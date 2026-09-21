// Progress: which concepts are weakest, calibration, and export/import.

import { useRef, useState } from 'preact/hooks';
import { DRILLS, unlockedModules } from '../drills';
import { weakestDrills, calibrationScore, exportJson, importJson, MODULE_IDS, type ProgressState } from '../srs/store';
import { encodeProgress, decodeProgress, codeLink } from '../srs/code';
import { useProgress, setProgress } from './progress';
import { RestorePrompt } from './RestorePrompt';

export function ProgressView() {
  const progress = useProgress();
  const now = new Date();
  const attempted = DRILLS.filter((d) => progress.drills[d.id]?.attempts);
  const weakest = weakestDrills(progress, attempted.map((d) => d.id), now).slice(0, 8);
  const calibration = calibrationScore(progress);
  const unlocked = unlockedModules(progress);
  const totalAttempts = Object.values(progress.drills).reduce((a, r) => a + r.attempts, 0);
  const totalCorrect = Object.values(progress.drills).reduce((a, r) => a + r.correct, 0);

  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importOk, setImportOk] = useState(false);

  const codeBox = useRef<HTMLTextAreaElement>(null);
  const [code, setCode] = useState('');
  const [codeNote, setCodeNote] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<ProgressState | null>(null);

  const makeCode = async () => {
    setCodeNote(null);
    setCode(await encodeProgress(progress));
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCodeNote(`${what} copied.`);
    } catch {
      codeBox.current?.select();
      setCodeNote('Copying was blocked. The code is selected, so copy it by hand.');
    }
  };

  const checkPasted = async () => {
    setRestoreError(null);
    setIncoming(null);
    try {
      setIncoming(await decodeProgress(pasted));
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : String(e));
    }
  };

  const doExport = () => {
    const blob = new Blob([exportJson(progress)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poker-odds-trainer-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = (file: File) => {
    setImportError(null);
    setImportOk(false);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = importJson(String(reader.result));
        setProgress(next);
        setImportOk(true);
      } catch (e) {
        setImportError(e instanceof Error ? e.message : String(e));
      }
    };
    reader.onerror = () => setImportError('Could not read that file.');
    reader.readAsText(file);
  };

  return (
    <div class="progress-layout">
      <section class="panel">
        <h3>Calibration</h3>
        <p class="calibration-score">{calibration !== null ? `${calibration.toFixed(1)} pts` : '—'}</p>
        <p class="muted">Median absolute error across your last fifty percent-based estimates. It should shrink over time.</p>
        <p class="muted">
          {totalAttempts} attempts overall, {totalAttempts > 0 ? `${Math.round((100 * totalCorrect) / totalAttempts)}%` : '—'} correct.
        </p>
      </section>

      <section class="panel">
        <h3>Weakest concepts</h3>
        {weakest.length === 0 && <p class="muted">No attempts yet. Weak spots show up here once you have some.</p>}
        {weakest.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Drill</th>
                <th>Recent accuracy</th>
                <th>Median time</th>
                <th>Box</th>
              </tr>
            </thead>
            <tbody>
              {weakest.map((w) => (
                <tr key={w.drillId}>
                  <th>{DRILLS.find((d) => d.id === w.drillId)?.title ?? w.drillId}</th>
                  <td>{w.recentAccuracy !== null ? `${Math.round(w.recentAccuracy * 100)}%` : '—'}</td>
                  <td>{w.medianMs !== null ? `${(w.medianMs / 1000).toFixed(1)}s` : '—'}</td>
                  <td>{w.box} of 5</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section class="panel">
        <h3>Modules unlocked</h3>
        <p>{MODULE_IDS.map((m) => (unlocked.includes(m) ? m : `${m} (locked)`)).join(', ')}</p>
        <p class="muted">Module gating is under Settings.</p>
      </section>

      <section class="panel">
        <h3>Progress code</h3>
        <p class="muted">
          Results save after every answer, in this browser only. To carry them to another browser or device, make a code and paste it there. The code is a snapshot, so make a new one after more practice. Anyone with your code can load your progress.
        </p>
        <div class="progress-actions">
          <button type="button" onClick={makeCode}>
            Make code
          </button>
          {code && (
            <>
              <button type="button" onClick={() => copy(code, 'Code')}>
                Copy code
              </button>
              <button type="button" onClick={() => copy(codeLink(code, location.href), 'Link')}>
                Copy link
              </button>
            </>
          )}
        </div>
        {code && <textarea ref={codeBox} class="code-box" readOnly rows={4} value={code} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />}
        {codeNote && <p class="hint">{codeNote}</p>}

        <h4>Restore from a code</h4>
        <textarea
          class="code-box"
          rows={4}
          placeholder="Paste a progress code"
          value={pasted}
          onInput={(e) => {
            setPasted((e.target as HTMLTextAreaElement).value);
            setIncoming(null);
            setRestoreError(null);
          }}
        />
        <div class="progress-actions">
          <button type="button" disabled={pasted.trim() === ''} onClick={checkPasted}>
            Check code
          </button>
        </div>
        {restoreError && <p class="error">{restoreError}</p>}
        {incoming && (
          <RestorePrompt
            incoming={incoming}
            onDone={() => {
              setIncoming(null);
              setPasted('');
            }}
          />
        )}
      </section>

      <section class="panel">
        <h3>Data</h3>
        <p class="muted">A file copy of the same data, for backups. An unfinished question or Timed run is not saved.</p>
        <div class="progress-actions">
          <button type="button" onClick={doExport}>
            Export progress
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            Import progress
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (f) doImport(f);
              (e.target as HTMLInputElement).value = '';
            }}
          />
        </div>
        {importOk && <p class="hint">Import complete.</p>}
        {importError && <p class="error">Import failed: {importError}</p>}
      </section>
    </div>
  );
}
