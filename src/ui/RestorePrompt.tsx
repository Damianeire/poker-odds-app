// Confirmation before a progress code replaces what is saved in this browser.

import { getProgress, setProgress } from './progress';
import { progressSummary, type ProgressState, type ProgressSummary } from '../srs/store';

function describe(s: ProgressSummary): string {
  if (s.attempts === 0) return 'no answers yet';
  const when = s.lastSeen ? `, last answer ${new Date(s.lastSeen).toLocaleDateString()}` : '';
  return `${s.attempts} ${s.attempts === 1 ? 'answer' : 'answers'} across ${s.drillsAttempted} ${s.drillsAttempted === 1 ? 'drill' : 'drills'}${when}`;
}

export function RestorePrompt({ incoming, onDone }: { incoming: ProgressState; onDone: () => void }) {
  const current = progressSummary(getProgress());
  return (
    <div class="restore-prompt">
      <p>
        This browser has {describe(current)}. The code holds {describe(progressSummary(incoming))}. Restoring replaces what is here.
      </p>
      <div class="progress-actions">
        <button
          type="button"
          onClick={() => {
            setProgress(incoming);
            onDone();
          }}
        >
          Restore from code
        </button>
        <button type="button" onClick={onDone}>
          Keep what is here
        </button>
      </div>
    </div>
  );
}
