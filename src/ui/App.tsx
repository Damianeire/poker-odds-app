import { useEffect, useState } from 'preact/hooks';
import { DrillView } from './DrillView';
import { LearnView } from './LearnView';
import { TimedView } from './TimedView';
import { BankrollView } from './BankrollView';
import { SandboxView } from './SandboxView';
import { TablesView } from './TablesView';
import { ProgressView } from './ProgressView';
import { useProgress, updateProgress } from './progress';
import { updateSettings } from '../srs/store';

type Tab = 'learn' | 'drill' | 'timed' | 'bankroll' | 'sandbox' | 'tables' | 'progress';

export function App() {
  const [tab, setTab] = useState<Tab>('drill');
  const [jumpDrill, setJumpDrill] = useState<string | null>(null);
  const progress = useProgress();

  useEffect(() => {
    document.body.classList.toggle('four-colour', progress.settings.fourColour);
  }, [progress.settings.fourColour]);

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
        <label class="toggle">
          <input
            type="checkbox"
            checked={progress.settings.fourColour}
            onChange={(e) =>
              updateProgress((s) => updateSettings(s, { fourColour: (e.target as HTMLInputElement).checked }))
            }
          />
          Four-colour deck
        </label>
      </header>
      <main>
        {tab === 'learn' && <LearnView onDrill={goToDrill} />}
        {tab === 'drill' && <DrillView jumpTo={jumpDrill} />}
        {tab === 'timed' && <TimedView />}
        {tab === 'bankroll' && <BankrollView />}
        {tab === 'sandbox' && <SandboxView />}
        {tab === 'tables' && <TablesView />}
        {tab === 'progress' && <ProgressView />}
      </main>
    </div>
  );
}
