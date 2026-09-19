import { describe, expect, it } from 'vitest';
import { DRILLS, FRESH_TRIES, conceptKey, generateFresh, questionKey, type Drill, type DrillInstance } from '../src/drills';
import { createRng } from '../src/engine/rng';

function stub(text: string, extra: Partial<DrillInstance['prompt']> = {}, answer = 1): DrillInstance {
  return {
    prompt: { text, ...extra },
    answer,
    unit: 'count',
    tolerance: 0,
    explanation: { steps: [{ text: 'x' }], summary: 'x' },
  };
}

describe('questionKey', () => {
  it('ignores the time limit and the order of choices', () => {
    const a = stub('Which?', { choices: ['a', 'b', 'c'], timeLimitSeconds: 10 });
    const b = stub('Which?', { choices: ['c', 'a', 'b'], timeLimitSeconds: 25 });
    expect(questionKey(a)).toBe(questionKey(b));
  });

  it('separates different cards, facts and answers', () => {
    const base = stub('Outs?', { facts: [{ label: 'Pot', value: '100' }] });
    expect(questionKey(base)).not.toBe(questionKey(stub('Outs?', { facts: [{ label: 'Pot', value: '120' }] })));
    expect(questionKey(base)).not.toBe(questionKey(stub('Outs?', { facts: [{ label: 'Pot', value: '100' }] }, 2)));
  });
});

describe('repeatKey', () => {
  it('treats the same concept as the same question whatever the cards', () => {
    const a = { ...stub('Outs to a flush?', { heroCards: [1, 2] }, 9), repeatKey: 'flush|9' };
    const b = { ...stub('Outs to a flush?', { heroCards: [30, 31] }, 9), repeatKey: 'flush|9' };
    const c = { ...stub('Outs to a flush?', { heroCards: [1, 2] }, 8), repeatKey: 'flush|8' };
    expect(questionKey(a)).toBe(questionKey(b));
    expect(questionKey(a)).not.toBe(questionKey(c));
  });
});

describe('repeatIgnoresCards', () => {
  it('conceptKey ignores cards but not numbers, text or answer', () => {
    const a = stub('You have 9 outs to a flush. Call or fold?', { heroCards: [1, 2], board: [3, 4, 5], facts: [{ label: 'Pot', value: '100' }] });
    const b = stub('You have 9 outs to a flush. Call or fold?', { heroCards: [30, 31], board: [7, 8, 9], facts: [{ label: 'Pot', value: '100' }] });
    expect(conceptKey(a)).toBe(conceptKey(b));
    expect(questionKey(a)).not.toBe(questionKey(b));
    expect(conceptKey(a)).not.toBe(conceptKey(stub(a.prompt.text, { facts: [{ label: 'Pot', value: '120' }] })));
    expect(conceptKey(a)).not.toBe(conceptKey(stub('You have 8 outs to a straight. Call or fold?', { facts: a.prompt.facts! })));
  });

  it('generateFresh redraws when only the cards differ', () => {
    let calls = 0;
    const drill = {
      repeatIgnoresCards: true,
      generate: () => stub('Same numbers', { heroCards: [calls], facts: [{ label: 'Pot', value: calls++ < 2 ? '100' : '200' }] }),
    } as unknown as Drill;
    const first = generateFresh(drill, 1, () => createRng(1), null);
    calls = 0;
    const next = generateFresh(drill, 1, () => createRng(1), questionKey(first));
    expect(next.prompt.facts![0]!.value).toBe('200');
  });

  it('is set on every draw drill', () => {
    const ids = DRILLS.filter((d) => d.repeatIgnoresCards).map((d) => d.id).sort();
    expect(ids).toEqual(['call-or-fold', 'dirty-outs', 'implied-odds', 'price-out', 'semi-bluff-ev', 'villain-dependent', 'which-multiplier']);
  });
});

describe('generateFresh', () => {
  it('redraws until the question differs from the one to avoid', () => {
    let calls = 0;
    const drill = { generate: () => stub(calls++ < 3 ? 'same' : 'different') } as unknown as Drill;
    const avoid = questionKey(stub('same'));
    const inst = generateFresh(drill, 1, () => createRng(1), avoid);
    expect(inst.prompt.text).toBe('different');
    expect(calls).toBe(4);
  });

  it('draws once when there is nothing to avoid', () => {
    let calls = 0;
    const drill = { generate: () => (calls++, stub('same')) } as unknown as Drill;
    generateFresh(drill, 1, () => createRng(1), null);
    expect(calls).toBe(1);
  });

  it('gives up after a bounded number of tries when the drill has one question', () => {
    let calls = 0;
    const drill = { generate: () => (calls++, stub('same')) } as unknown as Drill;
    const inst = generateFresh(drill, 1, () => createRng(1), questionKey(stub('same')));
    expect(inst.prompt.text).toBe('same');
    expect(calls).toBe(FRESH_TRIES);
  });

  it('retries when a draw throws', () => {
    let calls = 0;
    const drill = {
      generate: () => {
        if (calls++ < 2) throw new Error('could not build a spot');
        return stub('ok');
      },
    } as unknown as Drill;
    expect(generateFresh(drill, 1, () => createRng(1), null).prompt.text).toBe('ok');
    expect(calls).toBe(3);
  });

  it('rethrows when every draw throws', () => {
    let calls = 0;
    const drill = { generate: () => { calls++; throw new Error('could not build a spot'); } } as unknown as Drill;
    expect(() => generateFresh(drill, 1, () => createRng(1), null)).toThrow('could not build a spot');
    expect(calls).toBe(FRESH_TRIES);
  });

  // Preflop enumeration costs about half a second per instance, so it gets a shorter run.
  for (const drill of DRILLS) {
    const runs = drill.id === 'preflop-equity' ? 3 : 60;
    it(`never repeats a question back to back: ${drill.id}`, () => {
      for (const level of [1, 2, 3] as const) {
        let seed = level * 1000;
        let last: string | null = null;
        for (let i = 0; i < runs; i++) {
          const inst = generateFresh(drill, level, () => createRng(++seed), last);
          const key = questionKey(inst);
          expect(key).not.toBe(last);
          last = key;
        }
      }
    });
  }
});
