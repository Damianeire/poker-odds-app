// Main-thread client for the equity worker, with a synchronous fallback when
// workers are unavailable (for example when the built site is opened from file://).

import { enumerate, type EquityResult } from '../engine/enumerate';
import { type EquityMessage, type EquityRequest } from './equityWorker';

let worker: Worker | null | undefined;
let nextId = 1;
const pending = new Map<number, { resolve: (r: EquityResult) => void; reject: (e: Error) => void; onProgress?: (d: number, t: number) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./equityWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<EquityMessage>) => {
      const m = ev.data;
      const p = pending.get(m.id);
      if (!p) return;
      if (m.type === 'progress') p.onProgress?.(m.done, m.total);
      else if (m.type === 'result') {
        pending.delete(m.id);
        p.resolve(m.result);
      } else {
        pending.delete(m.id);
        p.reject(new Error(m.message));
      }
    };
    worker.onerror = () => {
      // Worker failed to load. Fall back to the main thread for everything pending.
      for (const [id, p] of pending) {
        pending.delete(id);
        p.reject(new Error('worker unavailable'));
      }
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

export interface EquityJob {
  promise: Promise<EquityResult>;
  cancel: () => void;
}

export function computeEquity(
  hands: number[][],
  board: number[],
  dead: number[],
  onProgress?: (done: number, total: number) => void,
): EquityJob {
  const w = getWorker();
  const id = nextId++;
  if (!w) {
    const promise = new Promise<EquityResult>((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(enumerate(hands, board, dead, { onProgress }));
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      }, 0);
    });
    return { promise, cancel: () => undefined };
  }
  const promise = new Promise<EquityResult>((resolve, reject) => {
    pending.set(id, {
      resolve,
      reject: (e) => {
        if (e.message === 'worker unavailable') {
          try {
            resolve(enumerate(hands, board, dead, { onProgress }));
          } catch (inner) {
            reject(inner instanceof Error ? inner : new Error(String(inner)));
          }
        } else reject(e);
      },
      ...(onProgress ? { onProgress } : {}),
    });
    const req: EquityRequest = { id, hands, board, dead };
    w.postMessage(req);
  });
  return {
    promise,
    cancel: () => {
      pending.delete(id);
    },
  };
}
