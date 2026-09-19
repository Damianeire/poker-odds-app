// Drill 4: percentage to odds ratio and back.

import { percentToOddsAgainst, oddsAgainstToPercent, formatOddsAgainst, oneInN, bracketAnchors } from '../engine/shortcuts';
import { type Drill, type DrillInstance, type ExplanationStep, num } from './types';

const ROUND_PERCENTS = [10, 20, 25, 33.3, 40, 50];
const ROUND_ODDS = [1, 1.5, 2, 3, 4, 5, 9];

/** The two anchors either side of N, or null when N is whole (or close enough to say so) or below 2. */
function bracketStep(n: number): ReturnType<typeof bracketAnchors> | null {
  if (n < 2 || Math.abs(n - Math.round(n)) < 0.01) return null;
  return bracketAnchors(n);
}

function toRatioSteps(p: number, against: number): ExplanationStep[] {
  const n = oneInN(p);
  const steps: ExplanationStep[] = [
    { text: 'How many times does the percentage go into 100? That is the N in "1 in N".', formula: `100 / ${num(p, 1)}`, result: num(n, 2) },
  ];
  const anchors = bracketStep(n);
  if (anchors) {
    const [lo, hi] = anchors;
    steps.push({
      text: `${num(p, 1)}% sits between ${num(lo.percent, 1)}% (${formatOddsAgainst(lo.against)}) and ${num(hi.percent, 1)}% (${formatOddsAgainst(hi.against)}), so the answer is between ${lo.against} and ${hi.against}.`,
    });
  }
  steps.push({
    text: 'One of the N outcomes is the hit, so the odds against are N - 1. This is the same as (100 - p) / p.',
    formula: `${num(n, 2)} - 1`,
    result: formatOddsAgainst(against, 2),
  });
  return steps;
}

function toPercentSteps(against: number, p: number): ExplanationStep[] {
  const n = against + 1;
  const steps: ExplanationStep[] = [
    { text: 'One hit for every x misses makes x + 1 outcomes. That is the N in "1 in N".', formula: `${num(against, 1)} + 1`, result: num(n, 1) },
  ];
  const anchors = bracketStep(n);
  if (anchors) {
    const [lo, hi] = anchors;
    steps.push({
      text: `1 in ${lo.n} is ${num(lo.percent, 1)}% and 1 in ${hi.n} is ${num(hi.percent, 1)}%, so the answer is between ${num(hi.percent, 1)}% and ${num(lo.percent, 1)}%.`,
    });
  }
  steps.push({ text: 'Divide N into 100.', formula: `100 / ${num(n, 1)}`, result: `${num(p, 2)}%` });
  return steps;
}

const HINT_TO_RATIO = 'Method: how many times does the percentage go into 100? Subtract 1.';
const HINT_TO_PERCENT = 'Method: add 1 to the odds, then divide into 100.';

export const percentRatio: Drill = {
  id: 'percent-ratio',
  module: 'M3',
  title: 'Percentage and odds ratio',
  description: 'Convert a probability to odds against, or odds against to a probability.',
  generate(rng, difficulty): DrillInstance {
    const toRatio = rng.next() < 0.5;
    if (toRatio) {
      const p = difficulty === 1 ? rng.pick(ROUND_PERCENTS) : difficulty === 2 ? rng.range(1, 12) * 5 : rng.range(4, 70) + rng.pick([0, 0.5]);
      const against = percentToOddsAgainst(p);
      return {
        prompt: {
          text: `A draw hits ${num(p, 1)}% of the time. Express that as odds against hitting, in the form x to 1.`,
          facts: [{ label: 'Probability', value: `${num(p, 1)}%` }],
          answerLabel: 'Odds against (x to 1)',
          ...(difficulty < 3 ? { hint: HINT_TO_RATIO } : {}),
          ...(difficulty === 3 ? { timeLimitSeconds: 30 } : {}),
        },
        answer: against,
        unit: 'ratio',
        tolerance: difficulty === 1 ? 0.1 : 0.2,
        explanation: {
          steps: toRatioSteps(p, against),
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
        ...(difficulty < 3 ? { hint: HINT_TO_PERCENT } : {}),
        ...(difficulty === 3 ? { timeLimitSeconds: 30 } : {}),
      },
      answer: p,
      unit: 'percent',
      tolerance: 0.5,
      explanation: {
        steps: toPercentSteps(against, p),
        summary: `${formatOddsAgainst(against)} against is ${num(p, 1)}%.`,
        alternate: `Check: (100 - ${num(p, 1)}) / ${num(p, 1)} = ${num(percentToOddsAgainst(p), 2)} to 1.`,
      },
    };
  },
};
