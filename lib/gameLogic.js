// ─── CARD CONSTANTS ────────────────────────────────────────────────────────────
export const SUITS = ['♠','♥','♦','♣']
export const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']

export function cardVal(rank) {
  if (rank === 'A') return 1
  if (['J','Q','K'].includes(rank)) return 10
  return parseInt(rank)
}

export const isFace  = (r) => ['J','Q','K'].includes(r)
export const isJack  = (r) => r === 'J'
export const isQueen = (r) => r === 'Q'
export const isKing  = (r) => r === 'K'

// ─── DECK ──────────────────────────────────────────────────────────────────────
export function createDeck() {
  const d = []
  for (const s of SUITS)
    for (const r of RANKS)
      d.push({ suit: s, rank: r, id: `${r}${s}` })
  return shuffle(d)
}

export function shuffle(a) {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

// ─── COMBINATION SEARCH ────────────────────────────────────────────────────────
/**
 * findElevenCombinations(tableCards)
 * Returns every subset of tableCards (non-face only) whose values sum to exactly 11.
 * Uses backtracking – stable even with 10+ cards on table.
 */
export function findElevenCombinations(tableCards) {
  const nonFace = tableCards.filter(c => !isFace(c.rank))
  const results = []

  function backtrack(startIdx, current, currentSum) {
    if (currentSum === 11) {
      results.push([...current])
      return
    }
    if (currentSum > 11) return

    for (let i = startIdx; i < nonFace.length; i++) {
      const card = nonFace[i]
      current.push(card)
      backtrack(i + 1, current, currentSum + cardVal(card.rank))
      current.pop()
    }
  }

  backtrack(0, [], 0)
  return results
}

/**
 * findCombosIncludingCard(playedCard, allTableCards)
 * Returns all subsets of OTHER table cards that, together with playedCard, sum to 11.
 * playedCard is already included in allTableCards when this is called.
 */
export function findCombosIncludingCard(playedCard, allTableCards) {
  if (isFace(playedCard.rank)) return []

  const pv     = cardVal(playedCard.rank)
  const target = 11 - pv
  const others = allTableCards.filter(c => c.id !== playedCard.id && !isFace(c.rank))
  const results = []

  function backtrack(startIdx, current, currentSum) {
    if (currentSum === target) {
      results.push([...current])
      return
    }
    if (currentSum > target) return

    for (let i = startIdx; i < others.length; i++) {
      const card = others[i]
      current.push(card)
      backtrack(i + 1, current, currentSum + cardVal(card.rank))
      current.pop()
    }
  }

  backtrack(0, [], 0)
  return results // each entry = the OTHER cards (not playedCard itself)
}

// ─── GAME INIT ─────────────────────────────────────────────────────────────────
export function initGameState(playerNames, teamMode = false) {
  const n    = playerNames.length
  const deck = createDeck()
  const hands = []
  let di = 0
  for (let i = 0; i < n; i++) { hands.push(deck.slice(di, di + 4)); di += 4 }
  const tableCards = deck.slice(di, di + 4)
  return {
    deck: deck.slice(di + 4),
    hands,
    table: tableCards,
    collected: Array(n).fill(null).map(() => []),
    scores: Array(n).fill(0),
    currentPlayer: 0,
    phase: 'playing',
    playerNames,
    teamMode,
    lastCollector: null,
    lastAction: null,
  }
}

// ─── APPLY PLAY (pure, no side-effects) ───────────────────────────────────────
/**
 * applyPlayCard(gs, playerIdx, card, comboCards)
 *
 * comboCards = the OTHER table cards that form the 11-combo (not the played card itself).
 * For Jack: comboCards is ignored — logic is applied internally.
 * For Q/K:  comboCards is ignored — matching face card is auto-collected.
 * Returns { ...newState, removedIds: string[] }
 */
export function applyPlayCard(gs, playerIdx, card, comboCards) {
  const n = gs.playerNames.length

  // 1. Remove card from hand
  let newHands = gs.hands.map(h => [...h])
  newHands[playerIdx] = newHands[playerIdx].filter(c => c.id !== card.id)

  // 2. Place card on table
  let newTable     = [...gs.table, card]
  let newCollected = gs.collected.map(c => [...c])
  let removedIds   = []

  if (isJack(card.rank)) {
    // Jack: takes everything EXCEPT Q and K — this includes other Jacks on the table
    const toTake = newTable.filter(c => !isQueen(c.rank) && !isKing(c.rank))
    removedIds   = toTake.map(c => c.id)
    newCollected[playerIdx] = [...newCollected[playerIdx], ...toTake]
    newTable = newTable.filter(c => isQueen(c.rank) || isKing(c.rank))

  } else if (isQueen(card.rank)) {
    // Queen: take one other Queen from table
    const otherQueens = newTable.filter(c => c.rank === 'Q' && c.id !== card.id)
    if (otherQueens.length > 0) {
      const pair = [card, otherQueens[0]]
      removedIds = pair.map(c => c.id)
      newCollected[playerIdx] = [...newCollected[playerIdx], ...pair]
      newTable = newTable.filter(c => !removedIds.includes(c.id))
    }

  } else if (isKing(card.rank)) {
    // King: take one other King from table
    const otherKings = newTable.filter(c => c.rank === 'K' && c.id !== card.id)
    if (otherKings.length > 0) {
      const pair = [card, otherKings[0]]
      removedIds = pair.map(c => c.id)
      newCollected[playerIdx] = [...newCollected[playerIdx], ...pair]
      newTable = newTable.filter(c => !removedIds.includes(c.id))
    }

  } else if (comboCards && comboCards.length > 0) {
    // 11-combo: take played card + combo partners
    const taken = [card, ...comboCards]
    removedIds  = taken.map(c => c.id)
    newCollected[playerIdx] = [...newCollected[playerIdx], ...taken]
    newTable = newTable.filter(c => !removedIds.includes(c.id))
  }

  // 3. Track last player who actually collected cards
  const didCollect = removedIds.length > 0
  const lastCollector = didCollect ? playerIdx : (gs.lastCollector ?? null)

  // 4. Refill empty hands from deck
  let newDeck = [...gs.deck]
  for (let i = 0; i < n; i++) {
    if (newHands[i].length === 0 && newDeck.length > 0) {
      const take = Math.min(4, newDeck.length)
      newHands[i] = newDeck.slice(0, take)
      newDeck     = newDeck.slice(take)
    }
  }

  const next     = (playerIdx + 1) % n
  const allEmpty = newHands.every(h => h.length === 0) && newDeck.length === 0

  // 5. At round end: leftover table cards go to last collector
  let finalTable     = newTable
  let finalCollected = newCollected
  if (allEmpty && newTable.length > 0) {
    const recipient = lastCollector !== null ? lastCollector : playerIdx
    finalCollected = newCollected.map((c, i) =>
      i === recipient ? [...c, ...newTable] : c
    )
    finalTable = []
  }

  const phase = allEmpty ? 'roundover' : 'playing'

  return {
    ...gs,
    hands:         newHands,
    table:         finalTable,
    collected:     finalCollected,
    deck:          newDeck,
    currentPlayer: next,
    lastCollector,
    phase,
    lastAction: {
      playerIdx,
      card,
      comboCards: comboCards || [],
      removedIds,
      tableBeforePlay: gs.table,  // snapshot of table BEFORE this move
      timestamp: Date.now(),
    },
  }
}


// ─── ROUND SCORING ─────────────────────────────────────────────────────────────
export function calcRoundPts(collected, teamMode, n) {
  const pts = Array(n).fill(0)

  // Most cards → 2 pts
  const counts = collected.map(c => c.length)
  const maxC   = Math.max(...counts)
  const winnersC = counts.reduce((a, v, i) => v === maxC ? [...a, i] : a, [])
  if (winnersC.length === 1) pts[winnersC[0]] += 2

  // Most clubs → 1 pt
  const clubs = collected.map(c => c.filter(x => x.suit === '♣').length)
  const maxCl  = Math.max(...clubs)
  const winnersCl = clubs.reduce((a, v, i) => v === maxCl ? [...a, i] : a, [])
  if (winnersCl.length === 1) pts[winnersCl[0]] += 1

  // 2♣ → 1 pt
  collected.forEach((c, i) => {
    if (c.some(x => x.rank === '2' && x.suit === '♣')) pts[i] += 1
  })

  // 10♦ → 1 pt
  collected.forEach((c, i) => {
    if (c.some(x => x.rank === '10' && x.suit === '♦')) pts[i] += 1
  })

  // Team mode: merge pairs
  if (teamMode && n === 4) {
    const t0 = pts[0] + pts[2]
    const t1 = pts[1] + pts[3]
    return { pts: [t0, t1, t0, t1], counts, clubs }
  }

  return { pts, counts, clubs }
}
