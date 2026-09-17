// Learn content as structured data. Every number is produced by a function
// that calls the engine when the page renders. No figure is a literal.

import { type ModuleId } from '../drills/types';

export interface TableData {
  head: string[];
  rows: string[][];
}

export type Block =
  | { kind: 'h'; text: string }
  | { kind: 'p'; text: () => string }
  | { kind: 'formula'; label: string; formula: string; value?: () => string }
  | { kind: 'table'; caption: string; build: () => TableData; slow?: boolean }
  | { kind: 'example'; hero?: string; board?: string; villain?: string; text: () => string }
  | { kind: 'terms'; items: { term: string; definition: () => string }[] };

export interface LearnPage {
  id: ModuleId;
  title: string;
  /** One sentence. */
  summary: string;
  blocks: Block[];
  /** Drill ids that belong to this module. */
  drills: string[];
}
