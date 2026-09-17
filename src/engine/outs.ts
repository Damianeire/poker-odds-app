// Out counting and out-based probability.

import { type Card, remainingDeck, assertDistinct, rankOf } from './cards';
import { Category, categoryOf, evaluate } from './evaluator';
import { choose } from './math';

/** Unseen cards from hero's point of view: 52 minus hole cards minus board minus any dead cards. */
export function unseenCount(boardLength: number, deadCount = 0): number {
  return 52 - 2 - boardLength - deadCount;
}

/** Probability (0..1) of hitting one of `outs` cards on the next card, with `unseen` cards unseen. */
export function probNextCard(outs: number, unseen: number): number {
  if (outs < 0 || unseen <= 0 || outs > unseen) throw new Error(`bad outs=${outs} unseen=${unseen}`);
  return outs / unseen;
}

/** Probability (0..1) of hitting at least once over the next two cards. */
export function probTwoCards(outs: number, unseen = 47): number {
  if (outs < 0 || unseen < 2 || outs > unseen) throw new Error(`bad outs=${outs} unseen=${unseen}`);
  return 1 - choose(unseen - outs, 2) / choose(unseen, 2);
}

export interface OutProbabilities {
  outs: number;
  unseen: number;
  /** Chance of hitting on the next single card, 0..1. */
  nextCard: number;
  /** Chance of hitting by the river. Two cards on the flop, one card on the turn. */
  byRiver: number;
  /** Number of cards still to come. */
  cardsToCome: 1 | 2;
}

/**
 * Both figures at once for a given street. boardLength 3 = flop, 4 = turn.
 */
export function outProbabilities(outs: number, boardLength: 3 | 4, deadCount = 0): OutProbabilities {
  const unseen = unseenCount(boardLength, deadCount);
  const nextCard = probNextCard(outs, unseen);
  if (boardLength === 3) {
    return { outs, unseen, nextCard, byRiver: probTwoCards(outs, unseen), cardsToCome: 2 };
  }
  return { outs, unseen, nextCard, byRiver: nextCard, cardsToCome: 1 };
}

/** Discounted outs: a judgement-based reduction, not arithmetic. */
export function discountOuts(rawOuts: number, tainted: number): number {
  if (tainted < 0 || tainted > rawOuts) throw new Error('tainted outs must be between 0 and the raw count');
  return rawOuts - tainted;
}

export interface OutsResult {
  /** The cards that qualify. */
  outs: Card[];
  count: number;
  /** Cards considered (the unseen deck). */
  unseen: number;
  /** The candidates that did not qualify, for display. */
  nonOuts: Card[];
}

/**
 * Category the board would make by itself, ignoring hole cards, so that
 * a card that merely pairs the board is not counted as an out to a pair.
 */
function boardOnlyCategory(board: readonly Card[]): Category {
  if (board.length >= 5) return categoryOf(evaluate(board));
  const counts = new Int8Array(15);
  let pairs = 0;
  let maxCount = 0;
  for (const c of board) {
    const r = rankOf(c);
    counts[r]!++;
    if (counts[r]! > maxCount) maxCount = counts[r]!;
  }
  for (let r = 2; r <= 14; r++) if (counts[r]! >= 2) pairs++;
  if (maxCount === 4) return Category.FourOfAKind;
  if (maxCount === 3) return Category.ThreeOfAKind;
  if (pairs >= 2) return Category.TwoPair;
  if (pairs === 1) return Category.OnePair;
  return Category.HighCard;
}

/**
 * Automatic out detection against a target category. A card is an out if it
 * lifts hero to at least the target category, hero is currently below it,
 * and hero's resulting hand beats what the board makes by itself.
 */
export function detectOutsToCategory(
  hero: readonly Card[],
  board: readonly Card[],
  target: Category,
  dead: readonly Card[] = [],
): OutsResult {
  if (hero.length !== 2) throw new Error('hero must have two cards');
  if (board.length < 3 || board.length > 4) throw new Error('out detection needs a flop or turn board');
  assertDistinct([...hero, ...board, ...dead], 'out detection');
  const candidates = remainingDeck([...hero, ...board, ...dead]);
  const outs: Card[] = [];
  const nonOuts: Card[] = [];
  const currentCat = board.length >= 3 ? categoryOf(evaluate([...hero, ...board])) : Category.HighCard;
  if (currentCat >= target) {
    return { outs: [], count: 0, unseen: candidates.length, nonOuts: candidates };
  }
  for (const c of candidates) {
    const withCard = [...hero, ...board, c];
    const cat = categoryOf(evaluate(withCard));
    const boardCat = boardOnlyCategory([...board, c]);
    // Count the card only if hero's hand is better than what the board makes by itself,
    // so a card that merely pairs the board is not an out to a pair.
    if (cat >= target && cat > boardCat) outs.push(c);
    else nonOuts.push(c);
  }
  return { outs, count: outs.length, unseen: candidates.length, nonOuts };
}

/**
 * Outs that actually win: cards after which hero's hand beats villain's.
 * Villain's cards are removed from the unseen deck.
 */
export function detectOutsVsHand(
  hero: readonly Card[],
  villain: readonly Card[],
  board: readonly Card[],
  dead: readonly Card[] = [],
): OutsResult {
  if (hero.length !== 2 || villain.length !== 2) throw new Error('hands must have two cards');
  if (board.length < 3 || board.length > 4) throw new Error('out detection needs a flop or turn board');
  assertDistinct([...hero, ...villain, ...board, ...dead], 'out detection');
  const candidates = remainingDeck([...hero, ...villain, ...board, ...dead]);
  const outs: Card[] = [];
  const nonOuts: Card[] = [];
  for (const c of candidates) {
    const h = evaluate([...hero, ...board, c]);
    const v = evaluate([...villain, ...board, c]);
    if (h > v) outs.push(c);
    else nonOuts.push(c);
  }
  return { outs, count: outs.length, unseen: candidates.length, nonOuts };
}

/** Is hero currently ahead of villain on this board? */
export function heroAhead(hero: readonly Card[], villain: readonly Card[], board: readonly Card[]): boolean {
  return evaluate([...hero, ...board]) > evaluate([...villain, ...board]);
}
