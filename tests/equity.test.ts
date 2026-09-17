import { describe, expect, it } from 'vitest';
import { parseCards, fullDeck } from '../src/engine/cards';
import { enumerate, runoutCount } from '../src/engine/enumerate';
import { monteCarlo } from '../src/engine/montecarlo';
import { createRng } from '../src/engine/rng';
import { choose } from '../src/engine/math';

const sumEquity = (r: { hands: { equity: number }[] }): number => r.hands.reduce((a, h) => a + h.equity, 0);

describe('enumerate', () => {
  it('visits the expected number of runouts', () => {
    const hero = parseCards('As Kd');
    const vill = parseCards('7h 7c');
    expect(runoutCount([hero, vill], parseCards('2c 9d Jh'))).toBe(choose(45, 2));
    expect(runoutCount([hero, vill], parseCards('2c 9d Jh Ts'))).toBe(44);
    expect(runoutCount([hero, vill], [])).toBe(choose(48, 5));
    const r = enumerate([hero, vill], parseCards('2c 9d Jh'));
    expect(r.runouts).toBe(990);
  });

  it('equities sum to one heads-up and multiway', () => {
    const board = parseCards('2c 9d Jh');
    const hu = enumerate([parseCards('As Kd'), parseCards('7h 7c')], board);
    expect(sumEquity(hu)).toBeCloseTo(1, 12);
    const three = enumerate([parseCards('As Kd'), parseCards('7h 7c'), parseCards('Qs Ts')], board);
    expect(sumEquity(three)).toBeCloseTo(1, 12);
    const four = enumerate(
      [parseCards('As Kd'), parseCards('7h 7c'), parseCards('Qs Ts'), parseCards('3d 4d')],
      board,
    );
    expect(sumEquity(four)).toBeCloseTo(1, 12);
    for (const r of [hu, three, four]) {
      for (const h of r.hands) {
        expect(h.win + h.tie + h.loss).toBeCloseTo(1, 12);
        expect(h.equity).toBeGreaterThanOrEqual(h.win);
        expect(h.equity).toBeLessThanOrEqual(h.win + h.tie);
      }
    }
  });

  it('a hand against an identical hand returns a tie', () => {
    // River: both hands make the same five cards.
    const river = enumerate([parseCards('As Kd'), parseCards('Ah Kc')], parseCards('2c 9d Jh 4s 7c'));
    expect(river.hands[0]!.tie).toBe(1);
    expect(river.hands[1]!.tie).toBe(1);
    expect(river.hands[0]!.equity).toBeCloseTo(0.5, 12);
    // Flop: symmetric hands on a rainbow board with no flush possible for either.
    const flop = enumerate([parseCards('As Kd'), parseCards('Ah Kc')], parseCards('2c 9d Jh'));
    expect(flop.hands[0]!.equity).toBeCloseTo(flop.hands[1]!.equity, 12);
    expect(flop.hands[0]!.win).toBeCloseTo(flop.hands[1]!.win, 12);
  });

  it('a pair against two overcards is roughly a coinflip favouring the pair', () => {
    const r = enumerate([parseCards('7h 7c'), parseCards('As Kd')], parseCards('2c 9d Jh'));
    expect(r.hands[0]!.equity).toBeGreaterThan(0.5);
    // Sanity: AK needs an ace or king, roughly 6 outs twice, ~24%, plus straight draws and running pairs.
    expect(r.hands[1]!.equity).toBeGreaterThan(0.2);
    expect(r.hands[1]!.equity).toBeLessThan(0.35);
  });

  it('preflop heads-up is exact and symmetric under suit relabeling', () => {
    // AKs vs 22 is a classic near coinflip; compute it exactly on the turn to keep the test fast.
    const a = enumerate([parseCards('As Ks'), parseCards('2h 2d')], parseCards('7c 9d Jc Ts'));
    const b = enumerate([parseCards('Ah Kh'), parseCards('2s 2c')], parseCards('7d 9c Jd Th'));
    expect(a.hands[0]!.equity).toBeCloseTo(b.hands[0]!.equity, 12);
  });

  it('reports progress', () => {
    const calls: number[] = [];
    enumerate([parseCards('As Kd'), parseCards('7h 7c')], parseCards('2c 9d Jh'), [], {
      onProgress: (done, total) => {
        calls.push(done);
        expect(total).toBe(990);
      },
      progressEvery: 100,
    });
    expect(calls[calls.length - 1]).toBe(990);
    expect(calls.length).toBeGreaterThan(5);
  });

  it('rejects overlapping cards', () => {
    expect(() => enumerate([parseCards('As Kd'), parseCards('As 7c')], [])).toThrow();
    expect(() => enumerate([parseCards('As Kd')], parseCards('Kd 2c 3c'))).toThrow();
  });
});

describe('monteCarlo', () => {
  it('agrees with enumeration within its confidence interval', () => {
    const hands = [parseCards('Qh Jh'), parseCards('7h 7c'), parseCards('As 2d')];
    const board = parseCards('Th 9c 2h');
    const exact = enumerate(hands, board);
    const mc = monteCarlo(hands, board, [], 200000, createRng(12345));
    expect(sumEquity(mc)).toBeCloseTo(1, 12);
    for (let i = 0; i < hands.length; i++) {
      const diff = Math.abs(mc.hands[i]!.equity - exact.hands[i]!.equity);
      // Fixed seed, so this is deterministic. Allow 1.5x the 95% half-width for safety.
      expect(diff).toBeLessThan(mc.ci95[i]! * 1.5 + 1e-9);
      expect(mc.ci95[i]!).toBeLessThan(0.01);
    }
  });

  it('is deterministic for a given seed', () => {
    const hands = [parseCards('Qh Jh'), parseCards('7h 7c')];
    const a = monteCarlo(hands, [], [], 5000, createRng(7));
    const b = monteCarlo(hands, [], [], 5000, createRng(7));
    expect(a.hands[0]!.equity).toBe(b.hands[0]!.equity);
  });

  it('preflop sampling matches a known matchup shape', () => {
    // Pair vs overcards preflop is a slight favourite for the pair.
    const mc = monteCarlo([parseCards('7h 7c'), parseCards('As Kd')], [], [], 100000, createRng(99));
    expect(mc.hands[0]!.equity).toBeGreaterThan(0.5);
    expect(mc.hands[0]!.equity).toBeLessThan(0.6);
  });
});

describe('property: equities sum to one for random deals', () => {
  it('holds across random multiway flops and turns', () => {
    const rng = createRng(2024);
    for (let trial = 0; trial < 30; trial++) {
      const players = rng.range(2, 4);
      const boardLen = rng.pick([3, 4, 5]);
      const cards = rng.sample(fullDeck(), players * 2 + boardLen);
      const hands: number[][] = [];
      for (let p = 0; p < players; p++) hands.push([cards[p * 2]!, cards[p * 2 + 1]!]);
      const board = cards.slice(players * 2);
      const r = enumerate(hands, board);
      expect(sumEquity(r)).toBeCloseTo(1, 10);
      for (const h of r.hands) expect(h.win + h.tie + h.loss).toBeCloseTo(1, 10);
    }
  });
});
