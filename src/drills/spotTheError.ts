// Drill 6: spot the error. How far off is the shortcut, and in which direction?

import { ruleOf2, ruleOf4, solomon, type ShortcutResult } from '../engine/shortcuts';
import { pickOuts } from './deal';
import { type Drill, type DrillInstance, num } from './types';

export const spotTheError: Drill = {
  id: 'spot-the-error',
  module: 'M4',
  title: 'Spot the error',
  description:
    'Given an out count and a shortcut estimate, state the signed error in percentage points. Positive means the shortcut overstates the true chance.',
  generate(rng, difficulty): DrillInstance {
    const outs = difficulty === 1 ? rng.pick([4, 8, 9, 12, 15]) : pickOuts(rng, difficulty);
    let sc: ShortcutResult;
    let context: string;
    let formula: string;
    if (difficulty === 1) {
      sc = ruleOf4(outs);
      context = 'two cards to come, villain all-in';
      formula = `1 - C(${47 - outs}, 2) / C(47, 2)`;
    } else {
      const which = difficulty === 2 ? rng.pick(['r2', 'r4']) : rng.pick(['r2', 'r4', 'sol']);
      if (which === 'r2') {
        sc = ruleOf2(outs);
        context = 'one card to come on the flop';
        formula = `${outs} / 47`;
      } else if (which === 'r4') {
        sc = ruleOf4(outs);
        context = 'two cards to come, villain all-in';
        formula = `1 - C(${47 - outs}, 2) / C(47, 2)`;
      } else {
        sc = solomon(outs);
        context = 'two cards to come, villain all-in';
        formula = `1 - C(${47 - outs}, 2) / C(47, 2)`;
      }
    }
    const direction = sc.error > 0 ? 'overstates' : sc.error < 0 ? 'understates' : 'is exact';
    return {
      prompt: {
        text: `${outs} outs, ${context}. ${sc.name} says ${sc.estimate}%. How many percentage points is that off by? Give a positive number if the shortcut overstates, negative if it understates.`,
        facts: [
          { label: 'Outs', value: String(outs) },
          { label: sc.name, value: `${sc.estimate}%` },
        ],
        answerLabel: 'Error (points)',
        ...(difficulty === 3 ? { timeLimitSeconds: 45 } : {}),
      },
      answer: sc.error,
      unit: 'percent',
      tolerance: 0.5,
      explanation: {
        steps: [
          { text: 'Exact figure from the engine.', formula, result: `${num(sc.exact, 2)}%` },
          {
            text: 'Error is estimate minus exact.',
            formula: `${sc.estimate} - ${num(sc.exact, 2)}`,
            result: `${num(sc.error, 2)} points`,
          },
        ],
        summary: `${sc.name} ${direction} by ${num(Math.abs(sc.error), 1)} points.`,
      },
    };
  },
};
