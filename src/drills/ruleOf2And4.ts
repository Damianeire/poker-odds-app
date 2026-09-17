// Drill 5: estimate with the Rule of 2 and 4 under a countdown.

import { probNextCard, probTwoCards } from '../engine/outs';
import { ruleOf2, ruleOf4, solomon, percentToOddsAgainst, formatOddsAgainst } from '../engine/shortcuts';
import { pickOuts } from './deal';
import { type Drill, type DrillInstance, toleranceForShortcut, num } from './types';

const TIME_LIMITS: Record<1 | 2 | 3, number> = { 1: 20, 2: 12, 3: 8 };

export const ruleOf2And4: Drill = {
  id: 'rule-of-2-and-4',
  module: 'M4',
  title: 'Estimate with the Rule of 2 and 4',
  description:
    'Outs and a street, on a timer. Estimate the probability in your head. The Rule of 2 applies to one card to come, the Rule of 4 only when both cards are guaranteed.',
  generate(rng, difficulty): DrillInstance {
    const outs = pickOuts(rng, difficulty);
    const twoCards = rng.next() < 0.5;
    const timeLimitSeconds = TIME_LIMITS[difficulty];
    if (twoCards) {
      const exact = probTwoCards(outs) * 100;
      const r4 = ruleOf4(outs);
      const sol = solomon(outs);
      const taught = outs > 8 ? sol : r4;
      return {
        prompt: {
          text: `Flop, villain all-in, ${outs} outs. Estimate your chance of hitting by the river.`,
          facts: [
            { label: 'Outs', value: String(outs) },
            { label: 'Cards to come', value: '2 (all-in)' },
          ],
          answerLabel: 'Percent',
          timeLimitSeconds,
        },
        answer: exact,
        unit: 'percent',
        tolerance: toleranceForShortcut([r4.error, sol.error]),
        shortcutAnswer: taught.estimate,
        shortcutName: taught.name,
        explanation: {
          steps: [
            { text: 'Two cards to come, so the Rule of 4 applies.', formula: `${outs} x 4`, result: `${r4.estimate}%` },
            {
              text: outs > 8 ? 'More than 8 outs, so apply Solomon’s correction.' : 'At 8 outs or fewer, no correction is needed.',
              formula: `${outs} x 4 - max(0, ${outs} - 8)`,
              result: `${sol.estimate}%`,
            },
            {
              text: 'Exact figure from the engine.',
              formula: `1 - C(${47 - outs}, 2) / C(47, 2)`,
              result: `${num(exact, 2)}%`,
            },
            { text: `Rule of 4 error ${num(r4.error, 1)} points. Solomon error ${num(sol.error, 1)} points.` },
          ],
          summary: `Exact ${num(exact, 1)}%. Taught shortcut ${taught.estimate}%.`,
          alternate: `As odds against: ${formatOddsAgainst(percentToOddsAgainst(exact))}.`,
        },
      };
    }
    const onTurn = rng.next() < 0.5;
    const unseen = onTurn ? 46 : 47;
    const exact = probNextCard(outs, unseen) * 100;
    const r2 = ruleOf2(outs, unseen);
    return {
      prompt: {
        text: onTurn
          ? `Turn, ${outs} outs, one card to come. Estimate your chance of hitting on the river.`
          : `Flop, villain is not all-in and will bet again on the turn, ${outs} outs. Estimate your chance of hitting on the next card.`,
        facts: [
          { label: 'Outs', value: String(outs) },
          { label: 'Cards to come', value: '1' },
        ],
        answerLabel: 'Percent',
        timeLimitSeconds,
      },
      answer: exact,
      unit: 'percent',
      tolerance: toleranceForShortcut([r2.error]),
      shortcutAnswer: r2.estimate,
      shortcutName: r2.name,
      explanation: {
        steps: [
          {
            text: onTurn
              ? 'One card to come, so the Rule of 2 applies.'
              : 'Calling on the flop only buys the turn card, so the Rule of 2 applies, not the Rule of 4.',
            formula: `${outs} x 2`,
            result: `${r2.estimate}%`,
          },
          { text: 'Exact figure from the engine.', formula: `${outs} / ${unseen}`, result: `${num(exact, 2)}%` },
          { text: `Rule of 2 error ${num(r2.error, 1)} points.` },
        ],
        summary: `Exact ${num(exact, 1)}%. Rule of 2 gives ${r2.estimate}%.`,
        alternate: `As odds against: ${formatOddsAgainst(percentToOddsAgainst(exact))}.`,
      },
    };
  },
};
