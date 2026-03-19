'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { LANG } from '../lib/i18n'
import { CardFace, CardBack, DragGhost } from '../components/Card'
import { isFace, isJack, findCombosIncludingCard, initGameState, applyPlayCard, calcRoundPts } from '../lib/gameLogic'

// ─── TOKENS ──────────────────────────────────────────────────────────────────
const C = {
  bg:'#0f1923', surface:'#1a2535', surface2:'#212f42',
  border:'#2a3d55', borderHi:'#3a5270',
  gold:'#d4a843', goldLt:'#f0c96a',
  green:'#1e8a5e', greenLt:'#28c47e',
  blue:'#1e5aaa', blueLt:'#5a9ae0',
  red:'#b02020', redLt:'#e05252',
  text:'#ddeeff', textSub:'#8aaccc', textMuted:'#4a6580',
}

function genCode() { return Math.random().toString(36).slice(2,7).toUpperCase() }

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, variant='gold', small }) {
  const styles = {
    gold:    { background:`linear-gradient(135deg,${C.gold},#a07820)`, color:'#0a1205', border:'none' },
    outline: { background:'transparent', color:C.textSub, border:`1px solid ${C.border}` },
    green:   { background:`linear-gradient(135deg,${C.green},#166040)`, color:'#e0fff0', border:'none' },
    danger:  { background:'linear-gradient(135deg,#8b2020,#5a1010)', color:'#fecaca', border:'none' },
    blue:    { background:`linear-gradient(135deg,${C.blue},#123a70)`, color:'#d0e8ff', border:'none' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant],
      padding: small ? '8px 18px' : '12px 24px',
      borderRadius:10, fontWeight:700, fontSize: small ? 13 : 15,
      cursor: disabled ? 'not-allowed' : 'pointer',
      width:'100%', fontFamily:'inherit', letterSpacing:'.4px',
      opacity: disabled ? .45 : 1, transition:'opacity .2s',
    }}>{children}</button>
  )
}

function Input({ value, onChange, placeholder, style={} }) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder} style={{
      display:'block', width:'100%', padding:'11px 14px', borderRadius:9,
      border:`1px solid ${C.border}`, background:'rgba(15,25,40,.9)', color:C.text,
      fontSize:15, outline:'none', fontFamily:'inherit', marginBottom:10,
      ...style,
    }}/>
  )
}

function Tag({ children, color=C.gold }) {
  return <span style={{ background:`${color}22`, border:`1px solid ${color}55`, color, borderRadius:6, padding:'2px 8px', fontSize:10, letterSpacing:1, fontFamily:"'Cinzel',serif" }}>{children}</span>
}

function LangBar({ lang, setLang }) {
  return (
    <div style={{ position:'fixed', top:14, right:14, display:'flex', gap:5, zIndex:200 }}>
      {Object.keys(LANG).map(l => (
        <button key={l} onClick={() => setLang(l)} style={{
          padding:'3px 9px', borderRadius:6,
          border: l===lang ? `1px solid ${C.gold}` : `1px solid ${C.border}`,
          background: l===lang ? `rgba(212,168,67,.15)` : 'transparent',
          color: l===lang ? C.gold : C.textMuted, fontSize:10, cursor:'pointer', letterSpacing:1,
        }}>{l.toUpperCase()}</button>
      ))}
    </div>
  )
}

// ─── RULES MODAL ─────────────────────────────────────────────────────────────
function RulesModal({ onClose }) {
  const rules = [
    { t:'Kartenwerte', items:['2–10: Zahlenwert','J, Q, K: 10 Punkte','As (A): 1 Punkt'] },
    { t:'Elferkombinationen', items:['Karten die zusammen 11 ergeben können genommen werden','Beispiele: 5+6 · 9+2 · 3+3+5 · 10+A','Mehrere Karten gleichzeitig möglich'] },
    { t:'Bube (J)', items:['Nimmt ALLE Karten vom Tisch außer Dame und König','Andere Buben auf dem Tisch werden ebenfalls genommen'] },
    { t:'Dame (Q) & König (K)', items:['Dame nimmt eine andere Dame vom Tisch','König nimmt einen anderen König vom Tisch'] },
    { t:'Rundenende', items:['Verbleibende Tischkarten → letzter Sammler bekommt sie','Meiste Karten: +2 · Meiste ♣: +1 · 2♣: +1 · 10♦: +1','Spiel endet bei 21 Punkten'] },
    { t:'Team-Modus (2v2)', items:['Spieler 1+3 bilden Team A · Spieler 2+4 Team B','Punkte werden im Team addiert'] },
  ]
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:16 }}>
      <div style={{ background:C.surface, borderRadius:18, padding:'28px 26px', border:`1px solid ${C.borderHi}`, maxWidth:460, width:'100%', maxHeight:'88vh', overflowY:'auto', animation:'fadeIn .3s ease-out' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <span style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:17, letterSpacing:2 }}>SPIELREGELN</span>
          <button onClick={onClose} style={{ background:'transparent', border:`1px solid ${C.border}`, borderRadius:7, color:C.textSub, cursor:'pointer', padding:'4px 12px', fontSize:13 }}>✕</button>
        </div>
        {rules.map(({ t, items }) => (
          <div key={t} style={{ marginBottom:18 }}>
            <div style={{ color:C.goldLt, fontSize:13, fontWeight:600, letterSpacing:1, marginBottom:8, fontFamily:"'Cinzel',serif" }}>{t}</div>
            {items.map(it => (
              <div key={it} style={{ display:'flex', gap:10, marginBottom:5 }}>
                <span style={{ color:C.gold, flexShrink:0 }}>›</span>
                <span style={{ color:C.text, fontSize:14, lineHeight:1.5 }}>{it}</span>
              </div>
            ))}
          </div>
        ))}
        <Btn onClick={onClose} small>Alles klar!</Btn>
      </div>
    </div>
  )
}

// ─── LOBBY ────────────────────────────────────────────────────────────────────
function Lobby({ onCreateGame, onJoinGame, t, lang, setLang }) {
  const [tab,      setTab]      = useState('home')
  const [myName,   setMyName]   = useState('')
  const [joinName, setJoinName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinErr,  setJoinErr]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [rules,    setRules]    = useState(false)

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 }}>
      <LangBar lang={lang} setLang={setLang}/>

      <div style={{ textAlign:'center', marginBottom:36 }}>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:90, fontWeight:900, lineHeight:1,
          background:`linear-gradient(135deg,${C.gold} 0%,${C.goldLt} 45%,${C.gold} 65%,#806018 100%)`,
          backgroundSize:'200% auto', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:-4 }}>21</div>
        <div style={{ color:C.textMuted, fontSize:11, letterSpacing:7, marginTop:4, fontFamily:"'Cinzel',serif" }}>DAS KARTENSPIEL</div>
      </div>

      <div style={{ width:'100%', maxWidth:360, background:C.surface, borderRadius:18, padding:24, border:`1px solid ${C.borderHi}` }}>

        {tab === 'home' && (
          <>
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              {['create','join'].map((id,i) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  flex:1, padding:'11px 0', borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer',
                  border:`1px solid ${C.border}`, background:'transparent', color:C.textSub,
                }}>{i===0 ? t.createGame : t.joinGame}</button>
              ))}
            </div>
            <button onClick={() => setRules(true)} style={{ width:'100%', padding:'9px', borderRadius:9, border:`1px solid ${C.border}`, background:'transparent', color:C.textMuted, fontSize:14, cursor:'pointer' }}>
              📖 Spielregeln
            </button>
          </>
        )}

        {tab === 'create' && (
          <>
            <button onClick={() => setTab('home')} style={{ background:'transparent', border:'none', color:C.textSub, cursor:'pointer', fontSize:13, marginBottom:18, padding:0 }}>← {t.back}</button>
            <div style={{ color:C.textMuted, fontSize:11, letterSpacing:3, marginBottom:10, fontFamily:"'Cinzel',serif" }}>DEIN NAME</div>
            <Input placeholder={t.enterName} value={myName} onChange={e => setMyName(e.target.value)}/>
            <div style={{ color:C.textMuted, fontSize:12, lineHeight:1.7, marginBottom:16, padding:'10px 12px', borderRadius:9, background:'rgba(212,168,67,.06)', border:`1px solid rgba(212,168,67,.15)` }}>
              Du erstellst einen Raum und bekommst einen Code.<br/>
              Teile den Code mit deinen Freunden — sie treten mit ihrem eigenen Namen bei.<br/>
              Du startest das Spiel wenn alle da sind.
            </div>
            <Btn onClick={() => onCreateGame(myName.trim() || t.player+' 1')}>{t.startGame}</Btn>
          </>
        )}

        {tab === 'join' && (
          <>
            <button onClick={() => setTab('home')} style={{ background:'transparent', border:'none', color:C.textSub, cursor:'pointer', fontSize:13, marginBottom:18, padding:0 }}>← {t.back}</button>
            <div style={{ color:C.textMuted, fontSize:11, letterSpacing:3, marginBottom:10, fontFamily:"'Cinzel',serif" }}>DEIN NAME & CODE</div>
            <Input placeholder={t.enterName} value={joinName} onChange={e => setJoinName(e.target.value)}/>
            <Input placeholder={t.gameCode} value={joinCode} onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinErr('') }}
              style={{ letterSpacing:5, fontSize:18, marginBottom: joinErr ? 4 : 16 }}/>
            {joinErr && <div style={{ color:C.redLt, fontSize:12, marginBottom:12 }}>{joinErr}</div>}
            <Btn disabled={loading} onClick={async () => {
              if (!joinName.trim()) { setJoinErr('Bitte Namen eingeben'); return }
              if (!joinCode.trim()) { setJoinErr('Bitte Code eingeben'); return }
              setLoading(true)
              await onJoinGame(joinName.trim(), joinCode.trim(), setJoinErr)
              setLoading(false)
            }}>{loading ? '…' : t.join}</Btn>
          </>
        )}
      </div>

      {rules && <RulesModal onClose={() => setRules(false)}/>}
      <div style={{ position:'fixed', bottom:14, left:16, color:C.textMuted, fontSize:10, fontFamily:"'Cinzel',serif", letterSpacing:1 }}>{t.dev}</div>
    </div>
  )
}

function WaitingRoom({ roomCode, playerNames, myIdx, maxPlayers, onStart, onLeave, t, isHost, teamMode }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(roomCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }

  const teamLabel = (i) => teamMode && maxPlayers === 4 ? ` · Team ${i%2===0?'A':'B'}` : ''

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:48, fontWeight:900, color:C.gold, lineHeight:1, marginBottom:28 }}>21</div>
      <div style={{ width:'100%', maxWidth:400, background:C.surface, borderRadius:18, padding:26, border:`1px solid ${C.borderHi}` }}>

        {/* Room code */}
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ color:C.textMuted, fontSize:11, letterSpacing:4, marginBottom:10, fontFamily:"'Cinzel',serif" }}>SPIELCODE TEILEN</div>
          <div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:44, fontWeight:900, letterSpacing:12, marginBottom:14, textShadow:`0 0 30px rgba(212,168,67,.35)` }}>{roomCode}</div>
          <button onClick={copy} style={{ padding:'7px 24px', borderRadius:8, border:`1px solid ${C.border}`, background:`rgba(212,168,67,.08)`, color:copied?C.greenLt:C.textSub, cursor:'pointer', fontSize:13 }}>
            {copied ? '✓ Kopiert!' : 'Code kopieren'}
          </button>
        </div>

        <div style={{ height:1, background:C.border, margin:'0 0 20px' }}/>

        {/* Players */}
        <div style={{ color:C.textMuted, fontSize:11, letterSpacing:3, marginBottom:12, fontFamily:"'Cinzel',serif" }}>
          SPIELER IM RAUM ({playerNames.length})
        </div>
        {playerNames.map((name, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10,
            background:'rgba(15,25,40,.8)',
            border: i===myIdx ? `1px solid ${C.greenLt}` : `1px solid ${C.border}`,
            marginBottom:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: i===myIdx ? C.greenLt : C.gold }}/>
            <span style={{ color:C.text, fontSize:14, flex:1 }}>{name}</span>
            {i===0 && <Tag color={C.gold}>HOST</Tag>}
            {i===myIdx && <Tag color={C.greenLt}>DU</Tag>}
          </div>
        ))}

        <div style={{ marginTop:18 }}>
          {isHost ? (
            <>
              {playerNames.length < 2 && (
                <div style={{ textAlign:'center', color:C.textMuted, fontSize:13, padding:'8px 0 12px', animation:'pulse 2s infinite' }}>
                  Warte auf Mitspieler…
                </div>
              )}
              <Btn variant="green" disabled={playerNames.length < 2} onClick={onStart}>
                Spiel starten ({playerNames.length} Spieler)
              </Btn>
            </>
          ) : (
            <div style={{ textAlign:'center', color:C.textSub, fontSize:13, padding:'10px 0' }}>
              Warte auf Host, das Spiel zu starten…
            </div>
          )}
          <div style={{ marginTop:10 }}>
            <Btn variant="outline" small onClick={onLeave}>{t.leaveGame}</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── COMBO PICKER ─────────────────────────────────────────────────────────────
function ComboPickerOverlay({ playedCard, combos, onPick, onSkip }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:150, padding:16 }}>
      <div style={{ background:C.surface, borderRadius:18, padding:24, border:`1.5px solid ${C.gold}`, maxWidth:400, width:'100%', maxHeight:'88vh', overflowY:'auto' }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:14, letterSpacing:1, marginBottom:6 }}>KOMBINATION WÄHLEN</div>
        <div style={{ color:C.textSub, fontSize:13, marginBottom:18 }}>Mehrere 11er möglich — welche Karten nimmst du?</div>
        {combos.map((combo, i) => (
          <button key={i} onClick={() => onPick(combo)} style={{
            display:'flex', gap:6, alignItems:'center', flexWrap:'wrap',
            width:'100%', background:`rgba(30,138,94,.1)`, border:`1px solid ${C.green}`,
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
          Nur legen (keine Kombination nehmen)
        </button>
      </div>
    </div>
  )
}

// ─── MOVE LOG ─────────────────────────────────────────────────────────────────
function MoveLog({ log, playerNames }) {
  const ref = useRef(null)
  useEffect(() => { if(ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [log])
  return (
    <div style={{ width:'100%', maxWidth:560, background:C.surface, borderRadius:12, border:`1px solid ${C.border}`, overflow:'hidden', marginBottom:6 }}>
      <div style={{ padding:'7px 12px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ color:C.textMuted, fontSize:10, letterSpacing:2, fontFamily:"'Cinzel',serif" }}>SPIELHISTORIE</span>
        <span style={{ color:C.textMuted, fontSize:10 }}>{log.length} Züge</span>
      </div>
      <div ref={ref} style={{ maxHeight:90, overflowY:'auto', padding:'5px 12px' }}>
        {log.length === 0 && <div style={{ color:C.textMuted, fontSize:12, padding:'4px 0' }}>Noch keine Züge</div>}
        {[...log].reverse().map((e, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'3px 0', borderBottom:`1px solid rgba(42,61,85,.5)`, animation: i===0?'slideIn .25s ease-out':undefined }}>
            <span style={{ color:e.pi===0?C.greenLt:C.blueLt, fontSize:10, minWidth:50, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:"'Cinzel',serif" }}>
              {playerNames[e.pi] || `S${e.pi+1}`}
            </span>
            <span style={{ color:C.gold, fontSize:13, fontWeight:700 }}>{e.card}</span>
            {e.took > 0
              ? <span style={{ color:C.textSub, fontSize:11 }}>+{e.took} Karten</span>
              : <span style={{ color:C.textMuted, fontSize:11 }}>gelegt</span>}
            {e.jack  && <Tag color={C.gold}>BUBE</Tag>}
            {e.combo && <Tag color={C.greenLt}>= 11</Tag>}
          </div>
        ))}
      </div>
    </div>
  )
}


// ─── GAME ─────────────────────────────────────────────────────────────────────
function Game({ gs, myIdx, onPlayCommit, t, onLeave, isSpectator }) {
  const { hands, table, collected, scores, currentPlayer, phase, playerNames, deck, teamMode } = gs
  const n = playerNames.length

  const [drag,          setDrag]          = useState(null)
  const [draggingId,    setDraggingId]    = useState(null)
  const [landingId,     setLandingId]     = useState(null)
  const [highlightIds,  setHighlightIds]  = useState([])
  const [collectingIds, setCollectingIds] = useState([])
  const [locked,        setLocked]        = useState(false)
  const [comboMenu,     setComboMenu]     = useState(null)
  const [showRules,     setShowRules]     = useState(false)
  const [moveLog,       setMoveLog]       = useState([])

  const tableRef  = useRef(null)
  const isMyTurn  = currentPlayer === myIdx && phase === 'playing' && !locked && !isSpectator

  const addLog = useCallback((pi, card, took, jack, combo) => {
    setMoveLog(l => [...l.slice(-29), { pi, card:`${card.rank}${card.suit}`, took, jack:!!jack, combo:!!combo }])
  }, [])

  // ── Drag ──────────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e, card) => {
    if (!isMyTurn) return
    e.preventDefault()
    const cx = e.clientX ?? e.touches?.[0]?.clientX
    const cy = e.clientY ?? e.touches?.[0]?.clientY
    setDrag({ card, x:cx, y:cy }); setDraggingId(card.id)
  }, [isMyTurn])

  useEffect(() => {
    if (!drag) return
    const move = e => { e.preventDefault(); const cx=e.clientX??e.touches?.[0]?.clientX, cy=e.clientY??e.touches?.[0]?.clientY; setDrag(d=>d?{...d,x:cx,y:cy}:null) }
    const end  = e => {
      if (!drag) return
      const cx=e.clientX??e.changedTouches?.[0]?.clientX??drag.x, cy=e.clientY??e.changedTouches?.[0]?.clientY??drag.y
      setDrag(null); setDraggingId(null)
      const tz = tableRef.current
      if (tz) { const r=tz.getBoundingClientRect(); if(cx>=r.left&&cx<=r.right&&cy>=r.top&&cy<=r.bottom){ initiatePlay(drag.card); return } }
      initiatePlay(drag.card)
    }
    window.addEventListener('mousemove',move); window.addEventListener('mouseup',end)
    window.addEventListener('touchmove',move,{passive:false}); window.addEventListener('touchend',end)
    return () => { window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',end); window.removeEventListener('touchmove',move); window.removeEventListener('touchend',end) }
  }, [drag])

  // ── Play pipeline ──────────────────────────────────────────────────────────
  const glow = useCallback((ids, delay, then) => {
    setHighlightIds(ids)
    setTimeout(() => { setHighlightIds([]); setCollectingIds(ids); setTimeout(() => { setCollectingIds([]); then() }, 450) }, delay)
  }, [])

  const initiatePlay = useCallback((card) => {
    if (!isMyTurn) return
    setLocked(true)
    const tw = [...table, card]

    if (isJack(card.rank)) {
      const ids = tw.filter(c=>c.rank!=='Q'&&c.rank!=='K').map(c=>c.id)
      setLandingId(card.id)
      setTimeout(() => { setLandingId(null); glow(ids, 950, () => { onPlayCommit(card,[]) }) }, 320)
      return
    }
    if (card.rank==='Q') {
      const other = tw.filter(c=>c.rank==='Q'&&c.id!==card.id)
      setLandingId(card.id)
      setTimeout(() => {
        setLandingId(null)
        if (other.length) glow([card.id,other[0].id], 900, () => { onPlayCommit(card,[]) })
        else { onPlayCommit(card,[]) }
      }, 320); return
    }
    if (card.rank==='K') {
      const other = tw.filter(c=>c.rank==='K'&&c.id!==card.id)
      setLandingId(card.id)
      setTimeout(() => {
        setLandingId(null)
        if (other.length) glow([card.id,other[0].id], 900, () => { onPlayCommit(card,[]) })
        else { onPlayCommit(card,[]) }
      }, 320); return
    }

    const combos = findCombosIncludingCard(card, tw)
    setLandingId(card.id)
    setTimeout(() => {
      setLandingId(null)
      if (!combos.length) { onPlayCommit(card,[]); return }
      if (combos.length===1) {
        const ids = [card.id,...combos[0].map(c=>c.id)]
        glow(ids, 1000, () => { onPlayCommit(card,combos[0]) })
        return
      }
      setComboMenu({card,combos}); setLocked(false)
    }, 340)
  }, [isMyTurn, table, myIdx, onPlayCommit, addLog, glow])

  const handlePick = useCallback((card, combo) => {
    setComboMenu(null); setLocked(true)
    const ids = [card.id,...combo.map(c=>c.id)]
    glow(ids, 900, () => { onPlayCommit(card,combo) })
  }, [myIdx, onPlayCommit, addLog, glow])

  // Animate remote moves
  useEffect(() => {
    if (!gs.lastAction || gs.lastAction.playerIdx===myIdx) return
    const { playerIdx, card, removedIds } = gs.lastAction
    if (!card) return
    addLog(playerIdx, card, removedIds?.length||0, isJack(card.rank), removedIds?.length>1&&!isJack(card.rank))
    if (removedIds?.length) {
      setHighlightIds(removedIds)
      setTimeout(() => { setHighlightIds([]); setCollectingIds(removedIds); setTimeout(() => setCollectingIds([]), 450) }, 800)
    }
  }, [gs.lastAction])

  const displayTable = comboMenu && !table.find(c=>c.id===comboMenu.card.id) ? [...table,comboMenu.card] : table

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 8px', overflowX:'hidden' }}>

      {/* Score bar */}
      <div style={{ display:'flex', gap:7, marginBottom:8, flexWrap:'wrap', justifyContent:'center', width:'100%', maxWidth:560, alignItems:'stretch' }}>
        {playerNames.map((name,i) => (
          <div key={i} style={{ textAlign:'center', padding:'6px 10px', borderRadius:10, flex:1, minWidth:60, maxWidth:110,
            background: i===currentPlayer ? `rgba(212,168,67,.12)` : `rgba(20,35,55,.8)`,
            border: i===currentPlayer ? `1.5px solid ${C.gold}` : `1px solid ${C.border}`, transition:'all .3s' }}>
            <div style={{ color:C.textMuted, fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {name}{teamMode&&n===4?` · T${i%2===0?'A':'B'}`:''}
            </div>
            <div style={{ color:C.gold, fontSize:22, fontWeight:900, lineHeight:1, fontFamily:"'Cinzel',serif" }}>{scores[i]}</div>
            {i===myIdx && <div style={{ color:C.greenLt, fontSize:8, letterSpacing:1 }}>DU</div>}
          </div>
        ))}
        <div style={{ display:'flex', flexDirection:'column', gap:5, justifyContent:'center' }}>
          <button onClick={() => setShowRules(true)} title="Regeln" style={{ padding:'6px 10px', borderRadius:7, border:`1px solid ${C.border}`, background:'transparent', color:C.textSub, fontSize:13, cursor:'pointer' }}>📖</button>
          <button onClick={onLeave} title="Verlassen" style={{ padding:'6px 10px', borderRadius:7, border:`1px solid ${C.border}`, background:'transparent', color:C.textSub, fontSize:13, cursor:'pointer' }}>✕</button>
        </div>
      </div>



      {/* Opponents */}
      {playerNames.slice(1).map((name,oi) => {
        const pi = oi+1
        return (
          <div key={pi} style={{ width:'100%', maxWidth:560, background:C.surface, borderRadius:12, padding:'8px 12px', marginBottom:6, border: pi===currentPlayer?`1.5px solid ${C.blueLt}`:`1px solid ${C.border}`, transition:'border .3s' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:pi===currentPlayer?C.blueLt:C.textMuted, transition:'background .3s' }}/>
                <span style={{ color:C.text, fontSize:13 }}>{name}</span>
                {pi===currentPlayer && <Tag color={C.blueLt}>AM ZUG</Tag>}
                {teamMode&&n===4 && <Tag color={pi%2===0?C.gold:C.blueLt}>{`Team ${pi%2===0?'A':'B'}`}</Tag>}
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
      <div ref={tableRef} style={{ width:'100%', maxWidth:560, background: drag?`rgba(30,138,94,.06)`:C.surface, borderRadius:14, padding:'10px 12px', marginBottom:6, border: drag?`1.5px dashed ${C.greenLt}`:`1px solid ${C.border}`, minHeight:130, position:'relative', transition:'border .2s, background .2s' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span style={{ color:C.textMuted, fontSize:10, letterSpacing:3, fontFamily:"'Cinzel',serif" }}>TISCH</span>
          {isMyTurn && !locked && <span style={{ color:C.textMuted, fontSize:9 }}>Karte anklicken oder hier ablegen</span>}
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:7, minHeight:84, alignItems:'flex-start' }}>
          {displayTable.length===0 && <div style={{ color:C.textMuted, fontSize:13, margin:'auto', alignSelf:'center' }}>Kein Karten auf dem Tisch</div>}
          {displayTable.map(c => (
            <div key={c.id} className="card-new">
              <CardFace card={c} disabled isHighlight={highlightIds.includes(c.id)} isCollecting={collectingIds.includes(c.id)} isLanding={landingId===c.id}/>
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
        {playerNames.map((name,i) => (
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
      <div style={{ width:'100%', maxWidth:560, background:C.surface, borderRadius:14, padding:'10px 12px', border: isMyTurn?`1.5px solid ${C.greenLt}`:`1px solid ${C.border}`, transition:'border .3s' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:isMyTurn?C.greenLt:C.textMuted, transition:'background .3s' }}/>
            <span style={{ color:C.text, fontSize:13 }}>{playerNames[myIdx]}</span>
            {teamMode&&n===4 && <Tag color={myIdx%2===0?C.gold:C.blueLt}>{`Team ${myIdx%2===0?'A':'B'}`}</Tag>}
          </div>
          <span style={{ color:isMyTurn?C.greenLt:comboMenu?C.gold:C.textMuted, fontSize:11 }}>
            {isMyTurn ? (drag?'Auf Tisch ziehen…':'Dein Zug') : comboMenu?'Kombination wählen ↓':'Warten…'}
          </span>
        </div>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
          {(hands[myIdx]||[]).map(c => (
            <CardFace key={c.id} card={c} isDragging={draggingId===c.id} disabled={!isMyTurn}
              onDragStart={isMyTurn ? (e=>handleDragStart(e,c)) : null}
              onClick={isMyTurn ? ()=>initiatePlay(c) : null}/>
          ))}
        </div>
      </div>

      {drag && <DragGhost card={drag.card} x={drag.x} y={drag.y}/>}
      {comboMenu && <ComboPickerOverlay playedCard={comboMenu.card} combos={comboMenu.combos} onPick={c=>handlePick(comboMenu.card,c)} onSkip={()=>{setComboMenu(null);onPlayCommit(comboMenu.card,[])}}/>}
      {showRules && <RulesModal onClose={()=>setShowRules(false)}/>}

      <div style={{ color:C.textMuted, fontSize:10, marginTop:10, fontFamily:"'Cinzel',serif", letterSpacing:1 }}>OMRAN & NYAZ</div>
    </div>
  )
}

// ─── ROUND RESULT ─────────────────────────────────────────────────────────────
function RoundResult({ result, newScores, collected, playerNames, teamMode, t, onNext, onRematch, gameOver, winner21 }) {
  const n = playerNames.length
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}>
      <div style={{ background:C.surface, borderRadius:22, padding:'28px 26px', border:`1.5px solid ${C.gold}`, maxWidth:440, width:'100%', animation:'fadeIn .35s ease-out', boxShadow:`0 0 60px rgba(212,168,67,.1)` }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:15, fontWeight:700, marginBottom:20, textAlign:'center', letterSpacing:3 }}>
          {gameOver ? '— GEWINNER —' : '— RUNDE VORBEI —'}
        </div>

        {result.lastCollector !== null && result.lastCollector !== undefined && (
          <div style={{ textAlign:'center', color:C.textSub, fontSize:12, marginBottom:14 }}>
            Restkarten gingen an <span style={{ color:C.text, fontWeight:600 }}>{playerNames[result.lastCollector]}</span>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(n,2)},1fr)`, gap:10, marginBottom:20 }}>
          {playerNames.map((name,i) => {
            const max = Math.max(...result.pts)
            return (
              <div key={i} style={{ background:'rgba(10,18,30,.8)', borderRadius:12, padding:'12px 14px', textAlign:'center', border:result.pts[i]===max?`1.5px solid ${C.gold}`:`1px solid ${C.border}` }}>
                <div style={{ color:C.textSub, fontSize:10, letterSpacing:1, marginBottom:4, fontFamily:"'Cinzel',serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {name}{teamMode&&n===4?` · T${i%2===0?'A':'B'}`:''}
                </div>
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
          {playerNames.map((name,i) => (
            <div key={i} style={{ textAlign:'center' }}>
              <div style={{ color:C.textMuted, fontSize:9, fontFamily:"'Cinzel',serif" }}>{name}</div>
              <div style={{ color:C.text, fontSize:20, fontWeight:700, fontFamily:"'Cinzel',serif" }}>
                {newScores[i]}<span style={{ color:C.textMuted, fontSize:11 }}>/21</span>
              </div>
            </div>
          ))}
        </div>

        {gameOver && (
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <div style={{ fontSize:44 }}>🏆</div>
            <div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:20, fontWeight:700, marginTop:8, letterSpacing:2 }}>
              {teamMode && n===4 ? `Team ${winner21%2===0?'A':'B'}` : playerNames[winner21]}
            </div>
            <div style={{ color:C.textSub, fontSize:13, marginTop:4 }}>gewinnt das Spiel!</div>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {gameOver ? (
            <>
              <Btn variant="gold" onClick={onRematch}>🔄 Rematch</Btn>
              <Btn variant="outline" onClick={onNext}>Hauptmenü</Btn>
            </>
          ) : (
            <Btn variant="gold" onClick={onNext}>{t.nextRound}</Btn>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [lang, setLang] = useState('de')
  const t = LANG[lang]

  const [screen,      setScreen]      = useState('lobby')
  const [roomCode,    setRoomCode]    = useState(null)
  const [roomId,      setRoomId]      = useState(null)
  const [myIdx,       setMyIdx]       = useState(0)
  const [isHost,      setIsHost]      = useState(false)
  const [isSpectator, setIsSpectator] = useState(false)
  const [gs,          setGs]          = useState(null)
  const [roundResult, setRoundResult] = useState(null)
  const [waitingNames,setWaitingNames]= useState([])
  const [maxPlayers,  setMaxPlayers]  = useState(2)
  const channelRef = useRef(null)
  const gsRef      = useRef(null)

  useEffect(() => { gsRef.current = gs }, [gs])

  const subscribeRoom = useCallback((rId) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel(`room:${rId}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'rooms', filter:`id=eq.${rId}` }, payload => {
        const data = payload.new
        // Update player list in waiting room
        if (data.player_names) setWaitingNames(data.player_names)
        if (data.game_state) {
          setGs(data.game_state)
          if (data.game_state.phase === 'roundover') doRoundResult(data.game_state)
        }
        if (data.status === 'playing') {
          if (data.game_state) setGs(data.game_state)
          setScreen('game')
        }
      }).subscribe()
  }, [screen])

  const doRoundResult = (newGs) => {
    const result    = calcRoundPts(newGs.collected, newGs.teamMode, newGs.playerNames.length)
    const newScores = newGs.scores.map((s,i) => s + result.pts[i])
    const winner21  = newScores.findIndex(s => s >= 21)
    result.lastCollector = newGs.lastCollector ?? null
    setRoundResult({ result, newScores, collected:newGs.collected, playerNames:newGs.playerNames, winner21, teamMode:newGs.teamMode })
  }

  const handleCreateGame = async (hostName) => {
    const code = genCode()
    // Start with just the host — others join via code
    // max_players = 4 (flexible), game starts when host clicks start
    const { data, error } = await supabase.from('rooms').insert({
      code,
      host_name: hostName,
      player_names: [hostName],
      max_players: 4,
      game_state: null,
      status: 'waiting',
    }).select().single()
    if (error||!data) { alert('Fehler: '+(error?.message||'')); return }
    setRoomCode(code); setRoomId(data.id); setMyIdx(0); setIsHost(true); setIsSpectator(false)
    setGs(null); subscribeRoom(data.id)
    setScreen('waiting')
  }

  const handleJoinGame = async (name, code, setError) => {
    const { data, error } = await supabase.from('rooms').select('*').eq('code', code.toUpperCase()).single()
    if (error || !data) { setError('Code nicht gefunden. Bitte prüfen.'); return }
    if (data.status === 'finished') { setError('Dieses Spiel ist bereits beendet.'); return }
    if (data.status === 'playing')  { setError('Das Spiel läuft bereits.'); return }

    const existing = data.player_names || []
    // Prevent joining with same name as existing player
    if (existing.includes(name)) { setError('Dieser Name ist bereits vergeben.'); return }

    const newNames = [...existing, name]
    const idx = newNames.length - 1
    const { error: err2 } = await supabase.from('rooms').update({ player_names: newNames }).eq('id', data.id)
    if (err2) { setError('Fehler beim Beitreten.'); return }
    setRoomCode(code.toUpperCase()); setRoomId(data.id); setMyIdx(idx); setIsHost(false); setIsSpectator(false)
    setGs(data.game_state); subscribeRoom(data.id); setScreen('waiting')
  }

  const handleStartGame = async () => {
    const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single()
    const names = data.player_names || []
    if (names.length < 2) { alert('Mindestens 2 Spieler werden benötigt.'); return }
    const newGs = initGameState(names, false)
    await supabase.from('rooms').update({ game_state: newGs, status: 'playing', max_players: names.length }).eq('id', roomId)
    setGs(newGs); setScreen('game')
  }

  const handlePlayCommit = useCallback(async (card, comboCards) => {
    const cur = gsRef.current
    if (!cur || cur.currentPlayer !== myIdx) return
    const newGs = applyPlayCard(cur, myIdx, card, comboCards)
    setGs(newGs)
    await supabase.from('rooms').update({ game_state:newGs }).eq('id',roomId)
    if (newGs.phase==='roundover') doRoundResult(newGs)
  }, [myIdx, roomId])

  const handleNextRound = async () => {
    if (!roundResult) return
    const { newScores, winner21 } = roundResult
    if (winner21 >= 0) {
      setScreen('lobby'); setRoundResult(null); setGs(null)
      if (roomId) await supabase.from('rooms').update({ status:'finished' }).eq('id',roomId)
      return
    }
    if (isHost) {
      const newGs = { ...initGameState(gs.playerNames, gs.teamMode), scores:newScores }
      await supabase.from('rooms').update({ game_state:newGs }).eq('id',roomId)
      setGs(newGs)
    }
    setRoundResult(null)
  }

  const handleRematch = async () => {
    if (!roundResult) return
    const newGs = initGameState(gs.playerNames, gs.teamMode)
    if (isHost) {
      await supabase.from('rooms').update({ game_state:newGs, status:'playing' }).eq('id',roomId)
      setGs(newGs)
    }
    setRoundResult(null)
  }

  const handleLeave = async () => {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    if (roomId && isHost) await supabase.from('rooms').update({ status:'finished' }).eq('id',roomId)
    setScreen('lobby'); setGs(null); setRoomCode(null); setRoundResult(null); setIsSpectator(false)
  }

  // Waiting room polling
  useEffect(() => {
    if (screen!=='waiting'||!roomId) return
    const poll = setInterval(async () => {
      const { data } = await supabase.from('rooms').select('player_names,max_players,status').eq('id',roomId).single()
      if (!data) return
      setWaitingNames(data.player_names||[])
      setMaxPlayers(data.max_players||2)
      if (data.status==='playing' && !isHost) {
        const { data:full } = await supabase.from('rooms').select('game_state').eq('id',roomId).single()
        if (full?.game_state) { setGs(full.game_state); setScreen('game') }
      }
    }, 1500)
    return () => clearInterval(poll)
  }, [screen, roomId, isHost])

  return (
    <>
      <LangBar lang={lang} setLang={setLang}/>
      {screen==='lobby'   && <Lobby onCreateGame={handleCreateGame} onJoinGame={handleJoinGame} t={t} lang={lang} setLang={setLang}/>}
      {screen==='waiting' && <WaitingRoom roomCode={roomCode} playerNames={waitingNames.length?waitingNames:(gs?.playerNames||[])} myIdx={myIdx} maxPlayers={maxPlayers} onStart={handleStartGame} onLeave={handleLeave} t={t} isHost={isHost} teamMode={gs?.teamMode}/>}
      {screen==='game' && gs && <Game gs={gs} myIdx={myIdx} onPlayCommit={handlePlayCommit} t={t} onLeave={handleLeave} isSpectator={isSpectator}/>}
      {roundResult && <RoundResult result={roundResult.result} newScores={roundResult.newScores} collected={roundResult.collected} playerNames={roundResult.playerNames} teamMode={roundResult.teamMode} t={t} onNext={handleNextRound} onRematch={handleRematch} gameOver={roundResult.winner21>=0} winner21={roundResult.winner21}/>}
    </>
  )
}
