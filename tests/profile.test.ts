import { describe, expect, it } from 'vitest';
import { PROFILE_PRESETS, profileInputs, profiledCall, validateProfile } from '../src/engine/profile';

describe('villain profiles', () => {
  it('presets are valid', () => {
    expect(PROFILE_PRESETS.length).toBe(4);
    for (const p of PROFILE_PRESETS) expect(() => validateProfile(p)).not.toThrow();
  });

  it('maps parameters onto engine inputs', () => {
    const p = { rangeWidth: 0.3, foldFrequency: 0.4, payoffPropensity: 0.8, aggression: 0.5 };
    const i = profileInputs(p, 100, 50, 2);
    expect(i.foldProb).toBe(0.4);
    expect(i.impliedGain).toBeCloseTo(80, 12);
    expect(i.reverseLoss).toBeCloseTo(25, 12);
    expect(i.raiseBehindProb).toBeCloseTo(1 - 0.5 ** 2, 12);
    expect(profileInputs(p, 100, 50, 0).raiseBehindProb).toBe(0);
  });

  it('the decision flips as payoff propensity moves', () => {
    // A 9-out flush draw on the turn (19.6%) facing half pot (needs 25%).
    const e = 9 / 46;
    const base = { rangeWidth: 0.3, foldFrequency: 0.4, aggression: 0 };
    const stingy = profiledCall({ ...base, payoffPropensity: 0 }, 100, 50, e);
    const generous = profiledCall({ ...base, payoffPropensity: 1.0 }, 100, 50, e);
    expect(stingy.call).toBe(false);
    expect(generous.call).toBe(true);
    expect(generous.equityNeeded).toBeLessThan(stingy.equityNeeded);
    expect(stingy.equityNeeded).toBeCloseTo(0.25, 12);
  });

  it('aggression raises the bar through reverse implied odds', () => {
    const e = 9 / 46;
    const passive = profiledCall({ rangeWidth: 0.3, foldFrequency: 0.4, payoffPropensity: 0.6, aggression: 0 }, 100, 50, e);
    const aggressive = profiledCall({ rangeWidth: 0.3, foldFrequency: 0.4, payoffPropensity: 0.6, aggression: 1 }, 100, 50, e);
    expect(aggressive.equityNeeded).toBeGreaterThan(passive.equityNeeded);
  });
});
