// Combinatorics and blockers, plus derived preflop and flop probabilities.

import { type Card, fullDeck, rankOf, suitOf, makeCard, RANK_CHARS } from './cards';
import { choose } from './math';

/** A starting hand class: 'AA', 'AKs', 'AKo'. */
export interface HandClass {
  hi: number;
  lo: number;
  kind: 'pair' | 'suited' | 'offsuit';
}

export function parseHandClass(text: string): HandClass {
  const t = text.trim();
  if (t.length < 2 || t.length > 3) throw new Error(`bad hand class "${text}"`);
  const a = RANK_CHARS.indexOf(t[0]!.toUpperCase()) + 2;
  const b = RANK_CHARS.indexOf(t[1]!.toUpperCase()) + 2;
  if (a < 2 || b < 2) throw new Error(`bad hand class "${text}"`);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (t.length === 2) {
    if (a !== b) throw new Error(`unpaired class "${text}" needs s or o`);
    return { hi, lo, kind: 'pair' };
  }
  if (a === b) throw new Error(`pair class "${text}" takes no suffix`);
  const suffix = t[2]!.toLowerCase();
  if (suffix === 's') return { hi, lo, kind: 'suited' };
  if (suffix === 'o') return { hi, lo, kind: 'offsuit' };
  throw new Error(`bad hand class "${text}"`);
}

export function formatHandClass(c: HandClass): string {
  const r = (x: number) => RANK_CHARS[x - 2]!;
  if (c.kind === 'pair') return `${r(c.hi)}${r(c.lo)}`;
  return `${r(c.hi)}${r(c.lo)}${c.kind === 'suited' ? 's' : 'o'}`;
}

/** Class of a concrete two-card hand. */
export function classOf(hand: readonly Card[]): HandClass {
  if (hand.length !== 2) throw new Error('hand must have two cards');
  const a = rankOf(hand[0]!);
  const b = rankOf(hand[1]!);
  if (a === b) return { hi: a, lo: a, kind: 'pair' };
  return { hi: Math.max(a, b), lo: Math.min(a, b), kind: suitOf(hand[0]!) === suitOf(hand[1]!) ? 'suited' : 'offsuit' };
}

/** Number of combinations of a class with no cards visible: 6, 4 or 12. */
export function baseCombos(c: HandClass): number {
  return c.kind === 'pair' ? 6 : c.kind === 'suited' ? 4 : 12;
}

/** Closed-form combos of an unpaired hand with bx and by cards of each rank visible. */
export function unpairedCombos(bx: number, by: number): number {
  return (4 - bx) * (4 - by);
}

/** Closed-form combos of a pocket pair with b cards of the rank visible. */
export function pairCombos(b: number): number {
  return choose(4 - b, 2);
}

/** Every concrete two-card combination of a class, excluding visible cards. */
export function combosOfClass(c: HandClass, visible: readonly Card[] = []): Card[][] {
  const dead = new Set(visible);
  const out: Card[][] = [];
  for (let s1 = 0; s1 < 4; s1++) {
    for (let s2 = 0; s2 < 4; s2++) {
      if (c.kind === 'pair') {
        if (s2 <= s1) continue;
      } else if (c.kind === 'suited') {
        if (s1 !== s2) continue;
      } else if (s1 === s2) continue;
      const x = makeCard(c.hi, s1);
      const y = makeCard(c.lo, s2);
      if (dead.has(x) || dead.has(y)) continue;
      out.push([x, y]);
    }
  }
  return out;
}

export interface BlockerEffect {
  handClass: HandClass;
  /** Combos given only the board. */
  withoutHero: number;
  /** Combos given the board and hero's cards. */
  withHero: number;
  removed: number;
}

/** How many combos of a class hero's own cards remove, over and above the board. */
export function blockerEffect(c: HandClass, hero: readonly Card[], board: readonly Card[] = []): BlockerEffect {
  const withoutHero = combosOfClass(c, board).length;
  const withHero = combosOfClass(c, [...board, ...hero]).length;
  return { handClass: c, withoutHero, withHero, removed: withoutHero - withHero };
}

export const STARTING_HANDS = choose(52, 2);

export interface DerivedProbability {
  label: string;
  numerator: number;
  denominator: number;
  probability: number;
  /** Odds against, x to 1. */
  oddsAgainst: number;
  formula: string;
}

function derived(label: string, numerator: number, denominator: number, formula: string): DerivedProbability {
  const p = numerator / denominator;
  return { label, numerator, denominator, probability: p, oddsAgainst: (1 - p) / p, formula };
}

/** Dealt a specific pocket pair: 6 / 1326. */
export function specificPairProb(): DerivedProbability {
  return derived('a specific pocket pair', 6, STARTING_HANDS, '6 / C(52, 2)');
}

/** Dealt any pocket pair: 13 x 6 / 1326. */
export function anyPairProb(): DerivedProbability {
  return derived('any pocket pair', 13 * 6, STARTING_HANDS, '13 x 6 / C(52, 2)');
}

/** Dealt a specific unpaired hand such as ace-king: 16 / 1326. */
export function specificUnpairedProb(): DerivedProbability {
  return derived('a specific unpaired hand', 16, STARTING_HANDS, '16 / C(52, 2)');
}

export const FLOPS = choose(50, 3);

/** Suited hole cards flop exactly four to the flush: C(11, 2) x 39 / C(50, 3). */
export function flopFlushDrawProb(): DerivedProbability {
  return derived('suited cards flop a flush draw', choose(11, 2) * 39, FLOPS, 'C(11, 2) x 39 / C(50, 3)');
}

/** Suited hole cards flop a flush: C(11, 3) / C(50, 3). */
export function flopFlushProb(): DerivedProbability {
  return derived('suited cards flop a flush', choose(11, 3), FLOPS, 'C(11, 3) / C(50, 3)');
}

/** Unpaired hole cards flop at least a pair using a hole card: 1 - C(44, 3) / C(50, 3). */
export function flopPairOrBetterProb(): DerivedProbability {
  return derived('unpaired cards flop a pair or better', FLOPS - choose(44, 3), FLOPS, '1 - C(44, 3) / C(50, 3)');
}

/** Pocket pair flops a set or better: 1 - C(48, 3) / C(50, 3). */
export function flopSetOrBetterProb(): DerivedProbability {
  return derived('a pocket pair flops a set or better', FLOPS - choose(48, 3), FLOPS, '1 - C(48, 3) / C(50, 3)');
}

/** All 169 starting hand classes. */
export function allHandClasses(): HandClass[] {
  const out: HandClass[] = [];
  for (let hi = 14; hi >= 2; hi--) {
    out.push({ hi, lo: hi, kind: 'pair' });
    for (let lo = hi - 1; lo >= 2; lo--) {
      out.push({ hi, lo, kind: 'suited' });
      out.push({ hi, lo, kind: 'offsuit' });
    }
  }
  return out;
}

export { fullDeck };
