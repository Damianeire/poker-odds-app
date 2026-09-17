// Web worker: runs full enumeration off the main thread and reports progress.

import { enumerate } from '../engine/enumerate';

export interface EquityRequest {
  id: number;
  hands: number[][];
  board: number[];
  dead: number[];
}

export type EquityMessage =
  | { id: number; type: 'progress'; done: number; total: number }
  | { id: number; type: 'result'; result: ReturnType<typeof enumerate> }
  | { id: number; type: 'error'; message: string };

self.onmessage = (ev: MessageEvent<EquityRequest>) => {
  const req = ev.data;
  const post = (m: EquityMessage) => (self as unknown as Worker).postMessage(m);
  try {
    const result = enumerate(req.hands, req.board, req.dead, {
      progressEvery: 20000,
      onProgress: (done, total) => post({ id: req.id, type: 'progress', done, total }),
    });
    post({ id: req.id, type: 'result', result });
  } catch (e) {
    post({ id: req.id, type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};
