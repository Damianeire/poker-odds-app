// A small external store for progress state, persisted on every change.

import { useEffect, useReducer } from 'preact/hooks';
import { loadState, saveState } from '../srs/persist';
import { type ProgressState } from '../srs/store';

let state: ProgressState = loadState();
const listeners = new Set<() => void>();

export function getProgress(): ProgressState {
  return state;
}

export function setProgress(next: ProgressState): void {
  state = next;
  saveState(state);
  for (const l of listeners) l();
}

export function updateProgress(fn: (s: ProgressState) => ProgressState): void {
  setProgress(fn(state));
}

export function useProgress(): ProgressState {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const l = () => force(0);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}
