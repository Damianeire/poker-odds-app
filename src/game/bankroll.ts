// EV Bankroll mode: a stream of decisions scored by expected value, not outcome.

import { type Card, formatCards } from '../engine/cards';
import { outProbabilities } from '../engine/outs';
import { evCall, evBluff, evSemiBluff } from '../engine/ev';
import { potOdds } from '../engine/potodds';
import { type Rng } from '../engine/rng';
import { dealDrawSpot } from '../drills/deal';
import { type PromptSpec, type ExplanationSpec, num } from '../drills/types';

export const STARTING_STACK = 100;

export interface DecisionOption {
  label: string;
  /** Expected value of this line in big blinds. */
  ev: number;
}

export interface Decision {
  kind: 'call' | 'bluff' | 'semibluff' | 'implied';
  prompt: PromptSpec;
  options: DecisionOption[];
  bestIndex: number;
  explanation: ExplanationSpec;
}

export interface ScoredChoice {
  chosenIndex: number;
  bestIndex: number;
  /** Stack change: the EV gained over the next best line, or the EV surrendered to the best line. */
  delta: number;
  correct: boolean;
}

function bb(x: number): string {
  return `${num(x, 1)} bb`;
}

function pickPotBb(rng: Rng): number {
  return rng.pick([4, 6, 8, 10, 12, 15, 18, 20, 25, 30]);
}

function callDecision(rng: Rng): Decision {
  const boardLength: 3 | 4 = rng.pick([3, 4]);
  const spot = dealDrawSpot(rng, { clean: rng.next() < 0.5, boardLength });
  const outs = spot.outs.count;
  const allIn = boardLength === 3 && rng.next() < 0.5;
  const probs = outProbabilities(outs, boardLength);
  const e = boardLength === 3 && allIn ? probs.byRiver : probs.nextCard;
  const pot = pickPotBb(rng);
  const bet = Math.round(pot * rng.pick([1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 1.5]) * 2) / 2;
  const call = evCall(pot, bet, e);
  const po = potOdds(pot, bet);
  const options = [
    { label: 'Call', ev: call.total },
    { label: 'Fold', ev: 0 },
  ];
  const bestIndex = call.total > 0 ? 0 : 1;
  return {
    kind: 'call',
    prompt: {
      text: `${boardLength === 3 ? (allIn ? 'Flop, villain all-in' : 'Flop, villain has chips behind') : 'Turn'}. Villain bets ${bb(bet)} into ${bb(pot)}. You are drawing to ${spot.target.label}.`,
      heroCards: spot.hero,
      board: spot.board,
      facts: [
        { label: 'Pot', value: bb(pot) },
        { label: 'Bet', value: bb(bet) },
      ],
      choices: options.map((o) => o.label),
    },
    options,
    bestIndex,
    explanation: {
      steps: [
        { text: `Outs: ${formatCards(spot.outs.outs)}.`, result: `${outs}` },
        { text: allIn || boardLength === 4 ? 'Chance to hit.' : 'Chance to hit on the next card; the call buys one card.', result: `${num(e * 100, 1)}% (need ${num(po.breakEven * 100, 1)}%)` },
        { text: 'EV of calling: e(P + B) - (1 - e)B.', formula: `${num(e, 3)} x ${pot + bet} - ${num(1 - e, 3)} x ${bet}`, result: bb(call.total) },
        { text: 'EV of folding is zero.' },
      ],
      summary: `${bestIndex === 0 ? 'Call' : 'Fold'}: calling is worth ${bb(call.total)}.`,
    },
  };
}

function bluffDecision(rng: Rng): Decision {
  const pot = pickPotBb(rng);
  const half = pot / 2;
  const full = pot;
  // Fold frequencies rise with size but not proportionally; both are given.
  const fHalf = rng.range(20, 55) / 100;
  const fFull = Math.min(0.9, fHalf + rng.range(5, 25) / 100);
  const bHalf = evBluff(pot, half, fHalf);
  const bFull = evBluff(pot, full, fFull);
  const options = [
    { label: 'Check, give up', ev: 0 },
    { label: `Bet half pot (${bb(half)})`, ev: bHalf.total },
    { label: `Bet pot (${bb(full)})`, ev: bFull.total },
  ];
  const bestIndex = options.reduce((b, o, i) => (o.ev > options[b]!.ev ? i : b), 0);
  return {
    kind: 'bluff',
    prompt: {
      text: `River. You missed everything and cannot win at showdown. Villain folds to a half-pot bet ${num(fHalf * 100, 0)}% of the time and to a pot-sized bet ${num(fFull * 100, 0)}% of the time.`,
      facts: [
        { label: 'Pot', value: bb(pot) },
        { label: 'Folds to half pot', value: `${num(fHalf * 100, 0)}%` },
        { label: 'Folds to pot', value: `${num(fFull * 100, 0)}%` },
      ],
      choices: options.map((o) => o.label),
    },
    options,
    bestIndex,
    explanation: {
      steps: [
        { text: 'Half pot: f x P - (1 - f) x B. Needs to work ' + num(bHalf.breakEvenFoldAll * 100, 0) + '% of the time.', formula: `${num(fHalf, 2)} x ${pot} - ${num(1 - fHalf, 2)} x ${half}`, result: bb(bHalf.total) },
        { text: 'Pot: needs to work ' + num(bFull.breakEvenFoldAll * 100, 0) + '% of the time.', formula: `${num(fFull, 2)} x ${pot} - ${num(1 - fFull, 2)} x ${full}`, result: bb(bFull.total) },
        { text: 'Checking is worth zero.' },
      ],
      summary: `Best: ${options[bestIndex]!.label} at ${bb(options[bestIndex]!.ev)}.`,
    },
  };
}

function semiBluffDecision(rng: Rng): Decision {
  const spot = dealDrawSpot(rng, { clean: rng.next() < 0.5, boardLength: 4 });
  const outs = spot.outs.count;
  const e = outProbabilities(outs, 4).nextCard;
  const pot = pickPotBb(rng);
  const bet = Math.round(pot * rng.pick([1 / 2, 2 / 3, 3 / 4, 1]) * 2) / 2;
  const f = rng.range(20, 65) / 100;
  const villainBet = Math.round(pot * rng.pick([1 / 3, 1 / 2, 2 / 3]) * 2) / 2;
  // Villain checks to you. Options: check behind (see the river for free, worth e x P as a rough
  // one-street value), bet as a semi-bluff. Checking realises equity for the current pot only.
  const check = e * pot;
  const semi = evSemiBluff(pot, bet, f, e);
  const options = [
    { label: 'Check behind', ev: check },
    { label: `Bet ${bb(bet)}`, ev: semi.total },
  ];
  const bestIndex = semi.total > check ? 1 : 0;
  void villainBet;
  return {
    kind: 'semibluff',
    prompt: {
      text: `Turn, villain checks to you. You have ${outs} outs to ${spot.target.label}. If you bet ${bb(bet)}, villain folds ${num(f * 100, 0)}% and otherwise calls. If you check, you see the river for free.`,
      heroCards: spot.hero,
      board: spot.board,
      facts: [
        { label: 'Pot', value: bb(pot) },
        { label: 'Villain folds to a bet', value: `${num(f * 100, 0)}%` },
      ],
      choices: options.map((o) => o.label),
    },
    options,
    bestIndex,
    explanation: {
      steps: [
        { text: 'Checking: you hit the river with probability e and, as a simplification, win the current pot then.', formula: `${num(e, 3)} x ${pot}`, result: bb(check) },
        { text: 'Betting: fold equity plus the called case.', formula: `${num(f, 2)} x ${pot} + ${num(1 - f, 2)} x [${num(e, 3)} x ${pot + bet} - ${num(1 - e, 3)} x ${bet}]`, result: `${bb(semi.foldTerm)} + ${bb(semi.calledTerm)} = ${bb(semi.total)}` },
        { text: 'Fold equity and draw equity add. That is why draws prefer betting to checking when villain folds often enough.' },
      ],
      summary: `Best: ${options[bestIndex]!.label} at ${bb(options[bestIndex]!.ev)}.`,
    },
  };
}

function impliedDecision(rng: Rng): Decision {
  const spot = dealDrawSpot(rng, { clean: rng.next() < 0.5, boardLength: 4 });
  const outs = spot.outs.count;
  const e = outProbabilities(outs, 4).nextCard;
  const pot = pickPotBb(rng);
  const bet = Math.round(pot * rng.pick([1 / 2, 2 / 3, 3 / 4, 1]) * 2) / 2;
  const propensity = rng.pick([0, 0.25, 0.5, 0.75, 1, 1.5]);
  const x = propensity * pot;
  const evImplied = e * (pot + bet + x) - (1 - e) * bet;
  const options = [
    { label: 'Call', ev: evImplied },
    { label: 'Fold', ev: 0 },
  ];
  const bestIndex = evImplied > 0 ? 0 : 1;
  const immediate = evCall(pot, bet, e);
  return {
    kind: 'implied',
    prompt: {
      text: `Turn. Villain bets ${bb(bet)} into ${bb(pot)}. You have ${outs} outs to ${spot.target.label}. When you hit, you expect to win a further ${num(propensity, 2)} x pot on the river.`,
      heroCards: spot.hero,
      board: spot.board,
      facts: [
        { label: 'Pot', value: bb(pot) },
        { label: 'Bet', value: bb(bet) },
        { label: 'Expected extra when you hit', value: bb(x) },
      ],
      choices: options.map((o) => o.label),
    },
    options,
    bestIndex,
    explanation: {
      steps: [
        { text: 'On immediate odds alone.', formula: `${num(e, 3)} x ${pot + bet} - ${num(1 - e, 3)} x ${bet}`, result: bb(immediate.total) },
        { text: 'Adding the expected future winnings to what you win when you hit.', formula: `${num(e, 3)} x (${pot + bet} + ${num(x, 1)}) - ${num(1 - e, 3)} x ${bet}`, result: bb(evImplied) },
        { text: 'The future winnings figure is an estimate; the arithmetic is exact.' },
      ],
      summary: `${bestIndex === 0 ? 'Call' : 'Fold'}: calling is worth ${bb(evImplied)} with implied odds.`,
    },
  };
}

export function generateDecision(rng: Rng): Decision {
  const kind = rng.pick(['call', 'call', 'bluff', 'semibluff', 'implied'] as const);
  switch (kind) {
    case 'bluff':
      return bluffDecision(rng);
    case 'semibluff':
      return semiBluffDecision(rng);
    case 'implied':
      return impliedDecision(rng);
    default:
      return callDecision(rng);
  }
}

/** Stack change for a choice: gain over the next best line, or loss against the best line. */
export function scoreChoice(d: Decision, chosenIndex: number): ScoredChoice {
  const evs = d.options.map((o) => o.ev);
  const best = evs[d.bestIndex]!;
  if (chosenIndex === d.bestIndex) {
    const others = evs.filter((_, i) => i !== d.bestIndex);
    const second = others.length ? Math.max(...others) : best;
    return { chosenIndex, bestIndex: d.bestIndex, delta: best - second, correct: true };
  }
  return { chosenIndex, bestIndex: d.bestIndex, delta: evs[chosenIndex]! - best, correct: false };
}

/** Big blinds won or lost per 100 decisions. */
export function bb100(totalDelta: number, decisions: number): number {
  if (decisions === 0) return 0;
  return (totalDelta / decisions) * 100;
}

export type { Card };
