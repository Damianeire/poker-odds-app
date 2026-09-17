import { describe, expect, it } from 'vitest';
import { HAND_RANKING, topRange, rangeCombos, equityVsRange, rankFractionOf } from '../src/engine/ranges';
import { parseHandClass, combosOfClass, allHandClasses, formatHandClass } from '../src/engine/combos';
import { parseCards } from '../src/engine/cards';
import { monteCarlo } from '../src/engine/montecarlo';
import { enumerate } from '../src/engine/enumerate';
import { createRng } from '../src/engine/rng';

describe('hand ranking', () => {
  it('is a permutation of all 169 classes', () => {
    expect(HAND_RANKING.length).toBe(169);
    expect(new Set(HAND_RANKING).size).toBe(169);
    const names = new Set(allHandClasses().map(formatHandClass));
    for (const h of HAND_RANKING) expect(names.has(h), h).toBe(true);
  });

  it('agrees with Monte Carlo equity against a random hand (rank correlation)', () => {
    const rng = createRng(31337);
    const eq = HAND_RANKING.map((name) => {
      const combo = combosOfClass(parseHandClass(name))[0]!;
      // Sample random villain hands by Monte Carlo over the full deck.
      let sum = 0;
      const trials = 40;
      for (let t = 0; t < trials; t++) {
        const deck = parseCards('').concat();
        void deck;
        const rest = Array.from({ length: 52 }, (_, i) => i + 8).filter((c) => c !== combo[0] && c !== combo[1]);
        const v = rng.sample(rest, 2);
        sum += monteCarlo([combo, v], [], [], 60, rng).hands[0]!.equity;
      }
      return sum / trials;
    });
    // Spearman correlation between ranking position and sampled equity.
    const n = eq.length;
    const order = eq.map((e, i) => [e, i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
    const rankByEq = new Array<number>(n);
    order.forEach((idx, pos) => (rankByEq[idx] = pos));
    let d2 = 0;
    for (let i = 0; i < n; i++) d2 += (i - rankByEq[i]!) ** 2;
    const rho = 1 - (6 * d2) / (n * (n * n - 1));
    expect(rho).toBeGreaterThan(0.9);
  });
});

describe('ranges', () => {
  it('top range fractions grow with the requested share', () => {
    const r5 = topRange(0.05);
    const r20 = topRange(0.2);
    const r100 = topRange(1);
    expect(r5.classes.length).toBeLessThan(r20.classes.length);
    expect(r100.classes.length).toBe(169);
    expect(r100.combos).toBe(1326);
    expect(r5.fraction).toBeGreaterThanOrEqual(0.05);
    expect(r20.classes.map(formatHandClass)).toContain('AA');
    expect(r20.classes.map(formatHandClass)).not.toContain('72o');
    expect(rankFractionOf(parseHandClass('AA'))).toBeCloseTo(6 / 1326, 12);
    expect(rankFractionOf(parseHandClass('32o'))).toBe(1);
  });

  it('removes blocked combos', () => {
    const r = topRange(0.05);
    const all = rangeCombos(r, []);
    const blocked = rangeCombos(r, parseCards('As Ah'));
    expect(blocked.length).toBeLessThan(all.length);
    for (const c of blocked) expect(c.includes(parseCards('As')[0]!)).toBe(false);
  });

  it('equity vs a single-combo range equals hand-vs-hand enumeration', () => {
    const hero = parseCards('Ah 7h');
    const board = parseCards('Kh 9h 2c');
    const v = parseCards('Kc Kd');
    const r = equityVsRange(hero, [v], board);
    expect(r.method).toBe('enumerate');
    expect(r.equity).toBeCloseTo(enumerate([hero, v], board).hands[0]!.equity, 12);
  });

  it('equity vs a range is the mean over combos and falls against tighter ranges', () => {
    const hero = parseCards('Qs Jd');
    const board = parseCards('Th 6c 2d');
    const wide = equityVsRange(hero, rangeCombos(topRange(0.5), [...hero, ...board]), board);
    const tight = equityVsRange(hero, rangeCombos(topRange(0.1), [...hero, ...board]), board);
    expect(wide.equity).toBeGreaterThan(tight.equity);
    const mean = wide.perCombo!.reduce((a, b) => a + b, 0) / wide.perCombo!.length;
    expect(wide.equity).toBeCloseTo(mean, 12);
  });

  it('preflop range equity is sampled with an interval', () => {
    const hero = parseCards('As Ad');
    const r = equityVsRange(hero, rangeCombos(topRange(0.3), hero), [], { trials: 20000, rng: createRng(5) });
    expect(r.method).toBe('montecarlo');
    expect(r.equity).toBeGreaterThan(0.75);
    expect(r.ci95).toBeLessThan(0.01);
  });
});
