// Drill 1: count the outs.

import { formatCards, formatCard } from '../engine/cards';
import { Category, describeScore, evaluate } from '../engine/evaluator';
import { boardMadeCards, dealDrawSpot, dealVersusSpot } from './deal';
import { type Drill, type DrillInstance, type ExplanationStep } from './types';

export const countOuts: Drill = {
  id: 'count-outs',
  module: 'M2',
  title: 'Count the outs',
  description:
    'Hole cards and a flop. State the number of unseen cards that improve you to the named target. At difficulty 3 a villain hand is shown and only cards that actually win count.',
  generate(rng, difficulty): DrillInstance {
    if (difficulty < 3) {
      const spot = dealDrawSpot(rng, { clean: difficulty === 1 });
      const steps: ExplanationStep[] = [
        {
          text: `Your best hand now: ${describeScore(evaluate([...spot.hero, ...spot.board]))}.`,
        },
        {
          text: `Unseen cards: 52 minus your 2 hole cards minus ${spot.board.length} on the board.`,
          formula: `52 - 2 - ${spot.board.length}`,
          result: String(spot.outs.unseen),
        },
        {
          text: `Cards that make ${spot.target.label}: ${formatCards(spot.outs.outs)}.`,
          result: `${spot.outs.count} outs`,
        },
      ];
      const boardMade = boardMadeCards(spot.hero, spot.board, spot.target.category, spot.outs);
      // Board-made quads or full houses are a fair reading of "or better", so they are accepted too.
      // A card that only pairs the board is not: that is the standard out-counting rule.
      const lenient = boardMade.length > 0 && spot.target.category >= Category.FullHouse;
      if (boardMade.length > 0) {
        steps.push({
          text: `Not counted: ${formatCards(boardMade)}. ${
            boardMade.length === 1 ? 'It makes' : 'They make'
          } the hand on the board by itself, so every player shares it and your hole cards add only a kicker.${
            lenient ? ` Counting ${boardMade.length === 1 ? 'it' : 'them'} (${spot.outs.count + boardMade.length}) is also accepted.` : ''
          }`,
        });
      }
      return {
        prompt: {
          text: `How many outs do you have to ${spot.target.label}?`,
          heroCards: spot.hero,
          board: spot.board,
          answerLabel: 'Outs',
        },
        answer: spot.outs.count,
        unit: 'count',
        tolerance: 0,
        ...(lenient ? { alsoAccept: [spot.outs.count + boardMade.length] } : {}),
        // The same target with the same count is the same question, even in another suit.
        repeatKey: `${spot.target.label}|${spot.outs.count}`,
        explanation: {
          steps,
          summary: `${spot.outs.count} outs to ${spot.target.label}.`,
        },
      };
    }
    const spot = dealVersusSpot(rng);
    const heroNow = describeScore(evaluate([...spot.hero, ...spot.board]));
    const villNow = describeScore(evaluate([...spot.villain, ...spot.board]));
    const steps: ExplanationStep[] = [
      { text: `You hold ${heroNow}. Villain holds ${villNow}. You are behind.` },
      {
        text: `Unseen cards: 52 minus your 2, villain's 2 and ${spot.board.length} on the board.`,
        formula: `52 - 2 - 2 - ${spot.board.length}`,
        result: String(spot.outs.unseen),
      },
      {
        text: `Cards that put you ahead: ${spot.outs.count === 0 ? 'none' : formatCards(spot.outs.outs)}.`,
        result: `${spot.outs.count} outs`,
      },
    ];
    if (spot.tainted.length > 0) {
      steps.push({
        text: `Cards that improve your hand but leave you behind (tainted, not counted): ${spot.tainted
          .map(formatCard)
          .join(' ')}.`,
      });
    }
    return {
      prompt: {
        text: 'Villain’s hand is face up. How many cards give you the best hand after the next card?',
        heroCards: spot.hero,
        board: spot.board,
        villainCards: spot.villain,
        answerLabel: 'Outs',
      },
      answer: spot.outs.count,
      unit: 'count',
      tolerance: 0,
      explanation: {
        steps,
        summary: `${spot.outs.count} cards win against this hand.`,
      },
    };
  },
};
