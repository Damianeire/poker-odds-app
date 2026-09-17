import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng';
import { generateDecision, scoreChoice, bb100, STARTING_STACK } from '../src/game/bankroll';

describe('EV bankroll mode', () => {
  it('generates well-formed decisions across many seeds and kinds', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      const d = generateDecision(createRng(seed));
      kinds.add(d.kind);
      expect(d.options.length).toBeGreaterThanOrEqual(2);
      expect(d.prompt.choices).toEqual(d.options.map((o) => o.label));
      expect(d.bestIndex).toBeGreaterThanOrEqual(0);
      expect(d.bestIndex).toBeLessThan(d.options.length);
      // The recorded best option really is the best by EV.
      const bestEv = Math.max(...d.options.map((o) => o.ev));
      expect(d.options[d.bestIndex]!.ev).toBeCloseTo(bestEv, 9);
      expect(d.explanation.steps.length).toBeGreaterThan(0);
      expect(d.explanation.summary.length).toBeGreaterThan(0);
    }
    expect(kinds).toEqual(new Set(['call', 'bluff', 'semibluff', 'implied']));
  });

  it('is deterministic for a given seed', () => {
    const a = generateDecision(createRng(42));
    const b = generateDecision(createRng(42));
    expect(a).toEqual(b);
  });

  it('scores the best choice as its EV edge over the next best option', () => {
    const d = generateDecision(createRng(7));
    const scored = scoreChoice(d, d.bestIndex);
    expect(scored.correct).toBe(true);
    const others = d.options.map((o) => o.ev).filter((_, i) => i !== d.bestIndex);
    const second = Math.max(...others);
    expect(scored.delta).toBeCloseTo(d.options[d.bestIndex]!.ev - second, 9);
    expect(scored.delta).toBeGreaterThanOrEqual(-1e-9);
  });

  it('scores a worse choice as its EV shortfall against the best', () => {
    const d = generateDecision(createRng(11));
    const worst = d.options.reduce((w, o, i) => (o.ev < d.options[w]!.ev ? i : w), 0);
    if (worst === d.bestIndex) return; // only one option this seed; nothing to compare
    const scored = scoreChoice(d, worst);
    expect(scored.correct).toBe(false);
    expect(scored.delta).toBeCloseTo(d.options[worst]!.ev - d.options[d.bestIndex]!.ev, 9);
    expect(scored.delta).toBeLessThanOrEqual(1e-9);
  });

  it('bb100 scales a total delta to a rate per 100 decisions', () => {
    expect(bb100(10, 20)).toBeCloseTo(50, 12);
    expect(bb100(-5, 25)).toBeCloseTo(-20, 12);
    expect(bb100(0, 0)).toBe(0);
  });

  it('starts a session at 100 big blinds', () => {
    expect(STARTING_STACK).toBe(100);
  });
});
