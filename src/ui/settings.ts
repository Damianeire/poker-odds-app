// Persisted display settings. The only thing stored across sessions in Phase 1.

export interface Settings {
  fourColour: boolean;
}

const KEY = 'poker-odds-trainer:settings:v1';
const DEFAULTS: Settings = { fourColour: true };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable; the setting lives for this session only.
  }
}
