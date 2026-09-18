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

type Tab = 'learn' | 'drill' | 'timed' | 'bankroll' | 'sandbox' | 'tables' | 'progress' | 'settings';

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
