'use client'

const RED = { '♥':true, '♦':true }

export function CardBack({ small, tiny }) {
  const w = tiny?32 : small?46 : 64
  const h = tiny?46 : small?68 : 92
  return (
    <div style={{
      width:w, height:h, borderRadius:9, flexShrink:0,
      background:'linear-gradient(145deg,#162540,#0a1525)',
      border:'1.5px solid #223560',
      boxShadow:'0 4px 14px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.05)',
      display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden',
    }}>
      <div style={{ width:w-12, height:h-12, borderRadius:6, border:'1px solid #1a2d50',
        background:'repeating-linear-gradient(45deg,#0e1e38,#0e1e38 3px,#081020 3px,#081020 6px)', opacity:.9 }}/>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(212,168,67,.08) 0%,transparent 60%)', pointerEvents:'none' }}/>
    </div>
  )
}

export function CardFace({ card, small, tiny, disabled, isDragging, isHighlight, isCollecting, isLanding, onDragStart, onClick }) {
  const isRed = RED[card.suit]
  const w = tiny?32 : small?46 : 64
  const h = tiny?46 : small?68 : 92

  let bg     = 'linear-gradient(160deg,#ffffff 0%,#f0e8d8 100%)'
  let border = '1.5px solid #cbbfa0'
  let shadow = '0 4px 16px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.95)'
  let tc     = isRed ? '#a01818' : '#0e1e30'
  let anim   = ''
  let op     = 1

  if (isDragging)  { op = .18 }
  if (isHighlight) {
    bg='linear-gradient(160deg,#0d3020,#071a10)'; border='2px solid #28c47e'
    shadow='0 0 0 3px rgba(40,196,126,.3), 0 6px 20px rgba(0,0,0,.6)'
    tc=isRed?'#f87171':'#6ee7b7'; anim='card-glow'
  }
  if (isCollecting) anim='card-collect'
  if (isLanding)    anim='card-land'

  const fs  = tiny?9  : small?11 : 16
  const fs2 = tiny?8  : small?10 : 13

  return (
    <div className={anim} onMouseDown={!disabled&&onDragStart?onDragStart:undefined}
      onTouchStart={!disabled&&onDragStart?onDragStart:undefined}
      onClick={!disabled&&onClick?onClick:undefined}
      style={{ width:w, height:h, borderRadius:9, flexShrink:0, background:bg, border, boxShadow:shadow,
        cursor:disabled?'default':onDragStart?'grab':'pointer',
        display:'flex', flexDirection:'column', justifyContent:'space-between',
        padding:tiny?'2px 3px':'5px 7px', opacity:op, userSelect:'none',
        position:'relative', overflow:'hidden', transition:isDragging?'opacity .15s':'none' }}>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(255,255,255,.18) 0%,transparent 55%)', pointerEvents:'none', borderRadius:8 }}/>
      <div style={{ fontSize:fs, fontWeight:700, color:tc, lineHeight:1.1, position:'relative' }}>
        {card.rank}<br/><span style={{ fontSize:fs2 }}>{card.suit}</span>
      </div>
      {!tiny && (
        <div style={{ fontSize:fs, fontWeight:700, color:tc, lineHeight:1.1, alignSelf:'flex-end', transform:'rotate(180deg)', position:'relative' }}>
          {card.rank}<br/><span style={{ fontSize:fs2 }}>{card.suit}</span>
        </div>
      )}
    </div>
  )
}

export function DragGhost({ card, x, y }) {
  if (!card) return null
  const isRed = RED[card.suit]
  return (
    <div style={{ position:'fixed', left:x-32, top:y-46, width:64, height:92, borderRadius:9,
      background:'linear-gradient(160deg,#ffffff,#f0e8d8)',
      border:'2px solid #5a9ae0', boxShadow:'0 22px 55px rgba(0,0,0,.75), 0 0 0 3px rgba(90,154,224,.3)',
      display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'5px 7px',
      transform:'scale(1.08) rotate(4deg)', pointerEvents:'none', zIndex:9999, userSelect:'none' }}>
      <div style={{ fontSize:16, fontWeight:700, color:isRed?'#a01818':'#0e1e30', lineHeight:1.1 }}>
        {card.rank}<br/><span style={{ fontSize:13 }}>{card.suit}</span>
      </div>
      <div style={{ fontSize:16, fontWeight:700, color:isRed?'#a01818':'#0e1e30', lineHeight:1.1, alignSelf:'flex-end', transform:'rotate(180deg)' }}>
        {card.rank}<br/><span style={{ fontSize:13 }}>{card.suit}</span>
      </div>
    </div>
  )
}
