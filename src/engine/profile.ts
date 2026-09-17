// Villain profiles: four estimated parameters, each feeding a term already in the engine.

import { evCall, type EvCall } from './ev';
import { equityNeededWithImplied, netImplied, type NetImplied } from './implied';

export interface VillainProfile {
  /** Fraction of starting hands villain plays, 0.05 to 1. Feeds equity against a range. */
  rangeWidth: number;
  /** Probability villain folds to a bet, 0 to 1. Feeds f in bluff and semi-bluff EV. */
  foldFrequency: number;
  /** Expected additional chips won on later streets when hero's draw completes, as a multiple of the current pot. Feeds X. */
  payoffPropensity: number;
  /** 0 to 1. Feeds reverse implied odds and the chance of action behind. */
  aggression: number;
}

export interface ProfilePreset extends VillainProfile {
  name: string;
  note: string;
}

export const PROFILE_PRESETS: readonly ProfilePreset[] = [
  { name: 'Loose passive', rangeWidth: 0.6, foldFrequency: 0.3, payoffPropensity: 0.8, aggression: 0.2, note: 'Plays many hands, calls a lot, rarely raises. Pays off draws.' },
  { name: 'Tight passive', rangeWidth: 0.2, foldFrequency: 0.5, payoffPropensity: 0.5, aggression: 0.2, note: 'Plays few hands, folds often, rarely raises.' },
  { name: 'Loose aggressive', rangeWidth: 0.6, foldFrequency: 0.35, payoffPropensity: 1.0, aggression: 0.8, note: 'Plays many hands and bets or raises with most of them.' },
  { name: 'Tight aggressive', rangeWidth: 0.2, foldFrequency: 0.55, payoffPropensity: 0.6, aggression: 0.8, note: 'Plays few hands and plays them fast.' },
];

export function validateProfile(p: VillainProfile): void {
  if (!(p.rangeWidth >= 0.05 && p.rangeWidth <= 1)) throw new Error('rangeWidth must be between 0.05 and 1');
  if (!(p.foldFrequency >= 0 && p.foldFrequency <= 1)) throw new Error('foldFrequency must be between 0 and 1');
  if (!(p.payoffPropensity >= 0)) throw new Error('payoffPropensity must be non-negative');
  if (!(p.aggression >= 0 && p.aggression <= 1)) throw new Error('aggression must be between 0 and 1');
}

export interface ProfileInputs {
  /** f: probability villain folds. */
  foldProb: number;
  /** X: expected future winnings when the draw completes, payoffPropensity x pot. */
  impliedGain: number;
  /** Expected future loss when the draw completes but loses: aggression x bet. A simplification. */
  reverseLoss: number;
  /** Probability of a raise behind: 1 - (1 - aggression)^playersBehind. Independence assumed. */
  raiseBehindProb: number;
}

/** Map a profile onto the engine's inputs for a given pot and bet. */
export function profileInputs(p: VillainProfile, pot: number, bet: number, playersBehind = 0): ProfileInputs {
  validateProfile(p);
  return {
    foldProb: p.foldFrequency,
    impliedGain: p.payoffPropensity * pot,
    reverseLoss: p.aggression * bet,
    raiseBehindProb: playersBehind > 0 ? 1 - (1 - p.aggression) ** playersBehind : 0,
  };
}

export interface ProfiledCall {
  inputs: ProfileInputs;
  implied: NetImplied;
  /** Equity needed after implied and reverse implied odds. */
  equityNeeded: number;
  /** Immediate break-even with no future betting. */
  immediateBreakEven: number;
  /** EV of the call on immediate odds alone. */
  evImmediate: EvCall;
  /** EV including net implied winnings: e(P + B + net) - (1 - e)B. */
  evWithImplied: number;
  raiseBehindProb: number;
  /** After the action-behind discount: (1 - r) x evWithImplied - r x B. */
  total: number;
  call: boolean;
}

/** The full call decision against a profiled villain. */
export function profiledCall(p: VillainProfile, pot: number, bet: number, equity: number, playersBehind = 0): ProfiledCall {
  const inputs = profileInputs(p, pot, bet, playersBehind);
  const implied = netImplied(inputs.impliedGain, inputs.reverseLoss);
  const equityNeeded = equityNeededWithImplied(pot, bet, implied.net);
  const evImmediate = evCall(pot, bet, equity);
  const evWithImplied = equity * (pot + bet + implied.net) - (1 - equity) * bet;
  const r = inputs.raiseBehindProb;
  const total = (1 - r) * evWithImplied - r * bet;
  return {
    inputs,
    implied,
    equityNeeded,
    immediateBreakEven: bet / (pot + 2 * bet),
    evImmediate,
    evWithImplied,
    raiseBehindProb: r,
    total,
    call: total > 0,
  };
}
