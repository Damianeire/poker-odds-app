import { describe, expect, it } from 'vitest';
import { fullDeck, formatCard, parseCard, parseCards, rankOf, suitOf, remainingDeck, describeCard } from '../src/engine/cards';

describe('card model', () => {
  it('has 52 distinct cards with valid ranks and suits', () => {
    const deck = fullDeck();
    expect(deck.length).toBe(52);
    expect(new Set(deck).size).toBe(52);
    for (const c of deck) {
      expect(rankOf(c)).toBeGreaterThanOrEqual(2);
      expect(rankOf(c)).toBeLessThanOrEqual(14);
      expect(suitOf(c)).toBeGreaterThanOrEqual(0);
      expect(suitOf(c)).toBeLessThanOrEqual(3);
    }
  });

  it('round-trips parse and format for every card', () => {
    for (const c of fullDeck()) {
      expect(parseCard(formatCard(c))).toBe(c);
    }
  });

  it('parses standard notation in any case and spacing', () => {
    expect(parseCards('As Kd')).toEqual([parseCard('As'), parseCard('Kd')]);
    expect(parseCards('asKD')).toEqual([parseCard('As'), parseCard('Kd')]);
    expect(parseCards('Th,7d, 2c')).toEqual([parseCard('Th'), parseCard('7d'), parseCard('2c')]);
    expect(parseCards('')).toEqual([]);
  });

  it('rejects bad tokens and duplicates', () => {
    expect(() => parseCard('1s')).toThrow();
    expect(() => parseCard('Ax')).toThrow();
    expect(() => parseCards('As As')).toThrow();
    expect(() => parseCards('AsK')).toThrow();
  });

  it('removes known cards from the deck', () => {
    const rest = remainingDeck(parseCards('As Kd 7h'));
    expect(rest.length).toBe(49);
    expect(rest).not.toContain(parseCard('As'));
  });

  it('describes cards in words for accessibility', () => {
    expect(describeCard(parseCard('As'))).toBe('ace of spades');
    expect(describeCard(parseCard('Td'))).toBe('ten of diamonds');
  });
});
