import { describe, expect, it } from 'vitest';
import {
  emptyState,
  recordAttempt,
  dueDrills,
  weakestDrills,
  isFluent,
  unlockedModules,
  calibrationScore,
  exportJson,
  importJson,
  summarise,
  BOX_INTERVALS_DAYS,
  addDays,
  updateSettings,
  levelPassed,
  levelWindow,
  nextUnfinishedDrill,
  suggestedLevel,
  curriculumProgress,
  curriculumOpenLevel,
  LEVEL_PASS,
  MODULE_IDS,
} from '../src/srs/store';
import { applyTimerSetting } from '../src/drills/timer';
import { type DrillInstance, TEACHING_ORDER, drillNumber } from '../src/drills';
import { timedSequence } from '../src/srs/timed';
import { generateDecision, scoreChoice, bb100 } from '../src/game/bankroll';
import { createRng } from '../src/engine/rng';
import { DRILLS } from '../src/drills';

const T0 = new Date('2026-09-17T10:00:00Z');

describe('Leitner scheduling', () => {
  it('advances a box on a correct answer and drops to box 1 on a miss', () => {
    let s = emptyState();
    s = recordAttempt(s, { drillId: 'a', correct: true, ms: 1000 }, T0);
    expect(s.drills['a']!.box).toBe(2);
    expect(new Date(s.drills['a']!.due).getTime()).toBe(addDays(T0, BOX_INTERVALS_DAYS[1]!).getTime());
    s = recordAttempt(s, { drillId: 'a', correct: true, ms: 1000 }, T0);
    s = recordAttempt(s, { drillId: 'a', correct: true, ms: 1000 }, T0);
    s = recordAttempt(s, { drillId: 'a', correct: true, ms: 1000 }, T0);
    expect(s.drills['a']!.box).toBe(5);
    s = recordAttempt(s, { drillId: 'a', correct: true, ms: 1000 }, T0);
    expect(s.drills['a']!.box).toBe(5);
    s = recordAttempt(s, { drillId: 'a', correct: false, ms: 1000 }, T0);
    expect(s.drills['a']!.box).toBe(1);
    expect(new Date(s.drills['a']!.due).getTime()).toBe(addDays(T0, 1).getTime());
    expect(s.drills['a']!.attempts).toBe(6);
    expect(s.drills['a']!.correct).toBe(5);
  });

  it('lists due drills, unattempted first', () => {
    let s = emptyState();
    s = recordAttempt(s, { drillId: 'a', correct: true, ms: 1000 }, T0);
    s = recordAttempt(s, { drillId: 'b', correct: false, ms: 1000 }, T0);
    expect(dueDrills(s, ['a', 'b', 'c'], T0)).toEqual(['c']);
    expect(dueDrills(s, ['a', 'b', 'c'], addDays(T0, 1))).toEqual(['c', 'b']);
    expect(dueDrills(s, ['a', 'b', 'c'], addDays(T0, 3))).toEqual(['c', 'b', 'a']);
  });

  it('ranks the weakest drills first', () => {
    let s = emptyState();
    for (let i = 0; i < 10; i++) s = recordAttempt(s, { drillId: 'good', correct: i !== 0, ms: 2000 }, T0);
    for (let i = 0; i < 10; i++) s = recordAttempt(s, { drillId: 'bad', correct: i % 2 === 0, ms: 2000 }, T0);
    for (let i = 0; i < 10; i++) s = recordAttempt(s, { drillId: 'slow', correct: i % 2 === 0, ms: 9000 }, T0);
    const order = weakestDrills(s, ['good', 'bad', 'slow', 'never'], T0).map((d) => d.drillId);
    expect(order).toEqual(['slow', 'bad', 'good', 'never']);
  });

  it('tracks signed error and calibration', () => {
    let s = emptyState();
    s = recordAttempt(s, { drillId: 'e', correct: true, ms: 1000, error: 2 }, T0);
    s = recordAttempt(s, { drillId: 'e', correct: true, ms: 1000, error: -1 }, T0);
    s = recordAttempt(s, { drillId: 'e', correct: false, ms: 1000, error: 5 }, T0);
    expect(summarise(s, 'e', T0).bias).toBeCloseTo(2, 12);
    expect(calibrationScore(s)).toBe(2);
  });

  it('gates modules on fluency of the M1 drills', () => {
    let s = emptyState();
    expect(unlockedModules(s)).toEqual(['M1']);
    for (const id of ['hand-ranking', 'best-hand']) {
      for (let i = 0; i < 20; i++) s = recordAttempt(s, { drillId: id, correct: true, ms: 4000 }, T0);
    }
    expect(isFluent(s, 'hand-ranking')).toBe(true);
    expect(unlockedModules(s).length).toBe(9);
    // Slow answers are not fluent.
    let slow = emptyState();
    for (const id of ['hand-ranking', 'best-hand']) {
      for (let i = 0; i < 20; i++) slow = recordAttempt(slow, { drillId: id, correct: true, ms: 15000 }, T0);
    }
    expect(unlockedModules(slow)).toEqual(['M1']);
    expect(unlockedModules(updateSettings(slow, { gating: false })).length).toBe(9);
  });

  it('exports and imports losslessly and rejects bad input', () => {
    let s = emptyState();
    s = recordAttempt(s, { drillId: 'a', correct: true, ms: 1234, error: 1.5 }, T0);
    const json = exportJson(s);
    const back = importJson(json);
    expect(back).toEqual(s);
    expect(() => importJson('not json')).toThrow(/JSON/);
    expect(() => importJson('{"version": 99, "drills": {}}')).toThrow(/version/);
    expect(() => importJson('{"version": 1}')).toThrow();
  });
});

describe('timed mode', () => {
  it('draws twenty questions spread across the available drills', () => {
    const seq = timedSequence(createRng(1), DRILLS.slice(0, 5));
    expect(seq.length).toBe(20);
    const counts = new Map<string, number>();
    for (const d of seq) counts.set(d.id, (counts.get(d.id) ?? 0) + 1);
    for (const c of counts.values()) expect(c).toBe(4);
  });
});

describe('EV bankroll', () => {
  it('generates decisions with a well-defined best option', () => {
    const rng = createRng(7);
    const kinds = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const d = generateDecision(rng);
      kinds.add(d.kind);
      expect(d.options.length).toBeGreaterThanOrEqual(2);
      expect(d.prompt.choices!.length).toBe(d.options.length);
      const evs = d.options.map((o) => o.ev);
      expect(evs[d.bestIndex]).toBe(Math.max(...evs));
      expect(d.explanation.steps.length).toBeGreaterThan(0);
    }
    expect(kinds.size).toBe(4);
  });

  it('scores the best choice non-negatively and others negatively', () => {
    const rng = createRng(11);
    for (let i = 0; i < 40; i++) {
      const d = generateDecision(rng);
      const best = scoreChoice(d, d.bestIndex);
      expect(best.correct).toBe(true);
      expect(best.delta).toBeGreaterThanOrEqual(0);
      for (let j = 0; j < d.options.length; j++) {
        if (j === d.bestIndex) continue;
        const other = scoreChoice(d, j);
        expect(other.correct).toBe(false);
        expect(other.delta).toBeLessThanOrEqual(0);
        expect(other.delta).toBeCloseTo(d.options[j]!.ev - d.options[d.bestIndex]!.ev, 12);
      }
    }
    expect(bb100(-5, 50)).toBe(-10);
    expect(bb100(0, 0)).toBe(0);
  });
});

function answers(drillId: string, level: 1 | 2 | 3, outcomes: boolean[]) {
  let s = emptyState();
  for (const correct of outcomes) s = recordAttempt(s, { drillId, correct, ms: 1000, difficulty: level }, T0);
  return s;
}

describe('level progress', () => {
  it('needs ten answers at the level before it can pass', () => {
    expect(levelPassed(answers('a', 1, Array(9).fill(true)), 'a', 1)).toBe(false);
    expect(levelPassed(answers('a', 1, Array(10).fill(true)), 'a', 1)).toBe(true);
  });

  it('passes at 8 of 10 and fails at 7 of 10', () => {
    const eight = [...Array(8).fill(true), false, false];
    const seven = [...Array(7).fill(true), false, false, false];
    expect(levelPassed(answers('a', 2, eight), 'a', 2)).toBe(true);
    expect(levelPassed(answers('a', 2, seven), 'a', 2)).toBe(false);
  });

  it('counts only the last ten answers', () => {
    const s = answers('a', 1, [...Array(10).fill(false), ...Array(10).fill(true)]);
    expect(s.levels['a']![1]!.length).toBe(LEVEL_PASS.attempts);
    expect(levelPassed(s, 'a', 1)).toBe(true);
  });

  it('keeps levels separate and ignores attempts with no level', () => {
    let s = answers('a', 1, Array(10).fill(true));
    expect(levelPassed(s, 'a', 2)).toBe(false);
    s = recordAttempt(s, { drillId: 'b', correct: true, ms: 1000 }, T0);
    expect(s.levels['b']).toBeUndefined();
    expect(s.drills['b']!.attempts).toBe(1);
  });

  it('reports correct answers and count in the level window', () => {
    expect(levelWindow(emptyState(), 'a', 1)).toEqual({ correct: 0, count: 0 });
    expect(levelWindow(answers('a', 1, [true, true, false, true]), 'a', 1)).toEqual({ correct: 3, count: 4 });
  });

  it('windows only the last ten answers and keeps levels separate', () => {
    const s = answers('a', 1, [...Array(5).fill(false), ...Array(10).fill(true)]);
    expect(levelWindow(s, 'a', 1)).toEqual({ correct: 10, count: LEVEL_PASS.attempts });
    expect(levelWindow(s, 'a', 2)).toEqual({ correct: 0, count: 0 });
    const t = recordAttempt(s, { drillId: 'a', correct: true, ms: 1000 }, T0);
    expect(levelWindow(t, 'a', 1)).toEqual({ correct: 10, count: LEVEL_PASS.attempts });
  });

  it('agrees with levelPassed', () => {
    for (let wins = 0; wins <= 10; wins++) {
      const s = answers('a', 1, [...Array(wins).fill(true), ...Array(10 - wins).fill(false)]);
      const w = levelWindow(s, 'a', 1);
      expect(levelPassed(s, 'a', 1)).toBe(w.count === LEVEL_PASS.attempts && w.correct / w.count >= LEVEL_PASS.accuracy);
    }
  });

  it('points at the next drill that has not passed level 3', () => {
    const ids = ['a', 'b', 'c'];
    let s = answers('a', 3, Array(10).fill(true));
    expect(nextUnfinishedDrill(s, ids, 'a')).toBe('b');
    for (let i = 0; i < 10; i++) s = recordAttempt(s, { drillId: 'b', correct: true, ms: 1000, difficulty: 3 }, T0);
    expect(nextUnfinishedDrill(s, ids, 'a')).toBe('c');
    expect(nextUnfinishedDrill(s, ids, 'c')).toBeNull();
    for (let i = 0; i < 10; i++) s = recordAttempt(s, { drillId: 'c', correct: true, ms: 1000, difficulty: 3 }, T0);
    expect(nextUnfinishedDrill(s, ids, 'a')).toBeNull();
  });

  it('teaches every drill once, in module order, numbered without gaps', () => {
    expect(TEACHING_ORDER.length).toBe(DRILLS.length);
    expect(new Set(TEACHING_ORDER.map((d) => d.id)).size).toBe(DRILLS.length);
    expect(TEACHING_ORDER.slice(0, 2).map((d) => d.id)).toEqual(['hand-ranking', 'best-hand']);
    const moduleIndex = TEACHING_ORDER.map((d) => (MODULE_IDS as readonly string[]).indexOf(d.module));
    expect(moduleIndex.every((m) => m >= 0)).toBe(true);
    expect(moduleIndex).toEqual([...moduleIndex].sort((a, b) => a - b));
    expect(TEACHING_ORDER.map((d) => drillNumber(d.id))).toEqual(TEACHING_ORDER.map((_, i) => i + 1));
  });

  it('suggests an M3 drill after the last M2 drill, not one from the far end of the catalogue', () => {
    const ids = TEACHING_ORDER.map((d) => d.id);
    const next = TEACHING_ORDER.find((d) => d.id === nextUnfinishedDrill(emptyState(), ids, 'dirty-outs'))!;
    expect(next.module).toBe('M3');
  });

  it('suggests the next level and stops at 3', () => {
    expect(suggestedLevel(answers('a', 1, Array(10).fill(true)), 'a', 1)).toBe(2);
    expect(suggestedLevel(answers('a', 1, Array(10).fill(false)), 'a', 1)).toBeNull();
    expect(suggestedLevel(answers('a', 3, Array(10).fill(true)), 'a', 3)).toBeNull();
  });

  it('opens each curriculum level only when every drill has passed the one below', () => {
    const ids = ['a', 'b'];
    let s = answers('a', 1, Array(10).fill(true));
    expect(curriculumProgress(s, ids, 1)).toBe(1);
    expect(curriculumOpenLevel(s, ids)).toBe(1);
    for (let i = 0; i < 10; i++) s = recordAttempt(s, { drillId: 'b', correct: true, ms: 1000, difficulty: 1 }, T0);
    expect(curriculumOpenLevel(s, ids)).toBe(2);
    for (const id of ids) for (let i = 0; i < 10; i++) s = recordAttempt(s, { drillId: id, correct: true, ms: 1000, difficulty: 2 }, T0);
    expect(curriculumOpenLevel(s, ids)).toBe(3);
  });
});

describe('settings and saves', () => {
  it('defaults to no timer and per-drill progression', () => {
    const s = emptyState().settings;
    expect(s.drillTimer).toBe('off');
    expect(s.progression).toBe('per-drill');
  });

  it('loads a save made before levels and timer settings existed', () => {
    const old = {
      version: 1,
      drills: { a: { box: 3, due: T0.toISOString(), attempts: 5, correct: 4, times: [900], errors: [], recent: [1, 1, 0, 1, 1], lastSeen: T0.toISOString() } },
      timed: [],
      bankroll: [],
      calibration: [],
      settings: { fourColour: false, gating: false },
    };
    const s = importJson(JSON.stringify(old));
    expect(s.settings).toEqual({ fourColour: false, gating: false, drillTimer: 'off', progression: 'per-drill' });
    expect(s.levels).toEqual({});
    expect(s.drillLevel).toEqual({});
    expect(s.curriculumLevel).toBe(1);
    expect(s.lastDrillId).toBeNull();
    expect(s.drills['a']!.attempts).toBe(5);
  });

  it('round-trips levels, settings and the last drill through export and import', () => {
    let s = answers('a', 2, Array(10).fill(true));
    s = updateSettings(s, { drillTimer: 'relaxed', progression: 'curriculum' });
    s = { ...s, drillLevel: { a: 2 }, curriculumLevel: 2, lastDrillId: 'a' };
    expect(importJson(exportJson(s))).toEqual(s);
  });

  it('falls back to defaults for invalid setting values', () => {
    const bad = { ...JSON.parse(exportJson(emptyState())), settings: { drillTimer: 'fast', progression: 'x', fourColour: 1 }, drillLevel: { a: 7 } };
    const s = importJson(JSON.stringify(bad));
    expect(s.settings.drillTimer).toBe('off');
    expect(s.settings.progression).toBe('per-drill');
    expect(s.drillLevel).toEqual({});
  });
});

describe('drill timer setting', () => {
  const base = (limit?: number): DrillInstance => ({
    prompt: { text: 'q', ...(limit !== undefined ? { timeLimitSeconds: limit } : {}) },
    answer: 1,
    unit: 'count',
    tolerance: 0,
    explanation: { steps: [], summary: '' },
  });

  it('off removes the limit', () => {
    expect(applyTimerSetting(base(20), 'off').prompt.timeLimitSeconds).toBeUndefined();
  });
  it('relaxed multiplies the limit by two and a half', () => {
    expect(applyTimerSetting(base(20), 'relaxed').prompt.timeLimitSeconds).toBe(50);
    expect(applyTimerSetting(base(8), 'relaxed').prompt.timeLimitSeconds).toBe(20);
  });
  it('standard leaves the limit alone', () => {
    expect(applyTimerSetting(base(20), 'standard').prompt.timeLimitSeconds).toBe(20);
  });
  it('leaves a drill with no limit without one, in every mode', () => {
    for (const m of ['off', 'relaxed', 'standard'] as const) expect('timeLimitSeconds' in applyTimerSetting(base(), m).prompt).toBe(false);
  });
});
