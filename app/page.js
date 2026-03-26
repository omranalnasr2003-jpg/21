'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { LANG } from '../lib/i18n'
import { CardFace, CardBack, DragGhost } from '../components/Card'
import { isFace, isJack, findCombosIncludingCard, initGameState, applyPlayCard, calcRoundPts } from '../lib/gameLogic'

const C = {
  bg:'#0f1923', surface:'#1a2535', border:'#2a3d55', borderHi:'#3a5270',
  gold:'#d4a843', goldLt:'#f0c96a', green:'#1e8a5e', greenLt:'#28c47e',
  blue:'#1e5aaa', blueLt:'#5a9ae0', red:'#b02020', redLt:'#e05252',
  text:'#ddeeff', textSub:'#8aaccc', textMuted:'#4a6580',
}

function genCode() { return Math.random().toString(36).slice(2,7).toUpperCase() }

// ─── UI ───────────────────────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, variant='gold', small }) {
  const s = {
    gold:    { background:`linear-gradient(135deg,${C.gold},#a07820)`, color:'#0a1205', border:'none' },
    outline: { background:'transparent', color:C.textSub, border:`1px solid ${C.border}` },
    green:   { background:`linear-gradient(135deg,${C.green},#166040)`, color:'#e0fff0', border:'none' },
    blue:    { background:`linear-gradient(135deg,${C.blue},#123a70)`, color:'#d0e8ff', border:'none' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...s[variant], padding: small?'8px 18px':'12px 24px', borderRadius:10,
      fontWeight:700, fontSize:small?13:15, cursor:disabled?'not-allowed':'pointer',
      width:'100%', fontFamily:'inherit', opacity:disabled?.45:1,
    }}>{children}</button>
  )
}

function Inp({ value, onChange, placeholder, style={} }) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder} style={{
      display:'block', width:'100%', padding:'11px 14px', borderRadius:9,
      border:`1px solid ${C.border}`, background:'rgba(15,25,40,.9)', color:C.text,
      fontSize:15, outline:'none', fontFamily:'inherit', marginBottom:10, ...style,
    }}/>
  )
}

function LangBar({ lang, setLang }) {
  return (
    <div style={{ position:'fixed', top:14, right:14, display:'flex', gap:5, zIndex:200 }}>
      {Object.keys(LANG).map(l => (
        <button key={l} onClick={() => setLang(l)} style={{
          padding:'3px 9px', borderRadius:6,
          border: l===lang ? `1px solid ${C.gold}` : `1px solid ${C.border}`,
          background: l===lang ? `rgba(212,168,67,.15)` : 'transparent',
          color: l===lang ? C.gold : C.textMuted, fontSize:10, cursor:'pointer',
        }}>{l.toUpperCase()}</button>
      ))}
    </div>
  )
}

// ─── RULES ────────────────────────────────────────────────────────────────────
function RulesModal({ onClose }) {
  const rules = [
    ['Kartenwerte', '2–10: Zahlenwert · J/Q/K: 10 Punkte · As: 1 Punkt'],
    ['Elferkombinationen', 'Karten die zusammen 11 ergeben werden genommen (z.B. 5+6, 9+2, 3+3+5)'],
    ['Bube (J)', 'Nimmt ALLE Karten vom Tisch außer Dame und König — auch andere Buben!'],
    ['Dame (Q)', 'Nimmt eine andere Dame vom Tisch'],
    ['König (K)', 'Nimmt einen anderen König vom Tisch'],
    ['Rundenende', 'Restkarten → letzter Sammler · Meiste Karten +2 · Meiste ♣ +1 · 2♣ +1 · 10♦ +1'],
    ['Ziel', 'Erster mit 21 Punkten gewinnt'],
  ]
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:16 }}>
      <div style={{ background:C.surface, borderRadius:16, padding:26, border:`1px solid ${C.gold}`, maxWidth:420, width:'100%', maxHeight:'85vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <span style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:16, letterSpacing:2 }}>SPIELREGELN</span>
          <button onClick={onClose} style={{ background:'transparent', border:`1px solid ${C.border}`, borderRadius:6, color:C.textSub, cursor:'pointer', padding:'4px 12px', fontSize:13 }}>✕</button>
        </div>
        {rules.map(([t,d]) => (
          <div key={t} style={{ marginBottom:14 }}>
            <div style={{ color:C.goldLt, fontSize:13, fontWeight:600, marginBottom:5, fontFamily:"'Cinzel',serif" }}>{t}</div>
            <div style={{ color:C.text, fontSize:14, lineHeight:1.6 }}>› {d}</div>
          </div>
        ))}
        <div style={{ marginTop:8 }}><Btn small onClick={onClose}>Alles klar!</Btn></div>
      </div>
    </div>
  )
}

// ─── LOBBY ────────────────────────────────────────────────────────────────────
function Lobby({ onCreateGame, onJoinGame, t, lang, setLang }) {
  const [tab,      setTab]      = useState('home')
  const [myName,   setMyName]   = useState('')
  const [maxScore, setMaxScore] = useState(21)
  const [joinName, setJoinName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [err,      setErr]      = useState('')
  const [loading,  setLoading]  = useState(false)
  const [rules,    setRules]    = useState(false)

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 }}>
      <LangBar lang={lang} setLang={setLang}/>
      <div style={{ textAlign:'center', marginBottom:36 }}>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:88, fontWeight:900, lineHeight:1,
          background:`linear-gradient(135deg,${C.gold},${C.goldLt},${C.gold})`,
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:-4 }}>21</div>
        <div style={{ color:C.textMuted, fontSize:11, letterSpacing:7, marginTop:4, fontFamily:"'Cinzel',serif" }}>DAS KARTENSPIEL</div>
      </div>

      <div style={{ width:'100%', maxWidth:360, background:C.surface, borderRadius:18, padding:24, border:`1px solid ${C.borderHi}` }}>
        {tab === 'home' && (
          <>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <button onClick={() => setTab('create')} style={{ flex:1, padding:'11px 0', borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer', border:`1px solid ${C.border}`, background:'transparent', color:C.textSub }}>{t.createGame}</button>
              <button onClick={() => setTab('join')}   style={{ flex:1, padding:'11px 0', borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer', border:`1px solid ${C.border}`, background:'transparent', color:C.textSub }}>{t.joinGame}</button>
            </div>
            <button onClick={() => setRules(true)} style={{ width:'100%', padding:'9px', borderRadius:9, border:`1px solid ${C.border}`, background:'transparent', color:C.textMuted, fontSize:14, cursor:'pointer' }}>📖 Spielregeln</button>
          </>
        )}

        {tab === 'create' && (
          <>
            <button onClick={() => setTab('home')} style={{ background:'transparent', border:'none', color:C.textSub, cursor:'pointer', fontSize:13, marginBottom:16, padding:0 }}>← {t.back}</button>
            <div style={{ color:C.textMuted, fontSize:11, letterSpacing:3, marginBottom:8, fontFamily:"'Cinzel',serif" }}>DEIN NAME</div>
            <Inp placeholder={t.enterName} value={myName} onChange={e => setMyName(e.target.value)}/>
            <div style={{ color:C.textMuted, fontSize:11, letterSpacing:3, marginBottom:8, fontFamily:"'Cinzel',serif" }}>SPIELZIEL</div>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              {[11, 21].map(n => (
                <button key={n} onClick={() => setMaxScore(n)} style={{
                  flex:1, padding:'10px 0', borderRadius:9, fontSize:18, fontWeight:800, cursor:'pointer',
                  border: maxScore===n ? `2px solid ${C.gold}` : `1px solid ${C.border}`,
                  background: maxScore===n ? `rgba(212,168,67,.12)` : 'transparent',
                  color: maxScore===n ? C.gold : C.textSub,
                }}>{n} Pkt</button>
              ))}
            </div>
            <Btn onClick={() => { if(!myName.trim()){setErr('Bitte Namen eingeben');return}; onCreateGame(myName.trim(), maxScore) }}>{t.startGame}</Btn>
            {err && <div style={{ color:C.redLt, fontSize:12, marginTop:8 }}>{err}</div>}
          </>
        )}

        {tab === 'join' && (
          <>
            <button onClick={() => { setTab('home'); setErr('') }} style={{ background:'transparent', border:'none', color:C.textSub, cursor:'pointer', fontSize:13, marginBottom:16, padding:0 }}>← {t.back}</button>
            <div style={{ color:C.textMuted, fontSize:11, letterSpacing:3, marginBottom:8, fontFamily:"'Cinzel',serif" }}>NAME & CODE</div>
            <Inp placeholder={t.enterName} value={joinName} onChange={e => { setJoinName(e.target.value); setErr('') }}/>
            <Inp placeholder={t.gameCode} value={joinCode} onChange={e => { setJoinCode(e.target.value.toUpperCase()); setErr('') }} style={{ letterSpacing:5, fontSize:18, marginBottom: err?4:16 }}/>
            {err && <div style={{ color:C.redLt, fontSize:12, marginBottom:12 }}>{err}</div>}
            <Btn disabled={loading} onClick={async () => {
              if (!joinName.trim()) { setErr('Bitte Namen eingeben'); return }
              if (!joinCode.trim()) { setErr('Bitte Code eingeben'); return }
              setLoading(true)
              await onJoinGame(joinName.trim(), joinCode.trim(), setErr)
              setLoading(false)
            }}>{loading ? '…' : t.join}</Btn>
          </>
        )}
      </div>
      {rules && <RulesModal onClose={() => setRules(false)}/>}
      <div style={{ position:'fixed', bottom:14, left:16, color:C.textMuted, fontSize:10, fontFamily:"'Cinzel',serif", letterSpacing:1 }}>OMRAN & NYAZ</div>
    </div>
  )
}

// ─── WAITING ROOM ─────────────────────────────────────────────────────────────
function WaitingRoom({ roomCode, playerNames, myIdx, onStart, onLeave, t, isHost }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(roomCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }
  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:48, fontWeight:900, color:C.gold, lineHeight:1, marginBottom:28 }}>21</div>
      <div style={{ width:'100%', maxWidth:380, background:C.surface, borderRadius:18, padding:26, border:`1px solid ${C.borderHi}` }}>
        <div style={{ textAlign:'center', marginBottom:22 }}>
          <div style={{ color:C.textMuted, fontSize:11, letterSpacing:4, marginBottom:10, fontFamily:"'Cinzel',serif" }}>CODE TEILEN</div>
          <div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:44, fontWeight:900, letterSpacing:12, marginBottom:14 }}>{roomCode}</div>
          <button onClick={copy} style={{ padding:'6px 20px', borderRadius:8, border:`1px solid ${C.border}`, background:'transparent', color:copied?C.greenLt:C.textSub, cursor:'pointer', fontSize:13 }}>
            {copied ? '✓ Kopiert!' : 'Code kopieren'}
          </button>
        </div>
        <div style={{ height:1, background:C.border, margin:'0 0 18px' }}/>
        <div style={{ color:C.textMuted, fontSize:11, letterSpacing:2, marginBottom:12, fontFamily:"'Cinzel',serif" }}>
          SPIELER ({playerNames.length})
        </div>
        {playerNames.map((name, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, background:'rgba(15,25,40,.8)', border: i===myIdx?`1px solid ${C.greenLt}`:`1px solid ${C.border}`, marginBottom:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: i===0?C.gold:C.blueLt }}/>
            <span style={{ color:C.text, fontSize:14, flex:1 }}>{name}</span>
            {i===0 && <span style={{ color:C.gold, fontSize:10, fontFamily:"'Cinzel',serif" }}>HOST</span>}
            {i===myIdx && <span style={{ color:C.greenLt, fontSize:10, fontFamily:"'Cinzel',serif" }}>DU</span>}
          </div>
        ))}
        <div style={{ marginTop:16 }}>
          {isHost ? (
            <>
              {playerNames.length < 2 && <div style={{ textAlign:'center', color:C.textMuted, fontSize:13, padding:'8px 0 12px' }}>Warte auf Mitspieler…</div>}
              <Btn variant="green" disabled={playerNames.length < 2} onClick={onStart}>
                Spiel starten ({playerNames.length} Spieler)
              </Btn>
            </>
          ) : (
            <div style={{ textAlign:'center', color:C.textSub, fontSize:13, padding:'10px 0' }}>Warte auf Host…</div>
          )}
          <div style={{ marginTop:10 }}><Btn variant="outline" small onClick={onLeave}>{t.leaveGame}</Btn></div>
        </div>
      </div>
    </div>
  )
}

// ─── COMBO PICKER ─────────────────────────────────────────────────────────────
function ComboPicker({ playedCard, combos, onPick, onSkip }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.86)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:150, padding:16 }}>
      <div style={{ background:C.surface, borderRadius:18, padding:24, border:`1.5px solid ${C.gold}`, maxWidth:400, width:'100%', maxHeight:'88vh', overflowY:'auto' }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:14, letterSpacing:1, marginBottom:6 }}>KOMBINATION WÄHLEN</div>
        <div style={{ color:C.textSub, fontSize:13, marginBottom:18 }}>Mehrere 11er möglich — welche Karten nimmst du?</div>
        {combos.map((combo, i) => (
          <button key={i} onClick={() => onPick(combo)} style={{
            display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', width:'100%',
            background:`rgba(30,138,94,.1)`, border:`1px solid ${C.green}`,
            borderRadius:10, padding:'10px 14px', marginBottom:10, cursor:'pointer', fontFamily:'inherit',
          }}>
            <CardFace card={playedCard} small disabled/>
            {combo.map(cc => (
              <span key={cc.id} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ color:C.textMuted, fontSize:12 }}>+</span>
                <CardFace card={cc} small disabled/>
              </span>
            ))}
            <span style={{ color:C.greenLt, fontSize:14, marginLeft:'auto', fontWeight:700 }}>= 11 ✓</span>
          </button>
        ))}
        <button onClick={onSkip} style={{ width:'100%', background:'transparent', border:`1px solid ${C.border}`, borderRadius:10, padding:'9px', cursor:'pointer', color:C.textSub, fontSize:13, fontFamily:'inherit' }}>
          Nur legen (keine Kombination)
        </button>
      </div>
    </div>
  )
}

// ─── GAME ─────────────────────────────────────────────────────────────────────
function Game({ gs, myIdx, onPlayCommit, t, onLeave, pendingOpponent, onOpponentAnimDone }) {
  const { hands, table, collected, scores, currentPlayer, phase, playerNames, deck } = gs
  const n = playerNames.length

  // Animation state
  const [pendingCard,   setPendingCard]   = useState(null)
  const [glowIds,       setGlowIds]       = useState([])
  const [fadeIds,       setFadeIds]       = useState([])
  const [comboMenu,     setComboMenu]     = useState(null)
  const [showRules,     setShowRules]     = useState(false)
  const [frozenTable,   setFrozenTable]   = useState(null)
  const [opponentCard,  setOpponentCard]  = useState(null)
  const playingRef    = useRef(false)
  const animatingRef  = useRef(false)
  const tableRef      = useRef(table) // always current table

  const canPlay = currentPlayer === myIdx && phase === 'playing' && !playingRef.current && !comboMenu

  // Keep tableRef current
  useEffect(() => { tableRef.current = table }, [table])

  // Reset when it becomes my turn again
  useEffect(() => {
    if (currentPlayer === myIdx) {
      playingRef.current = false
      setPendingCard(null)
      setGlowIds([])
      setFadeIds([])
    }
  }, [currentPlayer, myIdx])

  // Opponent animation: freeze table → card appears → glow all → fade all → update gs
  useEffect(() => {
    if (!pendingOpponent) return
    const { card, removedIds, newGs } = pendingOpponent
    if (animatingRef.current) {
      // Already animating — just apply state immediately
      onOpponentAnimDone(newGs)
      return
    }
    animatingRef.current = true

    // Capture current table NOW (before any state updates)
    const snapTable = [...(tableRef.current || [])]

    // Step 1: show frozen table + played card appears on top
    const tableWithCard = card ? [...snapTable.filter(c => c.id !== card.id), card] : snapTable
    setFrozenTable(tableWithCard)

    // Step 2: glow all affected cards (played + taken from table)
    const toGlow = removedIds.length > 0 ? removedIds : (card ? [card.id] : [])
    setTimeout(() => {
      setGlowIds(toGlow)

      // Step 3: fade all together
      setTimeout(() => {
        setFadeIds(toGlow)
        setGlowIds([])

        // Step 4: cleanup and apply new gs
        setTimeout(() => {
          setFadeIds([])
          setFrozenTable(null)
          animatingRef.current = false
          onOpponentAnimDone(newGs)
        }, 400)
      }, 900)
    }, 600)
  }, [pendingOpponent])

  // ── Card click/tap ────────────────────────────────────────────────────────
  const handleCardClick = useCallback((card) => {
    if (!canPlay) return
    playingRef.current = true
    setPendingCard(card)

    const tableWith = [...table, card]

    // Determine what happens
    if (isJack(card.rank)) {
      const toGlow = tableWith.filter(c => c.rank !== 'Q' && c.rank !== 'K').map(c => c.id)
      // Step 1: card lands on table (500ms)
      setTimeout(() => {
        // Step 2: all affected cards glow together
        setGlowIds(toGlow)
        setTimeout(() => {
          // Step 3: all fade together
          setFadeIds(toGlow)
          setGlowIds([])
          setTimeout(() => {
            setFadeIds([])
            setPendingCard(null)
            onPlayCommit(card, [])
          }, 420)
        }, 900)
      }, 500)
      return
    }

    if (card.rank === 'Q') {
      const other = tableWith.filter(c => c.rank === 'Q' && c.id !== card.id)
      if (other.length) {
        const ids = [card.id, other[0].id]
        setTimeout(() => {
          setGlowIds(ids)
          setTimeout(() => { setFadeIds(ids); setGlowIds([]); setTimeout(() => { setFadeIds([]); setPendingCard(null); onPlayCommit(card, []) }, 420) }, 900)
        }, 500)
      } else {
        setTimeout(() => { setPendingCard(null); onPlayCommit(card, []) }, 500)
      }
      return
    }

    if (card.rank === 'K') {
      const other = tableWith.filter(c => c.rank === 'K' && c.id !== card.id)
      if (other.length) {
        const ids = [card.id, other[0].id]
        setTimeout(() => {
          setGlowIds(ids)
          setTimeout(() => { setFadeIds(ids); setGlowIds([]); setTimeout(() => { setFadeIds([]); setPendingCard(null); onPlayCommit(card, []) }, 420) }, 900)
        }, 500)
      } else {
        setTimeout(() => { setPendingCard(null); onPlayCommit(card, []) }, 500)
      }
      return
    }

    // Normal card — find combos
    const combos = findCombosIncludingCard(card, tableWith)

    if (combos.length === 0) {
      setTimeout(() => { setPendingCard(null); onPlayCommit(card, []) }, 300)
      return
    }

    if (combos.length === 1) {
      const ids = [card.id, ...combos[0].map(c => c.id)]
      setTimeout(() => {
        setGlowIds(ids)
        setTimeout(() => {
          setFadeIds(ids); setGlowIds([])
          setTimeout(() => { setFadeIds([]); setPendingCard(null); onPlayCommit(card, combos[0]) }, 420)
        }, 900)
      }, 500)
      return
    }

    // Multiple combos — show picker (keep locked via comboMenu)
    setComboMenu({ card, combos })
    playingRef.current = false  // allow interaction with picker
  }, [canPlay, table, onPlayCommit])

  const handlePick = useCallback((card, combo) => {
    playingRef.current = true
    setComboMenu(null)
    const ids = [card.id, ...combo.map(c => c.id)]
    setGlowIds(ids)
    setTimeout(() => {
      setFadeIds(ids); setGlowIds([])
      setTimeout(() => { setFadeIds([]); setPendingCard(null); onPlayCommit(card, combo) }, 420)
    }, 900)
  }, [onPlayCommit])

  // Table to display:
  // - During opponent animation: show frozenTable (before-state) 
  // - During own play: show current table + pending card
  const displayTable = (() => {
    if (frozenTable) return frozenTable  // frozen before-state during opponent anim
    const t = [...table]
    if (pendingCard && !t.find(c => c.id === pendingCard.id)) t.push(pendingCard)
    if (comboMenu?.card && !t.find(c => c.id === comboMenu.card.id)) t.push(comboMenu.card)
    return t
  })()

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 8px', overflowX:'hidden' }}>

      {/* Scores */}
      <div style={{ display:'flex', gap:7, marginBottom:8, flexWrap:'wrap', justifyContent:'center', width:'100%', maxWidth:560, alignItems:'stretch' }}>
        {playerNames.map((name, i) => (
          <div key={i} style={{ textAlign:'center', padding:'6px 10px', borderRadius:10, flex:1, minWidth:60, maxWidth:110,
            background: i===currentPlayer ? `rgba(212,168,67,.12)` : `rgba(20,35,55,.8)`,
            border: i===currentPlayer ? `1.5px solid ${C.gold}` : `1px solid ${C.border}`, transition:'all .3s' }}>
            <div style={{ color:C.textMuted, fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
            <div style={{ color:C.gold, fontSize:22, fontWeight:900, lineHeight:1, fontFamily:"'Cinzel',serif" }}>{scores[i]}<span style={{ color:C.textMuted, fontSize:9 }}>/{gs.maxScore||21}</span></div>
            {i===myIdx && <div style={{ color:C.greenLt, fontSize:8, letterSpacing:1 }}>DU</div>}
          </div>
        ))}
        <div style={{ display:'flex', flexDirection:'column', gap:5, justifyContent:'center' }}>
          <button onClick={() => setShowRules(true)} style={{ padding:'6px 10px', borderRadius:7, border:`1px solid ${C.border}`, background:'transparent', color:C.textSub, fontSize:13, cursor:'pointer' }}>📖</button>
          <button onClick={onLeave} style={{ padding:'6px 10px', borderRadius:7, border:`1px solid ${C.border}`, background:'transparent', color:C.textSub, fontSize:13, cursor:'pointer' }}>✕</button>
        </div>
      </div>

      {/* Opponents */}
      {playerNames.slice(1).map((name, oi) => {
        const pi = oi + 1
        return (
          <div key={pi} style={{ width:'100%', maxWidth:560, background:C.surface, borderRadius:12, padding:'8px 12px', marginBottom:6, border: pi===currentPlayer?`1.5px solid ${C.blueLt}`:`1px solid ${C.border}`, transition:'border .3s' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:pi===currentPlayer?C.blueLt:C.textMuted }}/>
                <span style={{ color:C.text, fontSize:13 }}>{name}</span>
                {pi===currentPlayer && <span style={{ color:C.blueLt, fontSize:9, fontFamily:"'Cinzel',serif", letterSpacing:1 }}>AM ZUG</span>}
              </div>
              <span style={{ color:C.textMuted, fontSize:11 }}>{(hands[pi]||[]).length} Karten · {collected[pi].length} ges.</span>
            </div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {(hands[pi]||[]).map(c => <CardBack key={c.id} small/>)}
            </div>
          </div>
        )
      })}

      {/* Table */}
      <div style={{ width:'100%', maxWidth:560, background:C.surface, borderRadius:14, padding:'10px 12px', marginBottom:6, border:`1px solid ${C.border}`, minHeight:130, position:'relative' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span style={{ color:C.textMuted, fontSize:10, letterSpacing:3, fontFamily:"'Cinzel',serif" }}>TISCH</span>
          {canPlay && <span style={{ color:C.textMuted, fontSize:9 }}>Karte antippen zum Spielen</span>}
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:7, minHeight:84, alignItems:'flex-start' }}>
          {displayTable.length === 0 && <div style={{ color:C.textMuted, fontSize:13, margin:'auto', alignSelf:'center' }}>—</div>}
          {displayTable.map(c => (
            <div key={c.id}>
              <CardFace card={c} disabled
                isHighlight={glowIds.includes(c.id)}
                isCollecting={fadeIds.includes(c.id)}
                isLanding={c.id === pendingCard?.id}
              />
            </div>
          ))}
        </div>
        <div style={{ position:'absolute', top:10, right:12, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
          <CardBack small/>
          <div style={{ color:C.textMuted, fontSize:11 }}>{deck.length}</div>
        </div>
      </div>

      {/* Collected */}
      <div style={{ display:'flex', gap:6, width:'100%', maxWidth:560, marginBottom:6 }}>
        {playerNames.map((name, i) => (
          <div key={i} style={{ flex:1, background:C.surface, borderRadius:9, padding:'6px 10px', border:`1px solid ${C.border}` }}>
            <div style={{ color:C.textMuted, fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
            <div style={{ color:C.textSub, fontSize:12 }}>
              {collected[i].length} 🃏 <span style={{ color:C.greenLt }}>{collected[i].filter(c=>c.suit==='♣').length}♣</span>
              {collected[i].some(c=>c.rank==='10'&&c.suit==='♦') && <span style={{ color:C.gold, fontSize:10 }}> 10♦</span>}
              {collected[i].some(c=>c.rank==='2'&&c.suit==='♣')  && <span style={{ color:C.greenLt, fontSize:10 }}> 2♣</span>}
            </div>
          </div>
        ))}
      </div>

      {/* My hand */}
      <div style={{ width:'100%', maxWidth:560, background:C.surface, borderRadius:14, padding:'10px 12px', border: canPlay?`1.5px solid ${C.greenLt}`:`1px solid ${C.border}`, transition:'border .3s' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:canPlay?C.greenLt:C.textMuted, transition:'background .3s' }}/>
            <span style={{ color:C.text, fontSize:13 }}>{playerNames[myIdx]}</span>
          </div>
          <span style={{ color:canPlay?C.greenLt:comboMenu?C.gold:C.textMuted, fontSize:11 }}>
            {canPlay ? 'Dein Zug — Karte antippen' : comboMenu ? 'Kombination wählen ↓' : 'Warten…'}
          </span>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {(hands[myIdx]||[]).map(c => (
            <div key={c.id} onClick={() => handleCardClick(c)} style={{ cursor: canPlay ? 'pointer' : 'default', transform: canPlay ? 'none' : 'none', transition:'transform .15s' }}>
              <CardFace card={c} disabled={!canPlay}/>
            </div>
          ))}
        </div>
      </div>

      {comboMenu && (
        <ComboPicker
          playedCard={comboMenu.card}
          combos={comboMenu.combos}
          onPick={combo => handlePick(comboMenu.card, combo)}
          onSkip={() => { setComboMenu(null); setPendingCard(null); setTimeout(() => { setPendingCard(comboMenu.card); onPlayCommit(comboMenu.card, []) }, 100) }}
        />
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)}/>}
      <div style={{ color:C.textMuted, fontSize:10, marginTop:10, fontFamily:"'Cinzel',serif", letterSpacing:1 }}>OMRAN & NYAZ</div>
    </div>
  )
}

// ─── ROUND RESULT ─────────────────────────────────────────────────────────────
function RoundResult({ result, newScores, collected, playerNames, t, onNext, onRematch, gameOver, winner21, maxScore }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}>
      <div style={{ background:C.surface, borderRadius:22, padding:'28px 26px', border:`1.5px solid ${C.gold}`, maxWidth:440, width:'100%' }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:15, fontWeight:700, marginBottom:20, textAlign:'center', letterSpacing:3 }}>
          {gameOver ? '— GEWINNER —' : '— RUNDE VORBEI —'}
        </div>
        {result.lastCollector !== null && result.lastCollector !== undefined && (
          <div style={{ textAlign:'center', color:C.textSub, fontSize:12, marginBottom:14 }}>
            Restkarten → <span style={{ color:C.text, fontWeight:600 }}>{playerNames[result.lastCollector]}</span>
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(playerNames.length,2)},1fr)`, gap:10, marginBottom:20 }}>
          {playerNames.map((name, i) => {
            const max = Math.max(...result.pts)
            return (
              <div key={i} style={{ background:'rgba(10,18,30,.8)', borderRadius:12, padding:'12px 14px', textAlign:'center', border:result.pts[i]===max?`1.5px solid ${C.gold}`:`1px solid ${C.border}` }}>
                <div style={{ color:C.textSub, fontSize:10, marginBottom:4, fontFamily:"'Cinzel',serif" }}>{name}</div>
                <div style={{ color:C.gold, fontSize:30, fontWeight:900, lineHeight:1, fontFamily:"'Cinzel',serif" }}>+{result.pts[i]}</div>
                <div style={{ color:C.textMuted, fontSize:10, marginTop:5, lineHeight:1.7 }}>
                  {result.counts[i]} Karten · {result.clubs[i]}♣
                  {collected[i]?.some(c=>c.rank==='10'&&c.suit==='♦') && ' · 10♦'}
                  {collected[i]?.some(c=>c.rank==='2'&&c.suit==='♣')  && ' · 2♣'}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ display:'flex', justifyContent:'center', gap:20, marginBottom:22, flexWrap:'wrap' }}>
          {playerNames.map((name, i) => (
            <div key={i} style={{ textAlign:'center' }}>
              <div style={{ color:C.textMuted, fontSize:9, fontFamily:"'Cinzel',serif" }}>{name}</div>
              <div style={{ color:C.text, fontSize:20, fontWeight:700, fontFamily:"'Cinzel',serif" }}>{newScores[i]}<span style={{ color:C.textMuted, fontSize:11 }}>/{maxScore||21}</span></div>
            </div>
          ))}
        </div>
        {gameOver && (
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <div style={{ fontSize:44 }}>🏆</div>
            <div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:20, fontWeight:700, marginTop:8, letterSpacing:2 }}>{playerNames[winner21]}</div>
            <div style={{ color:C.textSub, fontSize:13, marginTop:4 }}>gewinnt das Spiel!</div>
          </div>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {gameOver ? (
            <>
              <Btn onClick={onRematch}>🔄 Rematch</Btn>
              <Btn variant="outline" onClick={onNext}>Hauptmenü</Btn>
            </>
          ) : (
            <Btn onClick={onNext}>{t.nextRound}</Btn>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [lang,         setLang]         = useState('de')
  const t = LANG[lang]
  const [screen,       setScreen]       = useState('lobby')
  const [roomCode,     setRoomCode]     = useState(null)
  const [roomId,       setRoomId]       = useState(null)
  const [myIdx,        setMyIdx]        = useState(0)
  const [isHost,       setIsHost]       = useState(false)
  const [gs,           setGs]           = useState(null)
  const [waitingNames, setWaitingNames] = useState([])
  const [roundResult,  setRoundResult]  = useState(null)
  const [roomMaxScore, setRoomMaxScore] = useState(21)
  const channelRef  = useRef(null)
  const gsRef       = useRef(null)
  const myIdxRef    = useRef(0)
  const [pendingOpponent, setPendingOpponent] = useState(null)

  useEffect(() => { gsRef.current = gs }, [gs])
  useEffect(() => { myIdxRef.current = myIdx }, [myIdx])

  const doRoundResult = useCallback((newGs) => {
    const result    = calcRoundPts(newGs.collected, newGs.teamMode, newGs.playerNames.length)
    const newScores = newGs.scores.map((s, i) => s + result.pts[i])
    const maxScore  = newGs.maxScore || 21
    const winner21  = newScores.findIndex(s => s >= maxScore)
    result.lastCollector = newGs.lastCollector ?? null
    setRoundResult({ result, newScores, collected: newGs.collected, playerNames: newGs.playerNames, winner21, maxScore })
  }, [])

  const subscribeRoom = useCallback((rId) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel(`room:${rId}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'rooms', filter:`id=eq.${rId}` }, payload => {
        const data = payload.new
        if (data.player_names) setWaitingNames(data.player_names)
        if (data.status === 'playing' && data.game_state) {
          setGs(data.game_state)
          setScreen('game')
          return
        }
        if (data.game_state) {
          const newGs = data.game_state
          const action = newGs.lastAction
          // Animate for opponent moves (not own moves - own animation already runs locally)
          if (action && action.playerIdx !== myIdxRef.current) {
            setPendingOpponent({ card: action.card, removedIds: action.removedIds || [], newGs })
          } else {
            setGs(newGs)
            if (newGs.phase === 'roundover') doRoundResult(newGs)
          }
        }
      }).subscribe()
  }, [doRoundResult])

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async (hostName, maxScore = 21) => {
    const code = genCode()
    const { data, error } = await supabase.from('rooms').insert({
      code, host_name: hostName, player_names: [hostName],
      max_players: 4, game_state: null, status: 'waiting',
      max_score: maxScore,
    }).select().single()
    if (error || !data) { alert('Fehler: ' + (error?.message || '')); return }
    setRoomCode(code); setRoomId(data.id); setMyIdx(0); setIsHost(true)
    setWaitingNames([hostName]); setRoomMaxScore(maxScore)
    subscribeRoom(data.id)
    setScreen('waiting')
  }

  // ── Join ──────────────────────────────────────────────────────────────────
  const handleJoin = async (name, code, setErr) => {
    const { data, error } = await supabase.from('rooms').select('*').eq('code', code.toUpperCase()).single()
    if (error || !data) { setErr('Code nicht gefunden.'); return }
    if (data.status === 'finished') { setErr('Dieses Spiel ist bereits beendet.'); return }
    if (data.status === 'playing')  { setErr('Das Spiel läuft bereits.'); return }
    const existing = data.player_names || []
    if (existing.includes(name)) { setErr('Dieser Name ist bereits vergeben.'); return }
    const newNames = [...existing, name]
    const { error: err2 } = await supabase.from('rooms').update({ player_names: newNames }).eq('id', data.id)
    if (err2) { setErr('Fehler beim Beitreten.'); return }
    setRoomCode(code.toUpperCase()); setRoomId(data.id)
    setMyIdx(newNames.length - 1); setIsHost(false)
    setWaitingNames(newNames)
    subscribeRoom(data.id)
    setScreen('waiting')
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single()
    const names = data.player_names || []
    if (names.length < 2) { alert('Mindestens 2 Spieler benötigt.'); return }
    const maxScore = data.max_score || roomMaxScore || 21
    const newGs = { ...initGameState(names, false), maxScore }
    await supabase.from('rooms').update({ game_state: newGs, status: 'playing', max_players: names.length }).eq('id', roomId)
    setGs(newGs); setScreen('game')
  }

  // ── Play ──────────────────────────────────────────────────────────────────
  const handlePlayCommit = useCallback(async (card, comboCards) => {
    const cur = gsRef.current
    if (!cur || cur.currentPlayer !== myIdx) return
    const newGs = applyPlayCard(cur, myIdx, card, comboCards)
    setGs(newGs)
    await supabase.from('rooms').update({ game_state: newGs }).eq('id', roomId)
    if (newGs.phase === 'roundover') doRoundResult(newGs)
  }, [myIdx, roomId, doRoundResult])

  // ── Next round ────────────────────────────────────────────────────────────
  const handleNextRound = async () => {
    if (!roundResult) return
    const { newScores, winner21 } = roundResult
    if (winner21 >= 0) {
      setScreen('lobby'); setRoundResult(null); setGs(null)
      if (roomId) await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId)
      return
    }
    if (isHost) {
      const newGs = { ...initGameState(gs.playerNames, false), scores: newScores }
      await supabase.from('rooms').update({ game_state: newGs }).eq('id', roomId)
      setGs(newGs)
    }
    setRoundResult(null)
  }

  const handleRematch = async () => {
    if (!roundResult) return
    const newGs = initGameState(gs.playerNames, false)
    if (isHost) {
      await supabase.from('rooms').update({ game_state: newGs, status: 'playing' }).eq('id', roomId)
      setGs(newGs)
    }
    setRoundResult(null)
  }

  const handleLeave = async () => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    if (roomId && isHost) await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId)
    setScreen('lobby'); setGs(null); setRoomCode(null); setRoundResult(null)
  }

  // ── Polling for waiting room ──────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'waiting' || !roomId) return
    const poll = setInterval(async () => {
      const { data } = await supabase.from('rooms').select('player_names,status,game_state').eq('id', roomId).single()
      if (!data) return
      setWaitingNames(data.player_names || [])
      if (data.status === 'playing' && data.game_state && !isHost) {
        setGs(data.game_state); setScreen('game')
      }
    }, 1500)
    return () => clearInterval(poll)
  }, [screen, roomId, isHost])

  return (
    <>
      {screen === 'lobby'   && <Lobby onCreateGame={handleCreate} onJoinGame={handleJoin} t={t} lang={lang} setLang={setLang}/>}
      {screen === 'waiting' && <WaitingRoom roomCode={roomCode} playerNames={waitingNames} myIdx={myIdx} onStart={handleStart} onLeave={handleLeave} t={t} isHost={isHost}/>}
      {screen === 'game' && gs && <Game gs={gs} myIdx={myIdx} onPlayCommit={handlePlayCommit} t={t} onLeave={handleLeave} pendingOpponent={pendingOpponent} onOpponentAnimDone={(newGs) => { setPendingOpponent(null); setGs(newGs); if(newGs.phase==='roundover') doRoundResult(newGs) }}/>}
      {roundResult && (
        <RoundResult
          result={roundResult.result} newScores={roundResult.newScores}
          collected={roundResult.collected} playerNames={roundResult.playerNames}
          t={t} onNext={handleNextRound} onRematch={handleRematch}
          gameOver={roundResult.winner21 >= 0} winner21={roundResult.winner21}
          maxScore={roundResult.maxScore || 21}
        />
      )}
    </>
  )
}
