import { parseCards } from '../engine/cards';
import { Category } from '../engine/evaluator';
import { detectOutsToCategory, probNextCard, probTwoCards } from '../engine/outs';
import { formatOddsAgainst, percentToOddsAgainst } from '../engine/shortcuts';

/** Fraction to percentage text. */
export const pc = (fraction: number, places = 1): string => `${(fraction * 100).toFixed(places)}%`;
/** Percentage points to text. */
export const pp = (points: number, places = 1): string => `${points.toFixed(places)}%`;
export const odds = (fraction: number, places = 1): string => formatOddsAgainst(percentToOddsAgainst(fraction * 100), places);
export const n = (x: number, places = 1): string => x.toFixed(places).replace(/\.?0+$/, '');

/** Outs for an example hand, from the engine. */
export function outs(hero: string, board: string, cat: Category): number {
  return detectOutsToCategory(parseCards(hero), parseCards(board), cat).count;
}

export const one = (o: number, u = 47): number => probNextCard(o, u);
export const two = (o: number): number => probTwoCards(o);

export { Category };
