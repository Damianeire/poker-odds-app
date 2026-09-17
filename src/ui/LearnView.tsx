import { useEffect, useState } from 'preact/hooks';
import { PAGES, GLOSSARY, type Block, type TableData } from '../content';
import { DRILLS } from '../drills';
import { parseCards } from '../engine/cards';
import { unlockedModules, GATING_DRILLS } from '../srs/store';
import { useProgress } from './progress';
import { CardRow } from './Card';

function SlowTable({ build }: { build: () => TableData }) {
  const [data, setData] = useState<TableData | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setData(build()), 30);
    return () => clearTimeout(t);
  }, [build]);
  if (!data) return <p class="muted">Enumerating every board for each matchup...</p>;
  return <DataTable data={data} />;
}

function DataTable({ data }: { data: TableData }) {
  return (
    <table>
      <thead>
        <tr>
          {data.head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (j === 0 ? <th key={j}>{c}</th> : <td key={j}>{c}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'h':
      return <h3>{block.text}</h3>;
    case 'p':
      return <p>{block.text()}</p>;
    case 'formula':
      return (
        <div class="formula">
          <div class="formula-label">{block.label}</div>
          <code>{block.formula}</code>
          {block.value && <div class="formula-value">{block.value()}</div>}
        </div>
      );
    case 'table':
      return (
        <figure class="learn-table">
          <figcaption>{block.caption}</figcaption>
          {block.slow ? <SlowTable build={block.build} /> : <DataTable data={block.build()} />}
        </figure>
      );
    case 'example':
      return (
        <div class="example">
          {block.hero && <CardRow label="You" cards={parseCards(block.hero)} />}
          {block.board && <CardRow label="Board" cards={parseCards(block.board)} />}
          {block.villain && <CardRow label="Villain" cards={parseCards(block.villain)} />}
          <p>{block.text()}</p>
        </div>
      );
    case 'terms':
      return (
        <dl class="terms">
          {block.items.map((it) => (
            <div key={it.term}>
              <dt>{it.term}</dt>
              <dd>{it.definition()}</dd>
            </div>
          ))}
        </dl>
      );
  }
}

export function LearnView({ onDrill }: { onDrill: (drillId: string) => void }) {
  const progress = useProgress();
  const unlocked = unlockedModules(progress);
  const [pageId, setPageId] = useState<string>('M1');
  const page = PAGES.find((p) => p.id === pageId);
  const pageUnlocked = page ? unlocked.includes(page.id) : true;
  return (
    <div class="learn-layout">
      <nav class="learn-nav">
        {PAGES.map((p) => (
          <button type="button" key={p.id} class={p.id === pageId ? 'active' : ''} onClick={() => setPageId(p.id)}>
            <span class="mod">{p.id}</span> {p.title}
            {!unlocked.includes(p.id) && <span class="muted"> (locked)</span>}
          </button>
        ))}
        <button type="button" class={pageId === 'glossary' ? 'active' : ''} onClick={() => setPageId('glossary')}>
          <span class="mod">G</span> Glossary
        </button>
      </nav>
      <article class="learn-page">
        {page && (
          <>
            <h2>
              {page.id}. {page.title}
            </h2>
            <p class="summary-line">{page.summary}</p>
            {page.blocks.map((b, i) => (
              <BlockView key={`${page.id}-${i}`} block={b} />
            ))}
            <div class="page-drills">
              <h3>Drills for this module</h3>
              {!pageUnlocked && (
                <p class="lock-note">
                  Locked until {GATING_DRILLS.map((id) => DRILLS.find((d) => d.id === id)!.title).join(' and ')} are fluent.
                  Gating can be turned off under Progress.
                </p>
              )}
              <ul>
                {page.drills.map((id) => {
                  const d = DRILLS.find((x) => x.id === id)!;
                  return (
                    <li key={id}>
                      {pageUnlocked ? (
                        <button type="button" class="link" onClick={() => onDrill(id)}>
                          {d.title}
                        </button>
                      ) : (
                        <span class="locked-label">{d.title}</span>
                      )}
                      <span class="muted"> {d.description}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
        {pageId === 'glossary' && (
          <>
            <h2>Glossary</h2>
            <dl class="terms">
              {GLOSSARY.map((g) => (
                <div key={g.term}>
                  <dt>
                    {g.term}
                    {g.module && (
                      <button type="button" class="link small" onClick={() => setPageId(g.module!)}>
                        {g.module}
                      </button>
                    )}
                  </dt>
                  <dd>{g.definition()}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </article>
    </div>
  );
}
