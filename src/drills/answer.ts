// Parse a typed answer into the drill's unit, accepting percentage or ratio
// forms for probabilities, and grade it against the instance.

import { type DrillInstance, type Unit } from './types';
import { oddsAgainstToPercent, percentToOddsAgainst } from '../engine/shortcuts';

export interface ParsedAnswer {
  value: number;
  /** How the user expressed it. */
  form: 'number' | 'percent' | 'ratio';
}

const RATIO_RE = /^\s*([+-]?\d*\.?\d+)\s*(?:to|:|-|\/)\s*([+-]?\d*\.?\d+)\s*$/i;
const PERCENT_RE = /^\s*([+-]?\d*\.?\d+)\s*%\s*$/;
const NUMBER_RE = /^\s*([+-]?\d*\.?\d+)\s*$/;

/**
 * Parse text into the unit the drill expects. Returns null if unreadable.
 * For percent units, "4 to 1" means 4 : 1 against and converts to 20.
 * For ratio units, "20%" converts to 4 (meaning 4 to 1 against).
 */
export function parseAnswer(text: string, unit: Unit): ParsedAnswer | null {
  const ratio = RATIO_RE.exec(text);
  if (ratio) {
    const against = parseFloat(ratio[1]!);
    const forPart = parseFloat(ratio[2]!);
    if (!(forPart > 0) || against < 0) return null;
    if (unit === 'percent') return { value: oddsAgainstToPercent(against, forPart), form: 'ratio' };
    if (unit === 'ratio') return { value: against / forPart, form: 'ratio' };
    return null;
  }
  const percent = PERCENT_RE.exec(text);
  if (percent) {
    const p = parseFloat(percent[1]!);
    if (unit === 'percent') return { value: p, form: 'percent' };
    if (unit === 'ratio') {
      if (!(p > 0) || p >= 100) return null;
      return { value: percentToOddsAgainst(p), form: 'percent' };
    }
    return null;
  }
  const plain = NUMBER_RE.exec(text);
  if (plain) {
    const v = parseFloat(plain[1]!);
    if (Number.isNaN(v)) return null;
    return { value: v, form: 'number' };
  }
  return null;
}

export interface GradeResult {
  correct: boolean;
  userValue: number;
  answer: number;
  /** userValue - answer, in the answer's unit. */
  error: number;
  shortcutAnswer?: number;
  tolerance: number;
}

export function grade(instance: DrillInstance, userValue: number): GradeResult {
  const error = userValue - instance.answer;
  const result: GradeResult = {
    correct:
      Math.abs(error) <= instance.tolerance + 1e-9 ||
      (instance.alsoAccept ?? []).some((a) => Math.abs(userValue - a) <= instance.tolerance + 1e-9),
    userValue,
    answer: instance.answer,
    error,
    tolerance: instance.tolerance,
  };
  if (instance.shortcutAnswer !== undefined) result.shortcutAnswer = instance.shortcutAnswer;
  return result;
}

/** Display a value in the drill's unit. */
export function formatValue(value: number, unit: Unit): string {
  switch (unit) {
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'ratio':
      return `${value.toFixed(2)} to 1`;
    case 'chips':
      return value.toFixed(value % 1 === 0 ? 0 : 1);
    case 'count':
      return String(Math.round(value));
  }
}
