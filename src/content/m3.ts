import { type LearnPage } from './types';
import { choose } from '../engine/math';
import { probNextCard, probTwoCards } from '../engine/outs';
import { percentToOddsAgainst, oddsAgainstToPercent, formatOddsAgainst } from '../engine/shortcuts';
import { pc, odds, n } from './helpers';

const OUTS = [1, 2, 4, 6, 8, 9, 12, 15];

export const m3: LearnPage = {
  id: 'M3',
  title: 'From outs to probability',
  summary: 'The exact formulas for one card and two cards to come, and moving between percentages and odds.',
  drills: ['outs-to-percent-one-card', 'outs-to-percent-two-cards', 'percent-ratio'],
  blocks: [
    { kind: 'h', text: 'Unseen cards' },
    {
      kind: 'p',
      text: () =>
        'Probability is outs divided by unseen cards. Unseen means every card you have not seen, whether it is in the deck, in an opponent’s hand or already folded. Folded cards are as unknown as deck cards, so they count as unseen. On the flop you have seen five cards, leaving 47. On the turn, 46.',
    },
    { kind: 'h', text: 'One card to come' },
    { kind: 'formula', label: 'Chance on the next card', formula: 'P = outs / unseen', value: () => `9 outs on the flop: 9 / 47 = ${pc(probNextCard(9, 47))}. On the turn: 9 / 46 = ${pc(probNextCard(9, 46))}.` },
    { kind: 'h', text: 'Two cards to come' },
    {
      kind: 'p',
      text: () =>
        'With two cards to come, count the ways to miss both. There are C(47, 2) two-card runouts. The runouts that avoid every out number C(47 - outs, 2). Hitting at least once is one minus the miss fraction.',
    },
    { kind: 'formula', label: 'Chance by the river, from the flop', formula: 'P = 1 - C(47 - outs, 2) / C(47, 2)', value: () => `9 outs: 1 - C(38, 2) / C(47, 2) = 1 - ${choose(38, 2)} / ${choose(47, 2)} = ${pc(probTwoCards(9))}.` },
    {
      kind: 'p',
      text: () =>
        `The two figures differ by a lot. Nine outs is ${pc(probNextCard(9, 47))} on the next card and ${pc(probTwoCards(9))} by the river. Which one applies depends on how many cards your money buys, which is the subject of module 4. Conflating the two is the most common beginner error, and the drills trap it deliberately.`,
    },
    {
      kind: 'table',
      caption: 'Exact figures, computed',
      build: () => ({
        head: ['Outs', 'Next card (flop)', 'Next card (turn)', 'By the river (flop)'],
        rows: OUTS.map((o) => [String(o), pc(probNextCard(o, 47)), pc(probNextCard(o, 46)), pc(probTwoCards(o))]),
      }),
    },
    { kind: 'h', text: 'Percentages and odds' },
    {
      kind: 'p',
      text: () =>
        `Poker writing quotes chances as odds against: ways to miss against ways to hit. A ${pc(0.2, 0)} chance is four misses for every hit, written ${formatOddsAgainst(percentToOddsAgainst(20))}. Break-even thresholds are usually quoted as percentages. You need both, without pausing.`,
    },
    { kind: 'formula', label: 'Percent to odds against', formula: '(100 - p) : p', value: () => `${pc(0.2, 0)}: (100 - 20) : 20 = ${formatOddsAgainst(percentToOddsAgainst(20))}.` },
    { kind: 'formula', label: 'Odds against to percent', formula: '100 x 1 / (x + 1)', value: () => `${formatOddsAgainst(4)}: 100 / 5 = ${n(oddsAgainstToPercent(4))}%. Three to two is the same as ${formatOddsAgainst(1.5)}: ${n(oddsAgainstToPercent(1.5))}%.` },
    {
      kind: 'table',
      caption: 'Draws as odds against, computed',
      build: () => ({
        head: ['Outs', 'Next card (flop)', 'By the river (flop)'],
        rows: OUTS.map((o) => [String(o), odds(probNextCard(o, 47)), odds(probTwoCards(o))]),
      }),
    },
  ],
};
