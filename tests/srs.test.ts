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
} from '../src/srs/store';
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
