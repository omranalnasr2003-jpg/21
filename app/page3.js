'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { LANG } from '../lib/i18n'
import { CardFace, CardBack } from '../components/Card'
import { initGameState, applyPlayCard } from '../lib/gameLogic'

function genCode() { return Math.random().toString(36).slice(2,7).toUpperCase() }

export default function Home() {
  const [screen, setScreen] = useState('lobby')
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [roomId, setRoomId] = useState(null)
  const [myIdx, setMyIdx] = useState(0)
  const [gs, setGs] = useState(null)

  const channelRef = useRef(null)

  // 🔥 REALTIME SUBSCRIBE (wichtig für beide Spieler)
  const subscribeRoom = (id) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)

    channelRef.current = supabase
      .channel('room-' + id)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${id}`
      }, (payload) => {
        const data = payload.new
        setGs(data.game_state) // 🔥 beide sehen alles live
      })
      .subscribe()
  }

  // ✅ CREATE (nur 1 Name)
  const createGame = async () => {
    const code = genCode()

    const players = [name, null]

    const gs = initGameState(players, false)

    const { data } = await supabase.from('rooms').insert({
      code,
      player_names: players,
      max_players: 2,
      game_state: gs,
      status: 'waiting'
    }).select().single()

    setRoomId(data.id)
    setRoomCode(code)
    setMyIdx(0)
    setGs(gs)
    subscribeRoom(data.id)
    setScreen('game')
  }

  // ✅ JOIN
  const joinGame = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', roomCode)
      .single()

    let players = data.player_names
    let idx = players.findIndex(p => !p)

    players[idx] = name

    await supabase.from('rooms').update({ player_names: players }).eq('id', data.id)

    setRoomId(data.id)
    setMyIdx(idx)
    setGs(data.game_state)
    subscribeRoom(data.id)
    setScreen('game')
  }

  // ✅ PLAY (wird an alle gesendet)
  const playCard = async (card) => {
    const newGs = applyPlayCard(gs, myIdx, card, [])

    await supabase
      .from('rooms')
      .update({ game_state: newGs })
      .eq('id', roomId)

    setGs(newGs)
  }

  if (screen === 'lobby') {
    return (
      <div style={{ padding: 20 }}>
        <h2>Dein Name</h2>
        <input value={name} onChange={e => setName(e.target.value)} />

        <button onClick={createGame}>Spiel erstellen</button>

        <h3>Beitreten</h3>
        <input placeholder="Code" value={roomCode} onChange={e => setRoomCode(e.target.value)} />
        <button onClick={joinGame}>Join</button>
      </div>
    )
  }

  if (!gs) return null

  return (
    <div style={{ padding: 20 }}>
      <h2>Spiel läuft</h2>

      <div>
        <h3>Tisch</h3>
        {gs.table.map(c => (
          <CardFace key={c.id} card={c} />
        ))}
      </div>

      <div>
        <h3>Deine Karten</h3>
        {gs.hands[myIdx].map(c => (
          <div key={c.id} onClick={() => playCard(c)}>
            <CardFace card={c} />
          </div>
        ))}
      </div>
    </div>
  )
}