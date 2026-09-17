// Drill 4: percentage to odds ratio and back.

import { percentToOddsAgainst, oddsAgainstToPercent, formatOddsAgainst } from '../engine/shortcuts';
import { type Drill, type DrillInstance, num } from './types';

const ROUND_PERCENTS = [10, 20, 25, 33.3, 40, 50];
const ROUND_ODDS = [1, 1.5, 2, 3, 4, 5, 9];

export const percentRatio: Drill = {
  id: 'percent-ratio',
  module: 'M3',
  title: 'Percentage and odds ratio',
  description: 'Convert a probability to odds against, or odds against to a probability.',
  generate(rng, difficulty): DrillInstance {
    const toRatio = rng.next() < 0.5;
    if (toRatio) {
      const p = difficulty === 1 ? rng.pick(ROUND_PERCENTS) : difficulty === 2 ? rng.range(5, 60) : rng.range(4, 70) + rng.pick([0, 0.5]);
      const against = percentToOddsAgainst(p);
      return {
        prompt: {
          text: `A draw hits ${num(p, 1)}% of the time. Express that as odds against hitting, in the form x to 1.`,
          facts: [{ label: 'Probability', value: `${num(p, 1)}%` }],
          answerLabel: 'Odds against (x to 1)',
          ...(difficulty === 3 ? { timeLimitSeconds: 30 } : {}),
        },
        answer: against,
        unit: 'ratio',
        tolerance: difficulty === 1 ? 0.1 : 0.2,
        explanation: {
          steps: [
            {
              text: 'Odds against are the ways to miss against the ways to hit: (100 - p) : p.',
              formula: `(100 - ${num(p, 1)}) : ${num(p, 1)}`,
              result: `${num(100 - p, 1)} : ${num(p, 1)}`,
            },
            {
              text: 'Divide both sides by p to get x to 1.',
              formula: `${num(100 - p, 1)} / ${num(p, 1)}`,
              result: formatOddsAgainst(against, 2),
            },
          ],
          summary: `${num(p, 1)}% is ${formatOddsAgainst(against, 2)} against.`,
          alternate: `Check: 100 / (${num(against, 2)} + 1) = ${num(oddsAgainstToPercent(against), 1)}%.`,
        },
      };
    }
    const against =
      difficulty === 1 ? rng.pick(ROUND_ODDS) : difficulty === 2 ? rng.range(1, 12) + rng.pick([0, 0.5]) : Math.round((0.5 + rng.next() * 12) * 10) / 10;
    const p = oddsAgainstToPercent(against);
    return {
      prompt: {
        text: `The odds against a draw hitting are ${formatOddsAgainst(against)}. What is that as a percentage?`,
        facts: [{ label: 'Odds against', value: formatOddsAgainst(against) }],
        answerLabel: 'Percent',
        ...(difficulty === 3 ? { timeLimitSeconds: 30 } : {}),
      },
      answer: p,
      unit: 'percent',
      tolerance: 0.5,
      explanation: {
        steps: [
          {
            text: 'x to 1 against means x losing outcomes for every winning one, so the win share is 1 in (x + 1).',
            formula: `100 x 1 / (${num(against, 1)} + 1)`,
            result: `${num(p, 2)}%`,
          },
        ],
        summary: `${formatOddsAgainst(against)} against is ${num(p, 1)}%.`,
        alternate: `Check: (100 - ${num(p, 1)}) / ${num(p, 1)} = ${num(percentToOddsAgainst(p), 2)} to 1.`,
      },
    };
  },
};
