import { type LearnPage } from './types';
import { impliedRequirement, equityNeededWithImplied, setOrBetterOnFlop, setMine } from '../engine/implied';
import { potOdds } from '../engine/potodds';
import { probNextCard } from '../engine/outs';
import { profiledCall, PROFILE_PRESETS } from '../engine/profile';
import { pc, n, odds } from './helpers';

export const m7: LearnPage = {
  id: 'M7',
  title: 'Implied and reverse implied odds',
  summary: 'When a call that fails on pot odds is still correct, and when a call that passes is not.',
  drills: ['implied-odds', 'set-mining', 'villain-dependent', 'implied-from-observation'],
  blocks: [
    {
      kind: 'terms',
      items: [
        { term: 'Implied odds', definition: () => 'Pot odds adjusted for the chips you expect to win on later streets if your draw completes.' },
        { term: 'Reverse implied odds', definition: () => 'The chips you expect to lose on later streets when your draw completes but is still second best, or when you improve to a hand that loses.' },
        { term: 'Effective stack', definition: () => 'The most that can be won or lost between two players: the smaller of the two stacks.' },
        { term: 'Set mining', definition: () => 'Calling a preflop raise with a pocket pair intending to continue only if the flop brings a set.' },
        { term: 'Nuts', definition: () => 'The best possible hand given the board. Drawing to a hand that is not the nuts carries reverse implied odds.' },
      ],
    },
    { kind: 'h', text: 'The requirement' },
    {
      kind: 'p',
      text: () =>
        'Facing a bet B into pot P with equity e, when B / (P + 2B) is above e the immediate price is wrong. The call can still be right if you expect to win enough on later streets when you hit. Set the EV of the call to zero with an extra X won on a hit and solve.',
    },
    { kind: 'formula', label: 'Future winnings needed', formula: 'X = B x (1 - e) / e - P - B', value: () => {
      const r = impliedRequirement(100, 75, probNextCard(9, 46));
      return `Flush draw on the turn (${pc(r.equity)}), pot 100, bet 75: X = ${n(r.required, 0)}. The immediate price needed ${pc(r.immediateBreakEven)}.`;
    } },
    { kind: 'formula', label: 'Equity needed with implied odds', formula: 'B / (P + 2B + X)', value: () => `With X = 100 added to the same spot: 75 / (100 + 150 + 100) = ${pc(equityNeededWithImplied(100, 75, 100))}.` },
    {
      kind: 'p',
      text: () =>
        'Whether you can win X is limited first by the effective stack, which caps it, and second by whether villain will pay. Both are estimates. The formula is exact; its input is not, and no amount of arithmetic changes that.',
    },
    { kind: 'h', text: 'Set mining, the worked case' },
    {
      kind: 'p',
      text: () => {
        const p = setOrBetterOnFlop();
        const r = setMine(1.5, 3, 100, 1);
        return `A pocket pair flops a set or better ${pc(p, 2)} of the time, derived as 1 - C(48, 3) / C(50, 3), which is ${odds(p)} against. Blinds 0.5 and 1, villain raises to 3, you call 3 with 1.5 dead: X = ${n(r.required, 1)}, about ${n(r.requiredMultiple, 1)} times the call. That is the break-even if you always won X after hitting. You will not: villain folds sometimes, or has nothing, or has a bigger set. The popular rule of thumb asks for effective stacks of ${r.ruleOfThumbMultiple} times the call, here ${r.ruleOfThumbStack}. It is a rough fit to the computed requirement under the assumption that you collect roughly a third of the stack behind when you hit.`;
      },
    },
    { kind: 'h', text: 'Reverse implied odds' },
    {
      kind: 'p',
      text: () =>
        'Drawing to a hand that is not the nuts costs on later streets in the cases where you hit and are still beaten: the low end of a straight, a small flush, two pair on a board that makes straights. Model it as an expected loss subtracted from the implied gain. The number is your estimate. The engine only does the subtraction.',
    },
    { kind: 'h', text: 'Villain profiles' },
    {
      kind: 'p',
      text: () =>
        'Player type is not separate from the maths. It is where the estimated inputs come from. A profile is four parameters, each feeding a specific term: range width feeds equity against a range; fold frequency feeds f in bluff and semi-bluff EV; payoff propensity, expected extra chips won when the draw completes as a multiple of the pot, feeds X; aggression feeds the reverse implied loss and the chance of a raise behind you.',
    },
    {
      kind: 'table',
      caption: 'The same turn spot against the four presets: flush draw, pot 100, bet 50',
      build: () => {
        const e = probNextCard(9, 46);
        return {
          head: ['Profile', 'Payoff', 'Aggression', 'Net implied', 'Equity needed', 'EV of call', 'Decision'],
          rows: PROFILE_PRESETS.map((p) => {
            const r = profiledCall(p, 100, 50, e);
            return [p.name, `${n(p.payoffPropensity, 2)} x pot`, n(p.aggression, 2), n(r.implied.net, 0), pc(r.equityNeeded), n(r.total, 1), r.call ? 'Call' : 'Fold'];
          }),
        };
      },
    },
    {
      kind: 'p',
      text: () =>
        `The immediate price in that spot needs ${pc(potOdds(100, 50).breakEven)} against a draw with ${pc(probNextCount())}. The decision moves from fold to call as the payoff slider moves. That one interaction, in the sandbox, is the point of this module. One honest caveat, stated once: the four parameters are estimates you make from observation, and the output is exactly as good as they are. The app calculates precisely from imprecise inputs.`,
    },
  ],
};

function probNextCount(): number {
  return probNextCard(9, 46);
}
