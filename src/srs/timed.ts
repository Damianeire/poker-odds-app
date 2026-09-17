// Timed mode: twenty questions drawn across unlocked modules.

import { type Drill } from '../drills/types';
import { type Rng } from '../engine/rng';

export const TIMED_QUESTIONS = 20;

/** Pick a sequence of drills, spread evenly across the available ones. */
export function timedSequence(rng: Rng, available: readonly Drill[], count = TIMED_QUESTIONS): Drill[] {
  if (available.length === 0) throw new Error('no drills available');
  const out: Drill[] = [];
  let pool: Drill[] = [];
  while (out.length < count) {
    if (pool.length === 0) pool = rng.shuffle(available.slice());
    out.push(pool.pop()!);
  }
  return out;
}
