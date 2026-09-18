import { useEffect, useMemo, useState } from 'preact/hooks';
import { DRILLS, TEACHING_ORDER, drillNumber, type Difficulty, type DrillInstance } from '../drills';
import { createRng } from '../engine/rng';
import { recordAttempt, summarise, unlockedModules, dueDrills, FLUENCY, GATING_DRILLS, MODULE_IDS } from '../srs/store';
import { PAGES } from '../content';
import { useProgress, updateProgress } from './progress';
import { Question, type QuestionResult } from './Question';

let seedCounter = Date.now() % 1000000;

// The Drill tab unmounts when you visit another tab. Keep the selection and the
// session tally here so coming back resumes the same drill.
const remembered: { drillId: string | null; difficulty: Difficulty; streak: number; session: { attempts: number; correct: number } } = {
  drillId: null,
  difficulty: 1,
  streak: 0,
  session: { attempts: 0, correct: 0 },
};

const moduleTitle = (id: string): string => PAGES.find((p) => p.id === id)?.title ?? id;

export function DrillView({ jumpTo }: { jumpTo?: string | null } = {}) {
  const progress = useProgress();
  const now = useMemo(() => new Date(), [progress]);
  const unlocked = unlockedModules(progress);
  const available = TEACHING_ORDER.filter((d) => unlocked.includes(d.module));
  const due = dueDrills(progress, available.map((d) => d.id), now);
  const [drillId, setDrillIdState] = useState(
    remembered.drillId && available.some((d) => d.id === remembered.drillId) ? remembered.drillId : (due[0] ?? available[0]!.id),
  );
  const [difficulty, setDifficultyState] = useState<Difficulty>(remembered.difficulty);
  const setDrillId = (id: string) => {
    remembered.drillId = id;
    setDrillIdState(id);
  };
  const setDifficulty = (d: Difficulty) => {
    remembered.difficulty = d;
    setDifficultyState(d);
  };

  useEffect(() => {
    if (jumpTo && available.some((d) => d.id === jumpTo)) setDrillId(jumpTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo]);
  const [instance, setInstance] = useState<DrillInstance | null>(null);
  const [streak, setStreakState] = useState(remembered.streak);
  const [session, setSessionState] = useState(remembered.session);

  const drill = useMemo(() => available.find((d) => d.id === drillId) ?? available[0]!, [drillId, available]);
  const summary = summarise(progress, drill.id, now);

  const next = () => {
    seedCounter += 1;
    setInstance(drill.generate(createRng(seedCounter), difficulty));
  };

  useEffect(() => {
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill.id, difficulty]);

  const onResult = (r: QuestionResult) => {
    remembered.streak = r.correct ? remembered.streak + 1 : 0;
    remembered.session = { attempts: remembered.session.attempts + 1, correct: remembered.session.correct + (r.correct ? 1 : 0) };
    setStreakState(remembered.streak);
    setSessionState(remembered.session);
    updateProgress((s) => recordAttempt(s, { drillId: drill.id, correct: r.correct, ms: r.ms, ...(r.error !== null ? { error: r.error } : {}) }, new Date()));
  };

  const locked = MODULE_IDS.filter((m) => !unlocked.includes(m));

  return (
    <div class="drill-layout">
      <section class="drill-main">
        <div class="drill-controls">
          <label>
            Drill
            <select value={drill.id} onChange={(e) => setDrillId((e.target as HTMLSelectElement).value)}>
              {MODULE_IDS.map((m) => (
                <optgroup key={m} label={`${m}. ${moduleTitle(m)}${unlocked.includes(m) ? '' : ' (locked)'}`}>
                  {TEACHING_ORDER.filter((d) => d.module === m).map((d) => (
                    <option value={d.id} key={d.id} disabled={!unlocked.includes(m)}>
                      {drillNumber(d.id)}. {d.title}
                      {due.includes(d.id) ? ' (due)' : ''}
                    </option>
                  ))}
                </optgroup>
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
        {locked.length > 0 && (
          <p class="lock-note">
            Modules M2 to M9 unlock when {GATING_DRILLS.map((id) => DRILLS.find((d) => d.id === id)!.title).join(' and ')} are fluent: {FLUENCY.attempts} attempts each, {Math.round(FLUENCY.accuracy * 100)}% recent accuracy, median under {FLUENCY.medianMs / 1000}s. Gating can be turned off under Progress.
          </p>
        )}
        {instance && <Question instance={instance} onResult={onResult} onNext={next} ghostMs={summary.medianMs} />}
      </section>

      <aside class="drill-stats">
        <h3>This session</h3>
        <table>
          <tbody>
            <tr>
              <th>Streak</th>
              <td>{streak}</td>
            </tr>
            <tr>
              <th>Attempts</th>
              <td>{session.attempts}</td>
            </tr>
            <tr>
              <th>Accuracy</th>
              <td>{session.attempts > 0 ? `${Math.round((100 * session.correct) / session.attempts)}%` : '—'}</td>
            </tr>
          </tbody>
        </table>
        <h3>This drill, all time</h3>
        <table>
          <tbody>
            <tr>
              <th>Attempts</th>
              <td>{summary.attempts}</td>
            </tr>
            <tr>
              <th>Recent accuracy</th>
              <td>{summary.recentAccuracy !== null ? `${Math.round(summary.recentAccuracy * 100)}%` : '—'}</td>
            </tr>
            <tr>
              <th>Median time</th>
              <td>{summary.medianMs !== null ? `${(summary.medianMs / 1000).toFixed(1)}s` : '—'}</td>
            </tr>
            <tr>
              <th>Bias</th>
              <td>{summary.bias !== null ? `${summary.bias >= 0 ? '+' : ''}${summary.bias.toFixed(1)} pts` : '—'}</td>
            </tr>
            <tr>
              <th>Box</th>
              <td>{summary.box} of 5</td>
            </tr>
          </tbody>
        </table>
        <h3>Due now</h3>
        {due.length === 0 ? (
          <p class="muted">Nothing due.</p>
        ) : (
          <ul class="due-list">
            {due.slice(0, 8).map((id) => (
              <li key={id}>
                <button type="button" class="link" onClick={() => setDrillId(id)}>
                  {DRILLS.find((d) => d.id === id)!.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
