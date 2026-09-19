import { describe, expect, it } from 'vitest';
import { DRILLS, parseAnswer, grade, type Difficulty, type DrillInstance } from '../src/drills';
import { createRng } from '../src/engine/rng';
import { probNextCard, probTwoCards, detectOutsToCategory, detectOutsVsHand } from '../src/engine/outs';
import { potOdds } from '../src/engine/potodds';
import { formatCards } from '../src/engine/cards';
import { evaluate, categoryOf, Category } from '../src/engine/evaluator';
import { parseCards } from '../src/engine/cards';
import { DRAW_TARGETS, dealDrawSpot, isGenuineDraw } from '../src/drills/deal';

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
  const cards = [
    ...(inst.prompt.heroCards ?? []),
    ...(inst.prompt.board ?? []),
    ...(inst.prompt.villainCards ?? []),
    ...(inst.prompt.handRows ?? []).flatMap((r) => r.cards),
  ];
  expect(new Set(cards).size).toBe(cards.length);
}

describe('drill catalogue', () => {
  it('has all 26 catalogue drills with unique ids', () => {
    expect(DRILLS.length).toBe(26);
    expect(new Set(DRILLS.map((d) => d.id)).size).toBe(26);
  });

  for (const drill of DRILLS) {
    // Preflop enumeration costs about half a second per instance.
    const SEEDS = drill.id === 'preflop-equity' ? 2 : 40;
    describe(drill.id, () => {
      it('generates well-formed instances at every difficulty', () => {
        for (const d of DIFFICULTIES) {
          for (let seed = 1; seed <= SEEDS; seed++) {
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
        if (drill.id === 'preflop-equity') return;
        for (const d of DIFFICULTIES) {
          for (let seed = 1; seed <= SEEDS; seed++) {
            const inst = drill.generate(createRng(seed * 31 + d), d);
            if (inst.shortcutAnswer === undefined) continue;
            expect(grade(inst, inst.shortcutAnswer).correct, `${drill.id} seed ${seed} d${d}`).toBe(true);
          }
        }
      });

      it('grades the exact answer as correct', () => {
        for (let seed = 1; seed <= Math.min(20, SEEDS); seed++) {
          const inst = drill.generate(createRng(seed), 2);
          expect(grade(inst, inst.answer).correct).toBe(true);
          expect(grade(inst, inst.answer + inst.tolerance + 1).correct).toBe(false);
        }
      });

      it('every probability answer offers a ratio form in the explanation', () => {
        for (let seed = 1; seed <= Math.min(10, SEEDS); seed++) {
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

describe('Phase 2 drills agree with the engine', () => {
  const byId = (id: string) => DRILLS.find((d) => d.id === id)!;

  it('price-out picks the smallest sizing that prices out the draw', () => {
    const drill = byId('price-out');
    for (let seed = 1; seed <= 20; seed++) {
      const inst = drill.generate(createRng(seed), 2);
      const pot = Number(inst.prompt.facts![0]!.value);
      const outs = Number(/(\d+) outs/.exec(inst.explanation.steps[0]!.result!)![1]);
      expect(outs).toBeGreaterThan(0);
      const idx = inst.answer;
      expect(inst.prompt.choices!.length).toBe(7);
      const fractions = [1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 1.5, 2];
      const unseen = inst.prompt.board!.length === 3 ? 47 : 46;
      const e = outs / unseen;
      expect(potOdds(pot, pot * fractions[idx]!).breakEven).toBeGreaterThan(e);
      if (idx > 0) expect(potOdds(pot, pot * fractions[idx - 1]!).breakEven).toBeLessThanOrEqual(e);
    }
  });

  it('mdf-alpha and bluff-break-even use the closed forms', () => {
    for (const id of ['mdf-alpha', 'bluff-break-even']) {
      const drill = byId(id);
      for (let seed = 1; seed <= 20; seed++) {
        const inst = drill.generate(createRng(seed), 2);
        const pot = Number(inst.prompt.facts![0]!.value);
        const bet = Number(inst.prompt.facts![1]!.value);
        const po = potOdds(pot, bet);
        const ok = Math.abs(inst.answer - po.mdf * 100) < 1e-9 || Math.abs(inst.answer - po.alpha * 100) < 1e-9;
        expect(ok).toBe(true);
      }
    }
  });

  it('multiway bluff answer is alpha^(1/n)', () => {
    const drill = byId('multiway-bluff');
    for (let seed = 1; seed <= 20; seed++) {
      const inst = drill.generate(createRng(seed), 2);
      const pot = Number(inst.prompt.facts![0]!.value);
      const bet = Number(inst.prompt.facts![1]!.value);
      const n = Number(inst.prompt.facts![2]!.value);
      expect(inst.answer).toBeCloseTo((bet / (pot + bet)) ** (1 / n) * 100, 10);
      expect(inst.answer).toBeGreaterThan((bet / (pot + bet)) * 100);
    }
  });

  it('dead money sums every contribution', () => {
    const drill = byId('dead-money');
    for (let seed = 1; seed <= 20; seed++) {
      const inst = drill.generate(createRng(seed), 2);
      const facts = inst.prompt.facts!;
      const bet = Number(facts[facts.length - 1]!.value);
      const pot = facts.slice(0, -1).reduce((a, f) => a + Number(f.value), 0);
      const po = potOdds(pot, bet);
      if (inst.unit === 'ratio') expect(inst.answer).toBeCloseTo(po.oddsOffered, 10);
      else expect(inst.answer).toBeCloseTo(po.breakEven * 100, 10);
    }
  });

  it('combo-count matches enumeration of the class', () => {
    const drill = byId('combo-count');
    let blocked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const inst = drill.generate(createRng(seed), 3);
      expect(inst.answer).toBeGreaterThanOrEqual(0);
      expect(inst.answer).toBeLessThanOrEqual(12);
      if (inst.answer < 12) blocked++;
    }
    expect(blocked).toBeGreaterThan(5);
  });

  it('dirty outs answer equals the winning cards against the shown hand', () => {
    const drill = byId('dirty-outs');
    for (let seed = 1; seed <= 20; seed++) {
      const inst = drill.generate(createRng(seed), 2);
      const r = detectOutsVsHand(inst.prompt.heroCards!, inst.prompt.villainCards!, inst.prompt.board!);
      expect(inst.answer).toBe(r.count);
      expect(Number(inst.prompt.facts![0]!.value)).toBeGreaterThan(0);
    }
  });

  it('which-multiplier grades on the all-in fact', () => {
    const drill = byId('which-multiplier');
    let allIn = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const inst = drill.generate(createRng(seed), 1);
      const isAllIn = inst.prompt.facts![2]!.value === 'all-in';
      expect(inst.answer).toBe(isAllIn ? 1 : 0);
      if (isAllIn) allIn++;
    }
    expect(allIn).toBeGreaterThan(5);
    expect(allIn).toBeLessThan(25);
  });

  it('hand-ranking and best-hand come from the evaluator', () => {
    const ranking = byId('hand-ranking');
    for (let seed = 1; seed <= 30; seed++) {
      const inst = ranking.generate(createRng(seed), 3);
      const score = evaluate([...inst.prompt.heroCards!, ...inst.prompt.board!]);
      expect(inst.answer).toBe(categoryOf(score));
    }
    const best = byId('best-hand');
    let splits = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const inst = best.generate(createRng(seed), 2);
      const board = inst.prompt.board!;
      const hands: number[][] = inst.prompt.handRows!.map((r) => r.cards);
      const scores = hands.map((h) => evaluate([...h, ...board]));
      const top = Math.max(...scores);
      const winners = scores.filter((s) => s === top).length;
      if (winners > 1) {
        splits++;
        expect(inst.answer).toBe(hands.length);
      } else expect(scores[inst.answer]).toBe(top);
    }
    expect(splits).toBeGreaterThan(0);
  });

  it('villain-dependent flips on the named parameter at difficulty 1', () => {
    const drill = byId('villain-dependent');
    for (let seed = 1; seed <= 20; seed++) {
      const inst = drill.generate(createRng(seed), 1);
      expect([0, 1]).toContain(inst.answer);
      expect(inst.explanation.summary).toMatch(/flipped/);
    }
  });

  it('set mining derives its numbers', () => {
    const drill = byId('set-mining');
    let calls = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const inst = drill.generate(createRng(seed), 2);
      if (inst.answer === 0) calls++;
      expect(inst.explanation.steps[0]!.result).toContain('11.76%');
    }
    expect(calls).toBeGreaterThan(5);
    expect(calls).toBeLessThan(35);
  });

  it('preflop equity is graded against enumeration', () => {
    const drill = byId('preflop-equity');
    const inst = drill.generate(createRng(3), 1);
    expect(inst.answer).toBeGreaterThan(0);
    expect(inst.answer).toBeLessThan(100);
    expect(inst.explanation.steps[0]!.text).toContain('1,712,304');
  });
});

describe('draw spots name a draw the hand actually has', () => {
  it('pocket deuces on 8-8-7 have full-house cards but no flush draw, and villain cards are never outs', () => {
    const hero = parseCards('2c 2d');
    const board = parseCards('8c 7h 8d');
    const villain = parseCards('8h Jd');
    const flush = detectOutsToCategory(hero, board, Category.Flush, villain);
    expect(flush.outs).not.toContain(villain[0]);
    expect(isGenuineDraw(hero, board, Category.Flush, flush)).toBe(false);
    const fullHouse = detectOutsToCategory(hero, board, Category.FullHouse, villain);
    expect(isGenuineDraw(hero, board, Category.FullHouse, fullHouse)).toBe(true);
  });

  it('dealDrawSpot only returns genuine draws, clean or not', () => {
    for (const clean of [true, false]) {
      for (let seed = 1; seed <= 300; seed++) {
        const spot = dealDrawSpot(createRng(seed), { clean, boardLength: seed % 2 ? 3 : 4 });
        expect(isGenuineDraw(spot.hero, spot.board, spot.target.category, spot.outs)).toBe(true);
      }
    }
  });

  it('dirty outs names a real flush or straight draw and counts raw outs with villain cards removed', () => {
    const drill = DRILLS.find((x) => x.id === 'dirty-outs')!;
    for (const d of DIFFICULTIES) {
      for (let seed = 1; seed <= 60; seed++) {
        const inst = drill.generate(createRng(seed * 31 + d), d);
        const { heroCards, board, villainCards } = inst.prompt;
        const raw = Number(inst.prompt.facts![0]!.value);
        const named = DRAW_TARGETS.filter((t) => inst.prompt.text.includes(`drawing to ${t.label},`));
        expect(named.length).toBe(1);
        const outs = detectOutsToCategory(heroCards!, board!, named[0]!.category, villainCards!);
        expect(outs.count).toBe(raw);
        expect(isGenuineDraw(heroCards!, board!, named[0]!.category, outs)).toBe(true);
        expect(outs.outs.some((c) => villainCards!.includes(c))).toBe(false);
      }
    }
  });
});

describe('generators that once threw', () => {
  it('dirty outs builds a level 1 spot for a seed that exhausted the old 5,000-attempt cap', () => {
    const drill = DRILLS.find((d) => d.id === 'dirty-outs')!;
    const inst = drill.generate(createRng(5055), 1);
    wellFormed(inst);
  });
});
