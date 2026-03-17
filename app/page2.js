'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { LANG } from '../lib/i18n'
import { CardFace, CardBack, DragGhost } from '../components/Card'
import { isFace, isJack, findCombosIncludingCard, initGameState, applyPlayCard, calcRoundPts } from '../lib/gameLogic'

function genCode() { return Math.random().toString(36).slice(2,7).toUpperCase() }

export default function Home() {
  const [lang, setLang] = useState('de')
  const t = LANG[lang]

  const [screen, setScreen] = useState('lobby')
  const [roomCode, setRoomCode] = useState(null)
  const [roomId, setRoomId] = useState(null)
  const [myIdx, setMyIdx] = useState(0)
  const [isHost, setIsHost] = useState(false)
  const [gs, setGs] = useState(null)

  const channelRef = useRef(null)
  const gsRef = useRef(null)

  useEffect(() => { gsRef.current = gs }, [gs])

  const subscribeRoom = useCallback((rId) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel(`room:${rId}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'rooms', filter:`id=eq.${rId}` }, payload => {
        const data = payload.new
        if (data.game_state) setGs(data.game_state)
        if (data.status === 'playing') setScreen('game')
      }).subscribe()
  }, [])

  // ✅ FIXED CREATE GAME
  const handleCreateGame = async (playerNames, numPlayers, teamMode) => {
    const code = genCode()

    const fullPlayers = [
      ...playerNames,
      ...Array(numPlayers - playerNames.length).fill(null)
    ]

    const initialGs = initGameState(fullPlayers, teamMode)

    const { data, error } = await supabase.from('rooms').insert({
      code,
      host_name: playerNames[0],
      player_names: fullPlayers,
      max_players: numPlayers,
      game_state: initialGs,
      status: 'waiting',
    }).select().single()

    if (error || !data) return

    setRoomCode(code)
    setRoomId(data.id)
    setMyIdx(0)
    setIsHost(true)
    setGs(initialGs)
    subscribeRoom(data.id)
    setScreen('waiting')
  }

  // ✅ FIXED JOIN GAME
  const handleJoinGame = async (name, code, setError) => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single()

    if (error || !data) {
      setError('Raum nicht gefunden.')
      return
    }

    let players = data.player_names || []

    let idx = players.findIndex(p => !p)

    if (idx === -1) {
      setError('Spiel ist voll!')
      return
    }

    players[idx] = name

    const { error: err2 } = await supabase
      .from('rooms')
      .update({
        player_names: players,
        status: players.filter(p => p !== null).length >= data.max_players ? 'ready' : 'waiting'
      })
      .eq('id', data.id)

    if (err2) {
      setError('Fehler beim Beitreten.')
      return
    }

    setRoomCode(code)
    setRoomId(data.id)
    setMyIdx(idx)
    setIsHost(false)

    setGs(data.game_state)
    subscribeRoom(data.id)
    setScreen('waiting')
  }

  return null
}
