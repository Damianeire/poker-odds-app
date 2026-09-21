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

export type Level = 1 | 2 | 3;

/** Countdown in the Drill tab. Timed mode is not affected. */
export type DrillTimer = 'off' | 'relaxed' | 'standard';

/**
 * How difficulty levels are worked through in the Drill tab.
 * free: one level for everything, chosen by hand.
 * per-drill: each drill keeps its own level and suggests moving up.
 * curriculum: one pass level for all drills, the next opens once every drill passes the current one.
 */
export type Progression = 'free' | 'per-drill' | 'curriculum';

export interface Settings {
  fourColour: boolean;
  /** Open modules one at a time, each after the previous module's drills pass level 1. */
  gating: boolean;
  drillTimer: DrillTimer;
  progression: Progression;
}

/** Recent outcomes (1 correct, 0 miss) at each level, up to LEVEL_WINDOW each. */
export type LevelHistory = Partial<Record<Level, number[]>>;

export interface ProgressState {
  version: number;
  drills: Record<string, DrillRecord>;
  timed: TimedSession[];
  bankroll: BankrollSession[];
  /** Absolute errors of the most recent estimates, in percentage points. */
  calibration: number[];
  settings: Settings;
  /** Recent outcomes per drill per level. */
  levels: Record<string, LevelHistory>;
  /** Current level per drill, used by per-drill progression. */
  drillLevel: Record<string, Level>;
  /** Current pass level, used by curriculum progression. */
  curriculumLevel: Level;
  /** Drill open when the app was last used, so a reload resumes it. */
  lastDrillId: string | null;
}

export function emptyState(): ProgressState {
  return {
    version: SCHEMA_VERSION,
    drills: {},
    timed: [],
    bankroll: [],
    calibration: [],
    settings: { fourColour: true, gating: true, drillTimer: 'off', progression: 'per-drill' },
    levels: {},
    drillLevel: {},
    curriculumLevel: 1,
    lastDrillId: null,
  };
}

export interface AttemptInput {
  drillId: string;
  correct: boolean;
  ms: number;
  /** Level the question was set at. Omitted for attempts that should not count towards level progress. */
  difficulty?: Level;
  /** Signed error for estimate-type answers, in percentage points. */
  error?: number;
}

export const LEVEL_PASS = { attempts: 10, accuracy: 0.8 };

function pushLevel(list: number[], value: number): number[] {
  const out = list.concat([value]);
  return out.length > LEVEL_PASS.attempts ? out.slice(out.length - LEVEL_PASS.attempts) : out;
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
  const levels = input.difficulty
    ? {
        ...state.levels,
        [input.drillId]: {
          ...state.levels[input.drillId],
          [input.difficulty]: pushLevel(state.levels[input.drillId]?.[input.difficulty] ?? [], input.correct ? 1 : 0),
        },
      }
    : state.levels;
  return { ...state, drills: { ...state.drills, [input.drillId]: rec }, calibration, levels };
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

export const MODULE_IDS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9'] as const;

/** A level is passed when the last ten answers at it exist and at least 80% were correct. */
export function levelPassed(state: ProgressState, drillId: string, level: Level): boolean {
  const recent = state.levels[drillId]?.[level] ?? [];
  if (recent.length < LEVEL_PASS.attempts) return false;
  return (mean(recent) ?? 0) >= LEVEL_PASS.accuracy;
}

/** A drill is cleared once it has passed level 1 (or any higher level). */
export function drillCleared(state: ProgressState, drillId: string): boolean {
  return ([1, 2, 3] as const).some((l) => levelPassed(state, drillId, l));
}

/**
 * Modules open one at a time. M1 is always open; each later module opens once every drill in the
 * one before it is cleared. With gating off, everything is open. `drillsIn` lists a module's drill ids.
 */
export function openModules(state: ProgressState, drillsIn: (module: string) => readonly string[]): string[] {
  if (!state.settings.gating) return MODULE_IDS.slice();
  const open: string[] = [MODULE_IDS[0]];
  for (let i = 1; i < MODULE_IDS.length; i++) {
    if (!drillsIn(MODULE_IDS[i - 1]!).every((id) => drillCleared(state, id))) break;
    open.push(MODULE_IDS[i]!);
  }
  return open;
}

/** Correct answers and answers counted in the current level window (last ten at most). */
export function levelWindow(state: ProgressState, drillId: string, level: Level): { correct: number; count: number } {
  const recent = state.levels[drillId]?.[level] ?? [];
  return { correct: recent.reduce((a, b) => a + b, 0), count: recent.length };
}

/** The next level up when the current one is passed, otherwise null. */
export function suggestedLevel(state: ProgressState, drillId: string, current: Level): Level | null {
  if (current >= 3 || !levelPassed(state, drillId, current)) return null;
  return (current + 1) as Level;
}

/** The first drill after the current one, in the given order, that has not passed level 3. Null when none remain. */
export function nextUnfinishedDrill(state: ProgressState, orderedIds: readonly string[], currentId: string): string | null {
  const after = orderedIds.slice(orderedIds.indexOf(currentId) + 1);
  return after.find((id) => !levelPassed(state, id, 3)) ?? null;
}

/** How many of the given drills have passed a level. */
export function curriculumProgress(state: ProgressState, drillIds: readonly string[], level: Level): number {
  return drillIds.filter((id) => levelPassed(state, id, level)).length;
}

/** The highest level open in curriculum progression: each level needs every drill to pass the one below. */
export function curriculumOpenLevel(state: ProgressState, drillIds: readonly string[]): Level {
  if (drillIds.length === 0) return 1;
  if (curriculumProgress(state, drillIds, 1) < drillIds.length) return 1;
  if (curriculumProgress(state, drillIds, 2) < drillIds.length) return 2;
  return 3;
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

export function setDrillLevel(state: ProgressState, drillId: string, level: Level): ProgressState {
  return { ...state, drillLevel: { ...state.drillLevel, [drillId]: level } };
}

export function setCurriculumLevel(state: ProgressState, level: Level): ProgressState {
  return { ...state, curriculumLevel: level };
}

export function setLastDrill(state: ProgressState, drillId: string): ProgressState {
  return state.lastDrillId === drillId ? state : { ...state, lastDrillId: drillId };
}

export function updateSettings(state: ProgressState, patch: Partial<Settings>): ProgressState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

export interface ProgressSummary {
  attempts: number;
  drillsAttempted: number;
  /** ISO timestamp of the most recent answer, or null when there are none. */
  lastSeen: string | null;
}

export function progressSummary(state: ProgressState): ProgressSummary {
  const records = Object.values(state.drills).filter((r) => r.attempts > 0);
  const lastSeen = records.reduce<string | null>((best, r) => (best === null || r.lastSeen > best ? r.lastSeen : best), null);
  return { attempts: records.reduce((a, r) => a + r.attempts, 0), drillsAttempted: records.length, lastSeen };
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
    settings: sanitiseSettings(obj.settings, base.settings),
    levels: sanitiseLevels(obj.levels),
    drillLevel: sanitiseDrillLevels(obj.drillLevel),
    curriculumLevel: asLevel(obj.curriculumLevel) ?? 1,
    lastDrillId: typeof obj.lastDrillId === 'string' ? obj.lastDrillId : null,
  };
}

function asLevel(x: unknown): Level | null {
  return x === 1 || x === 2 || x === 3 ? x : null;
}

const TIMERS: readonly DrillTimer[] = ['off', 'relaxed', 'standard'];
const PROGRESSIONS: readonly Progression[] = ['free', 'per-drill', 'curriculum'];

function sanitiseSettings(raw: unknown, base: Settings): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  return {
    fourColour: typeof r.fourColour === 'boolean' ? r.fourColour : base.fourColour,
    gating: typeof r.gating === 'boolean' ? r.gating : base.gating,
    drillTimer: TIMERS.includes(r.drillTimer as DrillTimer) ? (r.drillTimer as DrillTimer) : base.drillTimer,
    progression: PROGRESSIONS.includes(r.progression as Progression) ? (r.progression as Progression) : base.progression,
  };
}

function sanitiseLevels(raw: unknown): Record<string, LevelHistory> {
  const out: Record<string, LevelHistory> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, h] of Object.entries(raw as Record<string, unknown>)) {
    if (!h || typeof h !== 'object') continue;
    const hist: LevelHistory = {};
    for (const lv of [1, 2, 3] as const) {
      const list = (h as Record<string, unknown>)[String(lv)];
      if (Array.isArray(list)) hist[lv] = list.filter((x) => x === 0 || x === 1).slice(-LEVEL_PASS.attempts);
    }
    out[id] = hist;
  }
  return out;
}

function sanitiseDrillLevels(raw: unknown): Record<string, Level> {
  const out: Record<string, Level> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const lv = asLevel(v);
    if (lv) out[id] = lv;
  }
  return out;
}
