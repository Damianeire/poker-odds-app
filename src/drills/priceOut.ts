// Drill 9: bet sizing from the other side. Choose a bet that denies a draw the right price.

import { formatCards } from '../engine/cards';
import { outProbabilities } from '../engine/outs';
import { potOdds, betToPriceOut } from '../engine/potodds';
import { dealDrawSpot, pickPot } from './deal';
import { type Drill, type DrillInstance, num } from './types';

/**
 * Bet sizes offered at levels 1 and 2. They start well under a third of the pot: a clean draw has at most
 * 9 outs, so a list that began at one third had the same right answer for every draw. With small sizes a
 * gutshot needs a fifth of the pot, a flush draw a third, and the mixed spots at level 2 need more.
 */
export const PRICE_OUT_SIZES: readonly { label: string; fraction: number }[] = [
  { label: 'one tenth of the pot', fraction: 1 / 10 },
  { label: 'one fifth of the pot', fraction: 1 / 5 },
  { label: 'a quarter of the pot', fraction: 1 / 4 },
  { label: 'one third of the pot', fraction: 1 / 3 },
  { label: 'half the pot', fraction: 1 / 2 },
  { label: 'two thirds of the pot', fraction: 2 / 3 },
  { label: 'the size of the pot', fraction: 1 },
  { label: '1.5 times the pot', fraction: 1.5 },
];

export const priceOut: Drill = {
  id: 'price-out',
  repeatIgnoresCards: true,
  module: 'M5',
  title: 'Bet sizing against a draw',
  description:
    'Villain’s draw is face up. You are betting. Pick the smallest bet that gives the draw worse than break-even odds on the next card.',
  generate(rng, difficulty): DrillInstance {
    for (let attempt = 0; attempt < 500; attempt++) {
      const boardLength: 3 | 4 = difficulty === 1 ? 4 : rng.pick([3, 4]);
      const spot = dealDrawSpot(rng, { clean: difficulty === 1, boardLength });
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
        const idx = PRICE_OUT_SIZES.findIndex((f) => potOdds(pot, pot * f.fraction).breakEven > e);
        if (idx < 0) continue;
        return {
          prompt: {
            text: `Villain is drawing to ${spot.target.label}. Which is the smallest of these bets that denies the correct price on the next card?`,
            villainCards: spot.hero,
            board: spot.board,
            facts,
            choices: PRICE_OUT_SIZES.map((f) => f.label),
          },
          answer: idx,
          unit: 'count',
          tolerance: 0,
          explanation: {
            steps: [
              ...steps,
              {
                text: `Break-even equity for each sizing: ${PRICE_OUT_SIZES.map((f) => `${f.label} ${num(potOdds(pot, pot * f.fraction).breakEven * 100, 1)}%`).join(', ')}.`,
              },
            ],
            summary: `${PRICE_OUT_SIZES[idx]!.label} is the smallest sizing whose break-even exceeds ${num(e * 100, 1)}%.`,
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
