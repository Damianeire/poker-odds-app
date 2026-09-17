// Pot odds, break-even equity, minimum defence frequency and alpha.

export interface PotOdds {
  /** Pot before villain's bet. */
  pot: number;
  /** Bet hero faces. */
  bet: number;
  /** Cost to call. */
  cost: number;
  /** Odds offered as (pot + bet) : bet, reduced to x : 1. */
  oddsOffered: number;
  /** Pot after hero calls: P + 2B. */
  finalPot: number;
  /** Break-even equity to call, 0..1: B / (P + 2B). */
  breakEven: number;
  /** Minimum defence frequency, 0..1: P / (P + B). */
  mdf: number;
  /** Alpha, 0..1: B / (P + B). */
  alpha: number;
  /** Bet as a fraction of the pot. */
  betFraction: number;
}

export function potOdds(pot: number, bet: number): PotOdds {
  if (!(pot >= 0) || !(bet > 0)) throw new Error(`pot must be >= 0 and bet > 0, got pot=${pot} bet=${bet}`);
  return {
    pot,
    bet,
    cost: bet,
    oddsOffered: (pot + bet) / bet,
    finalPot: pot + 2 * bet,
    breakEven: bet / (pot + 2 * bet),
    mdf: pot / (pot + bet),
    alpha: bet / (pot + bet),
    betFraction: bet / pot,
  };
}

/** Pot built from several contributions (dead money, earlier calls), then a bet faced. */
export function potOddsFromContributions(contributions: readonly number[], bet: number): PotOdds {
  const pot = contributions.reduce((a, b) => a + b, 0);
  return potOdds(pot, bet);
}

/** The same figures for a bet expressed as a fraction of the pot. */
export function potOddsForFraction(fraction: number): PotOdds {
  return potOdds(1, fraction);
}

export interface SizingRow {
  label: string;
  fraction: number;
  odds: PotOdds;
}

export const STANDARD_SIZINGS: readonly { label: string; fraction: number }[] = [
  { label: '1/3 pot', fraction: 1 / 3 },
  { label: '1/2 pot', fraction: 1 / 2 },
  { label: '2/3 pot', fraction: 2 / 3 },
  { label: '3/4 pot', fraction: 3 / 4 },
  { label: 'Pot', fraction: 1 },
  { label: '1.5x pot', fraction: 1.5 },
  { label: '2x pot', fraction: 2 },
];

/** Live-generated reference table for the standard sizings. */
export function sizingTable(sizings = STANDARD_SIZINGS): SizingRow[] {
  return sizings.map((s) => ({ label: s.label, fraction: s.fraction, odds: potOddsForFraction(s.fraction) }));
}

/** Smallest bet that gives a caller with equity e worse than break-even odds: B > e P / (1 - 2e). */
export function betToPriceOut(pot: number, equity: number): number | null {
  if (equity >= 0.5) return null;
  return (equity * pot) / (1 - 2 * equity);
}
