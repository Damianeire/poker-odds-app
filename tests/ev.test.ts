import { describe, expect, it } from 'vitest';
import { evCall, evCallWithActionBehind, evBluff, evSemiBluff, riverBluffShare } from '../src/engine/ev';
import { potOdds } from '../src/engine/potodds';

describe('expected value', () => {
  it('EV of a call is zero exactly at break-even equity', () => {
    for (const [pot, bet] of [[100, 50], [100, 100], [80, 120], [300, 100]]) {
      const be = potOdds(pot!, bet!).breakEven;
      expect(evCall(pot!, bet!, be).total).toBeCloseTo(0, 10);
      expect(evCall(pot!, bet!, be + 0.05).total).toBeGreaterThan(0);
      expect(evCall(pot!, bet!, be - 0.05).total).toBeLessThan(0);
    }
  });

  it('returns the component terms', () => {
    const r = evCall(100, 50, 0.3);
    expect(r.winTerm).toBeCloseTo(0.3 * 150, 12);
    expect(r.loseTerm).toBeCloseTo(0.7 * 50, 12);
    expect(r.total).toBeCloseTo(45 - 35, 12);
  });

  it('action behind discounts the call', () => {
    const base = evCall(100, 50, 0.4);
    const r = evCallWithActionBehind(100, 50, 0.4, 0.25);
    expect(r.total).toBeCloseTo(0.75 * base.total - 0.25 * 50, 12);
    expect(evCallWithActionBehind(100, 50, 0.4, 0).total).toBeCloseTo(base.total, 12);
  });

  it('bluff breaks even at alpha and scales as f^n multiway', () => {
    const alpha = potOdds(100, 100).alpha;
    expect(evBluff(100, 100, alpha).total).toBeCloseTo(0, 10);
    expect(evBluff(100, 100, alpha).breakEvenFoldAll).toBeCloseTo(0.5, 12);
    const three = evBluff(100, 100, 0.8, 3);
    expect(three.foldAll).toBeCloseTo(0.512, 12);
    expect(three.breakEvenFoldEach).toBeCloseTo(0.5 ** (1 / 3), 12);
    expect(three.breakEvenFoldEach).toBeGreaterThan(0.79);
    expect(three.breakEvenFoldEach).toBeLessThan(0.8);
    // The overall threshold does not move with opponents.
    expect(three.breakEvenFoldAll).toBeCloseTo(0.5, 12);
  });

  it('semi-bluff exceeds both the pure bluff and the call-down', () => {
    const r = evSemiBluff(100, 75, 0.4, 0.35);
    expect(r.foldTerm).toBeCloseTo(0.4 * 100, 12);
    expect(r.calledTerm).toBeCloseTo(0.6 * evCall(100, 75, 0.35).total, 12);
    expect(r.total).toBeCloseTo(r.foldTerm + r.calledTerm, 12);
    expect(r.total).toBeGreaterThan(r.pureBluffTotal);
    expect(r.total).toBeGreaterThan(evCall(100, 75, 0.35).total);
    expect(evSemiBluff(100, 75, 0, 0.35).total).toBeCloseTo(evCall(100, 75, 0.35).total, 12);
    expect(evSemiBluff(100, 75, 1, 0.35).total).toBeCloseTo(100, 12);
  });

  it('river bluff share is one third for a pot-sized bet', () => {
    expect(riverBluffShare(100, 100)).toBeCloseTo(1 / 3, 12);
    expect(riverBluffShare(100, 50)).toBeCloseTo(0.25, 12);
  });

  it('rejects bad inputs', () => {
    expect(() => evCall(100, 0, 0.5)).toThrow();
    expect(() => evCall(100, 50, 1.2)).toThrow();
    expect(() => evBluff(100, 50, 0.5, 0)).toThrow();
  });
});
