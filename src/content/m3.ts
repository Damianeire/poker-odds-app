import { type LearnPage } from './types';
import { choose } from '../engine/math';
import { probNextCard, probTwoCards } from '../engine/outs';
import { percentToOddsAgainst, oddsAgainstToPercent, formatOddsAgainst, oneInN, bracketAnchors, anchorAt } from '../engine/shortcuts';
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
    { kind: 'h', text: 'Working it out in your head' },
    {
      kind: 'p',
      text: () =>
        'Both conversions are one reciprocal. One hit for every x misses is one outcome in x + 1, so the chance is 1 in N with N = x + 1. Odds against are (N - 1) to 1, and the percentage is 100 / N.',
    },
    {
      kind: 'formula',
      label: 'Percent to odds against',
      formula: 'how many times p goes into 100, minus 1',
      value: () => `${pc(0.2, 0)} goes into 100 ${n(oneInN(20), 0)} times, so ${formatOddsAgainst(oneInN(20) - 1)}. ${pc(0.18, 0)} goes into 100 about ${n(oneInN(18), 1)} times, so about ${formatOddsAgainst(oneInN(18) - 1)} (exact ${formatOddsAgainst(percentToOddsAgainst(18), 2)}).`,
    },
    {
      kind: 'formula',
      label: 'Odds against to percent',
      formula: 'add 1, then divide into 100',
      value: () => {
        const [lo, hi] = bracketAnchors(7.5 + 1);
        return `${formatOddsAgainst(7.5)}: 100 / ${n(7.5 + 1, 1)}. That sits between 1 in ${lo.n} (${n(lo.percent, 1)}%) and 1 in ${hi.n} (${n(hi.percent, 1)}%), so about ${n(oddsAgainstToPercent(7.5), 0)}% (exact ${n(oddsAgainstToPercent(7.5), 2)}%).`;
      },
    },
    {
      kind: 'table',
      caption: 'Anchors: rebuild them by dividing, do not memorise them',
      build: () => ({
        head: ['1 in N', 'Percent', 'Odds against'],
        rows: [2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => {
          const a = anchorAt(k);
          return [`1 in ${k}`, `${n(a.percent, 1)}%`, formatOddsAgainst(a.against)];
        }),
      }),
    },
    {
      kind: 'p',
      text: () => {
        const [lo, hi] = bracketAnchors(oneInN(18));
        return `For anything between two anchors, find the two it sits between and pick a point between them. ${pc(0.18, 0)} is between ${n(lo.percent, 1)}% and ${n(hi.percent, 1)}%, nearer ${n(hi.percent, 1)}%, so the odds are between ${lo.against} and ${hi.against} to 1, nearer ${hi.against}.`;
      },
    },
    { kind: 'h', text: 'The deck gives you the odds directly' },
    {
      kind: 'p',
      text: () =>
        `For a draw you can skip percentages. Odds against are ways to miss to ways to hit, and the deck tells you both. Nine outs on the flop leave ${47 - 9} unseen cards that miss and 9 that hit: ${47 - 9} to 9, which is ${n((47 - 9) / 9, 1)} to 1. Divide the two numbers and you have the odds.`,
    },
    {
      kind: 'table',
      caption: 'Draws as odds against, computed',
      build: () => ({
        head: ['Outs', 'Misses to hits (flop)', 'Next card (flop)', 'By the river (flop)'],
        rows: OUTS.map((o) => [String(o), `${47 - o} to ${o}`, odds(probNextCard(o, 47)), odds(probTwoCards(o))]),
      }),
    },
  ],
};
