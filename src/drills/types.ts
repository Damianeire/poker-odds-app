// Shared drill interface. Every drill module implements Drill.

import { type Card } from '../engine/cards';
import { type Rng } from '../engine/rng';

export type ModuleId = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9';

export type Difficulty = 1 | 2 | 3;

export type Unit = 'percent' | 'ratio' | 'chips' | 'count';

export interface Fact {
  label: string;
  value: string;
}

export interface PromptSpec {
  /** The question, plain text. */
  text: string;
  heroCards?: Card[];
  board?: Card[];
  villainCards?: Card[];
  /** Named figures given to the user (pot, bet, outs...). */
  facts?: Fact[];
  /** If present, the answer is the index of the chosen option. */
  choices?: string[];
  /** Countdown; the UI submits a miss when it expires. */
  timeLimitSeconds?: number;
  /** Label for the answer field, e.g. "Outs" or "Percent". */
  answerLabel?: string;
}

export interface ExplanationStep {
  text: string;
  formula?: string;
  result?: string;
}

export interface ExplanationSpec {
  steps: ExplanationStep[];
  /** One-line conclusion. */
  summary: string;
  /** For probability answers: the same figure in the other representation. */
  alternate?: string;
}

export interface DrillInstance {
  prompt: PromptSpec;
  /** Exact value from the engine. */
  answer: number;
  unit: Unit;
  /** Absolute, in the answer's unit. */
  tolerance: number;
  /** What the taught shortcut would give, if one applies. */
  shortcutAnswer?: number;
  shortcutName?: string;
  explanation: ExplanationSpec;
}

export interface Drill {
  id: string;
  module: ModuleId;
  title: string;
  /** One or two plain sentences. */
  description: string;
  generate(rng: Rng, difficulty: Difficulty): DrillInstance;
}

/** Tolerance wide enough that a correct application of the shortcut always passes. */
export function toleranceForShortcut(errors: readonly number[], floor = 1): number {
  const worst = errors.reduce((m, e) => Math.max(m, Math.abs(e)), 0);
  return Math.max(floor, worst + 0.25);
}

export function pct(fraction: number, places = 1): string {
  return `${(fraction * 100).toFixed(places)}%`;
}

export function num(x: number, places = 1): string {
  return x.toFixed(places).replace(/\.?0+$/, '');
}
