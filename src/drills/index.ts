import { type Drill } from './types';
import { countOuts } from './countOuts';
import { outsToPercentOneCard, outsToPercentTwoCards } from './outsToPercent';
import { percentRatio } from './percentRatio';
import { ruleOf2And4 } from './ruleOf2And4';
import { spotTheError } from './spotTheError';
import { breakEvenEquity } from './breakEven';
import { callOrFold } from './callOrFold';

export * from './types';
export * from './answer';

/** Phase 1 drills, in teaching order. */
export const DRILLS: readonly Drill[] = [
  countOuts,
  outsToPercentOneCard,
  outsToPercentTwoCards,
  percentRatio,
  ruleOf2And4,
  spotTheError,
  breakEvenEquity,
  callOrFold,
];

export function drillById(id: string): Drill | undefined {
  return DRILLS.find((d) => d.id === id);
}
