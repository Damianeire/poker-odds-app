// Small combinatorics helpers shared across the engine.

const CHOOSE_CACHE = new Map<number, number>();

/** Binomial coefficient C(n, k), exact for the sizes used here. */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const kk = Math.min(k, n - k);
  const key = n * 64 + kk;
  const cached = CHOOSE_CACHE.get(key);
  if (cached !== undefined) return cached;
  let result = 1;
  for (let i = 1; i <= kk; i++) {
    result = (result * (n - kk + i)) / i;
  }
  result = Math.round(result);
  CHOOSE_CACHE.set(key, result);
  return result;
}

/**
 * Call fn for every k-subset of items, passing a reusable index-mapped array.
 * The array passed to fn is reused between calls; copy it if you keep it.
 * Return true from fn to stop early.
 */
export function forEachCombination<T>(
  items: readonly T[],
  k: number,
  fn: (combo: T[], index: number) => boolean | void,
): number {
  const n = items.length;
  if (k > n) return 0;
  if (k === 0) {
    fn([], 0);
    return 1;
  }
  const idx: number[] = [];
  for (let i = 0; i < k; i++) idx.push(i);
  const combo: T[] = new Array(k);
  let count = 0;
  for (;;) {
    for (let i = 0; i < k; i++) combo[i] = items[idx[i]!]!;
    if (fn(combo, count) === true) return count + 1;
    count++;
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return count;
    idx[i]!++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1]! + 1;
  }
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Round to a number of decimal places. */
export function round(x: number, places = 1): number {
  const f = 10 ** places;
  return Math.round(x * f) / f;
}
