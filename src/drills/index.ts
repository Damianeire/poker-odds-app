import { type Drill } from './types';
import { MODULE_IDS } from '../srs/store';
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
export * from './fresh';

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

/** Drills in teaching order: by module, then by catalogue order within a module. */
export const TEACHING_ORDER: readonly Drill[] = MODULE_IDS.flatMap((m) => DRILLS.filter((d) => d.module === m));

/** Teaching-order number, 1-based. Differs from the specification's catalogue number. */
export function drillNumber(id: string): number {
  return TEACHING_ORDER.findIndex((d) => d.id === id) + 1;
}

export function drillById(id: string): Drill | undefined {
  return DRILLS.find((d) => d.id === id);
}

export function drillsForModule(module: string): Drill[] {
  return DRILLS.filter((d) => d.module === module);
}
