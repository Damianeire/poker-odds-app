// Stops a drill from asking the same question twice in a row. Drills with a small
// question space (a flush draw with nine outs, say) repeat by chance otherwise.

import { type Difficulty, type Drill, type DrillInstance } from './types';
import { type Rng } from '../engine/rng';

export const FRESH_TRIES = 20;

/**
 * Identifies what the learner sees. Ignores the time limit and the order of choices.
 * A drill can set `repeatKey` to say that only the concept counts, not the cards.
 */
export function questionKey(instance: DrillInstance): string {
  if (instance.repeatKey !== undefined) return `repeat:${instance.repeatKey}`;
  const { timeLimitSeconds: _limit, choices, ...shown } = instance.prompt;
  return JSON.stringify({ ...shown, choices: choices ? [...choices].sort() : undefined, answer: instance.answer });
}

/** Like questionKey but blind to the cards shown: the same numbers, target and answer in another suit match. */
export function conceptKey(instance: DrillInstance): string {
  const { timeLimitSeconds: _limit, heroCards: _hero, board: _board, villainCards: _villain, handRows: _rows, choices, ...shown } = instance.prompt;
  return `concept:${JSON.stringify({ ...shown, choices: choices ? [...choices].sort() : undefined, answer: instance.answer })}`;
}

/**
 * Generate a question whose key differs from `avoidKey`. Draws a new rng per attempt.
 * A draw that throws (a generator that could not build a spot) counts as a failed attempt.
 * If nothing different comes back within the limit, the last successful draw is returned;
 * if every draw threw, the last error is rethrown.
 */
export function generateFresh(drill: Drill, difficulty: Difficulty, nextRng: () => Rng, avoidKey: string | null, tries = FRESH_TRIES): DrillInstance {
  let last: DrillInstance | null = null;
  let failure: unknown = null;
  for (let i = 0; i < tries; i++) {
    let candidate: DrillInstance;
    try {
      candidate = drill.generate(nextRng(), difficulty);
    } catch (error) {
      failure = error;
      continue;
    }
    if (drill.repeatIgnoresCards && candidate.repeatKey === undefined) candidate = { ...candidate, repeatKey: conceptKey(candidate) };
    last = candidate;
    if (avoidKey === null || questionKey(candidate) !== avoidKey) return candidate;
  }
  if (last) return last;
  throw failure;
}
