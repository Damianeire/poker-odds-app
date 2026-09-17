// Drill 10: MDF and alpha. Drill 11: bluff break-even fold percentage.
// Drill 19: multiway bluff. Drill 20: dead money.

import { potOdds, potOddsFromContributions } from '../engine/potodds';
import { evBluff } from '../engine/ev';
import { formatOddsAgainst } from '../engine/shortcuts';
import { pickPot, pickBet } from './deal';
import { type Drill, type DrillInstance, num } from './types';

export const mdfAlpha: Drill = {
  id: 'mdf-alpha',
  module: 'M8',
  title: 'MDF and alpha',
  description: 'Pot and a bet. State the minimum defence frequency or alpha, as asked. Heads-up only; MDF does not generalise multiway.',
  generate(rng, difficulty): DrillInstance {
    const pot = pickPot(rng, difficulty);
    const { bet, label } = pickBet(rng, pot, difficulty);
    const po = potOdds(pot, bet);
    const askMdf = rng.next() < 0.5;
    const answer = (askMdf ? po.mdf : po.alpha) * 100;
    return {
      prompt: {
        text: askMdf
          ? `Villain bets ${bet}${label ? ` (${label})` : ''} into ${pot}. What share of your range must continue so villain cannot profit by betting any two cards?`
          : `You bet ${bet}${label ? ` (${label})` : ''} into ${pot} as a bluff. What is alpha, the share of the time the bluff must succeed to break even?`,
        facts: [
          { label: 'Pot', value: String(pot) },
          { label: 'Bet', value: String(bet) },
        ],
        answerLabel: askMdf ? 'MDF' : 'Alpha',
        ...(difficulty === 3 ? { timeLimitSeconds: 40 } : {}),
      },
      answer,
      unit: 'percent',
      tolerance: 1,
      explanation: {
        steps: [
          { text: 'Alpha: the bet over the pot after the bet.', formula: `${bet} / (${pot} + ${bet})`, result: `${num(po.alpha * 100, 1)}%` },
          { text: 'MDF is the complement.', formula: `1 - alpha = ${pot} / (${pot} + ${bet})`, result: `${num(po.mdf * 100, 1)}%` },
        ],
        summary: `${askMdf ? 'MDF' : 'Alpha'} is ${num(answer, 1)}%.`,
        alternate: `Odds the bettor lays on the bluff: ${formatOddsAgainst(pot / bet, 2)}.`,
      },
    };
  },
};

export const bluffBreakEven: Drill = {
  id: 'bluff-break-even',
  module: 'M8',
  title: 'Bluff break-even',
  description: 'You bet with no chance of winning at showdown. How often must villain fold for the bluff to break even?',
  generate(rng, difficulty): DrillInstance {
    const pot = pickPot(rng, difficulty);
    const { bet, label } = pickBet(rng, pot, difficulty);
    const b = evBluff(pot, bet, 0.5);
    return {
      prompt: {
        text: `The river. You have no showdown value and bet ${bet}${label ? ` (${label})` : ''} into ${pot}. How often must villain fold to make this break even?`,
        facts: [
          { label: 'Pot', value: String(pot) },
          { label: 'Bet', value: String(bet) },
        ],
        answerLabel: 'Fold frequency',
        ...(difficulty === 3 ? { timeLimitSeconds: 30 } : {}),
      },
      answer: b.breakEvenFoldAll * 100,
      unit: 'percent',
      tolerance: 1,
      explanation: {
        steps: [
          { text: 'EV of the bluff: f x P - (1 - f) x B. Set to zero and solve for f.', formula: `f = B / (P + B) = ${bet} / (${pot} + ${bet})`, result: `${num(b.breakEvenFoldAll * 100, 1)}%` },
          { text: 'You risk B to win P, so you are laying odds of P : B against yourself.', formula: `${pot} : ${bet}`, result: formatOddsAgainst(pot / bet, 2) },
        ],
        summary: `Villain must fold ${num(b.breakEvenFoldAll * 100, 1)}% of the time.`,
        alternate: `That is ${formatOddsAgainst(pot / bet, 2)} odds; the bluff needs to work 1 time in ${num(pot / bet + 1, 2)}.`,
      },
    };
  },
};

export const multiwayBluff: Drill = {
  id: 'multiway-bluff',
  module: 'M8',
  title: 'Multiway bluff',
  description: 'A bluff must get through every opponent. State the per-player fold frequency needed, assuming they fold independently.',
  generate(rng, difficulty): DrillInstance {
    const pot = pickPot(rng, difficulty);
    const { bet, label } = pickBet(rng, pot, difficulty);
    const opponents = difficulty === 1 ? rng.pick([2, 3]) : rng.range(2, 4);
    const b = evBluff(pot, bet, 0.5, opponents);
    return {
      prompt: {
        text: `You bet ${bet}${label ? ` (${label})` : ''} into ${pot} as a bluff against ${opponents} opponents. If each folds independently with the same probability, how often must each one fold for the bluff to break even?`,
        facts: [
          { label: 'Pot', value: String(pot) },
          { label: 'Bet', value: String(bet) },
          { label: 'Opponents', value: String(opponents) },
        ],
        answerLabel: 'Fold frequency per player',
        ...(difficulty === 3 ? { timeLimitSeconds: 45 } : {}),
      },
      answer: b.breakEvenFoldEach * 100,
      unit: 'percent',
      tolerance: 1,
      explanation: {
        steps: [
          { text: 'The bluff needs everyone to fold with probability alpha overall. Alpha does not change with the number of opponents.', formula: `${bet} / (${pot} + ${bet})`, result: `${num(b.breakEvenFoldAll * 100, 1)}%` },
          { text: 'With independent folds the chance all fold is f^n, so each must fold alpha^(1/n).', formula: `${num(b.breakEvenFoldAll, 3)}^(1/${opponents})`, result: `${num(b.breakEvenFoldEach * 100, 1)}%` },
          { text: 'Independence is a simplification. In practice a player behind a caller folds more, and the first player to act folds less.' },
        ],
        summary: `Each opponent must fold ${num(b.breakEvenFoldEach * 100, 1)}%, against ${num(b.breakEvenFoldAll * 100, 1)}% heads-up.`,
        alternate: `Heads-up the same bet needs ${num(b.breakEvenFoldAll * 100, 1)}% folds.`,
      },
    };
  },
};

export const deadMoney: Drill = {
  id: 'dead-money',
  module: 'M5',
  title: 'Dead money',
  description: 'The pot is built from several contributions. Compute the price being offered on the bet you face.',
  generate(rng, difficulty): DrillInstance {
    const blind = rng.pick([1, 2, 5, 10]);
    const contributions: { who: string; amount: number }[] = [
      { who: 'small blind (folded)', amount: blind / 2 },
      { who: 'big blind (folded)', amount: blind },
    ];
    const raise = blind * rng.pick(difficulty === 1 ? [3, 4] : [2.5, 3, 3.5, 4, 5]);
    contributions.push({ who: 'your preflop call', amount: raise });
    contributions.push({ who: 'villain’s preflop raise', amount: raise });
    const others = difficulty === 1 ? 1 : rng.range(1, 3);
    for (let i = 0; i < others; i++) {
      contributions.push({ who: `player ${i + 1} called preflop, folded on the flop`, amount: raise });
    }
    const pot = contributions.reduce((a, c) => a + c.amount, 0);
    const bet = Math.round(pot * rng.pick(difficulty === 3 ? [0.4, 0.55, 0.7, 0.85, 1.1] : [0.5, 0.75, 1]));
    const po = potOddsFromContributions(contributions.map((c) => c.amount), bet);
    const askOdds = difficulty > 1 && rng.next() < 0.4;
    return {
      prompt: {
        text: `On the flop villain bets ${bet} and it is on you. ${askOdds ? 'What odds is the pot offering, as x to 1?' : 'What equity do you need to call?'}`,
        facts: contributions.map((c) => ({ label: c.who, value: String(c.amount) })).concat([{ label: 'Bet faced', value: String(bet) }]),
        answerLabel: askOdds ? 'Odds offered (x to 1)' : 'Equity needed',
        ...(difficulty === 3 ? { timeLimitSeconds: 60 } : {}),
      },
      answer: askOdds ? po.oddsOffered : po.breakEven * 100,
      unit: askOdds ? 'ratio' : 'percent',
      tolerance: askOdds ? 0.15 : 0.5,
      explanation: {
        steps: [
          { text: 'Everything in the middle counts, including money from players who have folded. It is not theirs any more and it is not yours.', formula: contributions.map((c) => c.amount).join(' + '), result: String(pot) },
          { text: 'Odds offered: pot plus bet against the bet.', formula: `(${pot} + ${bet}) : ${bet}`, result: formatOddsAgainst(po.oddsOffered, 2) },
          { text: 'Equity needed: bet over the final pot.', formula: `${bet} / (${pot} + 2 x ${bet})`, result: `${num(po.breakEven * 100, 1)}%` },
        ],
        summary: `Pot ${pot}, bet ${bet}: ${formatOddsAgainst(po.oddsOffered, 2)}, ${num(po.breakEven * 100, 1)}% needed.`,
        alternate: askOdds ? `${num(po.breakEven * 100, 1)}% equity needed.` : `${formatOddsAgainst(po.oddsOffered, 2)} offered.`,
      },
    };
  },
};
