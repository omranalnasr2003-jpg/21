'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { LANG } from '../lib/i18n'
import { CardFace, CardBack } from '../components/Card'
import { isJack, findCombosIncludingCard, initGameState, applyPlayCard, calcRoundPts } from '../lib/gameLogic'

const C = {
  bg:'#0f1923', surface:'#1a2535', border:'#2a3d55', borderHi:'#3a5270',
  gold:'#d4a843', goldLt:'#f0c96a', green:'#1e8a5e', greenLt:'#28c47e',
  blue:'#1e5aaa', blueLt:'#5a9ae0',
  text:'#ddeeff', textSub:'#8aaccc', textMuted:'#4a6580', redLt:'#e05252',
}

function genCode() { return Math.random().toString(36).slice(2,7).toUpperCase() }

// ─── UI ───────────────────────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, variant='gold', small }) {
  const s = {
    gold:    { background:`linear-gradient(135deg,${C.gold},#a07820)`, color:'#0a1205', border:'none' },
    outline: { background:'transparent', color:C.textSub, border:`1px solid ${C.border}` },
    green:   { background:`linear-gradient(135deg,${C.green},#166040)`, color:'#e0fff0', border:'none' },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...s[variant], padding:small?'8px 18px':'12px 24px', borderRadius:10,
      fontWeight:700, fontSize:small?13:15, cursor:disabled?'not-allowed':'pointer',
      width:'100%', fontFamily:'inherit', opacity:disabled?.45:1, marginBottom:0,
    }}>{children}</button>
  )
}

function Inp({ value, onChange, placeholder, style={} }) {
  return <input value={value} onChange={onChange} placeholder={placeholder} style={{
    display:'block', width:'100%', padding:'11px 14px', borderRadius:9,
    border:`1px solid ${C.border}`, background:'rgba(15,25,40,.9)', color:C.text,
    fontSize:15, outline:'none', fontFamily:'inherit', marginBottom:10, ...style,
  }}/>
}

function LangBar({ lang, setLang }) {
  return (
    <div style={{ position:'fixed', top:14, right:14, display:'flex', gap:5, zIndex:200 }}>
      {Object.keys(LANG).map(l => (
        <button key={l} onClick={()=>setLang(l)} style={{
          padding:'3px 9px', borderRadius:6,
          border:l===lang?`1px solid ${C.gold}`:`1px solid ${C.border}`,
          background:l===lang?`rgba(212,168,67,.15)`:'transparent',
          color:l===lang?C.gold:C.textMuted, fontSize:10, cursor:'pointer',
        }}>{l.toUpperCase()}</button>
      ))}
    </div>
  )
}

function RulesModal({ onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:16 }}>
      <div style={{ background:C.surface, borderRadius:16, padding:26, border:`1px solid ${C.gold}`, maxWidth:420, width:'100%', maxHeight:'85vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <span style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:16, letterSpacing:2 }}>SPIELREGELN</span>
          <button onClick={onClose} style={{ background:'transparent', border:`1px solid ${C.border}`, borderRadius:6, color:C.textSub, cursor:'pointer', padding:'4px 12px' }}>✕</button>
        </div>
        {[
          ['Kartenwerte','2–10: Zahlenwert · J/Q/K: 10 Punkte · As: 1 Punkt'],
          ['Elferkombinationen','Karten die zusammen 11 ergeben werden genommen (z.B. 5+6, 9+2, 3+3+5)'],
          ['Bube (J)','Nimmt ALLE Karten vom Tisch außer Dame und König'],
          ['Dame (Q)','Nimmt eine andere Dame · König nimmt einen anderen König'],
          ['Rundenende','Restkarten → letzter Sammler · Meiste Karten +2 · Meiste ♣ +1 · 2♣ +1 · 10♦ +1'],
          ['Ziel','Erster der das Punkteziel erreicht gewinnt'],
        ].map(([ti,d])=>(
          <div key={ti} style={{ marginBottom:13 }}>
            <div style={{ color:C.goldLt, fontSize:13, fontWeight:600, marginBottom:5, fontFamily:"'Cinzel',serif" }}>{ti}</div>
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
  const [tab,setTab]=useState('home')
  const [myName,setMyName]=useState('')
  const [maxScore,setMaxScore]=useState(21)
  const [joinName,setJoinName]=useState('')
  const [joinCode,setJoinCode]=useState('')
  const [err,setErr]=useState('')
  const [loading,setLoading]=useState(false)
  const [rules,setRules]=useState(false)

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
        {tab==='home' && (
          <>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <button onClick={()=>setTab('create')} style={{ flex:1, padding:'11px 0', borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer', border:`1px solid ${C.border}`, background:'transparent', color:C.textSub }}>{t.createGame}</button>
              <button onClick={()=>setTab('join')} style={{ flex:1, padding:'11px 0', borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer', border:`1px solid ${C.border}`, background:'transparent', color:C.textSub }}>{t.joinGame}</button>
            </div>
            <button onClick={()=>setRules(true)} style={{ width:'100%', padding:'9px', borderRadius:9, border:`1px solid ${C.border}`, background:'transparent', color:C.textMuted, fontSize:14, cursor:'pointer' }}>📖 Spielregeln</button>
          </>
        )}
        {tab==='create' && (
          <>
            <button onClick={()=>setTab('home')} style={{ background:'transparent', border:'none', color:C.textSub, cursor:'pointer', fontSize:13, marginBottom:16, padding:0 }}>← {t.back}</button>
            <div style={{ color:C.textMuted, fontSize:11, letterSpacing:3, marginBottom:8, fontFamily:"'Cinzel',serif" }}>DEIN NAME</div>
            <Inp placeholder={t.enterName} value={myName} onChange={e=>{setMyName(e.target.value);setErr('')}}/>
            <div style={{ color:C.textMuted, fontSize:11, letterSpacing:3, marginBottom:8, fontFamily:"'Cinzel',serif" }}>SPIELZIEL</div>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              {[11,21].map(n=>(
                <button key={n} onClick={()=>setMaxScore(n)} style={{
                  flex:1, padding:'10px 0', borderRadius:9, fontSize:18, fontWeight:800, cursor:'pointer',
                  border:maxScore===n?`2px solid ${C.gold}`:`1px solid ${C.border}`,
                  background:maxScore===n?`rgba(212,168,67,.12)`:'transparent',
                  color:maxScore===n?C.gold:C.textSub,
                }}>{n} Pkt</button>
              ))}
            </div>
            {err&&<div style={{ color:C.redLt, fontSize:12, marginBottom:8 }}>{err}</div>}
            <Btn onClick={()=>{if(!myName.trim()){setErr('Bitte Namen eingeben');return}; onCreateGame(myName.trim(),maxScore)}}>{t.startGame}</Btn>
          </>
        )}
        {tab==='join' && (
          <>
            <button onClick={()=>{setTab('home');setErr('')}} style={{ background:'transparent', border:'none', color:C.textSub, cursor:'pointer', fontSize:13, marginBottom:16, padding:0 }}>← {t.back}</button>
            <div style={{ color:C.textMuted, fontSize:11, letterSpacing:3, marginBottom:8, fontFamily:"'Cinzel',serif" }}>NAME & CODE</div>
            <Inp placeholder={t.enterName} value={joinName} onChange={e=>{setJoinName(e.target.value);setErr('')}}/>
            <Inp placeholder={t.gameCode} value={joinCode} onChange={e=>{setJoinCode(e.target.value.toUpperCase());setErr('')}} style={{ letterSpacing:5, fontSize:18, marginBottom:err?4:16 }}/>
            {err&&<div style={{ color:C.redLt, fontSize:12, marginBottom:12 }}>{err}</div>}
            <Btn disabled={loading} onClick={async()=>{
              if(!joinName.trim()){setErr('Bitte Namen eingeben');return}
              if(!joinCode.trim()){setErr('Bitte Code eingeben');return}
              setLoading(true); await onJoinGame(joinName.trim(),joinCode.trim(),setErr); setLoading(false)
            }}>{loading?'…':t.join}</Btn>
          </>
        )}
      </div>
      {rules&&<RulesModal onClose={()=>setRules(false)}/>}
      <div style={{ position:'fixed', bottom:14, left:16, color:C.textMuted, fontSize:10, fontFamily:"'Cinzel',serif", letterSpacing:1 }}>OMRAN & NYAZ</div>
    </div>
  )
}

// ─── WAITING ROOM ─────────────────────────────────────────────────────────────
function WaitingRoom({ roomCode, playerNames, myIdx, onStart, onLeave, t, isHost }) {
  const [copied,setCopied]=useState(false)
  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:48, fontWeight:900, color:C.gold, marginBottom:28 }}>21</div>
      <div style={{ width:'100%', maxWidth:380, background:C.surface, borderRadius:18, padding:26, border:`1px solid ${C.borderHi}` }}>
        <div style={{ textAlign:'center', marginBottom:22 }}>
          <div style={{ color:C.textMuted, fontSize:11, letterSpacing:4, marginBottom:10, fontFamily:"'Cinzel',serif" }}>CODE TEILEN</div>
          <div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:44, fontWeight:900, letterSpacing:12, marginBottom:14 }}>{roomCode}</div>
          <button onClick={()=>{navigator.clipboard.writeText(roomCode).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)})}} style={{ padding:'6px 20px', borderRadius:8, border:`1px solid ${C.border}`, background:'transparent', color:copied?C.greenLt:C.textSub, cursor:'pointer', fontSize:13 }}>{copied?'✓ Kopiert!':'Code kopieren'}</button>
        </div>
        <div style={{ height:1, background:C.border, margin:'0 0 18px' }}/>
        <div style={{ color:C.textMuted, fontSize:11, letterSpacing:2, marginBottom:12, fontFamily:"'Cinzel',serif" }}>SPIELER ({playerNames.length})</div>
        {playerNames.map((name,i)=>(
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, background:'rgba(15,25,40,.8)', border:i===myIdx?`1px solid ${C.greenLt}`:`1px solid ${C.border}`, marginBottom:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:i===0?C.gold:C.blueLt }}/>
            <span style={{ color:C.text, fontSize:14, flex:1 }}>{name}</span>
            {i===0&&<span style={{ color:C.gold, fontSize:10, fontFamily:"'Cinzel',serif" }}>HOST</span>}
            {i===myIdx&&<span style={{ color:C.greenLt, fontSize:10, fontFamily:"'Cinzel',serif" }}>DU</span>}
          </div>
        ))}
        <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:10 }}>
          {isHost?(
            <Btn variant="green" disabled={playerNames.length<2} onClick={onStart}>Spiel starten ({playerNames.length} Spieler)</Btn>
          ):(
            <div style={{ textAlign:'center', color:C.textSub, fontSize:13, padding:'10px 0' }}>Warte auf Host…</div>
          )}
          <Btn variant="outline" small onClick={onLeave}>{t.leaveGame}</Btn>
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
        <div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:14, marginBottom:6 }}>KOMBINATION WÄHLEN</div>
        <div style={{ color:C.textSub, fontSize:13, marginBottom:18 }}>Mehrere 11er — welche nimmst du?</div>
        {combos.map((combo,i)=>(
          <button key={i} onClick={()=>onPick(combo)} style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', width:'100%', background:`rgba(30,138,94,.1)`, border:`1px solid ${C.green}`, borderRadius:10, padding:'10px 14px', marginBottom:10, cursor:'pointer', fontFamily:'inherit' }}>
            <CardFace card={playedCard} small disabled/>
            {combo.map(cc=>(
              <span key={cc.id} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ color:C.textMuted, fontSize:12 }}>+</span>
                <CardFace card={cc} small disabled/>
              </span>
            ))}
            <span style={{ color:C.greenLt, fontSize:14, marginLeft:'auto', fontWeight:700 }}>= 11 ✓</span>
          </button>
        ))}
        <button onClick={onSkip} style={{ width:'100%', background:'transparent', border:`1px solid ${C.border}`, borderRadius:10, padding:'9px', cursor:'pointer', color:C.textSub, fontSize:13, fontFamily:'inherit' }}>Nur legen</button>
      </div>
    </div>
  )
}

// ─── CARD DISPLAY ─────────────────────────────────────────────────────────────
function Card({ card, glow, fade, onClick, disabled, small }) {
  const red = card.suit==='♥'||card.suit==='♦'
  const w=small?44:62, h=small?64:90
  const tc = glow ? (red?'#fca5a5':'#6ee7b7') : (red?'#991b1b':'#1e293b')
  return (
    <div onClick={disabled?undefined:onClick} style={{
      width:w, height:h, borderRadius:8, flexShrink:0,
      background: glow?'linear-gradient(150deg,#052010,#031208)':'linear-gradient(150deg,#fff,#f5ede0)',
      border: `1.5px solid ${glow?'#34d399':'#c8b898'}`,
      boxShadow: glow
        ? '0 0 0 3px rgba(52,211,153,.4),0 4px 20px rgba(52,211,153,.25)'
        : '0 3px 12px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.9)',
      cursor: disabled?'default':'pointer',
      display:'flex', flexDirection:'column', justifyContent:'space-between',
      padding:'4px 6px', userSelect:'none', position:'relative', overflow:'hidden',
      opacity: fade?0:1,
      transform: fade?'scale(0.25) translateY(-25px)':'scale(1)',
      transition: fade?'opacity 0.38s ease-in, transform 0.38s ease-in':'none',
    }}>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(255,255,255,.15) 0%,transparent 50%)', pointerEvents:'none', borderRadius:7 }}/>
      <div style={{ fontSize:small?10:15, fontWeight:700, color:tc, lineHeight:1.1, position:'relative' }}>{card.rank}<br/><span style={{ fontSize:small?9:12 }}>{card.suit}</span></div>
      <div style={{ fontSize:small?10:15, fontWeight:700, color:tc, lineHeight:1.1, alignSelf:'flex-end', transform:'rotate(180deg)', position:'relative' }}>{card.rank}<br/><span style={{ fontSize:small?9:12 }}>{card.suit}</span></div>
    </div>
  )
}

function CardBack({ small }) {
  const w=small?44:62, h=small?64:90
  return (
    <div style={{ width:w, height:h, borderRadius:8, flexShrink:0, background:'linear-gradient(145deg,#1e3a5f,#0f1e35)', border:'1.5px solid #2a4a7f', boxShadow:'0 3px 10px rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:w-10, height:h-10, borderRadius:5, border:'1px solid #1a2d50', background:'repeating-linear-gradient(45deg,#162840,#162840 3px,#0c1828 3px,#0c1828 6px)' }}/>
    </div>
  )
}

// ─── GAME ─────────────────────────────────────────────────────────────────────
// Animation phases:
// 'idle'    → normal, waiting for input
// 'landing' → card just played, sitting on table (500ms)
// 'glowing' → affected cards glow green (900ms)
// 'fading'  → cards fade out (400ms)
function Game({ gs, pendingGs, onAnimDone, myIdx, onPlayCommit, t, onLeave }) {
  const { hands, table, collected, scores, currentPlayer, phase, playerNames, deck } = gs

  const [animPhase, setAnimPhase]   = useState('idle')
  const [animTable, setAnimTable]   = useState([])   // table shown during animation
  const [glowIds,   setGlowIds]     = useState([])
  const [fadeIds,   setFadeIds]     = useState([])
  const [comboMenu, setComboMenu]   = useState(null)
  const [showRules, setShowRules]   = useState(false)
  const busyRef = useRef(false)

  // ── Opponent animation ─────────────────────────────────────────────────────
  // pendingGs arrives → we show animation using tableBeforePlay from lastAction
  // THEN call onAnimDone() which applies pendingGs as the real gs
  useEffect(() => {
    if (!pendingGs) return
    const action = pendingGs.lastAction
    if (!action?.card) { onAnimDone(); return }

    const { card, removedIds, tableBeforePlay } = action
    const toGlow = removedIds?.length > 0 ? removedIds : [card.id]

    // Build the "before" table: old table + played card on top
    const beforeTable = [...(tableBeforePlay || []), card]

    // Phase 1: show card landing on table (500ms)
    setAnimPhase('landing')
    setAnimTable(beforeTable)
    setGlowIds([])
    setFadeIds([])

    // Phase 2: glow all affected cards (900ms)
    setTimeout(() => {
      setAnimPhase('glowing')
      setGlowIds(toGlow)

      // Phase 3: fade all together (400ms)
      setTimeout(() => {
        setAnimPhase('fading')
        setFadeIds(toGlow)
        setGlowIds([])

        // Phase 4: done — apply new gs
        setTimeout(() => {
          setAnimPhase('idle')
          setAnimTable([])
          setFadeIds([])
          onAnimDone()
        }, 400)
      }, 900)
    }, 500)
  }, [pendingGs])

  // Reset on my turn
  useEffect(() => {
    if (currentPlayer === myIdx) {
      busyRef.current = false
      setAnimPhase('idle')
      setAnimTable([])
      setGlowIds([])
      setFadeIds([])
    }
  }, [currentPlayer, myIdx])

  const canPlay = currentPlayer === myIdx && phase === 'playing'
    && !busyRef.current && !comboMenu && animPhase === 'idle'

  // ── Own card animation ─────────────────────────────────────────────────────
  const playAnim = useCallback((tableWithCard, toGlow, card, combo) => {
    setAnimPhase('landing')
    setAnimTable(tableWithCard)

    setTimeout(() => {
      setAnimPhase('glowing')
      setGlowIds(toGlow)

      setTimeout(() => {
        setAnimPhase('fading')
        setFadeIds(toGlow)
        setGlowIds([])

        setTimeout(() => {
          setAnimPhase('idle')
          setAnimTable([])
          setFadeIds([])
          onPlayCommit(card, combo)
        }, 400)
      }, 900)
    }, 500)
  }, [onPlayCommit])

  const handleCardClick = useCallback((card) => {
    if (!canPlay) return
    busyRef.current = true
    const tw = [...table, card]

    if (isJack(card.rank)) {
      const ids = tw.filter(c=>c.rank!=='Q'&&c.rank!=='K').map(c=>c.id)
      playAnim(tw, ids.length>0?ids:[card.id], card, [])
      return
    }
    if (card.rank==='Q') {
      const other = tw.filter(c=>c.rank==='Q'&&c.id!==card.id)
      if (other.length) { playAnim(tw, [card.id,other[0].id], card, []); return }
      setAnimTable(tw); setTimeout(()=>{ setAnimTable([]); onPlayCommit(card,[]) }, 400); return
    }
    if (card.rank==='K') {
      const other = tw.filter(c=>c.rank==='K'&&c.id!==card.id)
      if (other.length) { playAnim(tw, [card.id,other[0].id], card, []); return }
      setAnimTable(tw); setTimeout(()=>{ setAnimTable([]); onPlayCommit(card,[]) }, 400); return
    }
    const combos = findCombosIncludingCard(card, tw)
    if (!combos.length) {
      setAnimTable(tw); setTimeout(()=>{ setAnimTable([]); onPlayCommit(card,[]) }, 400); return
    }
    if (combos.length===1) {
      playAnim(tw, [card.id,...combos[0].map(c=>c.id)], card, combos[0]); return
    }
    busyRef.current = false
    setAnimTable(tw)
    setComboMenu({ card, combos })
  }, [canPlay, table, onPlayCommit, playAnim])

  const handlePick = useCallback((card, combo) => {
    busyRef.current = true
    setComboMenu(null)
    const tw = animTable.length > 0 ? animTable : [...table, card]
    playAnim(tw, [card.id,...combo.map(c=>c.id)], card, combo)
  }, [animTable, table, playAnim])

  // What to show on table
  const displayTable = animPhase !== 'idle' ? animTable : table

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 8px', overflowX:'hidden' }}>

      {/* Scores */}
      <div style={{ display:'flex', gap:7, marginBottom:8, flexWrap:'wrap', justifyContent:'center', width:'100%', maxWidth:560, alignItems:'stretch' }}>
        {playerNames.map((name,i)=>(
          <div key={i} style={{ textAlign:'center', padding:'6px 10px', borderRadius:10, flex:1, minWidth:60, maxWidth:110,
            background:i===currentPlayer?`rgba(212,168,67,.12)`:`rgba(20,35,55,.8)`,
            border:i===currentPlayer?`1.5px solid ${C.gold}`:`1px solid ${C.border}`, transition:'all .3s' }}>
            <div style={{ color:C.textMuted, fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
            <div style={{ color:C.gold, fontSize:22, fontWeight:900, lineHeight:1, fontFamily:"'Cinzel',serif" }}>{scores[i]}<span style={{ color:C.textMuted, fontSize:9 }}>/{gs.maxScore||21}</span></div>
            {i===myIdx&&<div style={{ color:C.greenLt, fontSize:8, letterSpacing:1 }}>DU</div>}
          </div>
        ))}
        <div style={{ display:'flex', flexDirection:'column', gap:5, justifyContent:'center' }}>
          <button onClick={()=>setShowRules(true)} style={{ padding:'6px 10px', borderRadius:7, border:`1px solid ${C.border}`, background:'transparent', color:C.textSub, fontSize:13, cursor:'pointer' }}>📖</button>
          <button onClick={onLeave} style={{ padding:'6px 10px', borderRadius:7, border:`1px solid ${C.border}`, background:'transparent', color:C.textSub, fontSize:13, cursor:'pointer' }}>✕</button>
        </div>
      </div>

      {/* Opponents */}
      {playerNames.slice(1).map((name,oi)=>{
        const pi=oi+1
        return (
          <div key={pi} style={{ width:'100%', maxWidth:560, background:C.surface, borderRadius:12, padding:'8px 12px', marginBottom:6, border:pi===currentPlayer?`1.5px solid ${C.blueLt}`:`1px solid ${C.border}`, transition:'border .3s' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:pi===currentPlayer?C.blueLt:C.textMuted }}/>
                <span style={{ color:C.text, fontSize:13 }}>{name}</span>
                {pi===currentPlayer&&<span style={{ color:C.blueLt, fontSize:9, fontFamily:"'Cinzel',serif", letterSpacing:1 }}>AM ZUG</span>}
              </div>
              <span style={{ color:C.textMuted, fontSize:11 }}>{(hands[pi]||[]).length} Karten · {collected[pi].length} ges.</span>
            </div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {(hands[pi]||[]).map((_,ci)=><CardBack key={ci} small/>)}
            </div>
          </div>
        )
      })}

      {/* Table */}
      <div style={{ width:'100%', maxWidth:560, background:C.surface, borderRadius:14, padding:'10px 12px', marginBottom:6, border:`1px solid ${C.border}`, minHeight:130, position:'relative' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <span style={{ color:C.textMuted, fontSize:10, letterSpacing:3, fontFamily:"'Cinzel',serif" }}>TISCH</span>
          {canPlay&&<span style={{ color:C.textMuted, fontSize:9 }}>Karte antippen ↓</span>}
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:7, minHeight:84, alignItems:'flex-start' }}>
          {displayTable.length===0&&<div style={{ color:C.textMuted, fontSize:13, margin:'auto', alignSelf:'center' }}>—</div>}
          {displayTable.map(c=>(
            <Card key={c.id} card={c} glow={glowIds.includes(c.id)} fade={fadeIds.includes(c.id)} disabled/>
          ))}
        </div>
        <div style={{ position:'absolute', top:10, right:12, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
          <CardBack small/>
          <div style={{ color:C.textMuted, fontSize:11 }}>{deck.length}</div>
        </div>
      </div>

      {/* Collected */}
      <div style={{ display:'flex', gap:6, width:'100%', maxWidth:560, marginBottom:6 }}>
        {playerNames.map((name,i)=>(
          <div key={i} style={{ flex:1, background:C.surface, borderRadius:9, padding:'6px 10px', border:`1px solid ${C.border}` }}>
            <div style={{ color:C.textMuted, fontSize:9, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
            <div style={{ color:C.textSub, fontSize:12 }}>
              {collected[i].length}🃏 <span style={{ color:C.greenLt }}>{collected[i].filter(c=>c.suit==='♣').length}♣</span>
              {collected[i].some(c=>c.rank==='10'&&c.suit==='♦')&&<span style={{ color:C.gold, fontSize:10 }}> 10♦</span>}
              {collected[i].some(c=>c.rank==='2'&&c.suit==='♣')&&<span style={{ color:C.greenLt, fontSize:10 }}> 2♣</span>}
            </div>
          </div>
        ))}
      </div>

      {/* My hand */}
      <div style={{ width:'100%', maxWidth:560, background:C.surface, borderRadius:14, padding:'10px 12px', border:canPlay?`1.5px solid ${C.greenLt}`:`1px solid ${C.border}`, transition:'border .3s' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:canPlay?C.greenLt:C.textMuted }}/>
            <span style={{ color:C.text, fontSize:13 }}>{playerNames[myIdx]}</span>
          </div>
          <span style={{ color:canPlay?C.greenLt:comboMenu?C.gold:C.textMuted, fontSize:11 }}>
            {canPlay?'Dein Zug ↓':comboMenu?'Kombination wählen ↓':'Warten…'}
          </span>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {(hands[myIdx]||[]).map(c=>(
            <Card key={c.id} card={c} onClick={()=>handleCardClick(c)} disabled={!canPlay}/>
          ))}
        </div>
      </div>

      {comboMenu&&<ComboPicker playedCard={comboMenu.card} combos={comboMenu.combos} onPick={combo=>handlePick(comboMenu.card,combo)} onSkip={()=>{setComboMenu(null);setAnimTable([]);busyRef.current=false}}/>}
      {showRules&&<RulesModal onClose={()=>setShowRules(false)}/>}
      <div style={{ color:C.textMuted, fontSize:10, marginTop:10, fontFamily:"'Cinzel',serif", letterSpacing:1 }}>OMRAN & NYAZ</div>
    </div>
  )
}

// ─── ROUND RESULT ─────────────────────────────────────────────────────────────
function RoundResult({ result, newScores, collected, playerNames, t, onNext, onRematch, gameOver, winner21, maxScore }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}>
      <div style={{ background:C.surface, borderRadius:22, padding:'28px 26px', border:`1.5px solid ${C.gold}`, maxWidth:440, width:'100%' }}>
        <div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:15, fontWeight:700, marginBottom:20, textAlign:'center', letterSpacing:3 }}>{gameOver?'— GEWINNER —':'— RUNDE VORBEI —'}</div>
        {result.lastCollector!=null&&<div style={{ textAlign:'center', color:C.textSub, fontSize:12, marginBottom:14 }}>Restkarten → <span style={{ color:C.text, fontWeight:600 }}>{playerNames[result.lastCollector]}</span></div>}
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(playerNames.length,2)},1fr)`, gap:10, marginBottom:20 }}>
          {playerNames.map((name,i)=>{
            const mx=Math.max(...result.pts)
            return (
              <div key={i} style={{ background:'rgba(10,18,30,.8)', borderRadius:12, padding:'12px 14px', textAlign:'center', border:result.pts[i]===mx?`1.5px solid ${C.gold}`:`1px solid ${C.border}` }}>
                <div style={{ color:C.textSub, fontSize:10, marginBottom:4, fontFamily:"'Cinzel',serif" }}>{name}</div>
                <div style={{ color:C.gold, fontSize:30, fontWeight:900, lineHeight:1, fontFamily:"'Cinzel',serif" }}>+{result.pts[i]}</div>
                <div style={{ color:C.textMuted, fontSize:10, marginTop:5 }}>{result.counts[i]} Karten · {result.clubs[i]}♣{collected[i]?.some(c=>c.rank==='10'&&c.suit==='♦')?' · 10♦':''}{collected[i]?.some(c=>c.rank==='2'&&c.suit==='♣')?' · 2♣':''}</div>
              </div>
            )
          })}
        </div>
        <div style={{ display:'flex', justifyContent:'center', gap:20, marginBottom:22, flexWrap:'wrap' }}>
          {playerNames.map((name,i)=>(
            <div key={i} style={{ textAlign:'center' }}>
              <div style={{ color:C.textMuted, fontSize:9, fontFamily:"'Cinzel',serif" }}>{name}</div>
              <div style={{ color:C.text, fontSize:20, fontWeight:700, fontFamily:"'Cinzel',serif" }}>{newScores[i]}<span style={{ color:C.textMuted, fontSize:11 }}>/{maxScore||21}</span></div>
            </div>
          ))}
        </div>
        {gameOver&&<div style={{ textAlign:'center', marginBottom:20 }}><div style={{ fontSize:44 }}>🏆</div><div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:20, fontWeight:700, marginTop:8, letterSpacing:2 }}>{playerNames[winner21]}</div><div style={{ color:C.textSub, fontSize:13, marginTop:4 }}>gewinnt das Spiel!</div></div>}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {gameOver?<><Btn onClick={onRematch}>🔄 Rematch</Btn><Btn variant="outline" onClick={onNext}>Hauptmenü</Btn></>:<Btn onClick={onNext}>{t.nextRound}</Btn>}
        </div>
      </div>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [lang,setLang]=useState('de')
  const t=LANG[lang]
  const [screen,setScreen]=useState('lobby')
  const [roomCode,setRoomCode]=useState(null)
  const [roomId,setRoomId]=useState(null)
  const [myIdx,setMyIdx]=useState(0)
  const [isHost,setIsHost]=useState(false)
  const [gs,setGs]=useState(null)
  const [pendingGs,setPendingGs]=useState(null)
  const [waitingNames,setWaitingNames]=useState([])
  const [roundResult,setRoundResult]=useState(null)
  const channelRef=useRef(null)
  const gsRef=useRef(null)
  const myIdxRef=useRef(0)
  useEffect(()=>{ gsRef.current=gs },[gs])
  useEffect(()=>{ myIdxRef.current=myIdx },[myIdx])

  const doRoundResult=useCallback((newGs)=>{
    const result=calcRoundPts(newGs.collected,newGs.teamMode,newGs.playerNames.length)
    const newScores=newGs.scores.map((s,i)=>s+result.pts[i])
    const maxScore=newGs.maxScore||21
    const winner21=newScores.findIndex(s=>s>=maxScore)
    result.lastCollector=newGs.lastCollector??null
    setRoundResult({result,newScores,collected:newGs.collected,playerNames:newGs.playerNames,winner21,maxScore})
  },[])

  const subscribeRoom=useCallback((rId)=>{
    if(channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current=supabase.channel(`room:${rId}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'rooms',filter:`id=eq.${rId}`},payload=>{
        const data=payload.new
        if(data.player_names) setWaitingNames(data.player_names)
        if(data.status==='playing'&&data.game_state){ setGs(data.game_state); setScreen('game'); return }
        if(data.game_state){
          const newGs=data.game_state
          const action=newGs.lastAction
          // If opponent played: park in pendingGs, Game will animate then call onAnimDone
          if(action && action.playerIdx!==myIdxRef.current && action.card) {
            setPendingGs(newGs)
          } else {
            setGs(newGs)
            if(newGs.phase==='roundover') doRoundResult(newGs)
          }
        }
      }).subscribe()
  },[doRoundResult])

  const handleCreate=async(hostName,maxScore=21)=>{
    const code=genCode()
    const{data,error}=await supabase.from('rooms').insert({
      code,host_name:hostName,player_names:[hostName],
      max_players:4,game_state:null,status:'waiting',max_score:maxScore,
    }).select().single()
    if(error||!data){alert('Fehler: '+(error?.message||''));return}
    setRoomCode(code);setRoomId(data.id);setMyIdx(0);setIsHost(true)
    setWaitingNames([hostName]);subscribeRoom(data.id);setScreen('waiting')
  }

  const handleJoin=async(name,code,setErr)=>{
    const{data,error}=await supabase.from('rooms').select('*').eq('code',code.toUpperCase()).single()
    if(error||!data){setErr('Code nicht gefunden.');return}
    if(data.status==='finished'){setErr('Spiel bereits beendet.');return}
    if(data.status==='playing'){setErr('Spiel läuft bereits.');return}
    const existing=data.player_names||[]
    if(existing.includes(name)){setErr('Name bereits vergeben.');return}
    const newNames=[...existing,name]
    const{error:err2}=await supabase.from('rooms').update({player_names:newNames}).eq('id',data.id)
    if(err2){setErr('Fehler beim Beitreten.');return}
    setRoomCode(code.toUpperCase());setRoomId(data.id)
    setMyIdx(newNames.length-1);setIsHost(false)
    setWaitingNames(newNames);subscribeRoom(data.id);setScreen('waiting')
  }

  const handleStart=async()=>{
    const{data}=await supabase.from('rooms').select('*').eq('id',roomId).single()
    const names=data.player_names||[]
    if(names.length<2){alert('Mindestens 2 Spieler benötigt.');return}
    const maxScore=data.max_score||21
    const newGs={...initGameState(names,false),maxScore}
    await supabase.from('rooms').update({game_state:newGs,status:'playing',max_players:names.length}).eq('id',roomId)
    setGs(newGs);setScreen('game')
  }

  const handlePlayCommit=useCallback(async(card,comboCards)=>{
    const cur=gsRef.current
    if(!cur||cur.currentPlayer!==myIdx) return
    const newGs=applyPlayCard(cur,myIdx,card,comboCards)
    setGs(newGs)
    await supabase.from('rooms').update({game_state:newGs}).eq('id',roomId)
    if(newGs.phase==='roundover') doRoundResult(newGs)
  },[myIdx,roomId,doRoundResult])

  const handleAnimDone=useCallback(()=>{
    if(pendingGs){
      setGs(pendingGs)
      if(pendingGs.phase==='roundover') doRoundResult(pendingGs)
      setPendingGs(null)
    }
  },[pendingGs,doRoundResult])

  const handleNextRound=async()=>{
    if(!roundResult) return
    const{newScores,winner21,maxScore}=roundResult
    if(winner21>=0){setScreen('lobby');setRoundResult(null);setGs(null);if(roomId) await supabase.from('rooms').update({status:'finished'}).eq('id',roomId);return}
    if(isHost){const newGs={...initGameState(gs.playerNames,false),scores:newScores,maxScore:maxScore||gs.maxScore||21};await supabase.from('rooms').update({game_state:newGs}).eq('id',roomId);setGs(newGs)}
    setRoundResult(null)
  }

  const handleRematch=async()=>{
    if(!roundResult) return
    const newGs={...initGameState(gs.playerNames,false),maxScore:gs.maxScore||21}
    if(isHost){await supabase.from('rooms').update({game_state:newGs,status:'playing'}).eq('id',roomId);setGs(newGs)}
    setRoundResult(null)
  }

  const handleLeave=async()=>{
    if(channelRef.current) supabase.removeChannel(channelRef.current)
    if(roomId&&isHost) await supabase.from('rooms').update({status:'finished'}).eq('id',roomId)
    setScreen('lobby');setGs(null);setRoomCode(null);setRoundResult(null);setPendingGs(null)
  }

  useEffect(()=>{
    if(screen!=='waiting'||!roomId) return
    const poll=setInterval(async()=>{
      const{data}=await supabase.from('rooms').select('player_names,status,game_state').eq('id',roomId).single()
      if(!data) return
      setWaitingNames(data.player_names||[])
      if(data.status==='playing'&&data.game_state&&!isHost){setGs(data.game_state);setScreen('game')}
    },1500)
    return()=>clearInterval(poll)
  },[screen,roomId,isHost])

  return (
    <>
      {screen==='lobby'&&<Lobby onCreateGame={handleCreate} onJoinGame={handleJoin} t={t} lang={lang} setLang={setLang}/>}
      {screen==='waiting'&&<WaitingRoom roomCode={roomCode} playerNames={waitingNames} myIdx={myIdx} onStart={handleStart} onLeave={handleLeave} t={t} isHost={isHost}/>}
      {screen==='game'&&gs&&<Game gs={gs} pendingGs={pendingGs} onAnimDone={handleAnimDone} myIdx={myIdx} onPlayCommit={handlePlayCommit} t={t} onLeave={handleLeave}/>}
      {roundResult&&<RoundResult result={roundResult.result} newScores={roundResult.newScores} collected={roundResult.collected} playerNames={roundResult.playerNames} t={t} onNext={handleNextRound} onRematch={handleRematch} gameOver={roundResult.winner21>=0} winner21={roundResult.winner21} maxScore={roundResult.maxScore||21}/>}
    </>
  )
}
