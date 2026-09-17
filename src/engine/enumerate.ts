// Exact equity by full enumeration of every possible runout.

import { type Card, remainingDeck, assertDistinct } from './cards';
import { evaluate } from './evaluator';
import { choose, forEachCombination } from './math';

export interface HandEquity {
  /** Fraction of runouts where this hand is the unique best. */
  win: number;
  /** Fraction of runouts where this hand ties for best. */
  tie: number;
  /** Fraction of runouts where this hand loses outright. */
  loss: number;
  /** Pot share: win + tied share. Sums to 1 across all hands. */
  equity: number;
}

export interface EquityResult {
  hands: HandEquity[];
  /** Number of runouts enumerated or trials sampled. */
  runouts: number;
  method: 'enumerate' | 'montecarlo';
  /** Half-width of a 95% confidence interval on equity, per hand. 0 for enumeration. */
  ci95: number[];
}

export interface EnumerateOptions {
  /** Called periodically with (done, total). */
  onProgress?: (done: number, total: number) => void;
  /** How often to call onProgress, in runouts. */
  progressEvery?: number;
}

export function validateEquityInputs(hands: readonly (readonly Card[])[], board: readonly Card[], dead: readonly Card[]): void {
  if (hands.length < 1) throw new Error('need at least one hand');
  for (const h of hands) {
    if (h.length !== 2) throw new Error('each hand must have exactly two cards');
  }
  if (board.length > 5) throw new Error('board has more than five cards');
  assertDistinct([...hands.flat(), ...board, ...dead], 'equity inputs');
}

/** Number of runouts full enumeration would visit for these inputs. */
export function runoutCount(hands: readonly (readonly Card[])[], board: readonly Card[], dead: readonly Card[] = []): number {
  const known = hands.length * 2 + board.length + dead.length;
  return choose(52 - known, 5 - board.length);
}

/**
 * Exact equity for each hand by iterating every possible completion of the board.
 */
export function enumerate(
  hands: readonly (readonly Card[])[],
  board: readonly Card[],
  dead: readonly Card[] = [],
  opts: EnumerateOptions = {},
): EquityResult {
  validateEquityInputs(hands, board, dead);
  const n = hands.length;
  const remaining = remainingDeck([...hands.flat(), ...board, ...dead]);
  const toCome = 5 - board.length;
  const total = choose(remaining.length, toCome);
  const progressEvery = opts.progressEvery ?? 8192;

  const wins = new Float64Array(n);
  const ties = new Float64Array(n);
  const share = new Float64Array(n);
  const scores = new Float64Array(n);

  // Scratch 7-card buffers per hand: hole cards fixed, board filled per runout.
  const bufs: number[][] = hands.map((h) => {
    const b = new Array<number>(7);
    b[0] = h[0]!;
    b[1] = h[1]!;
    for (let i = 0; i < board.length; i++) b[2 + i] = board[i]!;
    return b;
  });

  let done = 0;
  const scoreRunout = (runout: readonly number[]): void => {
    let best = -1;
    let bestCount = 0;
    for (let i = 0; i < n; i++) {
      const buf = bufs[i]!;
      for (let j = 0; j < toCome; j++) buf[2 + board.length + j] = runout[j]!;
      const s = evaluate(buf);
      scores[i] = s;
      if (s > best) {
        best = s;
        bestCount = 1;
      } else if (s === best) {
        bestCount++;
      }
    }
    if (bestCount === 1) {
      for (let i = 0; i < n; i++) {
        if (scores[i] === best) {
          wins[i]!++;
          share[i]!++;
        }
      }
    } else {
      const part = 1 / bestCount;
      for (let i = 0; i < n; i++) {
        if (scores[i] === best) {
          ties[i]!++;
          share[i]! += part;
        }
      }
    }
    done++;
    if (opts.onProgress && done % progressEvery === 0) opts.onProgress(done, total);
  };

  if (toCome === 0) {
    scoreRunout([]);
  } else {
    forEachCombination(remaining, toCome, (combo) => {
      scoreRunout(combo);
    });
  }
  if (opts.onProgress) opts.onProgress(done, total);

  const result: HandEquity[] = [];
  for (let i = 0; i < n; i++) {
    result.push({
      win: wins[i]! / done,
      tie: ties[i]! / done,
      loss: 1 - (wins[i]! + ties[i]!) / done,
      equity: share[i]! / done,
    });
  }
  return { hands: result, runouts: done, method: 'enumerate', ci95: new Array<number>(n).fill(0) };
}
