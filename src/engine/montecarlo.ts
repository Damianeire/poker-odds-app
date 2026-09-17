// Sampled equity with a 95% confidence interval.

import { type Card, remainingDeck } from './cards';
import { evaluate } from './evaluator';
import { type EquityResult, type HandEquity, validateEquityInputs } from './enumerate';
import { type Rng } from './rng';

export function monteCarlo(
  hands: readonly (readonly Card[])[],
  board: readonly Card[],
  dead: readonly Card[],
  trials: number,
  rng: Rng,
): EquityResult {
  validateEquityInputs(hands, board, dead);
  if (trials < 1) throw new Error('trials must be positive');
  const n = hands.length;
  const remaining = remainingDeck([...hands.flat(), ...board, ...dead]);
  const toCome = 5 - board.length;

  const wins = new Float64Array(n);
  const ties = new Float64Array(n);
  const share = new Float64Array(n);
  const shareSq = new Float64Array(n);
  const scores = new Float64Array(n);

  const bufs: number[][] = hands.map((h) => {
    const b = new Array<number>(7);
    b[0] = h[0]!;
    b[1] = h[1]!;
    for (let i = 0; i < board.length; i++) b[2 + i] = board[i]!;
    return b;
  });

  const deck = remaining.slice();
  for (let t = 0; t < trials; t++) {
    // Partial Fisher-Yates: draw toCome cards without replacement.
    for (let j = 0; j < toCome; j++) {
      const k = j + Math.floor(rng.next() * (deck.length - j));
      const tmp = deck[j]!;
      deck[j] = deck[k]!;
      deck[k] = tmp;
    }
    let best = -1;
    let bestCount = 0;
    for (let i = 0; i < n; i++) {
      const buf = bufs[i]!;
      for (let j = 0; j < toCome; j++) buf[2 + board.length + j] = deck[j]!;
      const s = evaluate(buf);
      scores[i] = s;
      if (s > best) {
        best = s;
        bestCount = 1;
      } else if (s === best) {
        bestCount++;
      }
    }
    const part = 1 / bestCount;
    for (let i = 0; i < n; i++) {
      if (scores[i] === best) {
        if (bestCount === 1) wins[i]!++;
        else ties[i]!++;
        share[i]! += part;
        shareSq[i]! += part * part;
      }
    }
  }

  const result: HandEquity[] = [];
  const ci95: number[] = [];
  for (let i = 0; i < n; i++) {
    const mean = share[i]! / trials;
    const variance = Math.max(0, shareSq[i]! / trials - mean * mean);
    ci95.push(1.96 * Math.sqrt(variance / trials));
    result.push({
      win: wins[i]! / trials,
      tie: ties[i]! / trials,
      loss: 1 - (wins[i]! + ties[i]!) / trials,
      equity: mean,
    });
  }
  return { hands: result, runouts: trials, method: 'montecarlo', ci95 };
}
