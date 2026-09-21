// Progress code: the whole progress state as one copyable string, so it can move between browsers
// with no backend. Format: PQ1.<base64url of deflated JSON>.<crc32 of the compressed bytes, hex>.
// The checksum catches typos and truncation. It does not stop anyone editing a code.

import { importJson, type ProgressState } from './store';

export const CODE_PREFIX = 'PQ1';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('The code contains characters that are not allowed.');
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Response times to 100 ms and errors to 0.1 points, the precision the app shows. Much smaller codes. */
function compact(state: ProgressState): ProgressState {
  const drills: ProgressState['drills'] = {};
  for (const [id, r] of Object.entries(state.drills)) {
    drills[id] = {
      ...r,
      times: r.times.map((t) => Math.round(t / 100) * 100),
      errors: r.errors.map((e) => Math.round(e * 10) / 10),
    };
  }
  return { ...state, drills, calibration: state.calibration.map((e) => Math.round(e * 10) / 10) };
}

export async function encodeProgress(state: ProgressState): Promise<string> {
  const packed = await pipe(new TextEncoder().encode(JSON.stringify(compact(state))), new CompressionStream('deflate-raw'));
  return `${CODE_PREFIX}.${toBase64Url(packed)}.${crc32(packed).toString(16).padStart(8, '0')}`;
}

/** Decode a code, ignoring whitespace so a wrapped or re-flowed paste still works. Throws with a plain message. */
export async function decodeProgress(code: string): Promise<ProgressState> {
  const parts = code.replace(/\s+/g, '').split('.');
  if (parts[0] !== CODE_PREFIX) throw new Error('That is not a progress code.');
  if (parts.length !== 3 || !parts[1] || !/^[0-9a-f]{8}$/i.test(parts[2]!)) throw new Error('The code is incomplete. Copy the whole thing.');
  const packed = fromBase64Url(parts[1]);
  if (crc32(packed) !== parseInt(parts[2]!, 16)) throw new Error('The code has a typo or is cut short. Check it against the original.');
  let json: string;
  try {
    json = new TextDecoder().decode(await pipe(packed, new DecompressionStream('deflate-raw')));
  } catch {
    throw new Error('The code could not be unpacked.');
  }
  return importJson(json);
}

/** The address that restores a code when opened. The code sits in the hash, which is never sent to a server. */
export function codeLink(code: string, base: string): string {
  return `${base.split('#')[0]}#code=${code}`;
}

/** The code in a `#code=...` hash, or null. */
export function codeFromHash(hash: string): string | null {
  return hash.startsWith('#code=') ? hash.slice('#code='.length) : null;
}
