// Drill 9: bet sizing from the other side. Choose a bet that denies a draw the right price.

import { formatCards } from '../engine/cards';
import { outProbabilities } from '../engine/outs';
import { potOdds, betToPriceOut } from '../engine/potodds';
import { dealDrawSpot, pickPot, BET_FRACTIONS } from './deal';
import { type Drill, type DrillInstance, num } from './types';

export const priceOut: Drill = {
  id: 'price-out',
  module: 'M5',
  title: 'Bet sizing against a draw',
  description:
    'Villain’s draw is face up. You are betting. Pick the smallest bet that gives the draw worse than break-even odds on the next card.',
  generate(rng, difficulty): DrillInstance {
    for (let attempt = 0; attempt < 500; attempt++) {
      const boardLength: 3 | 4 = difficulty === 1 ? 4 : rng.pick([3, 4]);
      const spot = dealDrawSpot(rng, { clean: difficulty < 3, boardLength });
      const outs = spot.outs.count;
      const probs = outProbabilities(outs, boardLength);
      const e = probs.nextCard;
      const pot = pickPot(rng, difficulty);
      const minBet = betToPriceOut(pot, e);
      if (minBet === null || minBet > 2 * pot) continue;
      const facts = [
        { label: 'Pot', value: String(pot) },
        { label: 'Street', value: boardLength === 3 ? 'flop, villain will see one card for a call' : 'turn' },
      ];
      const steps = [
        { text: `Villain’s outs to ${spot.target.label}: ${formatCards(spot.outs.outs)}.`, result: `${outs} outs` },
        { text: 'Villain’s chance on the next card.', formula: `${outs} / ${probs.unseen}`, result: `${num(e * 100, 1)}%` },
        {
          text: 'A bet B prices the draw out when B / (P + 2B) exceeds that chance. Solve for B.',
          formula: `B > e x P / (1 - 2e) = ${num(e, 3)} x ${pot} / (1 - ${num(2 * e, 3)})`,
          result: `${num(minBet, 1)} (${num(minBet / pot, 2)} pot)`,
        },
      ];
      if (difficulty < 3) {
        const idx = BET_FRACTIONS.findIndex((f) => potOdds(pot, pot * f.fraction).breakEven > e);
        if (idx < 0) continue;
        return {
          prompt: {
            text: `Villain is drawing to ${spot.target.label}. Which is the smallest of these bets that denies the correct price on the next card?`,
            villainCards: spot.hero,
            board: spot.board,
            facts,
            choices: BET_FRACTIONS.map((f) => f.label),
          },
          answer: idx,
          unit: 'count',
          tolerance: 0,
          explanation: {
            steps: [
              ...steps,
              {
                text: `Break-even equity for each sizing: ${BET_FRACTIONS.map((f) => `${f.label} ${num(potOdds(pot, pot * f.fraction).breakEven * 100, 1)}%`).join(', ')}.`,
              },
            ],
            summary: `${BET_FRACTIONS[idx]!.label} is the smallest sizing whose break-even exceeds ${num(e * 100, 1)}%.`,
          },
        };
      }
      return {
        prompt: {
          text: `Villain is drawing to ${spot.target.label}. What is the smallest bet that makes a call break-even or worse for villain on the next card?`,
          villainCards: spot.hero,
          board: spot.board,
          facts,
          answerLabel: 'Bet',
          timeLimitSeconds: 60,
        },
        answer: minBet,
        unit: 'chips',
        tolerance: Math.max(1, pot * 0.03),
        explanation: { steps, summary: `Any bet above ${num(minBet, 1)} prices out ${outs} outs into a pot of ${pot}.` },
      };
    }
    throw new Error('could not build a price-out spot');
  },
};
