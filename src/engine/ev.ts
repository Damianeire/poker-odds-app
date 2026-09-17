// Expected value of calls, bluffs and semi-bluffs. Every function returns
// the component terms so the UI can show the decomposition.

export interface EvCall {
  pot: number;
  bet: number;
  equity: number;
  /** e x (P + B): what you win, times how often. */
  winTerm: number;
  /** (1 - e) x B: what you lose, times how often. */
  loseTerm: number;
  total: number;
}

/** EV of calling a bet B into pot P with equity e. Positive means call. */
export function evCall(pot: number, bet: number, equity: number): EvCall {
  checkPotBet(pot, bet);
  checkProb(equity, 'equity');
  const winTerm = equity * (pot + bet);
  const loseTerm = (1 - equity) * bet;
  return { pot, bet, equity, winTerm, loseTerm, total: winTerm - loseTerm };
}

export interface EvCallActionBehind {
  base: EvCall;
  /** Probability a player still to act raises and forces a fold. */
  raiseProb: number;
  /** The call forfeited when raised: r x B. */
  forfeit: number;
  /** (1 - r) x EV(call) - r x B. */
  total: number;
}

/**
 * Call EV discounted for action behind: with probability r a raise forces a
 * fold and the call is lost. One slider, one assumption.
 */
export function evCallWithActionBehind(pot: number, bet: number, equity: number, raiseProb: number): EvCallActionBehind {
  checkProb(raiseProb, 'raiseProb');
  const base = evCall(pot, bet, equity);
  const forfeit = raiseProb * bet;
  return { base, raiseProb, forfeit, total: (1 - raiseProb) * base.total - forfeit };
}

export interface EvBluff {
  pot: number;
  bet: number;
  /** Per-opponent fold probability. */
  foldEach: number;
  opponents: number;
  /** Probability every opponent folds: f^n under independence. */
  foldAll: number;
  /** foldAll x P. */
  winTerm: number;
  /** (1 - foldAll) x B. */
  loseTerm: number;
  total: number;
  /** Fold probability needed overall: B / (P + B). Does not move with opponents. */
  breakEvenFoldAll: number;
  /** Per-opponent fold probability needed: (B / (P + B))^(1/n). */
  breakEvenFoldEach: number;
}

/** EV of a pure bluff. Multiway assumes each opponent folds independently. */
export function evBluff(pot: number, bet: number, foldEach: number, opponents = 1): EvBluff {
  checkPotBet(pot, bet);
  checkProb(foldEach, 'foldEach');
  if (!Number.isInteger(opponents) || opponents < 1) throw new Error('opponents must be a positive integer');
  const foldAll = foldEach ** opponents;
  const winTerm = foldAll * pot;
  const loseTerm = (1 - foldAll) * bet;
  const breakEvenFoldAll = bet / (pot + bet);
  return {
    pot,
    bet,
    foldEach,
    opponents,
    foldAll,
    winTerm,
    loseTerm,
    total: winTerm - loseTerm,
    breakEvenFoldAll,
    breakEvenFoldEach: breakEvenFoldAll ** (1 / opponents),
  };
}

export interface EvSemiBluff {
  pot: number;
  bet: number;
  foldEach: number;
  opponents: number;
  equity: number;
  foldAll: number;
  /** foldAll x P: taken down without a showdown. */
  foldTerm: number;
  /** EV when called, as a call of your own bet: e(P + B) - (1 - e)B. */
  whenCalled: EvCall;
  /** (1 - foldAll) x whenCalled.total. */
  calledTerm: number;
  total: number;
  /** Fold equity's contribution: total minus what a plain call-down would be worth. */
  pureBluffTotal: number;
}

/** EV of betting B into P with fold probability f and equity e when called. */
export function evSemiBluff(pot: number, bet: number, foldEach: number, equity: number, opponents = 1): EvSemiBluff {
  const bluff = evBluff(pot, bet, foldEach, opponents);
  const whenCalled = evCall(pot, bet, equity);
  const foldTerm = bluff.foldAll * pot;
  const calledTerm = (1 - bluff.foldAll) * whenCalled.total;
  return {
    pot,
    bet,
    foldEach,
    opponents,
    equity,
    foldAll: bluff.foldAll,
    foldTerm,
    whenCalled,
    calledTerm,
    total: foldTerm + calledTerm,
    pureBluffTotal: bluff.total,
  };
}

/** Share of a river betting range that should be bluffs to make the caller indifferent: B / (P + 2B). */
export function riverBluffShare(pot: number, bet: number): number {
  checkPotBet(pot, bet);
  return bet / (pot + 2 * bet);
}

function checkPotBet(pot: number, bet: number): void {
  if (!(pot >= 0) || !(bet > 0)) throw new Error(`pot must be >= 0 and bet > 0, got pot=${pot} bet=${bet}`);
}

function checkProb(p: number, name: string): void {
  if (!(p >= 0 && p <= 1)) throw new Error(`${name} must be between 0 and 1, got ${p}`);
}
