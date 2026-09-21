import { useEffect, useState } from 'preact/hooks';
import { DrillView } from './DrillView';
import { LearnView } from './LearnView';
import { TimedView } from './TimedView';
import { BankrollView } from './BankrollView';
import { SandboxView } from './SandboxView';
import { TablesView } from './TablesView';
import { ProgressView } from './ProgressView';
import { SettingsView } from './SettingsView';
import { useProgress } from './progress';
import { RestorePrompt } from './RestorePrompt';
import { codeFromHash, decodeProgress } from '../srs/code';
import { type ProgressState } from '../srs/store';

type Tab = 'learn' | 'drill' | 'timed' | 'bankroll' | 'sandbox' | 'tables' | 'progress' | 'settings';

export function App() {
  const [tab, setTab] = useState<Tab>('drill');
  const [jumpDrill, setJumpDrill] = useState<string | null>(null);
  const progress = useProgress();

  useEffect(() => {
    document.body.classList.toggle('four-colour', progress.settings.fourColour);
  }, [progress.settings.fourColour]);

  // A shared link carries a progress code in the hash. Read it once, clear it, and ask before restoring.
  const [linked, setLinked] = useState<ProgressState | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  useEffect(() => {
    const code = codeFromHash(location.hash);
    if (code === null) return;
    history.replaceState(null, '', location.pathname + location.search);
    decodeProgress(code).then(setLinked, (e) => setLinkError(e instanceof Error ? e.message : String(e)));
  }, []);

  const goToDrill = (drillId: string) => {
    setJumpDrill(drillId);
    setTab('drill');
  };

  return (
    <div class="app">
      <header class="topbar">
        <span class="title">Poker Odds Trainer</span>
        <nav>
          {(
            [
              ['learn', 'Learn'],
              ['drill', 'Drill'],
              ['timed', 'Timed'],
              ['bankroll', 'Bankroll'],
              ['sandbox', 'Sandbox'],
              ['tables', 'Tables'],
              ['progress', 'Progress'],
              ['settings', 'Settings'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button type="button" key={id} class={tab === id ? 'active' : ''} onClick={() => {
                setJumpDrill(null);
                setTab(id);
              }}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      {(linked || linkError) && (
        <div class="link-banner panel">
          {linked && <RestorePrompt incoming={linked} onDone={() => setLinked(null)} />}
          {linkError && (
            <>
              <p class="error">The link's progress code did not work: {linkError}</p>
              <div class="progress-actions">
                <button type="button" onClick={() => setLinkError(null)}>
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <main>
        {tab === 'learn' && <LearnView onDrill={goToDrill} />}
        {tab === 'drill' && <DrillView jumpTo={jumpDrill} />}
        {tab === 'timed' && <TimedView />}
        {tab === 'bankroll' && <BankrollView />}
        {tab === 'sandbox' && <SandboxView />}
        {tab === 'tables' && <TablesView />}
        {tab === 'progress' && <ProgressView />}
        {tab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}
