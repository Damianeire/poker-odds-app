import { describe, expect, it } from 'vitest';
import { parseCards, remainingDeck, formatCards } from '../src/engine/cards';
import { Category } from '../src/engine/evaluator';
import { choose, forEachCombination } from '../src/engine/math';
import {
  probNextCard,
  probTwoCards,
  outProbabilities,
  detectOutsToCategory,
  detectOutsVsHand,
  discountOuts,
  unseenCount,
  heroAhead,
} from '../src/engine/outs';

describe('out probability formulas', () => {
  it('two-cards-to-come formula matches brute force over all C(47,2) runouts for 0..21 outs', () => {
    const deck = Array.from({ length: 47 }, (_, i) => i);
    for (let o = 0; o <= 21; o++) {
      let hits = 0;
      const total = forEachCombination(deck, 2, (pair) => {
        if (pair[0]! < o || pair[1]! < o) hits++;
      });
      expect(total).toBe(choose(47, 2));
      expect(probTwoCards(o, 47)).toBeCloseTo(hits / total, 12);
    }
  });

  it('one-card formula is o / u', () => {
    expect(probNextCard(9, 47)).toBeCloseTo(9 / 47, 12);
    expect(probNextCard(9, 46)).toBeCloseTo(9 / 46, 12);
    expect(unseenCount(3)).toBe(47);
    expect(unseenCount(4)).toBe(46);
  });

  it('exposes next-card and by-river figures separately', () => {
    const flop = outProbabilities(9, 3);
    expect(flop.cardsToCome).toBe(2);
    expect(flop.nextCard).toBeCloseTo(9 / 47, 12);
    expect(flop.byRiver).toBeCloseTo(1 - choose(38, 2) / choose(47, 2), 12);
    expect(flop.byRiver).toBeGreaterThan(flop.nextCard);
    const turn = outProbabilities(9, 4);
    expect(turn.cardsToCome).toBe(1);
    expect(turn.nextCard).toBeCloseTo(9 / 46, 12);
    expect(turn.byRiver).toBe(turn.nextCard);
  });

  it('property: adding an out never decreases a probability', () => {
    for (let o = 0; o < 47; o++) {
      expect(probNextCard(o + 1, 47)).toBeGreaterThan(probNextCard(o, 47));
      expect(probTwoCards(o + 1, 47)).toBeGreaterThanOrEqual(probTwoCards(o, 47));
    }
    // Strictly increasing until the draw is already certain (46 or 47 outs of 47).
    for (let o = 0; o < 46; o++) {
      expect(probTwoCards(o + 1, 47)).toBeGreaterThan(probTwoCards(o, 47));
    }
  });

  it('discounting is a straight reduction', () => {
    expect(discountOuts(9, 2)).toBe(7);
    expect(() => discountOuts(9, 10)).toThrow();
  });
});

describe('automatic out detection', () => {
  it('flush draw has 9 outs', () => {
    const r = detectOutsToCategory(parseCards('Ah 7h'), parseCards('Kh 9h 2c'), Category.Flush);
    expect(r.count).toBe(9);
    expect(r.unseen).toBe(47);
  });

  it('open-ended straight draw has 8 outs', () => {
    const r = detectOutsToCategory(parseCards('9s 8d'), parseCards('7h 6c 2s'), Category.Straight);
    expect(r.count).toBe(8);
  });

  it('gutshot has 4 outs', () => {
    const r = detectOutsToCategory(parseCards('9s 8d'), parseCards('6h 5c Kd'), Category.Straight);
    expect(r.count).toBe(4);
  });

  it('two overcards have 6 outs to a pair, board pairs excluded', () => {
    const r = detectOutsToCategory(parseCards('As Kd'), parseCards('Qh 7c 2d'), Category.OnePair);
    expect(r.count).toBe(6);
  });

  it('a pair has 2 outs to trips', () => {
    const r = detectOutsToCategory(parseCards('7s 7d'), parseCards('Kh 9c 4d'), Category.ThreeOfAKind);
    expect(r.count).toBe(2);
  });

  it('a set on the flop has 7 outs to a full house or better on the next card', () => {
    const r = detectOutsToCategory(parseCards('8s 8d'), parseCards('8h Kc 5d'), Category.FullHouse);
    expect(r.count).toBe(7);
  });

  it('flush draw plus open-ender has 15 outs, no double counting', () => {
    const r = detectOutsToCategory(parseCards('Jh Th'), parseCards('9h 8h 2c'), Category.Straight);
    // Straight-or-better: 8 straight cards, plus the 7 remaining hearts that are not straight cards.
    expect(r.count).toBe(15);
  });

  it('flush draw plus gutshot has 12 outs', () => {
    const r = detectOutsToCategory(parseCards('Jh Th'), parseCards('9h 7h 2c'), Category.Straight);
    expect(r.count).toBe(12);
  });

  it('a flush card that pairs the board still counts as an out to a pair or better', () => {
    // Ah 7h on Kh 9h 2c: 3 aces, 3 sevens and 9 hearts, the 2h included.
    const r = detectOutsToCategory(parseCards('Ah 7h'), parseCards('Kh 9h 2c'), Category.OnePair);
    expect(r.count).toBe(15);
    expect(formatCards(r.outs)).toContain('2h');
  });

  it('returns zero outs when hero already has the target', () => {
    const r = detectOutsToCategory(parseCards('Ah 7h'), parseCards('Kh 9h 2h'), Category.Flush);
    expect(r.count).toBe(0);
  });

  it('outs that win against a specific hand exclude tainted cards', () => {
    // Hero flush draw vs villain set: the board-pairing hearts do not win.
    const hero = parseCards('Ah 7h');
    const villain = parseCards('Kc Kd');
    const board = parseCards('Kh 9h 2c');
    expect(heroAhead(hero, villain, board)).toBe(false);
    const r = detectOutsVsHand(hero, villain, board);
    // 9 hearts remain minus villain's none; 9h on board already. Hearts left: 13 - 3 (Ah 7h Kh 9h = 4 seen) = 9.
    // Pairing the board with a heart (9 of hearts is on board; 2h pairs the 2) gives villain a full house: 2h is tainted.
    // Also Kh is on board so no further K hearts. Expected: 9 - 1 (2h) = 8.
    expect(r.count).toBe(8);
    expect(formatCards(r.outs)).not.toContain('2h');
    expect(r.unseen).toBe(45);
  });

  it('outs vs hand includes cards that win without reaching the named draw', () => {
    // Overcards against a lower pair: aces and kings both win.
    const r = detectOutsVsHand(parseCards('As Kd'), parseCards('7h 7c'), parseCards('Qh 8c 2d'));
    expect(r.count).toBe(6);
  });

  it('candidates cover the whole unseen deck', () => {
    const hero = parseCards('Ah 7h');
    const board = parseCards('Kh 9h 2c');
    const r = detectOutsToCategory(hero, board, Category.Flush);
    expect(r.outs.length + r.nonOuts.length).toBe(remainingDeck([...hero, ...board]).length);
  });
});
