// Drill 1: count the outs.

import { formatCards, formatCard } from '../engine/cards';
import { describeScore, evaluate } from '../engine/evaluator';
import { dealDrawSpot, dealVersusSpot } from './deal';
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
