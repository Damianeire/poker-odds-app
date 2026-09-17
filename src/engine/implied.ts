// Implied and reverse implied odds, and set mining.

import { choose } from './math';

export interface ImpliedRequirement {
  pot: number;
  bet: number;
  equity: number;
  /** Additional future winnings needed to break even: B(1 - e)/e - P - B. Negative means none needed. */
  required: number;
  /** Immediate break-even equity without implied odds. */
  immediateBreakEven: number;
  /** Odds the draw is against: (1 - e) : e, as x to 1. */
  oddsAgainst: number;
}

/** How much more must be won on later streets for the call to break even. */
export function impliedRequirement(pot: number, bet: number, equity: number): ImpliedRequirement {
  if (!(pot >= 0) || !(bet > 0)) throw new Error('pot must be >= 0 and bet > 0');
  if (!(equity > 0 && equity < 1)) throw new Error('equity must be strictly between 0 and 1');
  return {
    pot,
    bet,
    equity,
    required: (bet * (1 - equity)) / equity - pot - bet,
    immediateBreakEven: bet / (pot + 2 * bet),
    oddsAgainst: (1 - equity) / equity,
  };
}

/** Equity needed to call when X more is expected on later streets: B / (P + 2B + X). */
export function equityNeededWithImplied(pot: number, bet: number, futureWinnings: number): number {
  if (!(pot >= 0) || !(bet > 0)) throw new Error('pot must be >= 0 and bet > 0');
  const denom = pot + 2 * bet + futureWinnings;
  if (denom <= bet) return 1;
  return bet / denom;
}

export interface NetImplied {
  /** Expected future winnings when the draw completes (an estimate). */
  impliedGain: number;
  /** Expected future losses when it completes but loses, or improves to second best (an estimate). */
  reverseLoss: number;
  net: number;
}

/** Reverse implied odds: a user-supplied expected loss subtracted from the implied gain. */
export function netImplied(impliedGain: number, reverseLoss: number): NetImplied {
  if (!(impliedGain >= 0) || !(reverseLoss >= 0)) throw new Error('gain and loss must be non-negative');
  return { impliedGain, reverseLoss, net: impliedGain - reverseLoss };
}

/** A pocket pair flops a set or better: 1 - C(48, 3) / C(50, 3). */
export function setOrBetterOnFlop(): number {
  return 1 - choose(48, 3) / choose(50, 3);
}

export interface SetMine {
  pot: number;
  call: number;
  effectiveStack: number;
  /** Probability of flopping a set or better. */
  hitProb: number;
  /** Future winnings required when hitting. */
  required: number;
  /** Chips left behind after calling. */
  behind: number;
  /** Rule-of-thumb stack: multiple x call. */
  ruleOfThumbStack: number;
  ruleOfThumbMultiple: number;
  /** Required winnings as a multiple of the call. */
  requiredMultiple: number;
  /** Expected winnings when hitting, given the payoff fraction of the stack behind. */
  payoffFraction: number;
  expectedWin: number;
  /** Call if the expected winnings when hitting cover the requirement. */
  shouldCall: boolean;
}

/**
 * Set mining decision. payoffFraction is the share of the remaining effective
 * stack you expect to win, on average, when you hit. It is an estimate.
 */
export function setMine(pot: number, call: number, effectiveStack: number, payoffFraction: number, ruleOfThumbMultiple = 15): SetMine {
  if (!(effectiveStack >= call)) throw new Error('effective stack must cover the call');
  if (!(payoffFraction >= 0 && payoffFraction <= 1)) throw new Error('payoffFraction must be between 0 and 1');
  const hitProb = setOrBetterOnFlop();
  const required = impliedRequirement(pot, call, hitProb).required;
  const behind = effectiveStack - call;
  const expectedWin = payoffFraction * behind;
  return {
    pot,
    call,
    effectiveStack,
    hitProb,
    required,
    behind,
    ruleOfThumbStack: ruleOfThumbMultiple * call,
    ruleOfThumbMultiple,
    requiredMultiple: required / call,
    payoffFraction,
    expectedWin,
    shouldCall: expectedWin >= required,
  };
}
