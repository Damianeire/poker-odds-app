import { useEffect, useMemo, useState } from 'preact/hooks';
import { DRILLS, TEACHING_ORDER, drillNumber, generateFresh, questionKey, type Difficulty, type DrillInstance } from '../drills';
import { createRng } from '../engine/rng';
import {
  recordAttempt,
  summarise,
  unlockedModules,
  dueDrills,
  FLUENCY,
  GATING_DRILLS,
  MODULE_IDS,
  LEVEL_PASS,
  levelPassed,
  levelWindow,
  nextUnfinishedDrill,
  suggestedLevel,
  curriculumProgress,
  curriculumOpenLevel,
  setDrillLevel,
  setCurriculumLevel,
  setLastDrill,
  type Level,
} from '../srs/store';
import { applyTimerSetting } from '../drills/timer';
import { PAGES } from '../content';
import { useProgress, updateProgress } from './progress';
import { Question, type QuestionResult } from './Question';

let seedCounter = Date.now() % 1000000;

// The Drill tab unmounts when you visit another tab. Keep the selection and the
// session tally here so coming back resumes the same drill.
const remembered: {
  drillId: string | null;
  difficulty: Difficulty;
  streak: number;
  session: { attempts: number; correct: number };
  lastKey: string | null;
} = {
  drillId: null,
  difficulty: 1,
  streak: 0,
  session: { attempts: 0, correct: 0 },
  lastKey: null,
};

const LEVEL_NOTES: Record<Level, string> = {
  1: 'Level 1: round numbers and clean spots.',
  2: 'Level 2: less round numbers and mixed spots.',
  3: 'Level 3: arbitrary numbers and the hardest spots.',
};

const moduleTitle = (id: string): string => PAGES.find((p) => p.id === id)?.title ?? id;

export function DrillView({ jumpTo }: { jumpTo?: string | null } = {}) {
  const progress = useProgress();
  const now = useMemo(() => new Date(), [progress]);
  const unlocked = unlockedModules(progress);
  const available = TEACHING_ORDER.filter((d) => unlocked.includes(d.module));
  const due = dueDrills(progress, available.map((d) => d.id), now);
  const { progression, drillTimer } = progress.settings;
  const startId = [remembered.drillId, progress.lastDrillId].find((id) => id && available.some((d) => d.id === id));
  const [drillId, setDrillIdState] = useState(startId ?? due[0] ?? available[0]!.id);
  const [freeLevel, setFreeLevel] = useState<Level>(remembered.difficulty);
  const setDrillId = (id: string) => {
    remembered.drillId = id;
    setDrillIdState(id);
    updateProgress((s) => setLastDrill(s, id));
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

  const availableIds = available.map((d) => d.id);
  const openLevel = curriculumOpenLevel(progress, availableIds);
  const difficulty: Level =
    progression === 'free' ? freeLevel : progression === 'curriculum' ? (Math.min(progress.curriculumLevel, openLevel) as Level) : (progress.drillLevel[drill.id] ?? 1);
  const setDifficulty = (d: Level) => {
    if (progression === 'free') {
      remembered.difficulty = d;
      setFreeLevel(d);
    } else if (progression === 'curriculum') updateProgress((s) => setCurriculumLevel(s, d));
    else updateProgress((s) => setDrillLevel(s, drill.id, d));
  };
  const suggestion = progression === 'per-drill' ? suggestedLevel(progress, drill.id, difficulty) : null;
  // Level 3 has no level above it, so once it is passed point at the next drill in
  // teaching order that has not passed level 3 yet.
  const nextDrillId =
    progression !== 'free' && difficulty === 3 && levelPassed(progress, drill.id, 3) ? nextUnfinishedDrill(progress, availableIds, drill.id) : null;
  const nextDrill = available.find((d) => d.id === nextDrillId) ?? null;
  const recentWindow = levelWindow(progress, drill.id, difficulty);
  const passMark = Math.ceil(LEVEL_PASS.attempts * LEVEL_PASS.accuracy);

  const next = () => {
    const fresh = generateFresh(drill, difficulty, () => createRng(++seedCounter), remembered.lastKey);
    remembered.lastKey = questionKey(fresh);
    setInstance(applyTimerSetting(fresh, drillTimer));
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
    updateProgress((s) => recordAttempt(s, { drillId: drill.id, correct: r.correct, ms: r.ms, difficulty, ...(r.error !== null ? { error: r.error } : {}) }, new Date()));
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
                      {progression === 'curriculum' && levelPassed(progress, d.id, difficulty) ? ' (level passed)' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(Number((e.target as HTMLSelectElement).value) as Difficulty)}>
              {([1, 2, 3] as const).map((l) => (
                <option value={l} key={l} disabled={progression === 'curriculum' && l > openLevel}>
                  {l}
                  {progression === 'curriculum' && l > openLevel ? ' (locked)' : ''}
                </option>
              ))}
            </select>
          </label>
          <span class="drill-module">{drill.module}</span>
        </div>
        <p class="drill-description">{drill.description}</p>
        <p class="muted level-note">
          {LEVEL_NOTES[difficulty]}
          {progression === 'curriculum' &&
            ` ${curriculumProgress(progress, availableIds, difficulty)} of ${availableIds.length} drills have passed level ${difficulty}.${openLevel > difficulty ? ` Level ${openLevel} is open.` : ''}`}
        </p>
        {suggestion && (
          <p class="lock-note">
            {LEVEL_PASS.attempts} recent answers at level {difficulty} were {Math.round(LEVEL_PASS.accuracy * 100)}% correct or better. Level {suggestion} is next.{' '}
            <button type="button" class="link" onClick={() => setDifficulty(suggestion)}>
              Go to level {suggestion}
            </button>
          </p>
        )}
        {nextDrill && (
          <p class="lock-note">
            {LEVEL_PASS.attempts} recent answers at level 3 were {Math.round(LEVEL_PASS.accuracy * 100)}% correct or better. This drill is done. Next is {drillNumber(nextDrill.id)}. {nextDrill.title}.{' '}
            <button type="button" class="link" onClick={() => setDrillId(nextDrill.id)}>
              Go to drill {drillNumber(nextDrill.id)}
            </button>
          </p>
        )}
        {locked.length > 0 && (
          <p class="lock-note">
            Modules M2 to M9 unlock when {GATING_DRILLS.map((id) => DRILLS.find((d) => d.id === id)!.title).join(' and ')} are fluent: {FLUENCY.attempts} attempts each, {Math.round(FLUENCY.accuracy * 100)}% recent accuracy, median under {FLUENCY.medianMs / 1000}s. Gating can be turned off under Settings.
          </p>
        )}
        {instance && <Question instance={instance} onResult={onResult} onNext={next} ghostMs={drillTimer === 'off' ? null : summary.medianMs} />}
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
        <h3>Last ten, level {difficulty}</h3>
        <table>
          <tbody>
            <tr>
              <th>Correct</th>
              <td>{recentWindow.count > 0 ? `${recentWindow.correct} of ${recentWindow.count}` : '—'}</td>
            </tr>
            <tr>
              <th>Accuracy</th>
              <td>{recentWindow.count > 0 ? `${Math.round((100 * recentWindow.correct) / recentWindow.count)}%` : '—'}</td>
            </tr>
          </tbody>
        </table>
        {progression !== 'free' && difficulty < 3 && (
          <p class="stats-note">
            {recentWindow.count < LEVEL_PASS.attempts
              ? `${recentWindow.count} of ${LEVEL_PASS.attempts} answered at this level. Need ${passMark} of ${LEVEL_PASS.attempts} to level up.`
              : `Need ${passMark} of ${LEVEL_PASS.attempts} to level up.`}
          </p>
        )}
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
