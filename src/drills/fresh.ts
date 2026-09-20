// Stops a drill from asking the same question twice in a row. Drills with a small
// question space (a flush draw with nine outs, say) repeat by chance otherwise.

import { type Difficulty, type Drill, type DrillInstance } from './types';
import { type Rng } from '../engine/rng';
import { num } from './types';

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

/** What the learner would type or pick as the answer: the chosen option's text, or the figure to one decimal. */
export function answerKey(instance: DrillInstance): string {
  const { choices } = instance.prompt;
  return choices ? `choice:${choices[instance.answer]}` : `value:${num(instance.answer, 1)}`;
}

/** What the next question has to differ from: the previous question and, unless the drill opts out, its answer. */
export interface Seen {
  question: string;
  answer: string;
}

export function seen(instance: DrillInstance): Seen {
  return { question: questionKey(instance), answer: answerKey(instance) };
}

/**
 * Generate a question that differs from the previous one, and (unless the drill sets `answerMayRepeat`)
 * does not have the same answer either: 50 into 100 and 100 into 200 both need 25%, and a repeat is easy to spot.
 * Draws a new rng per attempt.
 * A draw that throws (a generator that could not build a spot) counts as a failed attempt.
 * If no draw satisfies both within the limit, the last one with a new question is preferred over one that repeats
 * the question (a drill with a single possible answer can only meet the first rule), then the last successful
 * draw; if every draw threw, the last error is rethrown.
 */
export function generateFresh(drill: Drill, difficulty: Difficulty, nextRng: () => Rng, avoid: Seen | null, tries = FRESH_TRIES): DrillInstance {
  let last: DrillInstance | null = null;
  let newQuestion: DrillInstance | null = null;
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
    if (avoid === null) return candidate;
    if (questionKey(candidate) === avoid.question) continue;
    newQuestion = candidate;
    if (!drill.answerMayRepeat && answerKey(candidate) === avoid.answer) continue;
    return candidate;
  }
  const fallback = newQuestion ?? last;
  if (fallback) return fallback;
  throw failure;
}
