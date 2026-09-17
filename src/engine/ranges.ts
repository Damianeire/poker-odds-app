// Percentage-based ranges over a static ordering of the 169 starting hand
// classes, and equity against a range.

import { type Card, remainingDeck } from './cards';
import { enumerate, type EquityResult } from './enumerate';
import { evaluate } from './evaluator';
import { type Rng } from './rng';
import { type HandClass, parseHandClass, formatHandClass, combosOfClass, baseCombos, STARTING_HANDS } from './combos';

/**
 * The one static table in the engine: an ordering of starting hands by
 * strength against a random hand, strongest first. It defines what "the top
 * x% of hands" means. It carries no probabilities; those are computed.
 * Tests check it against Monte Carlo equity so an ordering error is caught.
 */
export const HAND_RANKING: readonly string[] = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', 'AKs', '77', 'AQs', 'AJs', 'AKo', 'ATs', 'AQo', 'AJo', 'KQs', '66', 'A9s', 'ATo',
  'KJs', 'A8s', 'KTs', 'KQo', '55', 'A7s', 'A9o', 'KJo', 'QJs', 'A5s', 'A6s', 'A8o', 'KTo', 'QTs', 'A4s', 'A7o', 'K9s', 'JTs',
  '44', 'QJo', 'A3s', 'A6o', 'K8s', 'Q9s', 'A5o', 'QTo', 'K7s', 'A2s', 'JTo', 'K9o', 'A4o', '33', 'J9s', 'K6s', 'T9s', 'Q8s',
  'A3o', 'K8o', 'K5s', 'Q9o', 'J8s', 'A2o', 'K4s', 'J9o', 'T8s', 'Q7s', 'K7o', '22', 'K3s', 'T9o', 'Q6s', 'K2s', 'J7s', 'Q8o',
  'K6o', '98s', 'T7s', 'Q5s', 'J8o', 'K5o', 'Q4s', 'T8o', '97s', 'J6s', 'K4o', 'Q3s', 'J5s', '87s', 'T6s', 'Q7o', '98o', 'K3o',
  'Q2s', 'J4s', '96s', 'T7o', 'K2o', 'Q6o', 'J7o', '86s', 'J3s', 'T5s', '76s', 'Q5o', '95s', 'J2s', 'T4s', '97o', 'Q4o', '87o',
  '85s', 'T3s', '65s', 'J6o', 'T6o', '75s', 'Q3o', 'T2s', '94s', '96o', 'J5o', '54s', '86o', 'Q2o', '84s', '64s', '93s', 'J4o',
  '74s', '76o', 'T5o', '92s', '53s', 'J3o', '63s', '95o', 'T4o', '85o', '43s', '73s', 'J2o', '65o', '83s', 'T3o', '82s', '52s',
  '75o', '94o', '62s', 'T2o', '54o', '72s', '42s', '84o', '64o', '93o', '74o', '32s', '92o', '53o', '63o', '43o', '83o', '73o',
  '82o', '52o', '62o', '72o', '42o', '32o',
];

export interface Range {
  classes: HandClass[];
  /** Combos with no cards visible, summed over classes. */
  combos: number;
  /** Fraction of all 1,326 starting hands. */
  fraction: number;
}

/** The top fraction of starting hands by the ranking, e.g. 0.2 for the top 20%. */
export function topRange(fraction: number): Range {
  if (!(fraction > 0 && fraction <= 1)) throw new Error('fraction must be in (0, 1]');
  const target = fraction * STARTING_HANDS;
  const classes: HandClass[] = [];
  let combos = 0;
  for (const name of HAND_RANKING) {
    if (combos >= target - 1e-9) break;
    const c = parseHandClass(name);
    classes.push(c);
    combos += baseCombos(c);
  }
  return { classes, combos, fraction: combos / STARTING_HANDS };
}

/** Where a class sits in the ranking, as the smallest top-fraction that includes it. */
export function rankFractionOf(c: HandClass): number {
  const name = formatHandClass(c);
  let combos = 0;
  for (const n of HAND_RANKING) {
    combos += baseCombos(parseHandClass(n));
    if (n === name) return combos / STARTING_HANDS;
  }
  throw new Error(`class ${name} not in ranking`);
}

/** Concrete combos in a range with the visible cards removed. */
export function rangeCombos(range: Range, visible: readonly Card[]): Card[][] {
  const out: Card[][] = [];
  for (const c of range.classes) for (const combo of combosOfClass(c, visible)) out.push(combo);
  return out;
}

export interface RangeEquity {
  equity: number;
  /** Number of villain combos considered. */
  combos: number;
  method: 'enumerate' | 'montecarlo';
  /** Half-width of a 95% interval; 0 when enumerated. */
  ci95: number;
  /** Hero's equity against each combo, in the same order as combos. */
  perCombo?: number[];
}

export interface RangeEquityOptions {
  /** Trials for the preflop Monte Carlo path. */
  trials?: number;
  rng?: Rng;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Hero's equity against every combo in a range, weighted equally. On a flop or
 * later each combo is enumerated exactly. Preflop it is sampled.
 */
export function equityVsRange(hero: readonly Card[], combos: readonly (readonly Card[])[], board: readonly Card[], opts: RangeEquityOptions = {}): RangeEquity {
  if (combos.length === 0) throw new Error('range has no combos left');
  if (board.length >= 3) {
    let sum = 0;
    const perCombo: number[] = [];
    combos.forEach((v, i) => {
      const r: EquityResult = enumerate([hero, v], board);
      const e = r.hands[0]!.equity;
      perCombo.push(e);
      sum += e;
      if (opts.onProgress && (i % 20 === 0 || i === combos.length - 1)) opts.onProgress(i + 1, combos.length);
    });
    return { equity: sum / combos.length, combos: combos.length, method: 'enumerate', ci95: 0, perCombo };
  }
  const trials = opts.trials ?? 40000;
  const rng = opts.rng;
  if (!rng) throw new Error('preflop range equity needs an rng');
  let sum = 0;
  let sumSq = 0;
  const buf = new Array<number>(7);
  const vbuf = new Array<number>(7);
  buf[0] = hero[0]!;
  buf[1] = hero[1]!;
  for (let i = 0; i < board.length; i++) {
    buf[2 + i] = board[i]!;
    vbuf[2 + i] = board[i]!;
  }
  const toCome = 5 - board.length;
  for (let t = 0; t < trials; t++) {
    const v = combos[Math.floor(rng.next() * combos.length)]!;
    vbuf[0] = v[0]!;
    vbuf[1] = v[1]!;
    const deck = remainingDeck([...hero, ...v, ...board]);
    for (let j = 0; j < toCome; j++) {
      const k = j + Math.floor(rng.next() * (deck.length - j));
      const tmp = deck[j]!;
      deck[j] = deck[k]!;
      deck[k] = tmp;
      buf[2 + board.length + j] = deck[j]!;
      vbuf[2 + board.length + j] = deck[j]!;
    }
    const h = evaluate(buf);
    const vs = evaluate(vbuf);
    const share = h > vs ? 1 : h === vs ? 0.5 : 0;
    sum += share;
    sumSq += share * share;
    if (opts.onProgress && t % 5000 === 0) opts.onProgress(t, trials);
  }
  const mean = sum / trials;
  const variance = Math.max(0, sumSq / trials - mean * mean);
  return { equity: mean, combos: combos.length, method: 'montecarlo', ci95: 1.96 * Math.sqrt(variance / trials) };
}
