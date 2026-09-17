import { describe, expect, it } from 'vitest';
import {
  ruleOf2,
  ruleOf4,
  solomon,
  shortcutTable,
  percentToOddsAgainst,
  oddsAgainstToPercent,
  formatOddsAgainst,
} from '../src/engine/shortcuts';
import { probTwoCards, probNextCard } from '../src/engine/outs';

// Fixture from the spec, two cards to come. Exact column is asserted against the engine.
const TABLE: [number, number, number, number][] = [
  [4, 16, 16, 16.5],
  [8, 32, 32, 31.5],
  [9, 36, 35, 35.0],
  [12, 48, 44, 45.0],
  [15, 60, 53, 54.1],
];

describe('shortcuts', () => {
  it('reproduces the reference table for two cards to come', () => {
    for (const [outs, r4, sol, exact] of TABLE) {
      expect(ruleOf4(outs).estimate).toBe(r4);
      expect(solomon(outs).estimate).toBe(sol);
      expect(ruleOf4(outs).exact).toBeCloseTo(exact, 1);
      expect(Math.abs(ruleOf4(outs).exact - exact)).toBeLessThan(0.1);
      expect(solomon(outs).exact).toBeCloseTo(exact, 1);
    }
  });

  it('reports error with the correct sign and magnitude', () => {
    const r = ruleOf4(15);
    expect(r.error).toBeCloseTo(60 - probTwoCards(15) * 100, 12);
    expect(r.error).toBeGreaterThan(0); // overstates
    const g = ruleOf4(4);
    expect(g.error).toBeLessThan(0); // understates
    expect(g.error).toBeCloseTo(16 - probTwoCards(4) * 100, 12);
    const two = ruleOf2(9);
    expect(two.error).toBeCloseTo(18 - probNextCard(9, 47) * 100, 12);
    expect(two.estimate - two.error).toBeCloseTo(two.exact, 12);
  });

  it("Solomon's correction beats the raw rule at high out counts", () => {
    for (const outs of [10, 12, 15, 18, 20]) {
      expect(Math.abs(solomon(outs).error)).toBeLessThan(Math.abs(ruleOf4(outs).error));
    }
    for (const outs of [1, 4, 8]) {
      expect(solomon(outs).estimate).toBe(ruleOf4(outs).estimate);
    }
  });

  it('builds a live table', () => {
    const rows = shortcutTable([4, 8, 9, 12, 15]);
    expect(rows.map((r) => r.ruleOf4.estimate)).toEqual([16, 32, 36, 48, 60]);
    expect(rows.map((r) => r.solomon.estimate)).toEqual([16, 32, 35, 44, 53]);
    rows.forEach((row, i) => expect(row.exactTwoCards).toBeCloseTo(TABLE[i]![3], 1));
  });

  it('converts between percentages and odds ratios', () => {
    expect(percentToOddsAgainst(20)).toBeCloseTo(4, 12);
    expect(percentToOddsAgainst(50)).toBeCloseTo(1, 12);
    expect(oddsAgainstToPercent(4)).toBeCloseTo(20, 12);
    expect(oddsAgainstToPercent(3, 2)).toBeCloseTo(40, 12);
    for (const p of [5, 12.5, 33.3, 50, 80]) {
      expect(oddsAgainstToPercent(percentToOddsAgainst(p))).toBeCloseTo(p, 10);
    }
    expect(formatOddsAgainst(4.2)).toBe('4.2 to 1');
    expect(formatOddsAgainst(4)).toBe('4 to 1');
    expect(() => percentToOddsAgainst(0)).toThrow();
  });
});
