// localStorage persistence under one versioned key.

import { emptyState, importJson, exportJson, type ProgressState } from './store';

export const STORAGE_KEY = 'poker-odds-trainer:progress:v1';

export function loadState(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return importJson(raw);
  } catch {
    return emptyState();
  }
}

export function saveState(state: ProgressState): void {
  try {
    localStorage.setItem(STORAGE_KEY, exportJson(state));
  } catch {
    // Storage unavailable; progress lives for this session only.
  }
}
