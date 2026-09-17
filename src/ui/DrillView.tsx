import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { DRILLS, grade, parseAnswer, formatValue, type Difficulty, type DrillInstance, type GradeResult } from '../drills';
import { createRng } from '../engine/rng';
import { CardRow } from './Card';
import { Working, Step } from './Working';

interface DrillStats {
  attempts: number;
  correct: number;
  times: number[];
  errors: number[];
}

type StatsMap = Record<string, DrillStats>;

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

let seedCounter = Date.now() % 1000000;

export function DrillView() {
  const [drillId, setDrillId] = useState(DRILLS[0]!.id);
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [instance, setInstance] = useState<DrillInstance | null>(null);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<GradeResult | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showWorking, setShowWorking] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [stats, setStats] = useState<StatsMap>({});
  const startedAt = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const choicesRef = useRef<HTMLDivElement>(null);

  const drill = useMemo(() => DRILLS.find((d) => d.id === drillId)!, [drillId]);

  const next = () => {
    seedCounter += 1;
    const inst = drill.generate(createRng(seedCounter), difficulty);
    setInstance(inst);
    setInput('');
    setResult(null);
    setTimedOut(false);
    setParseError(null);
    setShowWorking(false);
    setRemaining(inst.prompt.timeLimitSeconds ?? null);
    startedAt.current = performance.now();
    // Move focus off the selects so number keys and Space reach the question.
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
      else choicesRef.current?.querySelector('button')?.focus();
    }, 0);
  };

  useEffect(() => {
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillId, difficulty]);

  const record = (inst: DrillInstance, g: GradeResult | null) => {
    const elapsed = performance.now() - startedAt.current;
    setStats((prev) => {
      const s: DrillStats = prev[inst.prompt.text ? drill.id : drill.id] ?? { attempts: 0, correct: 0, times: [], errors: [] };
      const copy: DrillStats = { ...s, times: [...s.times, elapsed], errors: s.errors.slice() };
      copy.attempts += 1;
      if (g?.correct) copy.correct += 1;
      if (g && inst.unit === 'percent' && Number.isFinite(g.error)) copy.errors.push(g.error);
      return { ...prev, [drill.id]: copy };
    });
  };

  const submit = (value?: number) => {
    if (!instance || result || timedOut) return;
    let v = value;
    if (v === undefined) {
      const parsed = parseAnswer(input, instance.unit);
      if (!parsed) {
        setParseError(
          instance.unit === 'percent'
            ? 'Enter a number, a percentage such as 35%, or odds such as 2 to 1.'
            : instance.unit === 'ratio'
              ? 'Enter odds such as 4, 4:1, 4 to 1, or a percentage such as 20%.'
              : 'Enter a whole number.',
        );
        return;
      }
      v = parsed.value;
    }
    const g = grade(instance, v);
    setResult(g);
    setParseError(null);
    record(instance, g);
  };

  // Countdown.
  useEffect(() => {
    if (!instance || remaining === null || result || timedOut) return;
    if (remaining <= 0) {
      setTimedOut(true);
      record(instance, null);
      return;
    }
    const t = setTimeout(() => setRemaining((r) => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, instance, result, timedOut]);

  // Keyboard: Space for next, w for working, 1/2 for choices.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');
      const answered = result !== null || timedOut;
      if (e.key === ' ' && answered) {
        e.preventDefault();
        next();
      } else if ((e.key === 'w' || e.key === 'W') && !typing) {
        e.preventDefault();
        setShowWorking((s) => !s);
      } else if (instance?.prompt.choices && !answered && !typing) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && idx < instance.prompt.choices.length) {
          e.preventDefault();
          submit(idx);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!instance) return null;
  const p = instance.prompt;
  const answered = result !== null || timedOut;
  const s = stats[drill.id];

  return (
    <div class="drill-layout">
      <section class="drill-main">
        <div class="drill-controls">
          <label>
            Drill
            <select value={drillId} onChange={(e) => setDrillId((e.target as HTMLSelectElement).value)}>
              {DRILLS.map((d, i) => (
                <option value={d.id} key={d.id}>
                  {i + 1}. {d.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(Number((e.target as HTMLSelectElement).value) as Difficulty)}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <span class="drill-module">{drill.module}</span>
        </div>
        <p class="drill-description">{drill.description}</p>

        <div class="prompt">
          {p.heroCards && <CardRow label="You" cards={p.heroCards} />}
          {p.board && <CardRow label="Board" cards={p.board} />}
          {p.villainCards && <CardRow label="Villain" cards={p.villainCards} />}
          {p.facts && (
            <dl class="facts">
              {p.facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <p class="prompt-text">{p.text}</p>
          {remaining !== null && !answered && (
            <div class="timer" aria-live="polite">
              <div class="timer-bar" style={{ width: `${(100 * remaining) / (p.timeLimitSeconds ?? 1)}%` }} />
              <span>{remaining}s</span>
            </div>
          )}
        </div>

        {!answered && p.choices && (
          <div class="choices" ref={choicesRef}>
            {p.choices.map((c, i) => (
              <button type="button" key={c} onClick={() => submit(i)}>
                <kbd>{i + 1}</kbd> {c}
              </button>
            ))}
          </div>
        )}

        {!answered && !p.choices && (
          <form
            class="answer-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label>
              {p.answerLabel ?? 'Answer'}
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                autocomplete="off"
                value={input}
                onInput={(e) => setInput((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
            </label>
            <button type="submit">
              Submit <kbd>Enter</kbd>
            </button>
            {instance.unit === 'percent' && <span class="hint">Percent or odds, e.g. 35 or 2 to 1</span>}
            {instance.unit === 'ratio' && <span class="hint">Odds against, e.g. 4 or 4 to 1, or a percent</span>}
            {parseError && <span class="error">{parseError}</span>}
          </form>
        )}

        {answered && (
          <div class={`result ${result?.correct ? 'ok' : 'miss'}`} aria-live="polite">
            <div class="result-line">
              {timedOut ? 'Time expired.' : result?.correct ? 'Within tolerance.' : 'Outside tolerance.'}
            </div>
            <table class="three-numbers">
              <tbody>
                <tr>
                  <th>Your answer</th>
                  <td>
                    {timedOut || !result
                      ? 'none'
                      : p.choices
                        ? p.choices[result.userValue] ?? String(result.userValue)
                        : formatValue(result.userValue, instance.unit)}
                  </td>
                </tr>
                {instance.shortcutAnswer !== undefined && (
                  <tr>
                    <th>{instance.shortcutName ?? 'Shortcut'}</th>
                    <td>{formatValue(instance.shortcutAnswer, instance.unit)}</td>
                  </tr>
                )}
                <tr>
                  <th>Exact</th>
                  <td>{p.choices ? p.choices[instance.answer] : formatValue(instance.answer, instance.unit)}</td>
                </tr>
                {!p.choices && (
                  <tr>
                    <th>Tolerance</th>
                    <td>&plusmn; {formatValue(instance.tolerance, instance.unit)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <p class="summary">{instance.explanation.summary}</p>
            {instance.explanation.alternate && <p class="alternate">{instance.explanation.alternate}</p>}
            <Working open={showWorking} onToggle={setShowWorking}>
              {instance.explanation.steps.map((st, i) => (
                <Step key={i} {...st} />
              ))}
            </Working>
            <button type="button" class="next" onClick={next}>
              Next <kbd>Space</kbd>
            </button>
          </div>
        )}
      </section>

      <aside class="drill-stats">
        <h3>This session</h3>
        <table>
          <tbody>
            <tr>
              <th>Attempts</th>
              <td>{s?.attempts ?? 0}</td>
            </tr>
            <tr>
              <th>Accuracy</th>
              <td>{s && s.attempts > 0 ? `${Math.round((100 * s.correct) / s.attempts)}%` : '—'}</td>
            </tr>
            <tr>
              <th>Median time</th>
              <td>{s && median(s.times) !== null ? `${(median(s.times)! / 1000).toFixed(1)}s` : '—'}</td>
            </tr>
            <tr>
              <th>Mean signed error</th>
              <td>{s && mean(s.errors) !== null ? `${mean(s.errors)! >= 0 ? '+' : ''}${mean(s.errors)!.toFixed(1)} pts` : '—'}</td>
            </tr>
          </tbody>
        </table>
        <p class="stats-note">Not saved between sessions in this build.</p>
        <h3>All drills</h3>
        <table>
          <tbody>
            {DRILLS.map((d) => {
              const st = stats[d.id];
              return (
                <tr key={d.id} class={d.id === drillId ? 'current' : ''}>
                  <th>{d.title}</th>
                  <td>{st ? `${st.correct}/${st.attempts}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </aside>
    </div>
  );
}
