import { type LearnPage } from './types';
import { parseCards } from '../engine/cards';
import { parseHandClass, combosOfClass, blockerEffect, specificPairProb, anyPairProb, specificUnpairedProb, flopFlushDrawProb, flopFlushProb, flopPairOrBetterProb, flopSetOrBetterProb } from '../engine/combos';
import { topRange } from '../engine/ranges';
import { formatOddsAgainst } from '../engine/shortcuts';
import { pc, n } from './helpers';

export const m9: LearnPage = {
  id: 'M9',
  title: 'Combinatorics and blockers',
  summary: 'Counting the ways a hand can be held, and how the cards you see change the count.',
  drills: ['combo-count'],
  blocks: [
    {
      kind: 'terms',
      items: [
        { term: 'Combination (combo)', definition: () => 'One specific pair of cards. Ace-king has several combos: As Kh, As Kd and so on.' },
        { term: 'Blocker', definition: () => 'A card you can see that removes combinations from what an opponent can hold.' },
        { term: 'Range', definition: () => 'The set of hands an opponent could plausibly hold, weighted by how many combos of each remain.' },
      ],
    },
    { kind: 'h', text: 'Counting combos' },
    {
      kind: 'p',
      text: () =>
        `A specific unpaired hand has ${combosOfClass(parseHandClass('AKs')).length + combosOfClass(parseHandClass('AKo')).length} combos: ${combosOfClass(parseHandClass('AKs')).length} suited and ${combosOfClass(parseHandClass('AKo')).length} offsuit. A specific pocket pair has ${combosOfClass(parseHandClass('QQ')).length}, which is C(4, 2). With bx cards of one rank and by of the other visible, an unpaired hand has (4 - bx)(4 - by) combos left, and a pair has C(4 - b, 2).`,
    },
    {
      kind: 'table',
      caption: 'Combos remaining, from enumeration',
      build: () => ({
        head: ['Hand', 'Visible', 'Combos'],
        rows: [
          ['AK', 'nothing', String(combosOfClass(parseHandClass('AKs')).length + combosOfClass(parseHandClass('AKo')).length)],
          ['AK', 'one ace on the board', String(combosOfClass(parseHandClass('AKs'), parseCards('Ah')).length + combosOfClass(parseHandClass('AKo'), parseCards('Ah')).length)],
          ['AK', 'an ace and a king visible', String(combosOfClass(parseHandClass('AKs'), parseCards('Ah Kd')).length + combosOfClass(parseHandClass('AKo'), parseCards('Ah Kd')).length)],
          ['QQ', 'nothing', String(combosOfClass(parseHandClass('QQ')).length)],
          ['QQ', 'one queen visible', String(combosOfClass(parseHandClass('QQ'), parseCards('Qs')).length)],
          ['QQ', 'two queens visible', String(combosOfClass(parseHandClass('QQ'), parseCards('Qs Qh')).length)],
        ],
      }),
    },
    { kind: 'h', text: 'Blockers' },
    {
      kind: 'p',
      text: () => {
        const e = blockerEffect(parseHandClass('AA'), parseCards('Ah Kd'), parseCards('Qc 7s 2d'));
        const ak = blockerEffect(parseHandClass('AKo'), parseCards('Ah Kd'), parseCards('Qc 7s 2d'));
        return `Holding an ace removes half of villain's pocket aces: ${e.withoutHero} combos become ${e.withHero}. Holding Ah Kd on Qc 7s 2d removes ${ak.removed} of villain's ${ak.withoutHero} offsuit ace-king combos. This is why an ace in your hand makes an opponent's strong ace less likely, and why the effect is numeric rather than a feeling.`;
      },
    },
    { kind: 'h', text: 'Dealing probabilities' },
    {
      kind: 'table',
      caption: 'Preflop, from C(52, 2) = 1,326 starting hands',
      build: () => ({
        head: ['Hand', 'Formula', 'Probability', 'Odds against'],
        rows: [specificPairProb(), anyPairProb(), specificUnpairedProb()].map((d) => [d.label, d.formula, pc(d.probability, 2), formatOddsAgainst(d.oddsAgainst, 0)]),
      }),
    },
    {
      kind: 'table',
      caption: 'On the flop, from C(50, 3) flops',
      build: () => ({
        head: ['Event', 'Formula', 'Probability', 'Odds against'],
        rows: [flopFlushDrawProb(), flopFlushProb(), flopPairOrBetterProb(), flopSetOrBetterProb()].map((d) => [d.label, d.formula, pc(d.probability, 2), formatOddsAgainst(d.oddsAgainst, 1)]),
      }),
    },
    { kind: 'h', text: 'From combos to ranges' },
    {
      kind: 'p',
      text: () => {
        const r = topRange(0.15);
        return `A range is a list of hand classes weighted by combos. The top ${pc(0.15, 0)} of hands by strength against a random hand is ${r.classes.length} classes and ${r.combos} combos, ${pc(r.fraction)} of all starting hands. When villain raises with that range and you hold an ace, the combos containing an ace shrink, and so the share of the range that is pocket pairs grows. Counting combos is what turns arithmetic into hand reading: how often villain holds a given class is the ratio of its remaining combos to the whole range's remaining combos.`;
      },
    },
    { kind: 'p', text: () => `The ordering of hands used for ranges is the one static table in the engine. It carries no probabilities. It is checked in the test suite against Monte Carlo equity so that an ordering error would be caught. Range width against a random hand is only a first approximation to a real opening range, and full range notation is deferred. ${n(1, 0) === '1' ? '' : ''}` },
  ],
};
