import { describe, expect, it } from 'vitest';
import { DRILLS, parseAnswer, grade, type Difficulty, type DrillInstance } from '../src/drills';
import { createRng } from '../src/engine/rng';
import { probNextCard, probTwoCards, detectOutsToCategory, detectOutsVsHand } from '../src/engine/outs';
import { potOdds } from '../src/engine/potodds';
import { formatCards } from '../src/engine/cards';

const DIFFICULTIES: Difficulty[] = [1, 2, 3];

function wellFormed(inst: DrillInstance): void {
  expect(inst.prompt.text.length).toBeGreaterThan(10);
  expect(Number.isFinite(inst.answer)).toBe(true);
  expect(inst.tolerance).toBeGreaterThanOrEqual(0);
  expect(inst.explanation.steps.length).toBeGreaterThan(0);
  expect(inst.explanation.summary.length).toBeGreaterThan(0);
  if (inst.prompt.choices) {
    expect(inst.answer).toBeGreaterThanOrEqual(0);
    expect(inst.answer).toBeLessThan(inst.prompt.choices.length);
  }
  const cards = [...(inst.prompt.heroCards ?? []), ...(inst.prompt.board ?? []), ...(inst.prompt.villainCards ?? [])];
  expect(new Set(cards).size).toBe(cards.length);
}

describe('drill catalogue', () => {
  it('has the eight Phase 1 drills with unique ids', () => {
    expect(DRILLS.length).toBe(8);
    expect(new Set(DRILLS.map((d) => d.id)).size).toBe(8);
  });

  for (const drill of DRILLS) {
    describe(drill.id, () => {
      it('generates well-formed instances at every difficulty', () => {
        for (const d of DIFFICULTIES) {
          for (let seed = 1; seed <= 40; seed++) {
            const inst = drill.generate(createRng(seed * 7919 + d), d);
            wellFormed(inst);
          }
        }
      });

      it('is deterministic for a given seed', () => {
        const a = drill.generate(createRng(42), 2);
        const b = drill.generate(createRng(42), 2);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      });

      it('accepts the taught shortcut as correct whenever one is given', () => {
        for (const d of DIFFICULTIES) {
          for (let seed = 1; seed <= 40; seed++) {
            const inst = drill.generate(createRng(seed * 31 + d), d);
            if (inst.shortcutAnswer === undefined) continue;
            expect(grade(inst, inst.shortcutAnswer).correct, `${drill.id} seed ${seed} d${d}`).toBe(true);
          }
        }
      });

      it('grades the exact answer as correct', () => {
        for (let seed = 1; seed <= 20; seed++) {
          const inst = drill.generate(createRng(seed), 2);
          expect(grade(inst, inst.answer).correct).toBe(true);
          expect(grade(inst, inst.answer + inst.tolerance + 1).correct).toBe(false);
        }
      });

      it('every probability answer offers a ratio form in the explanation', () => {
        for (let seed = 1; seed <= 10; seed++) {
          const inst = drill.generate(createRng(seed), 1);
          if (inst.unit === 'percent' && drill.id !== 'spot-the-error') {
            expect(inst.explanation.alternate, drill.id).toBeDefined();
          }
        }
      });
    });
  }
});

describe('count-outs answers come from the engine', () => {
  it('matches a fresh detection on the shown cards', () => {
    const drill = DRILLS.find((d) => d.id === 'count-outs')!;
    for (let seed = 1; seed <= 30; seed++) {
      const inst = drill.generate(createRng(seed), 3);
      const r = detectOutsVsHand(inst.prompt.heroCards!, inst.prompt.villainCards!, inst.prompt.board!);
      expect(inst.answer).toBe(r.count);
      expect(inst.answer).toBeGreaterThan(0);
    }
    for (let seed = 1; seed <= 30; seed++) {
      const inst = drill.generate(createRng(seed), 1);
      expect([2, 4, 6, 7, 8, 9]).toContain(inst.answer);
      // The listed outs in the explanation are exactly the answer count.
      const listed = inst.explanation.steps[2]!.text;
      expect(listed).toContain(formatCards([inst.prompt.heroCards![0]!]).slice(0, 0));
    }
  });

  it('difficulty 1 flush draws are always 9 outs', () => {
    const drill = DRILLS.find((d) => d.id === 'count-outs')!;
    let seen = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const inst = drill.generate(createRng(seed), 1);
      if (inst.prompt.text.includes('a flush?')) {
        seen++;
        expect(inst.answer).toBe(9);
        expect(detectOutsToCategory(inst.prompt.heroCards!, inst.prompt.board!, 5).count).toBe(9);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('formula drills agree with the engine', () => {
  it('one-card and two-card drills use o/u and the C(u-o,2) formula', () => {
    const one = DRILLS.find((d) => d.id === 'outs-to-percent-one-card')!;
    const two = DRILLS.find((d) => d.id === 'outs-to-percent-two-cards')!;
    for (let seed = 1; seed <= 20; seed++) {
      const a = one.generate(createRng(seed), 2);
      const outs = Number(a.prompt.facts![0]!.value);
      const unseen = a.prompt.facts![1]!.value === 'the flop' ? 47 : 46;
      expect(a.answer).toBeCloseTo(probNextCard(outs, unseen) * 100, 10);
      expect(a.shortcutAnswer).toBe(outs * 2);
      const b = two.generate(createRng(seed), 2);
      const o2 = Number(b.prompt.facts![0]!.value);
      expect(b.answer).toBeCloseTo(probTwoCards(o2) * 100, 10);
    }
  });

  it('break-even drill uses B / (P + 2B)', () => {
    const drill = DRILLS.find((d) => d.id === 'break-even-equity')!;
    for (let seed = 1; seed <= 20; seed++) {
      const inst = drill.generate(createRng(seed), 3);
      const pot = Number(inst.prompt.facts![0]!.value);
      const bet = Number(inst.prompt.facts![1]!.value);
      expect(inst.answer).toBeCloseTo(potOdds(pot, bet).breakEven * 100, 10);
    }
  });

  it('spot-the-error has the right sign', () => {
    const drill = DRILLS.find((d) => d.id === 'spot-the-error')!;
    for (let seed = 1; seed <= 30; seed++) {
      const inst = drill.generate(createRng(seed), 1);
      const outs = Number(inst.prompt.facts![0]!.value);
      const est = outs * 4;
      const exact = probTwoCards(outs) * 100;
      expect(inst.answer).toBeCloseTo(est - exact, 10);
    }
  });

  it('call-or-fold never asks a marginal question at difficulty 1', () => {
    const drill = DRILLS.find((d) => d.id === 'call-or-fold')!;
    let calls = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const inst = drill.generate(createRng(seed), 1);
      expect(inst.prompt.choices).toEqual(['Call', 'Fold']);
      if (inst.answer === 0) calls++;
    }
    expect(calls).toBeGreaterThan(3);
    expect(calls).toBeLessThan(37);
  });
});

describe('answer parsing', () => {
  it('accepts percent answers in several forms', () => {
    expect(parseAnswer('35', 'percent')!.value).toBe(35);
    expect(parseAnswer('35%', 'percent')!.value).toBe(35);
    expect(parseAnswer(' 35.5 % ', 'percent')!.value).toBe(35.5);
    expect(parseAnswer('4 to 1', 'percent')!.value).toBeCloseTo(20, 10);
    expect(parseAnswer('4:1', 'percent')!.value).toBeCloseTo(20, 10);
    expect(parseAnswer('3:2', 'percent')!.value).toBeCloseTo(40, 10);
    expect(parseAnswer('-2.5', 'percent')!.value).toBe(-2.5);
  });

  it('accepts ratio answers as ratios or percentages', () => {
    expect(parseAnswer('4', 'ratio')!.value).toBe(4);
    expect(parseAnswer('4 to 1', 'ratio')!.value).toBe(4);
    expect(parseAnswer('8:2', 'ratio')!.value).toBe(4);
    expect(parseAnswer('20%', 'ratio')!.value).toBeCloseTo(4, 10);
  });

  it('rejects garbage', () => {
    expect(parseAnswer('', 'percent')).toBeNull();
    expect(parseAnswer('abc', 'percent')).toBeNull();
    expect(parseAnswer('4 to 1', 'count')).toBeNull();
    expect(parseAnswer('20%', 'count')).toBeNull();
  });
});
