// Timed Mode: twenty questions drawn across unlocked modules, scored on
// accuracy and median response time, with a session history.

import { useRef, useState } from 'preact/hooks';
import { TEACHING_ORDER, generateFresh, unlockedModules, seen, type Seen, type Drill, type DrillInstance } from '../drills';
import { createRng } from '../engine/rng';
import { timedSequence, TIMED_QUESTIONS } from '../srs/timed';
import { addTimedSession, median } from '../srs/store';
import { useProgress, updateProgress } from './progress';
import { Question, type QuestionResult } from './Question';

let seedCounter = (Date.now() % 1000000) + 500000;

export function TimedView() {
  const progress = useProgress();
  const unlocked = unlockedModules(progress);
  const available = TEACHING_ORDER.filter((d) => unlocked.includes(d.module));

  const [sequence, setSequence] = useState<Drill[]>([]);
  const [index, setIndex] = useState(0);
  const [instance, setInstance] = useState<DrillInstance | null>(null);
  const [done, setDone] = useState(false);
  const results = useRef<QuestionResult[]>([]);
  const lastSeen = useRef<Seen | null>(null);

  const draw = (drill: Drill): DrillInstance => {
    const fresh = generateFresh(drill, 2, () => createRng(++seedCounter), lastSeen.current);
    lastSeen.current = seen(fresh);
    return fresh;
  };

  const running = sequence.length > 0 && !done;

  const start = () => {
    results.current = [];
    lastSeen.current = null;
    seedCounter += 1;
    const seq = timedSequence(createRng(seedCounter), available);
    setSequence(seq);
    setIndex(0);
    setDone(false);
    setInstance(draw(seq[0]!));
  };

  const onResult = (r: QuestionResult) => {
    results.current = [...results.current, r];
  };

  const onNext = () => {
    const nextIndex = index + 1;
    if (nextIndex >= sequence.length) {
      const correct = results.current.filter((r) => r.correct).length;
      const medianMs = median(results.current.map((r) => r.ms)) ?? 0;
      updateProgress((s) => addTimedSession(s, { at: new Date().toISOString(), questions: sequence.length, correct, medianMs }));
      setDone(true);
      return;
    }
    setIndex(nextIndex);
    setInstance(draw(sequence[nextIndex]!));
  };

  const history = progress.timed.slice().reverse().slice(0, 10);

  return (
    <div class="timed-layout">
      {!running && (
        <section class="timed-start">
          <p>
            {TIMED_QUESTIONS} questions drawn at random from every unlocked module. Scored on accuracy and median response
            time, not on box progression.
          </p>
          <button type="button" onClick={start} disabled={available.length === 0}>
            {done ? 'Run again' : 'Start'}
          </button>
          {done && (
            <p class="summary">
              {results.current.filter((r) => r.correct).length} of {results.current.length} correct, median{' '}
              {((median(results.current.map((r) => r.ms)) ?? 0) / 1000).toFixed(1)}s.
            </p>
          )}
          {history.length > 0 && (
            <>
              <h3>Recent sessions</h3>
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Score</th>
                    <th>Median</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s, i) => (
                    <tr key={i}>
                      <td>{new Date(s.at).toLocaleString()}</td>
                      <td>
                        {s.correct} / {s.questions}
                      </td>
                      <td>{(s.medianMs / 1000).toFixed(1)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}
      {running && instance && (
        <section class="timed-run">
          <p class="timed-progress">
            Question {index + 1} of {sequence.length}
          </p>
          <Question key={index} instance={instance} onResult={onResult} onNext={onNext} compact />
        </section>
      )}
    </div>
  );
}
