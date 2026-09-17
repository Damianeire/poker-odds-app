import { describe, expect, it } from 'vitest';
import { fullDeck, parseCards } from '../src/engine/cards';
import { Category, categoryOf, evaluate, describeScore, CATEGORY_COUNT } from '../src/engine/evaluator';
import { choose, forEachCombination } from '../src/engine/math';

// Published frequency table: a test fixture, never app data.
const FIVE_CARD_COUNTS: Record<number, number> = {
  [Category.StraightFlush]: 40,
  [Category.FourOfAKind]: 624,
  [Category.FullHouse]: 3744,
  [Category.Flush]: 5108,
  [Category.Straight]: 10200,
  [Category.ThreeOfAKind]: 54912,
  [Category.TwoPair]: 123552,
  [Category.OnePair]: 1098240,
  [Category.HighCard]: 1302540,
};

describe('evaluator', () => {
  it('reproduces the five-card category frequency table exactly', () => {
    const counts = new Array<number>(CATEGORY_COUNT).fill(0);
    const total = forEachCombination(fullDeck(), 5, (hand) => {
      counts[categoryOf(evaluate(hand))]!++;
    });
    expect(total).toBe(2598960);
    expect(choose(52, 5)).toBe(2598960);
    for (let cat = 0; cat < CATEGORY_COUNT; cat++) {
      expect(counts[cat], `category ${cat}`).toBe(FIVE_CARD_COUNTS[cat]);
    }
    expect(counts.reduce((a, b) => a + b, 0)).toBe(2598960);
  });

  it('states the seven-card enumeration space', () => {
    expect(choose(52, 7)).toBe(133784560);
  });

  it('ranks categories in order', () => {
    const hands = [
      '2c 3d 5h 9s Kc', // high card
      '2c 2d 5h 9s Kc', // pair
      '2c 2d 5h 5s Kc', // two pair
      '2c 2d 2h 9s Kc', // trips
      '2c 3d 4h 5s 6c', // straight
      '2c 7c 9c Jc Kc', // flush
      '2c 2d 2h 5s 5c', // full house
      '2c 2d 2h 2s Kc', // quads
      '2c 3c 4c 5c 6c', // straight flush
    ];
    const scores = hands.map((h) => evaluate(parseCards(h)));
    for (let i = 1; i < scores.length; i++) expect(scores[i]!).toBeGreaterThan(scores[i - 1]!);
  });

  it('handles the wheel and ace-high straights', () => {
    const wheel = evaluate(parseCards('As 2c 3d 4h 5s'));
    const six = evaluate(parseCards('2c 3d 4h 5s 6c'));
    const broadway = evaluate(parseCards('Ts Jc Qd Kh As'));
    expect(categoryOf(wheel)).toBe(Category.Straight);
    expect(six).toBeGreaterThan(wheel);
    expect(broadway).toBeGreaterThan(six);
    // Q K A 2 3 is not a straight.
    expect(categoryOf(evaluate(parseCards('Qs Kc Ad 2h 3s')))).toBe(Category.HighCard);
  });

  it('picks the best five from seven', () => {
    // Five hearts plus trips: the flush outranks the trips.
    const s = evaluate(parseCards('Ah Kh 7h 7d 7c 2h 9h'));
    expect(categoryOf(s)).toBe(Category.Flush);
    // Board pair plus a set: full house, not a flush draw.
    const fh = evaluate(parseCards('7h 7d 7c Kh Ks 2h 9h'));
    expect(describeScore(fh)).toBe('full house, sevens full of kings');
    // Two trips: full house using the higher trips.
    const t = evaluate(parseCards('Ah Ad Ac 7d 7c 7h 2s'));
    expect(describeScore(t)).toBe('full house, aces full of sevens');
    // Three pairs: two pair with the best kicker among the rest.
    const u = evaluate(parseCards('Ah Ad Kc Kd 2s 2c 9h'));
    expect(describeScore(u)).toBe('two pair, aces and kings');
  });

  it('compares kickers correctly', () => {
    const a = evaluate(parseCards('As Ad Kc 9d 2h 3s 7c'));
    const b = evaluate(parseCards('Ah Ac Qc 9d 2h 3s 7c'));
    expect(a).toBeGreaterThan(b);
    const tie1 = evaluate(parseCards('As Kd 7h 7c 2s 9d Tc'));
    const tie2 = evaluate(parseCards('Ah Kc 7h 7c 2s 9d Tc'));
    expect(tie1).toBe(tie2);
  });

  it('describes hands in words', () => {
    expect(describeScore(evaluate(parseCards('Ts Js Qs Ks As')))).toBe('royal flush');
    expect(describeScore(evaluate(parseCards('6s 6d 6c 2h 9s')))).toBe('three of a kind, sixes');
  });
});
