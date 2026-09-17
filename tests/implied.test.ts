import { describe, expect, it } from 'vitest';
import { impliedRequirement, equityNeededWithImplied, netImplied, setOrBetterOnFlop, setMine } from '../src/engine/implied';
import { evCall } from '../src/engine/ev';
import { choose } from '../src/engine/math';

describe('implied odds', () => {
  it('required future winnings make the call break even', () => {
    for (const [pot, bet, e] of [[100, 50, 0.2], [100, 100, 0.25], [60, 80, 0.18]]) {
      const x = impliedRequirement(pot!, bet!, e!).required;
      // Adding X to what is won on a hit makes EV zero.
      const ev = e! * (pot! + bet! + x) - (1 - e!) * bet!;
      expect(ev).toBeCloseTo(0, 10);
      expect(equityNeededWithImplied(pot!, bet!, x)).toBeCloseTo(e!, 10);
    }
  });

  it('is negative when immediate odds already suffice', () => {
    const r = impliedRequirement(100, 50, 0.4);
    expect(r.required).toBeLessThan(0);
    expect(evCall(100, 50, 0.4).total).toBeGreaterThan(0);
  });

  it('equity needed with implied odds falls as X rises', () => {
    expect(equityNeededWithImplied(100, 50, 0)).toBeCloseTo(0.25, 12);
    expect(equityNeededWithImplied(100, 50, 100)).toBeCloseTo(50 / 300, 12);
    expect(equityNeededWithImplied(100, 50, 100)).toBeLessThan(equityNeededWithImplied(100, 50, 0));
  });

  it('reverse implied odds subtract from the gain', () => {
    expect(netImplied(100, 30).net).toBe(70);
    expect(() => netImplied(-1, 0)).toThrow();
  });

  it('derives the set-mining probability', () => {
    expect(setOrBetterOnFlop()).toBeCloseTo(1 - choose(48, 3) / choose(50, 3), 12);
    expect(setOrBetterOnFlop() * 100).toBeCloseTo(11.76, 1);
  });

  it('set mining compares expected winnings with the requirement and the rule of thumb', () => {
    const r = setMine(1.5, 3, 100, 1);
    expect(r.required).toBeCloseTo((3 * (1 - r.hitProb)) / r.hitProb - 1.5 - 3, 10);
    expect(r.ruleOfThumbStack).toBe(45);
    expect(r.requiredMultiple).toBeGreaterThan(4);
    expect(r.requiredMultiple).toBeLessThan(8);
    expect(r.shouldCall).toBe(true);
    const shallow = setMine(1.5, 3, 12, 1);
    expect(shallow.shouldCall).toBe(false);
    const stingy = setMine(1.5, 3, 100, 0.1);
    expect(stingy.shouldCall).toBe(false);
  });
});
