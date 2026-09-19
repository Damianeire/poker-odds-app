// One drill question: prompt, answer entry, grading, the three numbers, working.
// Shared by the drill view and timed mode.

import { useEffect, useRef, useState } from 'preact/hooks';
import { grade, parseAnswer, formatValue, type DrillInstance, type GradeResult } from '../drills';
import { CardRow } from './Card';
import { Working, Step } from './Working';

export interface QuestionResult {
  correct: boolean;
  timedOut: boolean;
  ms: number;
  /** Signed error in the answer's unit, or null. */
  error: number | null;
}

interface Props {
  instance: DrillInstance;
  onResult: (r: QuestionResult) => void;
  onNext: () => void;
  /** Your own median time for this drill, shown as a ghost bar. */
  ghostMs?: number | null;
  /** Hide the working and next controls, for timed mode. */
  compact?: boolean;
}

export function Question({ instance, onResult, onNext, ghostMs, compact }: Props) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<GradeResult | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showWorking, setShowWorking] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(instance.prompt.timeLimitSeconds ?? null);
  const [ghost, setGhost] = useState(1);
  const startedAt = useRef(performance.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const choicesRef = useRef<HTMLDivElement>(null);
  const reported = useRef(false);

  const p = instance.prompt;
  // Multiple choice and zero-tolerance drills have one right answer, so tolerance wording is noise.
  const exact = !!p.choices || instance.tolerance === 0;
  const answered = result !== null || timedOut;

  // Reset on a new instance.
  useEffect(() => {
    setInput('');
    setResult(null);
    setTimedOut(false);
    setParseError(null);
    setShowWorking(false);
    setRemaining(instance.prompt.timeLimitSeconds ?? null);
    setGhost(1);
    startedAt.current = performance.now();
    reported.current = false;
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
      else choicesRef.current?.querySelector('button')?.focus();
    }, 0);
  }, [instance]);

  const finish = (g: GradeResult | null) => {
    if (reported.current) return;
    reported.current = true;
    const ms = performance.now() - startedAt.current;
    if (g) {
      setResult(g);
      onResult({ correct: g.correct, timedOut: false, ms, error: instance.unit === 'percent' && !p.choices ? g.error : null });
    } else {
      setTimedOut(true);
      onResult({ correct: false, timedOut: true, ms, error: null });
    }
  };

  const submit = (value?: number) => {
    if (answered) return;
    let v = value;
    if (v === undefined) {
      const parsed = parseAnswer(input, instance.unit);
      if (!parsed) {
        setParseError(
          instance.unit === 'percent'
            ? 'Enter a number, a percentage such as 35%, or odds such as 2 to 1.'
            : instance.unit === 'ratio'
              ? 'Enter odds such as 4, 4:1, 4 to 1, or a percentage such as 20%.'
              : 'Enter a number.',
        );
        return;
      }
      v = parsed.value;
    }
    setParseError(null);
    finish(grade(instance, v));
  };

  // Countdown.
  useEffect(() => {
    if (remaining === null || answered) return;
    if (remaining <= 0) {
      finish(null);
      return;
    }
    const t = setTimeout(() => setRemaining((r) => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, answered]);

  // Ghost bar: your own median time, counting down.
  useEffect(() => {
    if (!ghostMs || answered) return;
    const id = setInterval(() => {
      const frac = 1 - (performance.now() - startedAt.current) / ghostMs;
      setGhost(Math.max(0, frac));
    }, 100);
    return () => clearInterval(id);
  }, [ghostMs, answered, instance]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');
      if (e.key === ' ' && answered) {
        e.preventDefault();
        onNext();
      } else if ((e.key === 'w' || e.key === 'W') && !typing && !compact) {
        e.preventDefault();
        setShowWorking((s) => !s);
      } else if (p.choices && !answered && !typing) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && idx < p.choices.length) {
          e.preventDefault();
          submit(idx);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <div class="question">
      <div class="prompt">
        {p.heroCards && <CardRow label="You" cards={p.heroCards} />}
        {p.board && <CardRow label="Board" cards={p.board} />}
        {p.villainCards && <CardRow label={p.villainCards.length > 2 ? 'Others' : 'Villain'} cards={p.villainCards} />}
        {p.handRows && p.handRows.map((r) => <CardRow key={r.label} label={r.label} cards={r.cards} />)}
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
        {ghostMs && !answered && (
          <div class="ghost" title="Your median time for this drill">
            <div class="ghost-bar" style={{ width: `${ghost * 100}%` }} />
            <span>ghost {(ghostMs / 1000).toFixed(1)}s</span>
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

      {!answered && p.hint && <p class="hint method-hint">{p.hint}</p>}

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
          <div class="result-line">{timedOut ? 'Time expired.' : result?.correct ? (exact ? 'Correct.' : 'Within tolerance.') : exact ? 'Incorrect.' : 'Outside tolerance.'}</div>
          <table class="three-numbers">
            <tbody>
              <tr>
                <th>Your answer</th>
                <td>{timedOut || !result ? 'none' : p.choices ? (p.choices[result.userValue] ?? String(result.userValue)) : formatValue(result.userValue, instance.unit)}</td>
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
              {!exact && (
                <tr>
                  <th>Tolerance</th>
                  <td>&plusmn; {formatValue(instance.tolerance, instance.unit)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <p class="summary">{instance.explanation.summary}</p>
          {instance.explanation.alternate && <p class="alternate">{instance.explanation.alternate}</p>}
          {!compact && (
            <Working open={showWorking} onToggle={setShowWorking}>
              {instance.explanation.steps.map((st, i) => (
                <Step key={i} {...st} />
              ))}
            </Working>
          )}
          <button type="button" class="next" onClick={onNext}>
            Next <kbd>Space</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
