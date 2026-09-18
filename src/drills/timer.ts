// Applies the Drill tab's timer setting to a generated question. Drills set their own
// time limits; this is the one place those are switched off or slowed.

import { type DrillInstance } from './types';
import { type DrillTimer } from '../srs/store';

export const RELAXED_FACTOR = 2.5;

export function applyTimerSetting(instance: DrillInstance, mode: DrillTimer): DrillInstance {
  const limit = instance.prompt.timeLimitSeconds;
  if (limit === undefined || mode === 'standard') return instance;
  const { timeLimitSeconds: _dropped, ...rest } = instance.prompt;
  if (mode === 'off') return { ...instance, prompt: rest };
  return { ...instance, prompt: { ...rest, timeLimitSeconds: Math.round(limit * RELAXED_FACTOR) } };
}
