'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { LANG } from '../lib/i18n'
import { isJack, findCombosIncludingCard, initGameState, applyPlayCard, calcRoundPts } from '../lib/gameLogic'

const C = {
  bg:'#0f1923', surf:'#1a2535', bd:'#2a3d55',
  gold:'#d4a843', glt:'#f0c96a',
  grn:'#1e8a5e', grl:'#28c47e',
  blu:'#1e5aaa', bll:'#5a9ae0',
  tx:'#ddeeff', ts:'#8aaccc', tm:'#4a6580', rl:'#e05252',
}

const genCode = () => Math.random().toString(36).slice(2,7).toUpperCase()

const Btn = ({ children, onClick, disabled, v='gold', sm }) => {
  const styles = {
    gold: { background:`linear-gradient(135deg,${C.gold},#a07820)`, color:'#0a1205', border:'none' },
    grn:  { background:`linear-gradient(135deg,${C.grn},#166040)`, color:'#e0fff0', border:'none' },
    out:  { background:'transparent', color:C.ts, border:`1px solid ${C.bd}` },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[v],
      padding:sm?'8px 16px':'12px 20px', borderRadius:9,
      fontWeight:700, fontSize:sm?13:15, cursor:disabled?'not-allowed':'pointer',
      width:'100%', fontFamily:'inherit', opacity:disabled?.5:1,
    }}>{children}</button>
  )
}

const Inp = ({ value, onChange, placeholder, style={} }) => (
  <input value={value} onChange={onChange} placeholder={placeholder} style={{
    display:'block', width:'100%', padding:'11px 14px', borderRadius:8,
    border:`1px solid ${C.bd}`, background:'rgba(15,25,40,.9)', color:C.tx,
    fontSize:15, outline:'none', fontFamily:'inherit', marginBottom:10, ...style,
  }}/>
)

const CardView = ({ card, glow, onClick, disabled, sm, onDragStart }) => {
  const red = card.suit==='♥'||card.suit==='♦'
  const w=sm?44:60, h=sm?64:88
  const tc = glow?(red?'#fca5a5':'#6ee7b7'):(red?'#991b1b':'#1e293b')
  return (
    <div
      onClick={disabled?undefined:onClick}
      draggable={!disabled && !!onDragStart}
      onDragStart={onDragStart?e=>{e.dataTransfer.effectAllowed='move';onDragStart(card)}:undefined}
      style={{
        width:w, height:h, borderRadius:8, flexShrink:0,
        background:glow?'#031208':'linear-gradient(150deg,#fff,#f0e8d8)',
        border:`1.5px solid ${glow?C.grl:'#c8b898'}`,
        boxShadow:glow?`0 0 0 3px rgba(40,196,126,.35)`:'0 2px 8px rgba(0,0,0,.3)',
        cursor:disabled?'default':'pointer',
        display:'flex', flexDirection:'column', justifyContent:'space-between',
        padding:'4px 6px', userSelect:'none', position:'relative',
      }}>
      <div style={{ fontSize:sm?10:14, fontWeight:700, color:tc, lineHeight:1.1 }}>
        {card.rank}<br/><span style={{ fontSize:sm?9:11 }}>{card.suit}</span>
      </div>
      <div style={{ fontSize:sm?10:14, fontWeight:700, color:tc, lineHeight:1.1, alignSelf:'flex-end', transform:'rotate(180deg)' }}>
        {card.rank}<br/><span style={{ fontSize:sm?9:11 }}>{card.suit}</span>
      </div>
    </div>
  )
}

const CardBack = ({ sm }) => {
  const w=sm?44:60, h=sm?64:88
  return (
    <div style={{ width:w, height:h, borderRadius:8, flexShrink:0, background:'linear-gradient(145deg,#1e3a5f,#0f1e35)', border:'1.5px solid #2a4a7f', boxShadow:'0 2px 8px rgba(0,0,0,.4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:w-10, height:h-10, borderRadius:5, border:'1px solid #1a2d50', background:'repeating-linear-gradient(45deg,#162840,#162840 3px,#0c1828 3px,#0c1828 6px)' }}/>
    </div>
  )
}

const Rules = ({ onClose }) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:16 }}>
    <div style={{ background:C.surf, borderRadius:16, padding:24, border:`1px solid ${C.gold}`, maxWidth:400, width:'100%', maxHeight:'85vh', overflowY:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <span style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:15 }}>SPIELREGELN</span>
        <button onClick={onClose} style={{ background:'transparent', border:`1px solid ${C.bd}`, borderRadius:6, color:C.ts, cursor:'pointer', padding:'3px 10px' }}>✕</button>
      </div>
      {[
        ['Kartenwerte','2–10: Zahlenwert · J/Q/K = 10 · As = 1'],
        ['Elferkombinationen','Karten die zusammen 11 ergeben werden genommen (z.B. 5+6, 9+2)'],
        ['Bube (J)','Nimmt ALLE Karten außer Dame und König'],
        ['Dame / König','Dame nimmt andere Dame · König nimmt anderen König'],
        ['Rundenende','Restkarten → letzter Sammler · Meiste Karten +2 · Meiste ♣ +1 · 2♣ +1 · 10♦ +1'],
        ['Ziel','Erster der das Punkteziel erreicht gewinnt'],
      ].map(([ti,d])=>(
        <div key={ti} style={{ marginBottom:11 }}>
          <div style={{ color:C.glt, fontSize:12, fontWeight:600, marginBottom:4, fontFamily:"'Cinzel',serif" }}>{ti}</div>
          <div style={{ color:C.tx, fontSize:13, lineHeight:1.55 }}>› {d}</div>
        </div>
      ))}
      <div style={{ marginTop:10 }}><Btn sm onClick={onClose}>OK</Btn></div>
    </div>
  </div>
)

const Lobby = ({ onCreate, onJoin, t, lang, setLang }) => {
  const [tab,setTab]       = useState('home')
  const [name,setName]     = useState('')
  const [maxScore,setMax]  = useState(21)
  const [jname,setJname]   = useState('')
  const [jcode,setJcode]   = useState('')
  const [err,setErr]       = useState('')
  const [busy,setBusy]     = useState(false)
  const [rules,setRules]   = useState(false)

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ position:'fixed', top:14, right:14, display:'flex', gap:5, zIndex:200 }}>
        {Object.keys(LANG).map(l=>(
          <button key={l} onClick={()=>setLang(l)} style={{ padding:'3px 8px', borderRadius:5, border:l===lang?`1px solid ${C.gold}`:`1px solid ${C.bd}`, background:l===lang?`rgba(212,168,67,.15)`:'transparent', color:l===lang?C.gold:C.tm, fontSize:9, cursor:'pointer' }}>{l.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ textAlign:'center', marginBottom:32 }}>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:86, fontWeight:900, lineHeight:1, background:`linear-gradient(135deg,${C.gold},${C.glt},${C.gold})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:-4 }}>21</div>
        <div style={{ color:C.tm, fontSize:10, letterSpacing:7, marginTop:4, fontFamily:"'Cinzel',serif" }}>DAS KARTENSPIEL</div>
      </div>
      <div style={{ width:'100%', maxWidth:340, background:C.surf, borderRadius:16, padding:22, border:`1px solid ${C.bd}` }}>
        {tab==='home' && (
          <>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              <button onClick={()=>setTab('create')} style={{ flex:1, padding:'10px 0', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', border:`1px solid ${C.bd}`, background:'transparent', color:C.ts }}>{t.createGame}</button>
              <button onClick={()=>setTab('join')}   style={{ flex:1, padding:'10px 0', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', border:`1px solid ${C.bd}`, background:'transparent', color:C.ts }}>{t.joinGame}</button>
            </div>
            <button onClick={()=>setRules(true)} style={{ width:'100%', padding:'8px', borderRadius:8, border:`1px solid ${C.bd}`, background:'transparent', color:C.tm, fontSize:13, cursor:'pointer' }}>📖 Spielregeln</button>
          </>
        )}
        {tab==='create' && (
          <>
            <button onClick={()=>setTab('home')} style={{ background:'transparent', border:'none', color:C.ts, cursor:'pointer', fontSize:13, marginBottom:14, padding:0 }}>← {t.back}</button>
            <div style={{ color:C.tm, fontSize:10, letterSpacing:2, marginBottom:7, fontFamily:"'Cinzel',serif" }}>DEIN NAME</div>
            <Inp value={name} onChange={e=>{setName(e.target.value);setErr('')}} placeholder={t.enterName}/>
            <div style={{ color:C.tm, fontSize:10, letterSpacing:2, marginBottom:7, fontFamily:"'Cinzel',serif" }}>SPIELZIEL</div>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {[11,21].map(n=>(
                <button key={n} onClick={()=>setMax(n)} style={{ flex:1, padding:'9px 0', borderRadius:8, fontSize:17, fontWeight:800, cursor:'pointer', border:maxScore===n?`2px solid ${C.gold}`:`1px solid ${C.bd}`, background:maxScore===n?`rgba(212,168,67,.12)`:'transparent', color:maxScore===n?C.gold:C.ts }}>{n} Pkt</button>
              ))}
            </div>
            {err&&<div style={{ color:C.rl, fontSize:12, marginBottom:8 }}>{err}</div>}
            <Btn onClick={()=>{ if(!name.trim()){setErr('Bitte Namen eingeben');return}; onCreate(name.trim(),maxScore) }}>{t.startGame}</Btn>
          </>
        )}
        {tab==='join' && (
          <>
            <button onClick={()=>{setTab('home');setErr('')}} style={{ background:'transparent', border:'none', color:C.ts, cursor:'pointer', fontSize:13, marginBottom:14, padding:0 }}>← {t.back}</button>
            <div style={{ color:C.tm, fontSize:10, letterSpacing:2, marginBottom:7, fontFamily:"'Cinzel',serif" }}>NAME & CODE</div>
            <Inp value={jname} onChange={e=>{setJname(e.target.value);setErr('')}} placeholder={t.enterName}/>
            <Inp value={jcode} onChange={e=>{setJcode(e.target.value.toUpperCase());setErr('')}} placeholder={t.gameCode} style={{ letterSpacing:5, fontSize:17, marginBottom:err?4:14 }}/>
            {err&&<div style={{ color:C.rl, fontSize:12, marginBottom:10 }}>{err}</div>}
            <Btn disabled={busy} onClick={async()=>{
              if(!jname.trim()){setErr('Bitte Namen eingeben');return}
              if(!jcode.trim()){setErr('Bitte Code eingeben');return}
              setBusy(true); await onJoin(jname.trim(),jcode.trim(),setErr); setBusy(false)
            }}>{busy?'…':t.join}</Btn>
          </>
        )}
      </div>
      {rules&&<Rules onClose={()=>setRules(false)}/>}
      <div style={{ position:'fixed', bottom:12, left:14, color:'#1a2a3a', fontSize:10, fontFamily:"'Cinzel',serif" }}>OMRAN & NYAZ</div>
    </div>
  )
}

const WaitRoom = ({ code, players, myIdx, isHost, onStart, onLeave, t }) => {
  const [copied,setCopied]=useState(false)
  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ fontFamily:"'Cinzel',serif", fontSize:44, fontWeight:900, color:C.gold, marginBottom:24 }}>21</div>
      <div style={{ width:'100%', maxWidth:360, background:C.surf, borderRadius:16, padding:22, border:`1px solid ${C.bd}` }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ color:C.tm, fontSize:10, letterSpacing:4, marginBottom:8, fontFamily:"'Cinzel',serif" }}>CODE TEILEN</div>
          <div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:42, fontWeight:900, letterSpacing:10, marginBottom:12 }}>{code}</div>
          <button onClick={()=>{navigator.clipboard.writeText(code).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)})}} style={{ padding:'5px 16px', borderRadius:7, border:`1px solid ${C.bd}`, background:'transparent', color:copied?C.grl:C.ts, cursor:'pointer', fontSize:12 }}>{copied?'✓ Kopiert!':'Kopieren'}</button>
        </div>
        <div style={{ height:1, background:C.bd, margin:'0 0 14px' }}/>
        <div style={{ color:C.tm, fontSize:10, letterSpacing:2, marginBottom:10, fontFamily:"'Cinzel',serif" }}>SPIELER ({players.length})</div>
        {players.map((n,i)=>(
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', borderRadius:9, background:'rgba(15,25,40,.8)', border:i===myIdx?`1px solid ${C.grl}`:`1px solid ${C.bd}`, marginBottom:7 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:i===0?C.gold:C.bll }}/>
            <span style={{ color:C.tx, fontSize:14, flex:1 }}>{n}</span>
            {i===0&&<span style={{ color:C.gold, fontSize:9, fontFamily:"'Cinzel',serif" }}>HOST</span>}
            {i===myIdx&&<span style={{ color:C.grl, fontSize:9, fontFamily:"'Cinzel',serif" }}>DU</span>}
          </div>
        ))}
        <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:8 }}>
          {isHost
            ?<Btn v="grn" disabled={players.length<2} onClick={onStart}>Spiel starten ({players.length})</Btn>
            :<div style={{ textAlign:'center', color:C.ts, fontSize:13, padding:'8px 0' }}>Warte auf Host…</div>
          }
          <Btn v="out" sm onClick={onLeave}>{t.leaveGame}</Btn>
        </div>
      </div>
    </div>
  )
}

const Game = ({ gs, myIdx, onPlay, onLeave, t }) => {
  if (!gs || !gs.hands || !gs.playerNames) return null
  const { hands, table, collected, scores, currentPlayer, phase, playerNames, deck } = gs
  const [glowIds,setGlowIds] = useState([])
  const [combo,setCombo]     = useState(null)
  const [rules,setRules]     = useState(false)
  const [dragOver,setDragOver] = useState(false)
  const busy = useRef(false)

  // Highlight last played cards briefly
  useEffect(()=>{
    const act = gs.lastAction
    if(!act||!act.removedIds?.length) return
    setGlowIds(act.removedIds)
    const tid = setTimeout(()=>setGlowIds([]), 1000)
    return ()=>clearTimeout(tid)
  },[gs.lastAction?.timestamp])

  useEffect(()=>{
    if(currentPlayer===myIdx){ busy.current=false; setCombo(null) }
  },[currentPlayer,myIdx])

  const canPlay = currentPlayer===myIdx && phase==='playing' && !busy.current && !combo

  const doPlay = useCallback((card,combo=[])=>{
    busy.current=true; setCombo(null); onPlay(card,combo)
  },[onPlay])

  const tap = useCallback((card)=>{
    if(!canPlay) return
    const tw=[...table,card]
    if(isJack(card.rank)||card.rank==='Q'||card.rank==='K'){ doPlay(card,[]); return }
    const combos=findCombosIncludingCard(card,tw)
    if(!combos.length){ doPlay(card,[]); return }
    if(combos.length===1){ doPlay(card,combos[0]); return }
    busy.current=true; setCombo({card,combos})
  },[canPlay,table,doPlay])

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', alignItems:'center', padding:'8px', overflowX:'hidden' }}>

      <div style={{ display:'flex', gap:6, marginBottom:7, flexWrap:'wrap', justifyContent:'center', width:'100%', maxWidth:540 }}>
        {playerNames.map((n,i)=>(
          <div key={i} style={{ textAlign:'center', padding:'5px 8px', borderRadius:9, flex:1, minWidth:55, maxWidth:100, background:i===currentPlayer?`rgba(212,168,67,.12)`:`rgba(20,35,55,.8)`, border:i===currentPlayer?`1.5px solid ${C.gold}`:`1px solid ${C.bd}` }}>
            <div style={{ color:C.tm, fontSize:8, letterSpacing:1, fontFamily:"'Cinzel',serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n}</div>
            <div style={{ color:C.gold, fontSize:20, fontWeight:900, fontFamily:"'Cinzel',serif" }}>{scores[i]}<span style={{ color:C.tm, fontSize:8 }}>/{gs.maxScore||21}</span></div>
            {i===myIdx&&<div style={{ color:C.grl, fontSize:7 }}>DU</div>}
          </div>
        ))}
        <div style={{ display:'flex', flexDirection:'column', gap:4, justifyContent:'center' }}>
          <button onClick={()=>setRules(true)} style={{ padding:'5px 8px', borderRadius:6, border:`1px solid ${C.bd}`, background:'transparent', color:C.ts, fontSize:12, cursor:'pointer' }}>📖</button>
          <button onClick={onLeave} style={{ padding:'5px 8px', borderRadius:6, border:`1px solid ${C.bd}`, background:'transparent', color:C.ts, fontSize:12, cursor:'pointer' }}>✕</button>
        </div>
      </div>

      {playerNames.slice(1).map((n,oi)=>{
        const pi=oi+1
        return (
          <div key={pi} style={{ width:'100%', maxWidth:540, background:C.surf, borderRadius:11, padding:'7px 11px', marginBottom:5, border:pi===currentPlayer?`1.5px solid ${C.bll}`:`1px solid ${C.bd}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:pi===currentPlayer?C.bll:C.tm }}/>
                <span style={{ color:C.tx, fontSize:13 }}>{n}</span>
                {pi===currentPlayer&&<span style={{ color:C.bll, fontSize:9, fontFamily:"'Cinzel',serif" }}>AM ZUG</span>}
              </div>
              <span style={{ color:C.tm, fontSize:10 }}>{(hands[pi]||[]).length} Karten</span>
            </div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {(hands[pi]||[]).map((_,ci)=><CardBack key={ci} sm/>)}
            </div>
          </div>
        )
      })}

      <div
        onDragOver={e=>{ if(canPlay){e.preventDefault();setDragOver(true)} }}
        onDragLeave={()=>setDragOver(false)}
        onDrop={e=>{ e.preventDefault(); setDragOver(false); const id=e.dataTransfer.getData('cardId'); if(id){ const c=(hands[myIdx]||[]).find(x=>x.id===id); if(c) tap(c) } }}
        style={{ width:'100%', maxWidth:540, background:C.surf, borderRadius:12, padding:'9px 11px', marginBottom:5, border:dragOver?`1.5px dashed ${C.grl}`:`1px solid ${C.bd}`, minHeight:120, position:'relative', transition:'border .15s' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
          <span style={{ color:C.tm, fontSize:9, letterSpacing:3, fontFamily:"'Cinzel',serif" }}>TISCH</span>
          {canPlay&&<span style={{ color:C.tm, fontSize:8 }}>Karte antippen ↓</span>}
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, minHeight:76, alignItems:'flex-start' }}>
          {table.length===0&&<div style={{ color:C.tm, fontSize:12, margin:'auto', alignSelf:'center' }}>—</div>}
          {table.map(c=><CardView key={c.id} card={c} glow={glowIds.includes(c.id)} disabled/>)}
        </div>
        <div style={{ position:'absolute', top:9, right:11, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
          <CardBack sm/>
          <div style={{ color:C.tm, fontSize:10 }}>{deck.length}</div>
        </div>
      </div>

      <div style={{ display:'flex', gap:5, width:'100%', maxWidth:540, marginBottom:5 }}>
        {playerNames.map((n,i)=>(
          <div key={i} style={{ flex:1, background:C.surf, borderRadius:8, padding:'5px 9px', border:`1px solid ${C.bd}` }}>
            <div style={{ color:C.tm, fontSize:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n}</div>
            <div style={{ color:C.ts, fontSize:11 }}>
              {collected[i].length}🃏 <span style={{ color:C.grl }}>{collected[i].filter(c=>c.suit==='♣').length}♣</span>
              {collected[i].some(c=>c.rank==='10'&&c.suit==='♦')&&<span style={{ color:C.gold, fontSize:9 }}> 10♦</span>}
              {collected[i].some(c=>c.rank==='2'&&c.suit==='♣')&&<span style={{ color:C.grl, fontSize:9 }}> 2♣</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ width:'100%', maxWidth:540, background:C.surf, borderRadius:12, padding:'9px 11px', border:canPlay?`1.5px solid ${C.grl}`:`1px solid ${C.bd}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:canPlay?C.grl:C.tm }}/>
            <span style={{ color:C.tx, fontSize:13 }}>{playerNames[myIdx]}</span>
          </div>
          <span style={{ color:canPlay?C.grl:combo?C.gold:C.tm, fontSize:11 }}>
            {canPlay?'Dein Zug ↓':combo?'Kombination wählen ↓':'Warten…'}
          </span>
        </div>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
          {(hands[myIdx]||[]).map(c=>(
            <div key={c.id}
              draggable={canPlay}
              onDragStart={e=>{ e.dataTransfer.setData('cardId',c.id); e.dataTransfer.effectAllowed='move' }}
            >
              <CardView card={c} onClick={()=>tap(c)} disabled={!canPlay}/>
            </div>
          ))}
        </div>
      </div>

      {combo&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:16 }}>
          <div style={{ background:C.surf, borderRadius:16, padding:22, border:`1.5px solid ${C.gold}`, maxWidth:380, width:'100%', maxHeight:'85vh', overflowY:'auto' }}>
            <div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:13, marginBottom:5 }}>KOMBINATION WÄHLEN</div>
            <div style={{ color:C.ts, fontSize:12, marginBottom:14 }}>Welche Karten nimmst du?</div>
            {combo.combos.map((c,i)=>(
              <button key={i} onClick={()=>doPlay(combo.card,c)} style={{ display:'flex', gap:5, alignItems:'center', flexWrap:'wrap', width:'100%', background:`rgba(30,138,94,.1)`, border:`1px solid ${C.grn}`, borderRadius:9, padding:'9px 12px', marginBottom:9, cursor:'pointer', fontFamily:'inherit' }}>
                <CardView card={combo.card} sm disabled/>
                {c.map(cc=><span key={cc.id} style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ color:C.tm, fontSize:11 }}>+</span><CardView card={cc} sm disabled/></span>)}
                <span style={{ color:C.grl, fontSize:13, marginLeft:'auto', fontWeight:700 }}>= 11 ✓</span>
              </button>
            ))}
            <button onClick={()=>{setCombo(null);busy.current=false}} style={{ width:'100%', background:'transparent', border:`1px solid ${C.bd}`, borderRadius:9, padding:'8px', cursor:'pointer', color:C.ts, fontSize:13, fontFamily:'inherit' }}>Nur legen</button>
          </div>
        </div>
      )}
      {rules&&<Rules onClose={()=>setRules(false)}/>}
      <div style={{ color:'#1a2a3a', fontSize:9, marginTop:8, fontFamily:"'Cinzel',serif" }}>OMRAN & NYAZ</div>
    </div>
  )
}

const RoundRes = ({ r, scores, cols, names, t, onNext, onRematch, over, winner, ms }) => (
  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}>
    <div style={{ background:C.surf, borderRadius:18, padding:'24px 22px', border:`1.5px solid ${C.gold}`, maxWidth:420, width:'100%' }}>
      <div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:14, fontWeight:700, marginBottom:16, textAlign:'center', letterSpacing:2 }}>{over?'— GEWINNER —':'— RUNDE VORBEI —'}</div>
      {r.lastCollector!=null&&<div style={{ textAlign:'center', color:C.ts, fontSize:11, marginBottom:12 }}>Restkarten → <span style={{ color:C.tx, fontWeight:600 }}>{names[r.lastCollector]}</span></div>}
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(names.length,2)},1fr)`, gap:8, marginBottom:16 }}>
        {names.map((n,i)=>{
          const mx=Math.max(...r.pts)
          return (
            <div key={i} style={{ background:'rgba(10,18,30,.8)', borderRadius:10, padding:'11px 12px', textAlign:'center', border:r.pts[i]===mx?`1.5px solid ${C.gold}`:`1px solid ${C.bd}` }}>
              <div style={{ color:C.ts, fontSize:9, marginBottom:3, fontFamily:"'Cinzel',serif" }}>{n}</div>
              <div style={{ color:C.gold, fontSize:28, fontWeight:900, fontFamily:"'Cinzel',serif" }}>+{r.pts[i]}</div>
              <div style={{ color:C.tm, fontSize:9, marginTop:4 }}>{r.counts[i]} Karten · {r.clubs[i]}♣</div>
            </div>
          )
        })}
      </div>
      <div style={{ display:'flex', justifyContent:'center', gap:16, marginBottom:18, flexWrap:'wrap' }}>
        {names.map((n,i)=>(
          <div key={i} style={{ textAlign:'center' }}>
            <div style={{ color:C.tm, fontSize:8, fontFamily:"'Cinzel',serif" }}>{n}</div>
            <div style={{ color:C.tx, fontSize:18, fontWeight:700, fontFamily:"'Cinzel',serif" }}>{scores[i]}<span style={{ color:C.tm, fontSize:10 }}>/{ms||21}</span></div>
          </div>
        ))}
      </div>
      {over&&<div style={{ textAlign:'center', marginBottom:16 }}><div style={{ fontSize:40 }}>🏆</div><div style={{ fontFamily:"'Cinzel',serif", color:C.gold, fontSize:18, fontWeight:700, marginTop:6 }}>{names[winner]}</div></div>}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {over?<><Btn onClick={onRematch}>🔄 Rematch</Btn><Btn v="out" onClick={onNext}>Hauptmenü</Btn></>:<Btn onClick={onNext}>{t.nextRound}</Btn>}
      </div>
    </div>
  </div>
)

export default function App() {
  const [lang,setLang]     = useState('de')
  const t = LANG[lang]
  const [screen,setScreen] = useState('lobby')
  const [code,setCode]     = useState(null)
  const [roomId,setRoomId] = useState(null)
  const [myIdx,setMyIdx]   = useState(0)
  const [isHost,setIsHost] = useState(false)
  const [gs,setGs]         = useState(null)
  const [names,setNames]   = useState([])
  const [result,setResult] = useState(null)
  const chRef  = useRef(null)
  const gsRef  = useRef(null)
  const idxRef = useRef(0)
  useEffect(()=>{ gsRef.current=gs },[gs])
  useEffect(()=>{ idxRef.current=myIdx },[myIdx])

  const calcResult = useCallback((g)=>{
    const r=calcRoundPts(g.collected,g.teamMode,g.playerNames.length)
    const ns=g.scores.map((s,i)=>s+r.pts[i])
    const ms=g.maxScore||21
    r.lastCollector=g.lastCollector??null
    setResult({ r, ns, cols:g.collected, names:g.playerNames, win:ns.findIndex(s=>s>=ms), ms })
  },[])

  const subscribe = useCallback((rId)=>{
    if(chRef.current) supabase.removeChannel(chRef.current)
    chRef.current = supabase.channel(`room:${rId}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'rooms',filter:`id=eq.${rId}`},p=>{
        const d=p.new
        if(d.player_names) setNames(d.player_names)
        if(d.status==='playing'&&d.game_state){ setGs(d.game_state); setScreen('game'); return }
        if(d.game_state){
          setGs(d.game_state)
          if(d.game_state.phase==='roundover') calcResult(d.game_state)
        }
      }).subscribe()
  },[calcResult])

  const onCreate = async(name,maxScore)=>{
    const c=genCode()
    const{data,error}=await supabase.from('rooms').insert({ code:c, host_name:name, player_names:[name], max_players:4, game_state:null, status:'waiting', max_score:maxScore }).select().single()
    if(error||!data){alert('Fehler');return}
    setCode(c);setRoomId(data.id);setMyIdx(0);setIsHost(true);setNames([name]);subscribe(data.id);setScreen('waiting')
  }

  const onJoin = async(name,c,setErr)=>{
    const{data,error}=await supabase.from('rooms').select('*').eq('code',c).single()
    if(error||!data){setErr('Code nicht gefunden');return}
    if(data.status==='finished'){setErr('Spiel beendet');return}
    if(data.status==='playing'){setErr('Spiel läuft bereits');return}
    const ex=data.player_names||[]
    if(ex.includes(name)){setErr('Name vergeben');return}
    const nn=[...ex,name]
    const{error:e2}=await supabase.from('rooms').update({player_names:nn}).eq('id',data.id)
    if(e2){setErr('Fehler');return}
    setCode(c);setRoomId(data.id);setMyIdx(nn.length-1);setIsHost(false);setNames(nn);subscribe(data.id);setScreen('waiting')
  }

  const onStart = async()=>{
    const{data}=await supabase.from('rooms').select('*').eq('id',roomId).single()
    const ns=data.player_names||[]
    if(ns.length<2){alert('Mindestens 2 Spieler');return}
    const ms=data.max_score||21
    const g={...initGameState(ns,false),maxScore:ms}
    await supabase.from('rooms').update({game_state:g,status:'playing',max_players:ns.length}).eq('id',roomId)
    setGs(g);setScreen('game')
  }

  const onPlay = useCallback(async(card,combo)=>{
    const cur=gsRef.current
    if(!cur||cur.currentPlayer!==idxRef.current) return
    const g=applyPlayCard(cur,idxRef.current,card,combo)
    setGs(g)
    await supabase.from('rooms').update({game_state:g}).eq('id',roomId)
    if(g.phase==='roundover') calcResult(g)
  },[roomId,calcResult])

  const onNext = async()=>{
    if(!result) return
    const{ns,win,ms}=result
    if(win>=0){
      setScreen('lobby');setResult(null);setGs(null)
      if(roomId) await supabase.from('rooms').update({status:'finished'}).eq('id',roomId)
      return
    }
    if(isHost){
      const g={...initGameState(gs.playerNames,false),scores:ns,maxScore:ms||gs.maxScore||21}
      await supabase.from('rooms').update({game_state:g}).eq('id',roomId);setGs(g)
    }
    setResult(null)
  }

  const onRematch = async()=>{
    if(!result) return
    const g={...initGameState(gs.playerNames,false),maxScore:gs.maxScore||21}
    if(isHost){ await supabase.from('rooms').update({game_state:g,status:'playing'}).eq('id',roomId);setGs(g) }
    setResult(null)
  }

  const onLeave = async()=>{
    if(chRef.current) supabase.removeChannel(chRef.current)
    if(roomId&&isHost) await supabase.from('rooms').update({status:'finished'}).eq('id',roomId)
    setScreen('lobby');setGs(null);setCode(null);setResult(null)
  }

  useEffect(()=>{
    if(screen!=='waiting'||!roomId) return
    const p=setInterval(async()=>{
      const{data}=await supabase.from('rooms').select('player_names,status,game_state').eq('id',roomId).single()
      if(!data) return
      setNames(data.player_names||[])
      if(data.status==='playing'&&data.game_state&&!isHost){setGs(data.game_state);setScreen('game')}
    },1500)
    return()=>clearInterval(p)
  },[screen,roomId,isHost])

  return (
    <>
      {screen==='lobby'   &&<Lobby onCreate={onCreate} onJoin={onJoin} t={t} lang={lang} setLang={setLang}/>}
      {screen==='waiting' &&<WaitRoom code={code} players={names} myIdx={myIdx} isHost={isHost} onStart={onStart} onLeave={onLeave} t={t}/>}
      {screen==='game'&&gs&&<Game gs={gs} myIdx={myIdx} onPlay={onPlay} onLeave={onLeave} t={t}/>}
      {result&&<RoundRes r={result.r} scores={result.ns} cols={result.cols} names={result.names} t={t} onNext={onNext} onRematch={onRematch} over={result.win>=0} winner={result.win} ms={result.ms}/>}
      {/* Recovery button if game gets stuck */}
      {screen==='game'&&gs&&<div style={{ position:'fixed', bottom:8, right:8 }}><button onClick={onLeave} style={{ background:'transparent', border:`1px solid ${C.bd}`, borderRadius:6, color:C.tm, fontSize:10, cursor:'pointer', padding:'3px 8px' }}>Verlassen</button></div>}
    </>
  )
}
