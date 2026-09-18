// Settings: Drill tab timer, how difficulty levels are worked through, module gating, card colours.

import { useProgress, updateProgress } from './progress';
import { updateSettings, type DrillTimer, type Progression, type Settings } from '../srs/store';

const TIMER_OPTIONS: { value: DrillTimer; label: string; text: string }[] = [
  { value: 'off', label: 'Off', text: 'No countdown or ghost bar in the Drill tab. Take as long as you need.' },
  { value: 'relaxed', label: 'Relaxed', text: 'Each drill keeps its countdown at two and a half times the standard limit.' },
  { value: 'standard', label: 'Standard', text: 'The drill limits as designed. Most drills only have one at level 3.' },
];

const PROGRESSION_OPTIONS: { value: Progression; label: string; text: string }[] = [
  {
    value: 'per-drill',
    label: 'Drill by drill',
    text: 'Each drill keeps its own level. After ten answers at a level with 80% or more correct, the Drill tab suggests the next level for that drill. Work one drill up to level 3, then move on.',
  },
  {
    value: 'curriculum',
    label: 'Whole curriculum, level by level',
    text: 'One level for every drill. Do every drill at level 1, and level 2 opens once each has passed level 1 (ten answers, 80% or more). Then the same for level 3.',
  },
  {
    value: 'free',
    label: 'Free',
    text: 'One difficulty selector for everything, set by hand. No tracking or suggestions.',
  },
];

export function SettingsView() {
  const progress = useProgress();
  const s = progress.settings;
  const set = (patch: Partial<Settings>) => updateProgress((p) => updateSettings(p, patch));

  return (
    <div class="settings">
      <section class="panel">
        <h3>Drill timer</h3>
        <p class="muted">Applies to the Drill tab. The Timed tab always runs against the clock.</p>
        <div class="options">
          {TIMER_OPTIONS.map((o) => (
            <label class="option" key={o.value}>
              <input type="radio" name="drillTimer" checked={s.drillTimer === o.value} onChange={() => set({ drillTimer: o.value })} />
              <span>
                {o.label}
                <span class="muted option-text">{o.text}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section class="panel">
        <h3>Difficulty levels</h3>
        <p class="muted">How you move through levels 1 to 3 in the Drill tab. Switching keeps your results.</p>
        <div class="options">
          {PROGRESSION_OPTIONS.map((o) => (
            <label class="option" key={o.value}>
              <input type="radio" name="progression" checked={s.progression === o.value} onChange={() => set({ progression: o.value })} />
              <span>
                {o.label}
                <span class="muted option-text">{o.text}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section class="panel">
        <h3>Modules</h3>
        <label class="toggle">
          <input type="checkbox" checked={s.gating} onChange={(e) => set({ gating: (e.target as HTMLInputElement).checked })} />
          Require fluency on hand ranking and best hand before other modules unlock
        </label>
      </section>

      <section class="panel">
        <h3>Cards</h3>
        <label class="toggle">
          <input type="checkbox" checked={s.fourColour} onChange={(e) => set({ fourColour: (e.target as HTMLInputElement).checked })} />
          Four-colour deck
        </label>
      </section>
    </div>
  );
}
