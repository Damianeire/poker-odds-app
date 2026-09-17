import { describe, expect, it } from 'vitest';
import { parseCards, fullDeck, rankOf, suitOf } from '../src/engine/cards';
import { forEachCombination, choose } from '../src/engine/math';
import { Category, categoryOf, evaluate } from '../src/engine/evaluator';
import {
  parseHandClass,
  formatHandClass,
  combosOfClass,
  unpairedCombos,
  pairCombos,
  blockerEffect,
  specificPairProb,
  anyPairProb,
  specificUnpairedProb,
  flopFlushDrawProb,
  flopFlushProb,
  flopPairOrBetterProb,
  flopSetOrBetterProb,
  allHandClasses,
  classOf,
} from '../src/engine/combos';

describe('hand classes and combos', () => {
  it('parses and formats classes', () => {
    expect(formatHandClass(parseHandClass('aks'))).toBe('AKs');
    expect(formatHandClass(parseHandClass('KAo'))).toBe('AKo');
    expect(formatHandClass(parseHandClass('77'))).toBe('77');
    expect(() => parseHandClass('AK')).toThrow();
    expect(() => parseHandClass('AAs')).toThrow();
    expect(classOf(parseCards('Ah Kh'))).toEqual({ hi: 14, lo: 13, kind: 'suited' });
  });

  it('has 16 combos for an unpaired hand and 6 for a pair', () => {
    expect(combosOfClass(parseHandClass('AKs')).length).toBe(4);
    expect(combosOfClass(parseHandClass('AKo')).length).toBe(12);
    expect(combosOfClass(parseHandClass('QQ')).length).toBe(6);
    const all = allHandClasses();
    expect(all.length).toBe(169);
    expect(all.reduce((a, c) => a + combosOfClass(c).length, 0)).toBe(1326);
  });

  it('closed-form blocker formulas agree with enumeration', () => {
    // As on the board: AK combos = 3 x 4 = 12.
    const visible = parseCards('As');
    const ak = combosOfClass(parseHandClass('AKs'), visible).length + combosOfClass(parseHandClass('AKo'), visible).length;
    expect(ak).toBe(unpairedCombos(1, 0));
    expect(ak).toBe(12);
    // Two aces visible: AA combos = C(2, 2) = 1.
    expect(combosOfClass(parseHandClass('AA'), parseCards('As Ah')).length).toBe(pairCombos(2));
    expect(pairCombos(1)).toBe(3);
    expect(unpairedCombos(1, 1)).toBe(9);
  });

  it('measures the blocker effect of hero cards', () => {
    const e = blockerEffect(parseHandClass('AKo'), parseCards('Ah Qd'), parseCards('Kc 7s 2d'));
    expect(e.withoutHero).toBe(3 * 4 - 3); // AKo: 4 aces x 3 kings minus 3 suited = 9
    expect(e.withHero).toBe(3 * 3 - 2); // 3 aces x 3 kings offsuit only = 9 - 2 suited (hearts... ) checked below
    expect(e.removed).toBe(e.withoutHero - e.withHero);
  });

  it('derives preflop dealing probabilities from C(52, 2)', () => {
    expect(specificPairProb().probability * 100).toBeCloseTo(0.45, 2);
    expect(specificPairProb().oddsAgainst).toBeCloseTo(220, 0);
    expect(anyPairProb().probability * 100).toBeCloseTo(5.88, 2);
    expect(anyPairProb().oddsAgainst).toBeCloseTo(16, 0);
    expect(specificUnpairedProb().probability * 100).toBeCloseTo(1.21, 2);
  });

  it('flop probabilities match brute force over all C(50, 3) flops', () => {
    const suited = parseCards('Ah 7h');
    const unpaired = parseCards('Ah 7d');
    const pair = parseCards('7h 7d');
    const count = (hole: number[], pred: (flop: number[]) => boolean): number => {
      const rest = fullDeck().filter((c) => !hole.includes(c));
      let n = 0;
      forEachCombination(rest, 3, (flop) => {
        if (pred(flop)) n++;
      });
      return n;
    };
    const total = choose(50, 3);
    const flushDraw = count(suited, (f) => f.filter((c) => suitOf(c) === suitOf(suited[0]!)).length === 2);
    expect(flushDraw / total).toBeCloseTo(flopFlushDrawProb().probability, 12);
    expect(flopFlushDrawProb().probability * 100).toBeCloseTo(10.94, 2);
    const flush = count(suited, (f) => f.every((c) => suitOf(c) === suitOf(suited[0]!)));
    expect(flush / total).toBeCloseTo(flopFlushProb().probability, 12);
    expect(flopFlushProb().probability * 100).toBeCloseTo(0.84, 2);
    const pairOrBetter = count(unpaired, (f) => f.some((c) => rankOf(c) === 14 || rankOf(c) === 7));
    expect(pairOrBetter / total).toBeCloseTo(flopPairOrBetterProb().probability, 12);
    expect(flopPairOrBetterProb().probability * 100).toBeCloseTo(32.43, 2);
    const setOrBetter = count(pair, (f) => f.some((c) => rankOf(c) === 7));
    expect(setOrBetter / total).toBeCloseTo(flopSetOrBetterProb().probability, 12);
    expect(flopSetOrBetterProb().probability * 100).toBeCloseTo(11.76, 2);
    // Cross-check with the evaluator: every counted flop really makes trips or better.
    // The evaluator also counts the 48 flops where the board itself is trips (12 ranks x C(4, 3)).
    const setByEval = count(pair, (f) => categoryOf(evaluate([...pair, ...f])) >= Category.ThreeOfAKind);
    expect(setByEval - setOrBetter).toBe(12 * choose(4, 3));
  });
});
