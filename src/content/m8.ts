import { type LearnPage } from './types';
import { evCall, evBluff, evSemiBluff, riverBluffShare } from '../engine/ev';
import { potOdds, sizingTable } from '../engine/potodds';
import { probNextCard } from '../engine/outs';
import { pc, n } from './helpers';

export const m8: LearnPage = {
  id: 'M8',
  title: 'Expected value, bluffs and defence',
  summary: 'EV as the frame that unifies calls, bluffs and semi-bluffs, plus MDF, alpha and multiway bluffing.',
  drills: ['mdf-alpha', 'bluff-break-even', 'semi-bluff-ev', 'multiway-bluff'],
  blocks: [
    {
      kind: 'terms',
      items: [
        { term: 'Expected value (EV)', definition: () => 'The average result of a decision over all outcomes, weighted by their probabilities. Positive EV gains chips on average.' },
        { term: 'Fold equity', definition: () => 'The share of the pot you win because the opponent folds, regardless of your cards.' },
        { term: 'Semi-bluff', definition: () => 'A bet with a hand that is probably behind now but can improve: it wins when villain folds and sometimes when called.' },
        { term: 'Value bet', definition: () => 'A bet made expecting to be called by worse hands.' },
        { term: 'Minimum defence frequency (MDF)', definition: () => 'The share of your range you must continue with so that a bet with any two cards cannot show an automatic profit.' },
        { term: 'Alpha', definition: () => 'The share of the time a bluff must succeed to break even. Equal to one minus MDF.' },
      ],
    },
    { kind: 'h', text: 'EV of a call' },
    { kind: 'formula', label: 'Call', formula: 'EV = e x (P + B) - (1 - e) x B', value: () => {
      const r = evCall(100, 50, probNextCard(9, 46));
      return `Flush draw on the turn, pot 100, bet 50: ${n(r.winTerm, 1)} - ${n(r.loseTerm, 1)} = ${n(r.total, 1)}. Negative, so fold. Setting EV to zero recovers the break-even equity B / (P + 2B) from module 5.`;
    } },
    { kind: 'h', text: 'EV of a bluff' },
    { kind: 'formula', label: 'Pure bluff', formula: 'EV = f x P - (1 - f) x B', value: () => {
      const r = evBluff(100, 100, 0.5);
      return `Pot-sized bluff, villain folds half the time: ${n(r.winTerm, 0)} - ${n(r.loseTerm, 0)} = ${n(r.total, 0)}. Break-even at f = B / (P + B) = ${pc(r.breakEvenFoldAll)}.`;
    } },
    {
      kind: 'table',
      caption: 'Alpha and MDF by bet size, computed',
      build: () => ({
        head: ['Bet', 'Alpha (bluff must work)', 'MDF (defender must continue)'],
        rows: sizingTable().map((r) => [r.label, pc(r.odds.alpha), pc(r.odds.mdf)]),
      }),
    },
    {
      kind: 'p',
      text: () =>
        `MDF is what a defender needs to continue with so the bettor cannot profit by bluffing any two cards: P / (P + B). Against a pot-sized bet that is ${pc(potOdds(100, 100).mdf)}. It is a heads-up construct. Multiway, the defence burden is shared, and no single player's continuing frequency follows from the formula. The app does not show a multiway MDF because it would be misleading.`,
    },
    { kind: 'h', text: 'Semi-bluff' },
    { kind: 'formula', label: 'Semi-bluff', formula: 'EV = f x P + (1 - f) x [e x (P + B) - (1 - e) x B]', value: () => {
      const e = probNextCard(9, 46);
      const r = evSemiBluff(100, 75, 0.4, e);
      return `Flush draw on the turn, bet 75 into 100, villain folds ${pc(0.4, 0)}: ${n(r.foldTerm, 0)} + ${n(1 - 0.4, 1)} x ${n(r.whenCalled.total, 1)} = ${n(r.total, 1)}. Calling a 75 bet instead would be worth ${n(evCall(100, 75, e).total, 1)}. A pure bluff with the same fold equity is worth ${n(r.pureBluffTotal, 1)}.`;
    } },
    {
      kind: 'p',
      text: () =>
        'Fold equity and draw equity add. That is why drawing hands prefer betting to calling when villain folds often enough: the bet wins the pot outright some of the time and still has the draw when called. Neither component alone would justify the bet.',
    },
    { kind: 'h', text: 'Bluff-to-value ratio on the river' },
    { kind: 'formula', label: 'Bluff share that makes the caller indifferent', formula: 'B / (P + 2B)', value: () => `Pot-sized bet: ${pc(riverBluffShare(100, 100))}, one bluff for every two value bets. Half pot: ${pc(riverBluffShare(100, 50))}.` },
    { kind: 'h', text: 'Bluffing multiway' },
    {
      kind: 'p',
      text: () => {
        const hu = evBluff(100, 100, 0.5, 1);
        const three = evBluff(100, 100, 0.5, 3);
        return `A bluff must get through every opponent. If each folds independently with probability f, it succeeds with probability f to the power n. The overall threshold B / (P + B) does not move, but reaching it against three players with a pot-sized bet needs each to fold ${pc(three.breakEvenFoldEach)} of the time, against ${pc(hu.breakEvenFoldAll)} heads-up. Independence is a simplification, and the true numbers are worse for the bluffer since the last player to act knows the others have not folded. The lesson survives the simplification: bluffing scales badly.`;
      },
    },
    { kind: 'h', text: 'Action behind' },
    {
      kind: 'p',
      text: () =>
        'Calling with players still to act carries the risk of a raise that forces a fold and forfeits the call. The sandbox models this with one probability r: EV becomes (1 - r) times the call EV minus r times the call. It is a crude adjustment, and it is deliberately kept to one slider.',
    },
  ],
};
