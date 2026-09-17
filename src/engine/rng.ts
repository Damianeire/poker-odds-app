// Seeded random number generator so drills are reproducible.

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  /** Uniform integer in [lo, hi] inclusive. */
  range(lo: number, hi: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: T[]): T[];
  /** Draw k distinct items without replacement. */
  sample<T>(items: readonly T[], k: number): T[];
}

/** mulberry32: small, fast, good enough for drills and Monte Carlo. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (n) => Math.floor(next() * n),
    range: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (items) => {
      if (items.length === 0) throw new Error('pick from empty array');
      return items[Math.floor(next() * items.length)]!;
    },
    shuffle: (items) => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = items[i]!;
        items[i] = items[j]!;
        items[j] = tmp;
      }
      return items;
    },
    sample: (items, k) => {
      if (k > items.length) throw new Error('sample larger than population');
      const copy = items.slice();
      for (let i = 0; i < k; i++) {
        const j = i + Math.floor(next() * (copy.length - i));
        const tmp = copy[i]!;
        copy[i] = copy[j]!;
        copy[j] = tmp;
      }
      return copy.slice(0, k);
    },
  };
  return rng;
}

/** Derive a numeric seed from a string, for shareable seed codes later. */
export function seedFromString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
