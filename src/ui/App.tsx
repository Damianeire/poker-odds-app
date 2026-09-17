import { useEffect, useState } from 'preact/hooks';
import { DrillView } from './DrillView';
import { SandboxView } from './SandboxView';
import { TablesView } from './TablesView';
import { loadSettings, saveSettings, type Settings } from './settings';

type Tab = 'drill' | 'sandbox' | 'tables';

export function App() {
  const [tab, setTab] = useState<Tab>('drill');
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  useEffect(() => {
    document.body.classList.toggle('four-colour', settings.fourColour);
    saveSettings(settings);
  }, [settings]);

  return (
    <div class="app">
      <header class="topbar">
        <span class="title">Poker Odds Trainer</span>
        <nav>
          {(
            [
              ['drill', 'Drill'],
              ['sandbox', 'Sandbox'],
              ['tables', 'Tables'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button type="button" key={id} class={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <label class="toggle">
          <input
            type="checkbox"
            checked={settings.fourColour}
            onChange={(e) => setSettings({ ...settings, fourColour: (e.target as HTMLInputElement).checked })}
          />
          Four-colour deck
        </label>
      </header>
      <main>
        {tab === 'drill' && <DrillView />}
        {tab === 'sandbox' && <SandboxView />}
        {tab === 'tables' && <TablesView />}
      </main>
    </div>
  );
}
