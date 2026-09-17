import { describe, expect, it } from 'vitest';
import { potOdds, potOddsFromContributions, sizingTable, betToPriceOut } from '../src/engine/potodds';

// Fixture from the spec: closed-form values for the standard sizings.
const TABLE: [number, number, number, number][] = [
  [1 / 3, 20.0, 75.0, 25.0],
  [1 / 2, 25.0, 66.7, 33.3],
  [2 / 3, 28.6, 60.0, 40.0],
  [3 / 4, 30.0, 57.1, 42.9],
  [1, 33.3, 50.0, 50.0],
  [1.5, 37.5, 40.0, 60.0],
  [2, 40.0, 33.3, 66.7],
];

describe('pot odds', () => {
  it('matches the closed-form reference table', () => {
    for (const [fraction, eq, mdf, alpha] of TABLE) {
      const p = potOdds(100, 100 * fraction);
      expect(p.breakEven * 100).toBeCloseTo(eq, 1);
      expect(p.mdf * 100).toBeCloseTo(mdf, 1);
      expect(p.alpha * 100).toBeCloseTo(alpha, 1);
      expect(p.mdf + p.alpha).toBeCloseTo(1, 12);
    }
  });

  it('generates the sizing table live', () => {
    const rows = sizingTable();
    expect(rows.length).toBe(7);
    rows.forEach((row, i) => {
      expect(row.odds.breakEven * 100).toBeCloseTo(TABLE[i]![1], 1);
    });
  });

  it('computes odds offered and the final pot', () => {
    const p = potOdds(100, 50);
    expect(p.oddsOffered).toBeCloseTo(3, 12);
    expect(p.finalPot).toBe(200);
    expect(p.breakEven).toBeCloseTo(0.25, 12);
    expect(p.cost).toBe(50);
  });

  it('accepts a pot built from contributions', () => {
    const p = potOddsFromContributions([30, 30, 40], 50);
    expect(p.pot).toBe(100);
    expect(p.breakEven).toBeCloseTo(0.25, 12);
  });

  it('prices out a draw', () => {
    // A 9-out flush draw on the turn has 9/46 = 19.6% equity; a bet just over 0.32 pot prices it out.
    const e = 9 / 46;
    const b = betToPriceOut(100, e)!;
    expect(potOdds(100, b).breakEven).toBeCloseTo(e, 12);
    expect(betToPriceOut(100, 0.5)).toBeNull();
  });

  it('rejects bad inputs', () => {
    expect(() => potOdds(100, 0)).toThrow();
    expect(() => potOdds(-1, 10)).toThrow();
  });
});
