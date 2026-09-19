// Drill 23: hand ranking. Drill 24: best hand.

import { fullDeck, formatCards, rankOf } from '../engine/cards';
import { evaluate, describeScore, describeTiebreak, categoryOf, CATEGORY_NAMES, Category } from '../engine/evaluator';
import { type Rng } from '../engine/rng';
import { type Drill, type DrillInstance } from './types';

/** How many hole cards the best five-card hand uses. */
function holeCardsUsed(hole: readonly number[], board: readonly number[]): number {
  const full = evaluate([...hole, ...board]);
  // If the board alone makes the same score, zero hole cards are needed.
  if (board.length === 5 && evaluate(board) === full) return 0;
  // If dropping one hole card keeps the score, only one is needed.
  for (const keep of hole) {
    const withOne = [keep, ...board];
    if (withOne.length >= 5 && evaluate(withOne) === full) return 1;
  }
  return 2;
}

export const handRanking: Drill = {
  id: 'hand-ranking',
  module: 'M1',
  title: 'Name the hand',
  description: 'Seven cards: your two and five on the board. Name the category of the best five-card hand. At difficulty 3 the best hand often uses one hole card or none.',
  generate(rng, difficulty): DrillInstance {
    for (let attempt = 0; attempt < 5000; attempt++) {
      const cards = rng.sample(fullDeck(), 7);
      const hero = cards.slice(0, 2);
      const board = cards.slice(2);
      const score = evaluate(cards);
      const cat = categoryOf(score);
      const used = holeCardsUsed(hero, board);
      if (difficulty === 1 && cat === Category.HighCard && rng.next() < 0.7) continue;
      if (difficulty === 3 && used === 2 && rng.next() < 0.8) continue;
      if (difficulty === 2 && cat <= Category.OnePair && rng.next() < 0.5) continue;
      const choices = CATEGORY_NAMES.slice();
      return {
        prompt: {
          text: 'What is the best five-card hand you can make?',
          heroCards: hero,
          board,
          choices,
          ...(difficulty === 3 ? { timeLimitSeconds: 10 } : difficulty === 2 ? { timeLimitSeconds: 15 } : {}),
        },
        answer: cat,
        unit: 'count',
        tolerance: 0,
        explanation: {
          steps: [
            { text: `Best five cards: ${describeScore(score)}.` },
            { text: used === 0 ? 'The board plays. Your hole cards add nothing, so every opponent has at least this hand.' : used === 1 ? 'Only one of your hole cards is part of the best five.' : 'Both hole cards are part of the best five.' },
            { text: 'Categories from weakest to strongest: ' + CATEGORY_NAMES.join(', ') + '.' },
          ],
          summary: describeScore(score),
        },
      };
    }
    throw new Error('could not deal a hand ranking spot');
  },
};

export const bestHand: Drill = {
  id: 'best-hand',
  module: 'M1',
  title: 'Best hand',
  description: 'Two or three holdings and a full board. Say which wins, or whether the pot is split.',
  generate(rng, difficulty): DrillInstance {
    const players = difficulty === 1 ? 2 : rng.pick([2, 3]);
    for (let attempt = 0; attempt < 5000; attempt++) {
      const cards = rng.sample(fullDeck(), players * 2 + 5);
      const hands = Array.from({ length: players }, (_, i) => cards.slice(i * 2, i * 2 + 2));
      const board = cards.slice(players * 2);
      const scores = hands.map((h) => evaluate([...h, ...board]));
      const best = Math.max(...scores);
      const winners = scores.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0);
      const split = winners.length > 1;
      // Make close decisions more common at higher difficulty.
      const cats = scores.map(categoryOf);
      const sameCat = new Set(cats).size === 1;
      if (difficulty === 1 && sameCat && !split && rng.next() < 0.5) continue;
      if (difficulty >= 2 && !sameCat && !split && rng.next() < 0.6) continue;
      if (split && rng.next() < 0.5) continue;
      const choices = hands.map((_, i) => `Hand ${i + 1}`).concat(['Split pot']);
      // Same category as the runner-up: say what broke the tie.
      const runnerUp = split ? undefined : Math.max(...scores.filter((s) => s !== best));
      const tiebreak = runnerUp === undefined ? null : describeTiebreak(best, runnerUp);
      return {
        prompt: {
          text: `${players} hands at showdown. Which wins?`,
          board,
          handRows: hands.map((h, i) => ({ label: `Hand ${i + 1}`, cards: h })),
          choices,
          ...(difficulty === 3 ? { timeLimitSeconds: 15 } : difficulty === 2 ? { timeLimitSeconds: 24 } : {}),
        },
        answer: split ? players : winners[0]!,
        unit: 'count',
        tolerance: 0,
        explanation: {
          steps: hands.map((h, i) => ({ text: `Hand ${i + 1} (${formatCards(h)}): ${describeScore(scores[i]!)}.` })).concat([
            { text: split ? 'The best five cards are identical, so the pot is split. Suits never break ties.' : `Hand ${winners[0]! + 1} is best.${tiebreak ? ` ${tiebreak}` : ''}` },
          ]),
          summary: split ? 'Split pot.' : `Hand ${winners[0]! + 1} wins with ${describeScore(best)}.${tiebreak ? ` ${tiebreak}` : ''}`,
        },
      };
    }
    throw new Error('could not deal a best hand spot');
  },
};

export { rankOf };
export type { Rng };
