// Mental shortcuts as first-class functions, each returning its estimate
// and its signed error against the exact engine figure.

import { probNextCard, probTwoCards } from './outs';

export interface ShortcutResult {
  name: string;
  outs: number;
  /** Estimate in percentage points. */
  estimate: number;
  /** Exact figure in percentage points. */
  exact: number;
  /** estimate - exact, in percentage points. Positive means the shortcut overstates. */
  error: number;
}

function build(name: string, outs: number, estimate: number, exactFraction: number): ShortcutResult {
  const exact = exactFraction * 100;
  return { name, outs, estimate, exact, error: estimate - exact };
}

/** Rule of 2: outs x 2 approximates the chance on the next card. */
export function ruleOf2(outs: number, unseen = 47): ShortcutResult {
  return build('Rule of 2', outs, outs * 2, probNextCard(outs, unseen));
}

/** Rule of 4: outs x 4 approximates the chance by the river with two cards to come. */
export function ruleOf4(outs: number, unseen = 47): ShortcutResult {
  return build('Rule of 4', outs, outs * 4, probTwoCards(outs, unseen));
}

/** Solomon's correction: outs x 4, minus one point per out above eight. */
export function solomon(outs: number, unseen = 47): ShortcutResult {
  return build("Solomon's correction", outs, outs * 4 - Math.max(0, outs - 8), probTwoCards(outs, unseen));
}

export interface ShortcutRow {
  outs: number;
  ruleOf4: ShortcutResult;
  solomon: ShortcutResult;
  exactTwoCards: number;
  ruleOf2: ShortcutResult;
  exactNextCard: number;
}

/** Live-generated comparison table. */
export function shortcutTable(outsList: readonly number[]): ShortcutRow[] {
  return outsList.map((o) => {
    const r4 = ruleOf4(o);
    const sol = solomon(o);
    const r2 = ruleOf2(o);
    return { outs: o, ruleOf4: r4, solomon: sol, exactTwoCards: r4.exact, ruleOf2: r2, exactNextCard: r2.exact };
  });
}

/** Convert a percentage to odds against, as x : 1. E.g. 20% -> 4 : 1. */
export function percentToOddsAgainst(percent: number): number {
  if (!(percent > 0) || percent >= 100) throw new Error(`percent must be in (0, 100), got ${percent}`);
  return (100 - percent) / percent;
}

/** Convert odds against (x : 1) to a percentage. E.g. 4 : 1 -> 20%. */
export function oddsAgainstToPercent(against: number, forPart = 1): number {
  if (!(against >= 0) || !(forPart > 0)) throw new Error('bad odds');
  return (100 * forPart) / (against + forPart);
}

/** Format odds against as "4.2 to 1". */
export function formatOddsAgainst(against: number, places = 1): string {
  return `${trimNumber(against, places)} to 1`;
}

export function trimNumber(x: number, places = 1): string {
  const s = x.toFixed(places);
  return s.replace(/\.?0+$/, '');
}
