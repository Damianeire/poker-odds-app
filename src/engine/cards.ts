// Card model. A card is a small integer: rank * 4 + suit.
// Ranks run 2..14 (ace high). Suits: 0 = clubs, 1 = diamonds, 2 = hearts, 3 = spades.
// No DOM, no framework imports.

export type Card = number;

export const SUITS = ['c', 'd', 'h', 's'] as const;
export const SUIT_NAMES = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export const SUIT_GLYPHS = ['♣', '♦', '♥', '♠'] as const;
export const RANK_CHARS = '23456789TJQKA';
export const RANK_NAMES = [
  'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'jack', 'queen', 'king', 'ace',
] as const;

export const MIN_RANK = 2;
export const MAX_RANK = 14;

export function makeCard(rank: number, suit: number): Card {
  if (rank < MIN_RANK || rank > MAX_RANK || suit < 0 || suit > 3) {
    throw new Error(`Invalid card rank=${rank} suit=${suit}`);
  }
  return rank * 4 + suit;
}

export function rankOf(card: Card): number {
  return card >> 2;
}

export function suitOf(card: Card): number {
  return card & 3;
}

export function rankChar(rank: number): string {
  return RANK_CHARS[rank - 2] ?? '?';
}

export function rankName(rank: number): string {
  return RANK_NAMES[rank - 2] ?? 'unknown';
}

export function suitName(suit: number): string {
  return SUIT_NAMES[suit] ?? 'unknown';
}

/** Format a card as two characters, e.g. As, Th, 7d. */
export function formatCard(card: Card): string {
  return rankChar(rankOf(card)) + SUITS[suitOf(card)];
}

export function formatCards(cards: readonly Card[]): string {
  return cards.map(formatCard).join(' ');
}

/** Long form for accessible names, e.g. "ace of spades". */
export function describeCard(card: Card): string {
  return `${rankName(rankOf(card))} of ${suitName(suitOf(card))}`;
}

/** Parse a single card token such as "As", "th", "7D". */
export function parseCard(token: string): Card {
  const t = token.trim();
  if (t.length !== 2) throw new Error(`Bad card token "${token}"`);
  const rc = t[0]!.toUpperCase();
  const sc = t[1]!.toLowerCase();
  const rank = RANK_CHARS.indexOf(rc);
  const suit = SUITS.indexOf(sc as (typeof SUITS)[number]);
  if (rank < 0 || suit < 0) throw new Error(`Bad card token "${token}"`);
  return makeCard(rank + 2, suit);
}

/** Parse a string of cards: "As Kd", "AsKd", "As,Kd" all accepted. */
export function parseCards(text: string): Card[] {
  const cleaned = text.replace(/[\s,]+/g, '');
  if (cleaned.length === 0) return [];
  if (cleaned.length % 2 !== 0) throw new Error(`Bad card string "${text}"`);
  const out: Card[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    out.push(parseCard(cleaned.slice(i, i + 2)));
  }
  const seen = new Set<Card>();
  for (const c of out) {
    if (seen.has(c)) throw new Error(`Duplicate card ${formatCard(c)} in "${text}"`);
    seen.add(c);
  }
  return out;
}

/** All 52 cards in rank-major order. */
export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (let r = MIN_RANK; r <= MAX_RANK; r++) {
    for (let s = 0; s < 4; s++) deck.push(r * 4 + s);
  }
  return deck;
}

/** Deck with the given cards removed. */
export function remainingDeck(known: readonly Card[]): Card[] {
  const set = new Set(known);
  return fullDeck().filter((c) => !set.has(c));
}

export function assertDistinct(cards: readonly Card[], context = 'cards'): void {
  const seen = new Set<Card>();
  for (const c of cards) {
    if (seen.has(c)) throw new Error(`Duplicate card ${formatCard(c)} in ${context}`);
    seen.add(c);
  }
}
