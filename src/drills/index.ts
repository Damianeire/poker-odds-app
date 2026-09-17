import { type Drill } from './types';
import { countOuts } from './countOuts';
import { outsToPercentOneCard, outsToPercentTwoCards } from './outsToPercent';
import { percentRatio } from './percentRatio';
import { ruleOf2And4 } from './ruleOf2And4';
import { spotTheError } from './spotTheError';
import { breakEvenEquity } from './breakEven';
import { callOrFold } from './callOrFold';
import { priceOut } from './priceOut';
import { mdfAlpha, bluffBreakEven, multiwayBluff, deadMoney } from './defence';
import { semiBluffEv, impliedOdds, setMining, impliedFromObservation } from './evDrills';
import { comboCount } from './comboDrills';
import { preflopEquity, multiwayEquity } from './equityDrills';
import { dirtyOuts, villainDependent, whichMultiplier, whichTool } from './judgementDrills';
import { handRanking, bestHand } from './handReading';

export * from './types';
export * from './answer';

/** All drills, numbered as in the specification's catalogue. */
export const DRILLS: readonly Drill[] = [
  countOuts, // 1
  outsToPercentOneCard, // 2
  outsToPercentTwoCards, // 3
  percentRatio, // 4
  ruleOf2And4, // 5
  spotTheError, // 6
  breakEvenEquity, // 7
  callOrFold, // 8
  priceOut, // 9
  mdfAlpha, // 10
  bluffBreakEven, // 11
  semiBluffEv, // 12
  impliedOdds, // 13
  setMining, // 14
  comboCount, // 15
  preflopEquity, // 16
  dirtyOuts, // 17
  multiwayEquity, // 18
  multiwayBluff, // 19
  deadMoney, // 20
  villainDependent, // 21
  impliedFromObservation, // 22
  handRanking, // 23
  bestHand, // 24
  whichMultiplier, // 25
  whichTool, // 26
];

/** Catalogue number, 1-based, as in the specification. */
export function drillNumber(id: string): number {
  return DRILLS.findIndex((d) => d.id === id) + 1;
}

export function drillById(id: string): Drill | undefined {
  return DRILLS.find((d) => d.id === id);
}

/** Drills in teaching order: gating drills first, then the catalogue order. */
export const TEACHING_ORDER: readonly Drill[] = [handRanking, bestHand, ...DRILLS.filter((d) => d.id !== 'hand-ranking' && d.id !== 'best-hand')];

export function drillsForModule(module: string): Drill[] {
  return DRILLS.filter((d) => d.module === module);
}
