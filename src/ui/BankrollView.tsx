// EV Bankroll mode: a stream of decisions scored by expected value, not
// outcome. The stack moves by the EV gained or surrendered on every choice.

import { useEffect, useRef, useState } from 'preact/hooks';
import { createRng } from '../engine/rng';
import { generateDecision, scoreChoice, bb100, STARTING_STACK, type Decision } from '../game/bankroll';
import { addBankrollSession } from '../srs/store';
import { num } from '../drills/types';
import { useProgress, updateProgress } from './progress';
import { CardRow } from './Card';
import { Working, Step } from './Working';

let seedCounter = (Date.now() % 1000000) + 900000;

const SESSION_LENGTH = 20;

function bbFmt(x: number): string {
  return `${x >= 0 ? '+' : ''}${num(x, 2)} bb`;
}

export function BankrollView() {
  const progress = useProgress();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [stack, setStack] = useState(STARTING_STACK);
  const [decisionNum, setDecisionNum] = useState(0);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [delta, setDelta] = useState(0);
  const totalDelta = useRef(0);
  const streak = useRef(0);
  const [correctCount, setCorrectCount] = useState(0);
  const finalSummary = useRef<{ bb100: number; stack: number } | null>(null);

  const start = () => {
    setStack(STARTING_STACK);
    setDecisionNum(0);
    setCorrectCount(0);
    totalDelta.current = 0;
    streak.current = 0;
    setDone(false);
    setRunning(true);
    setChosen(null);
    seedCounter += 1;
    setDecision(generateDecision(createRng(seedCounter)));
  };

  const choose = (i: number) => {
    if (!decision || chosen !== null) return;
    const scored = scoreChoice(decision, i);
    setChosen(i);
    setDelta(scored.delta);
    setStack((s) => s + scored.delta);
    totalDelta.current += scored.delta;
    if (scored.correct) {
      streak.current += 1;
      setCorrectCount((c) => c + 1);
    } else {
      streak.current = 0;
    }
  };

  const next = () => {
    const n = decisionNum + 1;
    if (n >= SESSION_LENGTH) {
      const summary = { bb100: bb100(totalDelta.current, SESSION_LENGTH), stack };
      finalSummary.current = summary;
      updateProgress((s) => addBankrollSession(s, { at: new Date().toISOString(), decisions: SESSION_LENGTH, bb100: summary.bb100, finalStack: summary.stack }));
      setDone(true);
      setRunning(false);
      return;
    }
    setDecisionNum(n);
    setChosen(null);
    seedCounter += 1;
    setDecision(generateDecision(createRng(seedCounter)));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');
      if (typing || !running) return;
      if (e.key === ' ' && chosen !== null) {
        e.preventDefault();
        next();
      } else if (decision && chosen === null) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && idx < decision.options.length) {
          e.preventDefault();
          choose(idx);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const history = progress.bankroll.slice().reverse().slice(0, 10);

  return (
    <div class="bankroll-layout">
      {!running && (
        <section class="bankroll-start">
          <p>
            A session of {SESSION_LENGTH} decisions starting from a {STARTING_STACK} bb stack. Choosing the best line moves
            the stack up by the EV gained over the next best option; choosing worse moves it down by the EV surrendered. The
            stack tracks decision quality, not the luck of any single hand.
          </p>
          <button type="button" onClick={start}>
            {done ? 'Run again' : 'Start session'}
          </button>
          {done && finalSummary.current && (
            <p class="summary">
              Final stack {num(finalSummary.current.stack, 1)} bb, {correctCount} of {SESSION_LENGTH} best lines chosen,{' '}
              {bbFmt(finalSummary.current.bb100)} per 100 decisions.
            </p>
          )}
          {history.length > 0 && (
            <>
              <h3>Recent sessions</h3>
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>bb/100</th>
                    <th>Final stack</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s, i) => (
                    <tr key={i}>
                      <td>{new Date(s.at).toLocaleString()}</td>
                      <td>{bbFmt(s.bb100)}</td>
                      <td>{num(s.finalStack, 1)} bb</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}

      {running && decision && (
        <section class="bankroll-run">
          <div class="bankroll-header">
            <span>
              Decision {decisionNum + 1} of {SESSION_LENGTH}
            </span>
            <span class="bankroll-stack">Stack {num(stack, 2)} bb</span>
            <span class="muted">Streak {streak.current}</span>
          </div>
          <div class="prompt">
            {decision.prompt.heroCards && <CardRow label="You" cards={decision.prompt.heroCards} />}
            {decision.prompt.board && <CardRow label="Board" cards={decision.prompt.board} />}
            {decision.prompt.facts && (
              <dl class="facts">
                {decision.prompt.facts.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p class="prompt-text">{decision.prompt.text}</p>

            {chosen === null && (
              <div class="choices">
                {decision.options.map((o, i) => (
                  <button type="button" key={o.label} onClick={() => choose(i)}>
                    <kbd>{i + 1}</kbd> {o.label}
                  </button>
                ))}
              </div>
            )}

            {chosen !== null && (
              <div class={`result ${chosen === decision.bestIndex ? 'ok' : 'miss'}`} aria-live="polite">
                <div class="result-line">
                  {chosen === decision.bestIndex ? 'Best line.' : `Not the best line. Stack ${bbFmt(delta)}.`}
                </div>
                <table class="three-numbers">
                  <tbody>
                    <tr>
                      <th>Chosen</th>
                      <td>
                        {decision.options[chosen]!.label} ({num(decision.options[chosen]!.ev, 2)} bb)
                      </td>
                    </tr>
                    <tr>
                      <th>Best</th>
                      <td>
                        {decision.options[decision.bestIndex]!.label} ({num(decision.options[decision.bestIndex]!.ev, 2)} bb)
                      </td>
                    </tr>
                    <tr>
                      <th>Stack change</th>
                      <td>{bbFmt(delta)}</td>
                    </tr>
                  </tbody>
                </table>
                <p class="summary">{decision.explanation.summary}</p>
                <Working>
                  {decision.explanation.steps.map((st, i) => (
                    <Step key={i} {...st} />
                  ))}
                </Working>
                <button type="button" class="next" onClick={next}>
                  Next <kbd>Space</kbd>
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
