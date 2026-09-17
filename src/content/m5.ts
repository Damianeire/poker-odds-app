import { type LearnPage } from './types';
import { potOdds, sizingTable } from '../engine/potodds';
import { probNextCard, probTwoCards } from '../engine/outs';
import { formatOddsAgainst } from '../engine/shortcuts';
import { pc, odds } from './helpers';

export const m5: LearnPage = {
  id: 'M5',
  title: 'Pot odds',
  summary: 'The price of a call, as a ratio and as a percentage, and the decision as one comparison.',
  drills: ['break-even-equity', 'call-or-fold', 'price-out', 'dead-money', 'which-tool'],
  blocks: [
    {
      kind: 'terms',
      items: [
        { term: 'Pot odds', definition: () => 'The ratio of what is in the pot, including the bet you face, to what it costs you to call.' },
        { term: 'Equity', definition: () => 'Your share of the pot in expectation: the fraction of the time you win, counting ties as half. Module 6 treats it properly.' },
        { term: 'Break-even equity', definition: () => 'The equity at which calling neither wins nor loses chips on average.' },
      ],
    },
    { kind: 'h', text: 'The price' },
    {
      kind: 'p',
      text: () =>
        'Let P be the pot before villain’s bet and B the bet you face. The pot is offering you P + B for a cost of B. As a ratio that is (P + B) : B. As a break-even percentage, the call is B out of the final pot P + 2B, since your call goes in too.',
    },
    { kind: 'formula', label: 'Odds offered', formula: '(P + B) : B', value: () => `Pot 100, bet 50: 150 : 50 = ${formatOddsAgainst(potOdds(100, 50).oddsOffered)}.` },
    { kind: 'formula', label: 'Equity needed to call', formula: 'B / (P + 2B)', value: () => `Pot 100, bet 50: 50 / 200 = ${pc(potOdds(100, 50).breakEven)}.` },
    {
      kind: 'p',
      text: () =>
        `Two traps. First, chips you put in on earlier streets are not yours any more. They are part of P, and the decision compares this call against the pot as it now stands. Second, the denominator is P + 2B, not P + B, because your own call becomes part of the pot you are trying to win. Using P + B gives ${pc(50 / 150)} instead of ${pc(potOdds(100, 50).breakEven)} for a half-pot bet, and the error grows with bet size.`,
    },
    { kind: 'h', text: 'The anchor set' },
    {
      kind: 'table',
      caption: 'Seven bet sizes to know cold. Generated from the formulas.',
      build: () => ({
        head: ['Bet', 'Odds offered', 'Equity needed'],
        rows: sizingTable().map((r) => [r.label, formatOddsAgainst(r.odds.oddsOffered, 2), pc(r.odds.breakEven)]),
      }),
    },
    { kind: 'h', text: 'The decision' },
    {
      kind: 'p',
      text: () =>
        `Compare your chance of winning with the equity the price demands. If your chance is higher, call. A flush draw on the turn has ${pc(probNextCard(9, 46))} for the river card, so it cannot call any of the standard sizings above: even one third of the pot needs ${pc(potOdds(100, 100 / 3).breakEven)}. The same draw on the flop against an all-in villain has ${pc(probTwoCards(9))} and can call anything up to a pot-sized bet.`,
    },
    {
      kind: 'p',
      text: () =>
        `In ratios: the draw on the turn is ${odds(probNextCard(9, 46))} against; a half-pot bet offers ${formatOddsAgainst(potOdds(100, 50).oddsOffered)}. The pot offers less than the odds against you, so fold. Fluency means moving between the two forms without thinking, since the literature uses both.`,
    },
    { kind: 'h', text: 'From the other side' },
    {
      kind: 'p',
      text: () =>
        `If you are betting into a draw, you choose the price. A bet B denies a draw with chance e when B / (P + 2B) exceeds e, so the smallest such bet is e x P / (1 - 2e). Against a flush draw on the turn (${pc(probNextCard(9, 46))}) into a pot of 100 that is about ${((probNextCard(9, 46) * 100) / (1 - 2 * probNextCard(9, 46))).toFixed(0)} chips. Anything smaller gives the draw a profitable call.`,
    },
    { kind: 'h', text: 'Dead money' },
    {
      kind: 'p',
      text: () =>
        'Money from players who have since folded, and calls from players between you and the bettor, are all in the pot and all count. The formula does not change; P does. The sandbox takes the pot as a set of contributions so you can see where the price comes from.',
    },
    { kind: 'h', text: 'Which tool' },
    {
      kind: 'p',
      text: () =>
        'Pot odds are the correct tool when no further betting can happen: villain is all-in, it is the river, or you are pricing a pure bluff. Everywhere else the answer depends on what happens on later streets, and the correct tool is implied odds, module 7. Deciding which calculation a spot calls for is a separate skill from performing it, and it is drilled separately.',
    },
  ],
};
