// Drill 7: break-even equity for a given bet size.

import { potOdds } from '../engine/potodds';
import { formatOddsAgainst } from '../engine/shortcuts';
import { pickPot, pickBet } from './deal';
import { type Drill, type DrillInstance, num } from './types';

export const breakEvenEquity: Drill = {
  id: 'break-even-equity',
  module: 'M5',
  title: 'Break-even equity',
  description: 'Pot and a bet faced. State the equity you need to call, as a percentage or as odds.',
  generate(rng, difficulty): DrillInstance {
    const pot = pickPot(rng, difficulty);
    const { bet, label } = pickBet(rng, pot, difficulty);
    const po = potOdds(pot, bet);
    const exact = po.breakEven * 100;
    return {
      prompt: {
        text: `The pot is ${pot} and villain bets ${bet}${label ? ` (${label})` : ''}. What equity do you need to call?`,
        facts: [
          { label: 'Pot before the bet', value: String(pot) },
          { label: 'Bet faced', value: String(bet) },
        ],
        answerLabel: 'Equity needed',
        ...(difficulty === 3 ? { timeLimitSeconds: 40 } : {}),
      },
      answer: exact,
      unit: 'percent',
      tolerance: 0.5,
      explanation: {
        steps: [
          {
            text: 'The final pot includes villain’s bet and your call.',
            formula: `${pot} + ${bet} + ${bet}`,
            result: String(po.finalPot),
          },
          {
            text: 'Break-even equity is the call divided by the final pot.',
            formula: `${bet} / ${po.finalPot}`,
            result: `${num(exact, 2)}%`,
          },
          {
            text: 'The same thing as odds offered: (pot + bet) : bet.',
            formula: `${pot + bet} : ${bet}`,
            result: `${formatOddsAgainst(po.oddsOffered, 2)}, so you need to win 1 in ${num(po.oddsOffered + 1, 2)}`,
          },
        ],
        summary: `You need ${num(exact, 1)}% equity.`,
        alternate: `Odds offered: ${formatOddsAgainst(po.oddsOffered, 2)}.`,
      },
    };
  },
};
