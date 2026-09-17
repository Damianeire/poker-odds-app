// Hand evaluator for 5 to 7 cards. Returns a single comparable integer score
// plus a category. Higher score wins. Pure TypeScript, no dependencies.

import { type Card, rankOf, suitOf, rankName } from './cards';

export const enum Category {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export const CATEGORY_NAMES: readonly string[] = [
  'high card',
  'one pair',
  'two pair',
  'three of a kind',
  'straight',
  'flush',
  'full house',
  'four of a kind',
  'straight flush',
];

export const CATEGORY_COUNT = 9;

// Score layout: category in the top bits, then five 4-bit rank slots
// in order of significance. 9 * 2^20 fits comfortably in a 32-bit int.
const CAT_SHIFT = 20;

export function categoryOf(score: number): Category {
  return (score >> CAT_SHIFT) as Category;
}

export function categoryName(score: number): string {
  return CATEGORY_NAMES[categoryOf(score)]!;
}

/** Ranks encoded in the score, most significant first (up to 5). */
export function scoreRanks(score: number): number[] {
  const out: number[] = [];
  for (let i = 4; i >= 0; i--) {
    const r = (score >> (i * 4)) & 15;
    if (r !== 0) out.push(r);
  }
  return out;
}

function pack(cat: Category, ranks: readonly number[]): number {
  let s = cat << CAT_SHIFT;
  for (let i = 0; i < 5; i++) {
    s |= (ranks[i] ?? 0) << ((4 - i) * 4);
  }
  return s;
}

/**
 * Highest straight top rank present in a rank bitmask, or 0.
 * Bit r set means rank r is present (r = 2..14). Ace also counts as 1.
 */
function straightTop(bits: number): number {
  let b = bits;
  if (b & (1 << 14)) b |= 1 << 1;
  for (let hi = 14; hi >= 5; hi--) {
    const mask = 0b11111 << (hi - 4);
    if ((b & mask) === mask) return hi;
  }
  return 0;
}

function topRanks(bits: number, count: number, out: number[]): void {
  for (let r = 14; r >= 2 && out.length < count; r--) {
    if (bits & (1 << r)) out.push(r);
  }
}

// Scratch buffers reused across calls. The evaluator is synchronous and
// single-threaded, so this is safe and avoids allocation in hot loops.
const rankCount = new Int8Array(15);
const suitCount = new Int8Array(4);
const suitBits = new Int32Array(4);

/**
 * Evaluate 5, 6 or 7 cards. Returns a comparable integer score.
 */
export function evaluate(cards: readonly Card[]): number {
  const n = cards.length;
  if (n < 5 || n > 7) throw new Error(`evaluate needs 5-7 cards, got ${n}`);

  rankCount.fill(0);
  suitCount.fill(0);
  suitBits.fill(0);
  let rankBits = 0;

  for (let i = 0; i < n; i++) {
    const c = cards[i]!;
    const r = c >> 2;
    const s = c & 3;
    rankCount[r]!++;
    suitCount[s]!++;
    suitBits[s] = (suitBits[s] ?? 0) | (1 << r);
    rankBits |= 1 << r;
  }

  // Flush and straight flush.
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) {
    if (suitCount[s]! >= 5) {
      flushSuit = s;
      break;
    }
  }
  if (flushSuit >= 0) {
    const sfTop = straightTop(suitBits[flushSuit]!);
    if (sfTop > 0) return pack(Category.StraightFlush, [sfTop]);
  }

  // Count multiples.
  let quadRank = 0;
  let tripRank = 0;
  let pairHi = 0;
  let pairLo = 0;
  let secondTrip = 0;
  for (let r = 14; r >= 2; r--) {
    const c = rankCount[r]!;
    if (c === 4) {
      if (quadRank === 0) quadRank = r;
    } else if (c === 3) {
      if (tripRank === 0) tripRank = r;
      else if (secondTrip === 0) secondTrip = r;
    } else if (c === 2) {
      if (pairHi === 0) pairHi = r;
      else if (pairLo === 0) pairLo = r;
    }
  }

  if (quadRank > 0) {
    const kick: number[] = [];
    topRanks(rankBits & ~(1 << quadRank), 1, kick);
    return pack(Category.FourOfAKind, [quadRank, kick[0] ?? 0]);
  }

  if (tripRank > 0 && (pairHi > 0 || secondTrip > 0)) {
    const fill = Math.max(pairHi, secondTrip);
    return pack(Category.FullHouse, [tripRank, fill]);
  }

  if (flushSuit >= 0) {
    const ranks: number[] = [];
    topRanks(suitBits[flushSuit]!, 5, ranks);
    return pack(Category.Flush, ranks);
  }

  const st = straightTop(rankBits);
  if (st > 0) return pack(Category.Straight, [st]);

  if (tripRank > 0) {
    const kick: number[] = [];
    topRanks(rankBits & ~(1 << tripRank), 2, kick);
    return pack(Category.ThreeOfAKind, [tripRank, ...kick]);
  }

  if (pairHi > 0 && pairLo > 0) {
    const kick: number[] = [];
    topRanks(rankBits & ~(1 << pairHi) & ~(1 << pairLo), 1, kick);
    return pack(Category.TwoPair, [pairHi, pairLo, ...kick]);
  }

  if (pairHi > 0) {
    const kick: number[] = [];
    topRanks(rankBits & ~(1 << pairHi), 3, kick);
    return pack(Category.OnePair, [pairHi, ...kick]);
  }

  const ranks: number[] = [];
  topRanks(rankBits, 5, ranks);
  return pack(Category.HighCard, ranks);
}

/** Plain-language description of a score, e.g. "flush, ace high" or "two pair, kings and sevens". */
export function describeScore(score: number): string {
  const cat = categoryOf(score);
  const r = scoreRanks(score);
  const plural = (rank: number): string => {
    const n = rankName(rank);
    return n === 'six' ? 'sixes' : `${n}s`;
  };
  switch (cat) {
    case Category.StraightFlush:
      return r[0] === 14 ? 'royal flush' : `straight flush, ${rankName(r[0]!)} high`;
    case Category.FourOfAKind:
      return `four of a kind, ${plural(r[0]!)}`;
    case Category.FullHouse:
      return `full house, ${plural(r[0]!)} full of ${plural(r[1]!)}`;
    case Category.Flush:
      return `flush, ${rankName(r[0]!)} high`;
    case Category.Straight:
      return `straight, ${rankName(r[0]!)} high`;
    case Category.ThreeOfAKind:
      return `three of a kind, ${plural(r[0]!)}`;
    case Category.TwoPair:
      return `two pair, ${plural(r[0]!)} and ${plural(r[1]!)}`;
    case Category.OnePair:
      return `one pair, ${plural(r[0]!)}`;
    default:
      return `high card, ${rankName(r[0]!)}`;
  }
}

/** Convenience: evaluate hole cards plus board. */
export function evaluateHand(hole: readonly Card[], board: readonly Card[]): number {
  return evaluate([...hole, ...board]);
}

// Re-export helpers used by callers that want rank/suit without importing cards.
export { rankOf, suitOf };
