// Random situation generation shared by the drills. Everything here calls
// the engine; nothing is looked up.

import { type Card, fullDeck, rankOf } from '../engine/cards';
import { Category, evaluate, categoryOf } from '../engine/evaluator';
import { detectOutsToCategory, detectOutsVsHand, heroAhead, type OutsResult } from '../engine/outs';
import { type Rng } from '../engine/rng';

export interface DrawTarget {
  category: Category;
  /** How the drill names the target, e.g. "a flush". */
  label: string;
}

export const DRAW_TARGETS: readonly DrawTarget[] = [
  { category: Category.Flush, label: 'a flush' },
  { category: Category.Straight, label: 'a straight or better' },
  { category: Category.FullHouse, label: 'a full house or better' },
  { category: Category.ThreeOfAKind, label: 'three of a kind or better' },
  { category: Category.OnePair, label: 'a pair or better using one of your hole cards' },
];

/** The counts that appear in the standard teaching list, per target. */
const CLEAN_COUNTS: Record<number, number[]> = {
  [Category.Flush]: [9],
  [Category.Straight]: [4, 8],
  [Category.FullHouse]: [7],
  [Category.ThreeOfAKind]: [2],
  [Category.OnePair]: [6],
};

export interface DrawSpot {
  hero: Card[];
  board: Card[];
  target: DrawTarget;
  outs: OutsResult;
}

function hasOtherDraw(hero: Card[], board: Card[], except: Category): boolean {
  for (const t of DRAW_TARGETS) {
    if (t.category === except) continue;
    if (t.category < except) continue; // lower targets are subsumed
    if (detectOutsToCategory(hero, board, t.category).count > 0) return true;
  }
  return false;
}

/**
 * Deal hero plus a flop (or turn) that contains a draw to one of the targets.
 * clean = true restricts to the textbook counts with no second draw present.
 */
export function dealDrawSpot(rng: Rng, opts: { clean: boolean; boardLength?: 3 | 4 } = { clean: true }): DrawSpot {
  const boardLength = opts.boardLength ?? 3;
  for (let attempt = 0; attempt < 5000; attempt++) {
    const cards = rng.sample(fullDeck(), 2 + boardLength);
    const hero = cards.slice(0, 2);
    const board = cards.slice(2);
    const heroCat = categoryOf(evaluate([...hero, ...board]));
    // Try targets from strongest to weakest and take the first that has a draw.
    const candidates = rng.shuffle(DRAW_TARGETS.slice());
    for (const target of candidates) {
      if (heroCat >= target.category) continue;
      const outs = detectOutsToCategory(hero, board, target.category);
      if (outs.count === 0) continue;
      if (opts.clean) {
        const allowed = CLEAN_COUNTS[target.category] ?? [];
        if (!allowed.includes(outs.count)) continue;
        // Flush and straight targets: no flush draw alongside a straight draw, and vice versa.
        if (target.category === Category.Straight && detectOutsToCategory(hero, board, Category.Flush).count > 0) continue;
        if (target.category === Category.Flush && detectOutsToCategory(hero, board, Category.Straight).count > outs.count) continue;
        if (target.category === Category.OnePair) {
          // Two overcards: both hole cards above the board, unpaired.
          const top = Math.max(...board.map(rankOf));
          if (!(rankOf(hero[0]!) > top && rankOf(hero[1]!) > top)) continue;
          if (hasOtherDraw(hero, board, Category.OnePair)) continue;
        }
        if (target.category === Category.ThreeOfAKind && rankOf(hero[0]!) !== rankOf(hero[1]!)) continue;
      } else if (outs.count > 21) {
        continue;
      }
      return { hero, board, target, outs };
    }
  }
  throw new Error('could not deal a draw spot');
}

export interface VersusSpot {
  hero: Card[];
  villain: Card[];
  board: Card[];
  outs: OutsResult;
  /** Cards that improve hero's hand but still lose. */
  tainted: Card[];
}

/** Deal hero behind a villain hand with between 1 and 20 winning cards. */
export function dealVersusSpot(rng: Rng, boardLength: 3 | 4 = 3): VersusSpot {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const cards = rng.sample(fullDeck(), 4 + boardLength);
    const hero = cards.slice(0, 2);
    const villain = cards.slice(2, 4);
    const board = cards.slice(4);
    if (heroAhead(hero, villain, board)) continue;
    const outs = detectOutsVsHand(hero, villain, board);
    if (outs.count < 1 || outs.count > 20) continue;
    const current = evaluate([...hero, ...board]);
    const tainted = outs.nonOuts.filter((c) => evaluate([...hero, ...board, c]) > current);
    return { hero, villain, board, outs, tainted };
  }
  throw new Error('could not deal a versus spot');
}

/** Pick a plausible out count for text-only drills. */
export function pickOuts(rng: Rng, difficulty: 1 | 2 | 3): number {
  if (difficulty === 1) return rng.pick([2, 4, 6, 8, 9]);
  if (difficulty === 2) return rng.range(1, 15);
  return rng.range(1, 21);
}

/** Round-ish pot sizes at low difficulty, awkward ones higher up. */
export function pickPot(rng: Rng, difficulty: 1 | 2 | 3): number {
  if (difficulty === 1) return rng.pick([100, 200, 300, 400, 500, 1000]);
  if (difficulty === 2) return rng.pick([60, 80, 120, 150, 180, 240, 350, 450, 600, 750]);
  return rng.range(23, 987);
}

export const BET_FRACTIONS: readonly { label: string; fraction: number }[] = [
  { label: 'one third of the pot', fraction: 1 / 3 },
  { label: 'half the pot', fraction: 1 / 2 },
  { label: 'two thirds of the pot', fraction: 2 / 3 },
  { label: 'three quarters of the pot', fraction: 3 / 4 },
  { label: 'the size of the pot', fraction: 1 },
  { label: '1.5 times the pot', fraction: 1.5 },
  { label: 'twice the pot', fraction: 2 },
];

export function pickBet(rng: Rng, pot: number, difficulty: 1 | 2 | 3): { bet: number; label: string | null } {
  if (difficulty <= 2) {
    const f = rng.pick(BET_FRACTIONS);
    const raw = pot * f.fraction;
    const bet = difficulty === 1 ? Math.round(raw) : Math.round(raw);
    return { bet, label: f.label };
  }
  const bet = Math.max(1, Math.round(pot * (0.2 + rng.next() * 2.0)));
  return { bet, label: null };
}
