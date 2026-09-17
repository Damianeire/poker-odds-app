import { setOrBetterOnFlop } from '../engine/implied';
import { pc } from './helpers';

export interface GlossaryEntry {
  term: string;
  definition: () => string;
  /** Module that computes the quantity, if any. */
  module?: string;
}

export const GLOSSARY: readonly GlossaryEntry[] = [
  { term: 'Backdoor draw', definition: () => 'A draw needing both the turn and the river, worth roughly one out.', module: 'M2' },
  { term: 'Blocker', definition: () => 'A visible card that removes combinations from what an opponent can hold.', module: 'M9' },
  { term: 'Board', definition: () => 'The shared face-up cards, up to five.', module: 'M1' },
  { term: 'Combo', definition: () => 'One specific two-card holding; a hand class has 4, 6, 12 or 16 of them.', module: 'M9' },
  { term: 'Dominated', definition: () => 'A hand sharing its top card with an opponent who has a better kicker, so most of its equity is cancelled.', module: 'M6' },
  { term: 'Equity', definition: () => 'Your expected share of the pot with no further betting: wins plus half of ties over all runouts.', module: 'M6' },
  { term: 'Effective stacks', definition: () => 'The smaller of two stacks: the most that can change hands between those players.', module: 'M7' },
  { term: 'Fold equity', definition: () => 'The part of a bet’s value that comes from the opponent folding.', module: 'M8' },
  { term: 'Gutshot', definition: () => 'A straight draw with one missing rank in the middle, four outs.', module: 'M2' },
  { term: 'Hole cards', definition: () => 'Your two private cards.', module: 'M1' },
  { term: 'Implied odds', definition: () => 'Pot odds adjusted for chips expected to be won later if the draw completes.', module: 'M7' },
  { term: 'Nuts', definition: () => 'The best possible hand given the board.', module: 'M7' },
  { term: 'Open-ended straight draw', definition: () => 'Four consecutive ranks completed at either end, eight outs.', module: 'M2' },
  { term: 'Out', definition: () => 'An unseen card that improves your hand to a likely winner.', module: 'M2' },
  { term: 'Overcard', definition: () => 'A hole card above every board card.', module: 'M2' },
  { term: 'Pot odds', definition: () => 'The ratio of the pot including the bet faced to the cost of calling; equivalently the break-even equity B / (P + 2B).', module: 'M5' },
  { term: 'Position', definition: () => 'Where you act in the betting order. Later is better.', module: 'M1' },
  { term: 'Range', definition: () => 'The set of hands an opponent could hold, weighted by remaining combos.', module: 'M9' },
  { term: 'Reverse implied odds', definition: () => 'Chips expected to be lost later when a draw completes but loses anyway.', module: 'M7' },
  { term: 'Semi-bluff', definition: () => 'A bet with a hand that is behind now but can improve; wins by folds and sometimes at showdown.', module: 'M8' },
  { term: 'Set', definition: () => 'Three of a kind using a pocket pair and one board card.', module: 'M2' },
  { term: 'Set mining', definition: () => `Calling preflop with a pocket pair to hit a set, which happens ${pc(setOrBetterOnFlop(), 1)} of the time, then playing for stacks.`, module: 'M7' },
  { term: 'Street', definition: () => 'A betting round: preflop, flop, turn or river.', module: 'M1' },
  { term: 'Tainted out', definition: () => 'A card that completes your draw but plausibly improves an opponent more.', module: 'M2' },
  { term: 'Value bet', definition: () => 'A bet expecting to be called by worse hands.', module: 'M8' },
];
