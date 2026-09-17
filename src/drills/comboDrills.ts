// Drill 15: combination counting, with and without blockers.

import { fullDeck, rankOf, formatCards, RANK_CHARS } from '../engine/cards';
import { parseHandClass, formatHandClass, combosOfClass, baseCombos, unpairedCombos, pairCombos, type HandClass } from '../engine/combos';
import { type Drill, type DrillInstance, type ExplanationStep, num } from './types';

export const comboCount: Drill = {
  id: 'combo-count',
  module: 'M9',
  title: 'Combination counting',
  description: 'How many combinations of a named hand exist, given the cards you can see. Blockers remove combinations.',
  generate(rng, difficulty): DrillInstance {
    const hi = rng.range(6, 14);
    const lo = difficulty === 1 ? hi : rng.range(2, hi);
    let cls: HandClass;
    if (lo === hi) cls = { hi, lo, kind: 'pair' };
    else cls = { hi, lo, kind: rng.next() < 0.3 ? 'suited' : rng.next() < 0.5 ? 'offsuit' : 'suited' };
    // Difficulty 1 alternates between pairs and unpaired; both may be blocked.
    if (difficulty === 1 && rng.next() < 0.5) cls = { hi, lo: rng.range(2, hi - 1), kind: 'offsuit' };
    const name = formatHandClass(cls);
    const visibleCount = difficulty === 1 ? rng.pick([0, 2]) : difficulty === 2 ? rng.pick([2, 5]) : rng.pick([5, 6]);
    let visible: number[] = [];
    if (visibleCount > 0) {
      // Bias visible cards toward the ranks in question so blockers matter.
      const pool = fullDeck();
      const relevant = pool.filter((c) => rankOf(c) === cls.hi || rankOf(c) === cls.lo);
      const nRelevant = Math.min(relevant.length, rng.range(0, Math.min(2, visibleCount)));
      const picked = rng.sample(relevant, nRelevant);
      const rest = rng.sample(pool.filter((c) => !picked.includes(c)), visibleCount - nRelevant);
      visible = [...picked, ...rest];
    }
    const combos = combosOfClass(cls, visible);
    const bx = visible.filter((c) => rankOf(c) === cls.hi).length;
    const by = visible.filter((c) => rankOf(c) === cls.lo).length;
    const label = cls.kind === 'pair' ? `pocket ${RANK_CHARS[cls.hi - 2]}s` : `${name} (${cls.kind})`;
    const steps: ExplanationStep[] = [
      { text: `With nothing visible, ${name} has ${baseCombos(cls)} combinations: ${cls.kind === 'pair' ? 'C(4, 2)' : cls.kind === 'suited' ? 'one per suit' : '4 x 4 minus the 4 suited'}.` },
    ];
    if (cls.kind === 'pair') {
      steps.push({ text: `Visible ${RANK_CHARS[cls.hi - 2]}s: ${bx}. Remaining combos are C(4 - ${bx}, 2).`, formula: `C(${4 - bx}, 2)`, result: String(pairCombos(bx)) });
    } else if (cls.kind === 'offsuit') {
      steps.push({ text: `Visible: ${bx} of rank ${RANK_CHARS[cls.hi - 2]}, ${by} of rank ${RANK_CHARS[cls.lo - 2]}. All combos are (4 - bx)(4 - by); subtract the suited ones that remain.`, formula: `${unpairedCombos(bx, by)} - suited`, result: String(combos.length) });
    } else {
      steps.push({ text: `Visible: ${bx} of rank ${RANK_CHARS[cls.hi - 2]}, ${by} of rank ${RANK_CHARS[cls.lo - 2]}. A suited combo survives only if both cards of that suit are unseen.`, result: String(combos.length) });
    }
    steps.push({ text: `Remaining combinations: ${combos.length === 0 ? 'none' : combos.map((c) => formatCards(c)).join(', ')}.` });
    return {
      prompt: {
        text: visible.length === 0 ? `How many combinations of ${label} are there?` : `Given the cards you can see, how many combinations of ${label} can villain hold?`,
        ...(visible.length > 0 ? { board: visible } : {}),
        answerLabel: 'Combinations',
        ...(difficulty === 3 ? { timeLimitSeconds: 45 } : {}),
      },
      answer: combos.length,
      unit: 'count',
      tolerance: 0,
      explanation: { steps, summary: `${combos.length} combinations of ${name}.` },
    };
  },
};

export { parseHandClass, num };
