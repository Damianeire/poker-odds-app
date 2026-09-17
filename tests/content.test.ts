import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAGES, GLOSSARY } from '../src/content';
import { DRILLS } from '../src/drills';

describe('learn content', () => {
  it('has nine pages in module order, each renderable', () => {
    expect(PAGES.map((p) => p.id)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9']);
    for (const page of PAGES) {
      for (const block of page.blocks) {
        if (block.kind === 'p') expect(block.text().length).toBeGreaterThan(20);
        if (block.kind === 'formula' && block.value) expect(block.value().length).toBeGreaterThan(0);
        if (block.kind === 'table') {
          const t = block.build();
          expect(t.rows.length).toBeGreaterThan(0);
          for (const r of t.rows) expect(r.length).toBe(t.head.length);
        }
        if (block.kind === 'example') expect(block.text().length).toBeGreaterThan(10);
        if (block.kind === 'terms') for (const item of block.items) expect(item.definition().length).toBeGreaterThan(10);
      }
    }
  }, 60000);

  it('every drill is referenced by exactly one page, matching its module', () => {
    const seen = new Map<string, string>();
    for (const page of PAGES) for (const id of page.drills) {
      expect(seen.has(id), `${id} listed twice`).toBe(false);
      seen.set(id, page.id);
    }
    for (const d of DRILLS) {
      expect(seen.get(d.id), `${d.id} not in any page`).toBe(d.module);
    }
  });

  it('glossary covers the specified terms and renders', () => {
    const required = ['Backdoor draw', 'Blocker', 'Board', 'Combo', 'Dominated', 'Equity', 'Effective stacks', 'Fold equity', 'Gutshot', 'Hole cards', 'Implied odds', 'Nuts', 'Open-ended straight draw', 'Out', 'Overcard', 'Pot odds', 'Position', 'Range', 'Reverse implied odds', 'Semi-bluff', 'Set', 'Set mining', 'Street', 'Tainted out', 'Value bet'];
    const terms = GLOSSARY.map((g) => g.term);
    for (const t of required) expect(terms).toContain(t);
    for (const g of GLOSSARY) expect(g.definition().length).toBeGreaterThan(5);
  });

  it('content source contains no literal percentages or odds', () => {
    const dir = join(__dirname, '..', 'src', 'content');
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts')) continue;
      const src = readFileSync(join(dir, file), 'utf8');
      // A digit immediately followed by % in source would be a hardcoded figure.
      expect(/\d(\.\d+)?%/.test(src), `${file} has a literal percentage`).toBe(false);
      expect(/\d+(\.\d+)? to 1/.test(src), `${file} has a literal odds ratio`).toBe(false);
    }
  });
});
