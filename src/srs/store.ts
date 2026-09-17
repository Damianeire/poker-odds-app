// Progress state: Leitner boxes, per-drill statistics, session history,
// calibration, settings. Pure functions over a versioned JSON-able object.
// Persistence to localStorage lives in persist.ts.

export const SCHEMA_VERSION = 1;

export const BOX_INTERVALS_DAYS: readonly number[] = [1, 2, 4, 8, 16];
export const ROLLING_WINDOW = 50;

export interface DrillRecord {
  /** Leitner box, 1 to 5. */
  box: number;
  /** ISO timestamp when this drill is next due. */
  due: string;
  attempts: number;
  correct: number;
  /** Most recent response times in ms, up to ROLLING_WINDOW. */
  times: number[];
  /** Most recent signed errors in the answer's unit, percent-unit drills only. */
  errors: number[];
  /** Most recent outcomes, 1 correct, 0 miss, up to ROLLING_WINDOW. */
  recent: number[];
  lastSeen: string;
}

export interface TimedSession {
  at: string;
  questions: number;
  correct: number;
  medianMs: number;
}

export interface BankrollSession {
  at: string;
  decisions: number;
  /** Big blinds gained or lost per 100 decisions. */
  bb100: number;
  finalStack: number;
}

export interface Settings {
  fourColour: boolean;
  /** Require fluency on the M1 drills before other modules unlock. */
  gating: boolean;
}

export interface ProgressState {
  version: number;
  drills: Record<string, DrillRecord>;
  timed: TimedSession[];
  bankroll: BankrollSession[];
  /** Absolute errors of the most recent estimates, in percentage points. */
  calibration: number[];
  settings: Settings;
}

export function emptyState(): ProgressState {
  return {
    version: SCHEMA_VERSION,
    drills: {},
    timed: [],
    bankroll: [],
    calibration: [],
    settings: { fourColour: true, gating: true },
  };
}

export interface AttemptInput {
  drillId: string;
  correct: boolean;
  ms: number;
  /** Signed error for estimate-type answers, in percentage points. */
  error?: number;
}

function pushRolling(list: number[], value: number): number[] {
  const out = list.concat([value]);
  return out.length > ROLLING_WINDOW ? out.slice(out.length - ROLLING_WINDOW) : out;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

/** Record an attempt. Correct advances a box, a miss drops to box 1. Returns a new state. */
export function recordAttempt(state: ProgressState, input: AttemptInput, now: Date): ProgressState {
  const prev = state.drills[input.drillId] ?? {
    box: 1,
    due: now.toISOString(),
    attempts: 0,
    correct: 0,
    times: [],
    errors: [],
    recent: [],
    lastSeen: now.toISOString(),
  };
  const box = input.correct ? Math.min(5, prev.box + 1) : 1;
  const rec: DrillRecord = {
    box,
    due: addDays(now, BOX_INTERVALS_DAYS[box - 1]!).toISOString(),
    attempts: prev.attempts + 1,
    correct: prev.correct + (input.correct ? 1 : 0),
    times: pushRolling(prev.times, input.ms),
    errors: input.error !== undefined && Number.isFinite(input.error) ? pushRolling(prev.errors, input.error) : prev.errors,
    recent: pushRolling(prev.recent, input.correct ? 1 : 0),
    lastSeen: now.toISOString(),
  };
  const calibration =
    input.error !== undefined && Number.isFinite(input.error) ? pushRolling(state.calibration, Math.abs(input.error)) : state.calibration;
  return { ...state, drills: { ...state.drills, [input.drillId]: rec }, calibration };
}

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function mean(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export interface DrillSummary {
  drillId: string;
  attempts: number;
  accuracy: number | null;
  /** Accuracy over the recent window. */
  recentAccuracy: number | null;
  medianMs: number | null;
  /** Mean signed error, so a bias shows as a consistent sign. */
  bias: number | null;
  box: number;
  due: boolean;
}

export function summarise(state: ProgressState, drillId: string, now: Date): DrillSummary {
  const r = state.drills[drillId];
  if (!r) return { drillId, attempts: 0, accuracy: null, recentAccuracy: null, medianMs: null, bias: null, box: 1, due: true };
  return {
    drillId,
    attempts: r.attempts,
    accuracy: r.attempts > 0 ? r.correct / r.attempts : null,
    recentAccuracy: r.recent.length > 0 ? mean(r.recent) : null,
    medianMs: median(r.times),
    bias: mean(r.errors),
    box: r.box,
    due: new Date(r.due).getTime() <= now.getTime(),
  };
}

/** Drills due for review now, most overdue first. */
export function dueDrills(state: ProgressState, drillIds: readonly string[], now: Date): string[] {
  return drillIds
    .filter((id) => {
      const r = state.drills[id];
      return !r || new Date(r.due).getTime() <= now.getTime();
    })
    .sort((a, b) => {
      const ra = state.drills[a];
      const rb = state.drills[b];
      const ta = ra ? new Date(ra.due).getTime() : 0;
      const tb = rb ? new Date(rb.due).getTime() : 0;
      return ta - tb;
    });
}

/**
 * Weakest drills first: lowest recent accuracy among drills with any attempts,
 * ties broken by slower median time. Unattempted drills are listed last.
 */
export function weakestDrills(state: ProgressState, drillIds: readonly string[], now: Date): DrillSummary[] {
  const summaries = drillIds.map((id) => summarise(state, id, now));
  return summaries.sort((a, b) => {
    if (a.attempts === 0 && b.attempts === 0) return 0;
    if (a.attempts === 0) return 1;
    if (b.attempts === 0) return -1;
    const acc = (a.recentAccuracy ?? 0) - (b.recentAccuracy ?? 0);
    if (Math.abs(acc) > 1e-9) return acc;
    return (b.medianMs ?? 0) - (a.medianMs ?? 0);
  });
}

export const FLUENCY = { attempts: 20, accuracy: 0.9, medianMs: 10000 };

/** Fluent: enough attempts, high recent accuracy, and quick. */
export function isFluent(state: ProgressState, drillId: string): boolean {
  const r = state.drills[drillId];
  if (!r || r.attempts < FLUENCY.attempts) return false;
  const acc = mean(r.recent) ?? 0;
  const med = median(r.times) ?? Infinity;
  return acc >= FLUENCY.accuracy && med <= FLUENCY.medianMs;
}

export const GATING_DRILLS: readonly string[] = ['hand-ranking', 'best-hand'];

export const MODULE_IDS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9'] as const;

/** M1 is always open. The rest open once the gating drills are fluent, or gating is off. */
export function unlockedModules(state: ProgressState): string[] {
  if (!state.settings.gating) return MODULE_IDS.slice();
  const fluent = GATING_DRILLS.every((id) => isFluent(state, id));
  return fluent ? MODULE_IDS.slice() : ['M1'];
}

/** Median absolute error over the last fifty estimates, in percentage points. */
export function calibrationScore(state: ProgressState): number | null {
  return median(state.calibration);
}

export function addTimedSession(state: ProgressState, s: TimedSession): ProgressState {
  return { ...state, timed: state.timed.concat([s]) };
}

export function addBankrollSession(state: ProgressState, s: BankrollSession): ProgressState {
  return { ...state, bankroll: state.bankroll.concat([s]) };
}

export function updateSettings(state: ProgressState, patch: Partial<Settings>): ProgressState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

export function exportJson(state: ProgressState): string {
  return JSON.stringify(state, null, 2);
}

/** Parse and validate an export. Throws with a plain message on bad input. */
export function importJson(text: string): ProgressState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Not a progress export.');
  const obj = parsed as Partial<ProgressState>;
  if (obj.version !== SCHEMA_VERSION) throw new Error(`Unsupported schema version ${String(obj.version)}; this build reads version ${SCHEMA_VERSION}.`);
  if (!obj.drills || typeof obj.drills !== 'object') throw new Error('Missing drill records.');
  const base = emptyState();
  const drills: Record<string, DrillRecord> = {};
  for (const [id, r] of Object.entries(obj.drills as Record<string, Partial<DrillRecord>>)) {
    if (!r || typeof r !== 'object') continue;
    drills[id] = {
      box: Math.min(5, Math.max(1, Number(r.box) || 1)),
      due: typeof r.due === 'string' ? r.due : base.drills[id]?.due ?? new Date(0).toISOString(),
      attempts: Number(r.attempts) || 0,
      correct: Number(r.correct) || 0,
      times: Array.isArray(r.times) ? r.times.filter((x) => typeof x === 'number') : [],
      errors: Array.isArray(r.errors) ? r.errors.filter((x) => typeof x === 'number') : [],
      recent: Array.isArray(r.recent) ? r.recent.filter((x) => x === 0 || x === 1) : [],
      lastSeen: typeof r.lastSeen === 'string' ? r.lastSeen : new Date(0).toISOString(),
    };
  }
  return {
    version: SCHEMA_VERSION,
    drills,
    timed: Array.isArray(obj.timed) ? obj.timed : [],
    bankroll: Array.isArray(obj.bankroll) ? obj.bankroll : [],
    calibration: Array.isArray(obj.calibration) ? obj.calibration.filter((x) => typeof x === 'number') : [],
    settings: { ...base.settings, ...(obj.settings ?? {}) },
  };
}
