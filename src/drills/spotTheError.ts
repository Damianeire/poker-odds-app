// Drill 6: spot the error. How far off is the shortcut, and in which direction?
// Level 1 picks a direction and size band; levels 2 and 3 give the signed error.

import { ruleOf2, ruleOf4, solomon, ruleOf4ErrorEstimate, type ShortcutResult } from '../engine/shortcuts';
import { type Rng } from '../engine/rng';
import { pickOuts } from './deal';
import { type Difficulty, type Drill, type DrillInstance, type ExplanationStep, num } from './types';

type Which = 'r2' | 'r4' | 'sol';

const BAND_CHOICES = [
  'Understates by 3 points or more',
  'Understates by 1 to 3 points',
  'About right, within 1 point',
  'Overstates by 1 to 3 points',
  'Overstates by 3 points or more',
];
const BAND_EDGES = [1, 3];
const LEVEL_ONE_OUTS = [4, 6, 8, 10, 11, 13, 15, 17];

function bandOf(error: number): number {
  if (error <= -3) return 0;
  if (error <= -1) return 1;
  if (error < 1) return 2;
  if (error < 3) return 3;
  return 4;
}

/** Too close to a band edge to be a fair multiple-choice question. */
function nearEdge(error: number): boolean {
  return BAND_EDGES.some((edge) => Math.abs(Math.abs(error) - edge) < 0.3);
}

const HINTS: Record<Which, string | null> = {
  r2: 'Method: the Rule of 2 understates by about 1 point per 8 outs.',
  r4: 'Method: the Rule of 4 is close up to 8 outs, then overstates by about 1 point per extra out.',
  sol: null,
};

function shortcutFor(which: Which, outs: number): { sc: ShortcutResult; context: string; formula: string } {
  if (which === 'r2') return { sc: ruleOf2(outs), context: 'one card to come on the flop', formula: `${outs} / 47` };
  const sc = which === 'r4' ? ruleOf4(outs) : solomon(outs);
  return { sc, context: 'two cards to come, villain all-in', formula: `1 - C(${47 - outs}, 2) / C(47, 2)` };
}

function quickCheck(which: Which, outs: number, sc: ShortcutResult): ExplanationStep[] {
  if (which === 'r2') {
    return [{ text: 'Without the exact figure: the Rule of 2 understates by about 1 point per 8 outs.', formula: `${outs} / 8`, result: `about ${num(outs / 8, 1)} under` }];
  }
  if (which === 'r4') {
    const steps: ExplanationStep[] = [];
    if (outs <= 8) {
      steps.push({ text: 'Without the exact figure: up to 8 outs the Rule of 4 is close, under a point either way.', result: 'about 0' });
    } else {
      steps.push({
        text: 'Without the exact figure: past 8 outs the Rule of 4 overstates by about 1 point per extra out. This is the amount Solomon takes off.',
        formula: `${outs} - 8`,
        result: `about ${ruleOf4ErrorEstimate(outs)} over`,
      });
      const sol = solomon(outs);
      steps.push({
        text: `Solomon's correction would say ${sol.estimate}%, off by ${num(sol.error, 1)} points. Corrected, it is close.`,
      });
    }
    return steps;
  }
  return [
    {
      text: 'Solomon takes off the Rule of 4 overstatement, one point per out past 8, so what is left is small.',
      formula: `${outs} x 4 - ${Math.max(0, outs - 8)}`,
      result: `${sc.estimate}%, within about a point`,
    },
  ];
}

function draw(rng: Rng, difficulty: Difficulty): { outs: number; which: Which } {
  if (difficulty === 1) return { outs: rng.pick(LEVEL_ONE_OUTS), which: rng.pick(['r2', 'r4'] as const) };
  return { outs: pickOuts(rng, difficulty), which: difficulty === 2 ? rng.pick(['r2', 'r4'] as const) : rng.pick(['r2', 'r4', 'sol'] as const) };
}

export const spotTheError: Drill = {
  id: 'spot-the-error',
  module: 'M4',
  title: 'Spot the error',
  description:
    'Given an out count and a shortcut estimate, say how far off it is and in which direction. Level 1 picks a size band; later levels give the error in points, and about right is right. Positive means the shortcut overstates.',
  generate(rng, difficulty): DrillInstance {
    let drawn = draw(rng, difficulty);
    // Level 1 is multiple choice, so redraw spots too close to a band edge to call fairly.
    for (let attempt = 0; attempt < 200 && difficulty === 1 && nearEdge(shortcutFor(drawn.which, drawn.outs).sc.error); attempt++) {
      drawn = draw(rng, difficulty);
    }
    const { outs, which } = drawn;
    const { sc, context, formula } = shortcutFor(which, outs);
    const direction = sc.error > 0 ? 'overstates' : sc.error < 0 ? 'understates' : 'is exact';
    const hint = difficulty < 3 ? HINTS[which] : null;
    const explanation = {
      steps: [
        { text: 'Exact figure from the engine.', formula, result: `${num(sc.exact, 2)}%` },
        { text: 'Error is estimate minus exact.', formula: `${sc.estimate} - ${num(sc.exact, 2)}`, result: `${num(sc.error, 2)} points` },
        ...quickCheck(which, outs, sc),
        ...(difficulty === 1 ? [{ text: 'Size band.', result: BAND_CHOICES[bandOf(sc.error)]! }] : []),
      ],
      summary: `${sc.name} ${direction} by ${num(Math.abs(sc.error), 1)} points.`,
    };
    const facts = [
      { label: 'Outs', value: String(outs) },
      { label: sc.name, value: `${sc.estimate}%` },
    ];
    if (difficulty === 1) {
      return {
        prompt: {
          text: `${outs} outs, ${context}. ${sc.name} says ${sc.estimate}%. How far off is that?`,
          facts,
          choices: BAND_CHOICES,
          ...(hint ? { hint } : {}),
        },
        answer: bandOf(sc.error),
        unit: 'count',
        tolerance: 0,
        explanation,
      };
    }
    return {
      prompt: {
        text: `${outs} outs, ${context}. ${sc.name} says ${sc.estimate}%. How many percentage points is that off by? Give a positive number if the shortcut overstates, negative if it understates.`,
        facts,
        answerLabel: 'Error (points)',
        ...(hint ? { hint } : {}),
        ...(difficulty === 3 ? { timeLimitSeconds: 45 } : {}),
      },
      answer: sc.error,
      unit: 'percent',
      // The Rule of 2 error is easy to estimate closely; the Rule of 4 and Solomon estimates are good to about a point.
      tolerance: which === 'r2' ? 0.5 : 1.5,
      explanation,
    };
  },
};
