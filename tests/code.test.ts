import { describe, expect, it } from 'vitest';
import { encodeProgress, decodeProgress, codeLink, codeFromHash, CODE_PREFIX } from '../src/srs/code';
import { emptyState, recordAttempt, addTimedSession, addBankrollSession, updateSettings, setDrillLevel, setLastDrill, progressSummary, exportJson, importJson, type ProgressState } from '../src/srs/store';
import { createRng } from '../src/engine/rng';
import { DRILLS } from '../src/drills';

const T0 = new Date('2026-09-17T10:00:00Z');

/** Every drill with full rolling windows, timed and bankroll history, and non-default settings. */
function fullState(): ProgressState {
  const rng = createRng(7).next;
  let s = updateSettings(emptyState(), { fourColour: false, gating: false, drillTimer: 'relaxed', progression: 'curriculum' });
  for (const d of DRILLS) {
    for (let i = 0; i < 80; i++) {
      s = recordAttempt(
        s,
        { drillId: d.id, correct: rng() < 0.8, ms: 800 + Math.floor(rng() * 9000), difficulty: ((i % 3) + 1) as 1 | 2 | 3, error: (rng() - 0.5) * 20 },
        T0,
      );
    }
    s = setDrillLevel(s, d.id, 2);
  }
  for (let i = 0; i < 30; i++) {
    s = addTimedSession(s, { at: T0.toISOString(), questions: 20, correct: 12 + (i % 8), medianMs: 3000 + i * 37 });
    s = addBankrollSession(s, { at: T0.toISOString(), decisions: 50, bb100: (i - 15) * 1.7, finalStack: 100 + i });
  }
  return setLastDrill(s, DRILLS[0]!.id);
}

/** What a code should give back: the state with times and errors rounded as the encoder does. */
function rounded(s: ProgressState): ProgressState {
  const back = JSON.parse(exportJson(s)) as ProgressState;
  for (const r of Object.values(back.drills)) {
    r.times = r.times.map((t) => Math.round(t / 100) * 100);
    r.errors = r.errors.map((e) => Math.round(e * 10) / 10);
  }
  back.calibration = back.calibration.map((e) => Math.round(e * 10) / 10);
  return importJson(JSON.stringify(back));
}

describe('progress code', () => {
  it('round-trips an empty state exactly', async () => {
    const code = await encodeProgress(emptyState());
    expect(code.startsWith(`${CODE_PREFIX}.`)).toBe(true);
    expect(await decodeProgress(code)).toEqual(emptyState());
  });

  it('round-trips a full state', async () => {
    const s = fullState();
    expect(await decodeProgress(await encodeProgress(s))).toEqual(rounded(s));
  });

  it('keeps rounded values within 50 ms and 0.05 points', async () => {
    let s = recordAttempt(emptyState(), { drillId: 'a', correct: true, ms: 1234, error: 1.2345 }, T0);
    s = recordAttempt(s, { drillId: 'a', correct: false, ms: 4999, error: -7.777 }, T0);
    const back = await decodeProgress(await encodeProgress(s));
    back.drills['a']!.times.forEach((t, i) => expect(Math.abs(t - s.drills['a']!.times[i]!)).toBeLessThanOrEqual(50));
    back.drills['a']!.errors.forEach((e, i) => expect(Math.abs(e - s.drills['a']!.errors[i]!)).toBeLessThanOrEqual(0.05 + 1e-9));
    expect(back.drills['a']!.attempts).toBe(2);
    expect(back.drills['a']!.box).toBe(1);
  });

  it('accepts a code with spaces and line breaks inserted', async () => {
    const s = fullState();
    const code = await encodeProgress(s);
    const wrapped = code.replace(/(.{60})/g, '$1\n').replace(/^(.{20})/, '$1 ');
    expect(await decodeProgress(`  ${wrapped}\n`)).toEqual(rounded(s));
  });

  it('rejects a changed character, a truncated code, a wrong prefix and plain text', async () => {
    const code = await encodeProgress(fullState());
    const [prefix, payload, crc] = code.split('.') as [string, string, string];
    const i = Math.floor(payload.length / 2);
    const flipped = payload.slice(0, i) + (payload[i] === 'A' ? 'B' : 'A') + payload.slice(i + 1);
    await expect(decodeProgress(`${prefix}.${flipped}.${crc}`)).rejects.toThrow(/typo|cut short/);
    await expect(decodeProgress(code.slice(0, -20))).rejects.toThrow();
    await expect(decodeProgress(`${prefix}.${payload}`)).rejects.toThrow(/incomplete/);
    await expect(decodeProgress(`PQ9.${payload}.${crc}`)).rejects.toThrow(/not a progress code/);
    await expect(decodeProgress('hello world')).rejects.toThrow(/not a progress code/);
    await expect(decodeProgress('')).rejects.toThrow(/not a progress code/);
    await expect(decodeProgress(`${prefix}.$$$.${crc}`)).rejects.toThrow(/not allowed/);
  });

  it('rejects a wrong checksum, and a valid code from an unsupported schema version', async () => {
    const good = await encodeProgress(emptyState());
    const [prefix, payload] = good.split('.') as [string, string];
    await expect(decodeProgress(`${prefix}.${payload}.00000000`)).rejects.toThrow(/typo|cut short/);
    // Intact envelope and checksum, but the contents fail the normal import checks.
    const future = await encodeProgress({ ...emptyState(), version: 99 });
    await expect(decodeProgress(future)).rejects.toThrow(/version/);
  });

  it('stays a copyable size for a fully used profile', async () => {
    const code = await encodeProgress(fullState());
    console.log(`full-profile code: ${code.length} characters over ${DRILLS.length} drills`);
    expect(code.length).toBeLessThan(20000);
    const early = await encodeProgress(recordAttempt(emptyState(), { drillId: 'a', correct: true, ms: 1500 }, T0));
    console.log(`one-answer code: ${early.length} characters`);
    expect(early.length).toBeLessThan(1000);
  });

  it('summarises progress for the restore comparison', () => {
    expect(progressSummary(emptyState())).toEqual({ attempts: 0, drillsAttempted: 0, lastSeen: null });
    let s = recordAttempt(emptyState(), { drillId: 'a', correct: true, ms: 1000 }, T0);
    s = recordAttempt(s, { drillId: 'b', correct: false, ms: 1000 }, new Date('2026-09-19T10:00:00Z'));
    s = recordAttempt(s, { drillId: 'a', correct: true, ms: 1000 }, new Date('2026-09-18T10:00:00Z'));
    expect(progressSummary(s)).toEqual({ attempts: 3, drillsAttempted: 2, lastSeen: '2026-09-19T10:00:00.000Z' });
  });

  it('builds and reads the restore link', async () => {
    const code = await encodeProgress(emptyState());
    const link = codeLink(code, 'https://example.github.io/poker-odds-app/#old');
    expect(link).toBe(`https://example.github.io/poker-odds-app/#code=${code}`);
    expect(codeFromHash(new URL(link).hash)).toBe(code);
    expect(codeFromHash('#other')).toBeNull();
    expect(codeFromHash('')).toBeNull();
  });
});
