// Drill 12: semi-bluff EV. Drill 13: implied odds. Drill 14: set mining.
// Drill 22: implied odds from observation.

import { formatCards, RANK_CHARS } from '../engine/cards';
import { outProbabilities } from '../engine/outs';
import { evSemiBluff, evCall } from '../engine/ev';
import { impliedRequirement, equityNeededWithImplied, setMine } from '../engine/implied';
import { potOdds } from '../engine/potodds';
import { formatOddsAgainst, percentToOddsAgainst } from '../engine/shortcuts';
import { dealDrawSpot, pickPot, pickBet } from './deal';
import { type Drill, type DrillInstance, num } from './types';

export const semiBluffEv: Drill = {
  id: 'semi-bluff-ev',
  repeatIgnoresCards: true,
  module: 'M8',
  title: 'Semi-bluff EV',
  description: 'You bet a draw. Fold equity is given. Compute the EV of the bet in chips, and see it decomposed.',
  generate(rng, difficulty): DrillInstance {
    const spot = dealDrawSpot(rng, { clean: difficulty === 1, boardLength: 4 });
    const outs = spot.outs.count;
    const e = outProbabilities(outs, 4).nextCard;
    const pot = pickPot(rng, difficulty);
    const { bet, label } = pickBet(rng, pot, difficulty);
    const f = difficulty === 1 ? rng.pick([0.3, 0.4, 0.5, 0.6]) : rng.range(15, 75) / 100;
    const r = evSemiBluff(pot, bet, f, e);
    const tolerance = Math.max(2, Math.round(pot * 0.05));
    return {
      prompt: {
        text: `Turn. You bet ${bet}${label ? ` (${label})` : ''} into ${pot} with ${outs} outs. Villain folds ${num(f * 100, 0)}% of the time and otherwise calls. What is the EV of the bet in chips?`,
        heroCards: spot.hero,
        board: spot.board,
        facts: [
          { label: 'Pot', value: String(pot) },
          { label: 'Your bet', value: String(bet) },
          { label: 'Villain folds', value: `${num(f * 100, 0)}%` },
          { label: 'Outs', value: String(outs) },
        ],
        answerLabel: 'EV (chips)',
        ...(difficulty === 3 ? { timeLimitSeconds: 90 } : {}),
      },
      answer: r.total,
      unit: 'chips',
      tolerance,
      explanation: {
        steps: [
          { text: `Your equity when called, one card to come: ${formatCards(spot.outs.outs)}.`, formula: `${outs} / 46`, result: `${num(e * 100, 1)}%` },
          { text: 'When villain folds you win the pot.', formula: `${num(f, 2)} x ${pot}`, result: num(r.foldTerm, 1) },
          { text: 'When called, it is like calling your own bet: e(P + B) - (1 - e)B.', formula: `${num(e, 3)} x ${pot + bet} - ${num(1 - e, 3)} x ${bet}`, result: num(r.whenCalled.total, 1) },
          { text: 'Weight the called case by how often it happens.', formula: `${num(1 - f, 2)} x ${num(r.whenCalled.total, 1)}`, result: num(r.calledTerm, 1) },
          { text: 'Add the two.', formula: `${num(r.foldTerm, 1)} + ${num(r.calledTerm, 1)}`, result: num(r.total, 1) },
          { text: `For comparison, a pure bluff with the same fold equity is worth ${num(r.pureBluffTotal, 1)}, and checking is worth 0 here.` },
        ],
        summary: `EV of the semi-bluff: ${num(r.total, 1)} chips.`,
      },
    };
  },
};

export const impliedOdds: Drill = {
  id: 'implied-odds',
  repeatIgnoresCards: true,
  module: 'M7',
  title: 'Implied odds',
  description: 'The immediate pot odds are insufficient. State how much more you must expect to win on later streets for the call to break even.',
  generate(rng, difficulty): DrillInstance {
    for (let attempt = 0; attempt < 500; attempt++) {
      const boardLength: 3 | 4 = difficulty === 1 ? 4 : rng.pick([3, 4]);
      const spot = dealDrawSpot(rng, { clean: difficulty === 1, boardLength });
      const outs = spot.outs.count;
      const probs = outProbabilities(outs, boardLength);
      const e = probs.nextCard;
      const pot = pickPot(rng, difficulty);
      const { bet, label } = pickBet(rng, pot, difficulty);
      const req = impliedRequirement(pot, bet, e);
      if (req.required <= 0) continue;
      const tolerance = Math.max(2, Math.round((pot + bet) * 0.05));
      return {
        prompt: {
          text: `${boardLength === 3 ? 'Flop, villain has chips behind' : 'Turn'}. Villain bets ${bet}${label ? ` (${label})` : ''} into ${pot}. You have ${outs} outs to ${spot.target.label}. How much more must you expect to win after you hit for the call to break even?`,
          heroCards: spot.hero,
          board: spot.board,
          facts: [
            { label: 'Pot', value: String(pot) },
            { label: 'Bet', value: String(bet) },
            { label: 'Outs', value: String(outs) },
          ],
          answerLabel: 'Future winnings needed',
          ...(difficulty === 3 ? { timeLimitSeconds: 90 } : {}),
        },
        answer: req.required,
        unit: 'chips',
        tolerance,
        explanation: {
          steps: [
            { text: 'Chance of hitting on the next card.', formula: `${outs} / ${probs.unseen}`, result: `${num(e * 100, 1)}% (${formatOddsAgainst(req.oddsAgainst, 2)} against)` },
            { text: 'Immediate equity needed.', formula: `${bet} / (${pot} + 2 x ${bet})`, result: `${num(req.immediateBreakEven * 100, 1)}%, so the call fails on pot odds alone` },
            { text: 'For break-even, the total you win when you hit must equal the odds against times the bet. Subtract what is already in the pot.', formula: `${bet} x (1 - e) / e - ${pot} - ${bet}`, result: num(req.required, 1) },
            { text: 'Check: with that added to the pot, equity needed matches your chance.', formula: `${bet} / (${pot} + 2 x ${bet} + ${num(req.required, 1)})`, result: `${num(equityNeededWithImplied(pot, bet, req.required) * 100, 1)}%` },
            { text: 'Whether you can actually win that much depends on the stacks and on villain paying off. That is an estimate, not a calculation.' },
          ],
          summary: `You need about ${num(req.required, 0)} more chips on later streets.`,
        },
      };
    }
    throw new Error('could not build an implied odds spot');
  },
};

export const setMining: Drill = {
  id: 'set-mining',
  module: 'M7',
  title: 'Set mining',
  description: 'A pocket pair faces a preflop raise. Given effective stacks and how often villain pays off, decide whether to call to hit a set.',
  generate(rng, difficulty): DrillInstance {
    const rank = rng.range(2, 10);
    const rc = RANK_CHARS[rank - 2]!;
    const blind = 1;
    const raise = difficulty === 1 ? rng.pick([2.5, 3, 4]) : rng.pick([2, 2.5, 3, 3.5, 4, 5, 6]);
    const pot = blind * 1.5;
    const stack = difficulty === 1 ? rng.pick([20, 30, 50, 80, 120]) : rng.range(12, 150);
    const payoff = difficulty === 1 ? rng.pick([0.25, 0.5, 0.75]) : rng.range(15, 90) / 100;
    if (stack < raise) return setMining.generate(rng, difficulty);
    const r = setMine(pot, raise, stack, payoff);
    const margin = Math.abs(r.expectedWin - r.required) / Math.max(1, r.required);
    if (difficulty === 1 && margin < 0.25) return setMining.generate(rng, difficulty);
    const suits = rng.sample([0, 1, 2, 3], 2);
    return {
      prompt: {
        text: `Blinds 0.5 and 1. Villain raises to ${raise}. You hold ${rc}${rc} and will only continue past the flop if you hit a set. Effective stacks are ${stack}. When you hit, you expect to win on average ${num(payoff * 100, 0)}% of the stack behind. Call or fold?`,
        heroCards: [rank * 4 + suits[0]!, rank * 4 + suits[1]!],
        facts: [
          { label: 'Pot before your call', value: String(pot + raise) },
          { label: 'To call', value: String(raise) },
          { label: 'Effective stack', value: String(stack) },
          { label: 'Payoff when you hit', value: `${num(payoff * 100, 0)}% of the stack behind` },
        ],
        choices: ['Call', 'Fold'],
        ...(difficulty === 3 ? { timeLimitSeconds: 90 } : {}),
      },
      answer: r.shouldCall ? 0 : 1,
      unit: 'count',
      tolerance: 0,
      explanation: {
        steps: [
          { text: 'Chance of flopping a set or better, derived not remembered.', formula: '1 - C(48, 3) / C(50, 3)', result: `${num(r.hitProb * 100, 2)}% (${formatOddsAgainst(percentToOddsAgainst(r.hitProb * 100), 1)} against)` },
          { text: 'Future winnings needed when you hit, treating the pot before your call as dead money.', formula: `${raise} x (1 - p) / p - ${pot + raise} - ${raise}`, result: `${num(r.required, 1)} (${num(r.requiredMultiple, 1)} times the call)` },
          { text: 'Expected winnings when you hit.', formula: `${num(payoff, 2)} x (${stack} - ${raise})`, result: num(r.expectedWin, 1) },
          { text: r.shouldCall ? 'Expected winnings cover the requirement.' : 'Expected winnings fall short.', result: r.shouldCall ? 'Call' : 'Fold' },
          { text: `The rule of thumb says stacks of ${r.ruleOfThumbMultiple} times the call (${r.ruleOfThumbStack}). It is a rough fit for a payoff of about ${num((r.required / Math.max(1, r.ruleOfThumbStack - raise)) * 100, 0)}% of the stack behind.` },
        ],
        summary: `${r.shouldCall ? 'Call' : 'Fold'}: need ${num(r.required, 0)} more when you hit, expect ${num(r.expectedWin, 0)}.`,
      },
    };
  },
};

export const impliedFromObservation: Drill = {
  id: 'implied-from-observation',
  module: 'M7',
  title: 'Implied odds from observation',
  description: 'A described tendency sets a payoff propensity. Compute the equity you need to call once that expected payoff is included.',
  generate(rng, difficulty): DrillInstance {
    const pot = pickPot(rng, difficulty);
    const { bet, label } = pickBet(rng, pot, difficulty);
    const tendencies: { text: string; propensity: number }[] = [
      { text: 'Villain has called down with one pair twice and never folded to a river bet. Estimate villain pays off about 1 pot when you hit.', propensity: 1 },
      { text: 'Villain check-folds most rivers unless holding a strong hand. Estimate villain pays off about 0.25 pot when you hit.', propensity: 0.25 },
      { text: 'Villain calls turn bets often but folds most rivers. Estimate villain pays off about 0.5 pot when you hit.', propensity: 0.5 },
      { text: 'Villain has stacked off with top pair before. Estimate villain pays off about 1.5 pots when you hit.', propensity: 1.5 },
      { text: 'Villain is short-stacked and will be all-in for what is left, roughly 0.75 pot. Estimate villain pays off 0.75 pot when you hit.', propensity: 0.75 },
    ];
    const t = rng.pick(tendencies);
    const x = t.propensity * pot;
    const need = equityNeededWithImplied(pot, bet, x);
    const po = potOdds(pot, bet);
    return {
      prompt: {
        text: `${t.text} Villain bets ${bet}${label ? ` (${label})` : ''} into ${pot}. What equity do you need to call, counting that expected payoff?`,
        facts: [
          { label: 'Pot', value: String(pot) },
          { label: 'Bet', value: String(bet) },
          { label: 'Payoff propensity', value: `${num(t.propensity, 2)} x pot` },
        ],
        answerLabel: 'Equity needed',
        ...(difficulty === 3 ? { timeLimitSeconds: 60 } : {}),
      },
      answer: need * 100,
      unit: 'percent',
      tolerance: 0.5,
      explanation: {
        steps: [
          { text: 'Expected future winnings, X.', formula: `${num(t.propensity, 2)} x ${pot}`, result: num(x, 1) },
          { text: 'Immediate break-even without X.', formula: `${bet} / (${pot} + 2 x ${bet})`, result: `${num(po.breakEven * 100, 1)}%` },
          { text: 'Add X to the final pot.', formula: `${bet} / (${pot} + 2 x ${bet} + ${num(x, 1)})`, result: `${num(need * 100, 1)}%` },
          { text: 'The payoff estimate came from observation. The calculation is exact; the input is not.' },
        ],
        summary: `You need ${num(need * 100, 1)}% instead of ${num(po.breakEven * 100, 1)}%.`,
        alternate: `As odds: ${formatOddsAgainst(percentToOddsAgainst(need * 100), 2)} against is enough.`,
      },
    };
  },
};

export { evCall };
