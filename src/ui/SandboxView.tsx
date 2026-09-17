import { useEffect, useMemo, useState } from 'preact/hooks';
import { parseCards, formatCards, type Card } from '../engine/cards';
import { evaluate, describeScore, Category } from '../engine/evaluator';
import { detectOutsToCategory, detectOutsVsHand, outProbabilities, heroAhead } from '../engine/outs';
import { potOdds } from '../engine/potodds';
import { ruleOf2, ruleOf4, solomon, percentToOddsAgainst, formatOddsAgainst } from '../engine/shortcuts';
import { runoutCount, type EquityResult } from '../engine/enumerate';
import { choose } from '../engine/math';
import { createRng, seedFromString } from '../engine/rng';
import { topRange, rangeCombos, equityVsRange, type RangeEquity } from '../engine/ranges';
import { PROFILE_PRESETS, profiledCall, type VillainProfile } from '../engine/profile';
import { num } from '../drills/types';
import { DRAW_TARGETS } from '../drills/deal';
import { computeEquity } from './equityClient';
import { CardRow } from './Card';
import { Working, Step } from './Working';

const pct = (x: number, places = 1) => `${(x * 100).toFixed(places)}%`;

interface Parsed {
  hero: Card[];
  board: Card[];
  villain: Card[];
  error: string | null;
}

function parseInputs(heroText: string, boardText: string, villainText: string): Parsed {
  try {
    const hero = parseCards(heroText);
    const board = parseCards(boardText);
    const villain = parseCards(villainText);
    if (hero.length !== 0 && hero.length !== 2) return { hero, board, villain, error: 'Hero needs exactly two cards.' };
    if (villain.length !== 0 && villain.length !== 2) return { hero, board, villain, error: 'Villain needs exactly two cards or none.' };
    if (board.length > 5 || (board.length > 0 && board.length < 3)) return { hero, board, villain, error: 'Board must be empty, 3, 4 or 5 cards.' };
    const all = [...hero, ...board, ...villain];
    if (new Set(all).size !== all.length) return { hero, board, villain, error: 'A card appears twice.' };
    return { hero, board, villain, error: null };
  } catch (e) {
    return { hero: [], board: [], villain: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export function SandboxView() {
  const [heroText, setHeroText] = useState('Ah 7h');
  const [boardText, setBoardText] = useState('Kh 9h 2c');
  const [villainText, setVillainText] = useState('Kc Kd');
  const [potText, setPotText] = useState('100');
  const [betText, setBetText] = useState('50');
  const [outsOverride, setOutsOverride] = useState<string>('');
  const [taintedText, setTaintedText] = useState('0');
  const [equity, setEquity] = useState<EquityResult | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [equityError, setEquityError] = useState<string | null>(null);
  const [rangePctText, setRangePctText] = useState('20');
  const [rangeEquity, setRangeEquity] = useState<RangeEquity | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [profile, setProfile] = useState<VillainProfile>({ rangeWidth: 0.2, foldFrequency: 0.4, payoffPropensity: 0.5, aggression: 0.3 });
  const [presetName, setPresetName] = useState<string | null>(null);
  const [playersBehindText, setPlayersBehindText] = useState('0');

  const parsed = useMemo(() => parseInputs(heroText, boardText, villainText), [heroText, boardText, villainText]);
  const { hero, board, villain } = parsed;
  const pot = Number(potText);
  const bet = Number(betText);
  const potOk = Number.isFinite(pot) && pot >= 0 && Number.isFinite(bet) && bet > 0;
  const po = potOk ? potOdds(pot, bet) : null;

  const ready = parsed.error === null && hero.length === 2;
  const onFlopOrTurn = ready && (board.length === 3 || board.length === 4);

  // Out detection.
  const outsVsVillain = onFlopOrTurn && villain.length === 2 ? detectOutsVsHand(hero, villain, board) : null;
  const drawRows = onFlopOrTurn
    ? DRAW_TARGETS.map((t) => ({ target: t, outs: detectOutsToCategory(hero, board, t.category, villain) })).filter((r) => r.outs.count > 0)
    : [];
  const detectedOuts = outsVsVillain ? outsVsVillain.count : (drawRows[0]?.outs.count ?? 0);
  const detectedLabel = outsVsVillain ? 'cards that beat villain' : drawRows[0] ? `to ${drawRows[0].target.label}` : 'none detected';
  const rawOuts = outsOverride.trim() === '' ? detectedOuts : Math.max(0, Math.floor(Number(outsOverride) || 0));
  const tainted = Math.min(rawOuts, Math.max(0, Math.floor(Number(taintedText) || 0)));
  const outs = rawOuts - tainted;
  const deadCount = villain.length === 2 ? 2 : 0;
  const probs = onFlopOrTurn && outs <= 52 - 2 - board.length - deadCount ? outProbabilities(outs, board.length as 3 | 4, deadCount) : null;
  const r2 = probs ? ruleOf2(outs, probs.unseen) : null;
  const r4 = probs && probs.cardsToCome === 2 ? ruleOf4(outs, probs.unseen) : null;
  const sol = probs && probs.cardsToCome === 2 ? solomon(outs, probs.unseen) : null;

  // Exact equity via the worker whenever hero and villain are both set.
  const equityKey = ready && villain.length === 2 ? `${formatCards(hero)}|${formatCards(villain)}|${formatCards(board)}` : '';
  useEffect(() => {
    setEquity(null);
    setEquityError(null);
    setProgress(null);
    if (!equityKey) return;
    const job = computeEquity([hero, villain], board, [], (done, total) => setProgress([done, total]));
    let cancelled = false;
    job.promise
      .then((r) => {
        if (!cancelled) {
          setEquity(r);
          setProgress(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setEquityError(e.message);
      });
    return () => {
      cancelled = true;
      job.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equityKey]);

  const heroNow = ready && board.length >= 3 ? describeScore(evaluate([...hero, ...board])) : null;
  const villNow = ready && villain.length === 2 && board.length >= 3 ? describeScore(evaluate([...villain, ...board])) : null;
  const ahead = ready && villain.length === 2 && board.length >= 3 ? heroAhead(hero, villain, board) : null;

  // Equity against a range, a minimal Phase 2 stand-in for a full range picker:
  // whenever no specific villain hand is given, treat the range width slider
  // in the villain profile panel as the villain's holdings.
  const rangeFraction = Math.min(1, Math.max(0.01, (Number(rangePctText) || 0) / 100));
  const rangeKey = ready && villain.length !== 2 && [0, 3, 4, 5].includes(board.length) ? `${formatCards(hero)}|${formatCards(board)}|${rangeFraction}` : '';
  useEffect(() => {
    setRangeEquity(null);
    setRangeError(null);
    if (!rangeKey) {
      setRangeLoading(false);
      return;
    }
    setRangeLoading(true);
    const timer = setTimeout(() => {
      try {
        const range = topRange(rangeFraction);
        const combos = rangeCombos(range, [...hero, ...board]);
        const rng = createRng(seedFromString(rangeKey));
        setRangeEquity(equityVsRange(hero, combos, board, { rng, trials: 20000 }));
      } catch (e) {
        setRangeError(e instanceof Error ? e.message : String(e));
      } finally {
        setRangeLoading(false);
      }
    }, 30);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  const heroEquity = equity ? equity.hands[0]!.equity : null;
  const compareEquity = heroEquity ?? rangeEquity?.equity ?? (probs ? probs.byRiver : null);
  const compareLabel =
    heroEquity !== null
      ? 'exact equity'
      : rangeEquity
        ? `equity vs top ${rangePctText}%`
        : probs
          ? probs.cardsToCome === 2
            ? 'chance to hit by the river'
            : 'chance to hit on the next card'
          : null;

  const playersBehind = Math.max(0, Math.floor(Number(playersBehindText) || 0));
  const profileResult = potOk && compareEquity !== null ? profiledCall(profile, pot, bet, compareEquity, playersBehind) : null;

  return (
    <div class="sandbox">
      <section class="sandbox-inputs">
        <label>
          Hero
          <input value={heroText} onInput={(e) => setHeroText((e.target as HTMLInputElement).value)} placeholder="As Kd" />
        </label>
        <label>
          Board
          <input value={boardText} onInput={(e) => setBoardText((e.target as HTMLInputElement).value)} placeholder="Qh 7c 2d" />
        </label>
        <label>
          Villain
          <input value={villainText} onInput={(e) => setVillainText((e.target as HTMLInputElement).value)} placeholder="optional" />
        </label>
        <label>
          Pot before the bet
          <input value={potText} inputMode="decimal" onInput={(e) => setPotText((e.target as HTMLInputElement).value)} />
        </label>
        <label>
          Bet faced
          <input value={betText} inputMode="decimal" onInput={(e) => setBetText((e.target as HTMLInputElement).value)} />
        </label>
        <label>
          Outs (override)
          <input value={outsOverride} inputMode="numeric" placeholder={String(detectedOuts)} onInput={(e) => setOutsOverride((e.target as HTMLInputElement).value)} />
        </label>
        <label>
          Tainted outs
          <input value={taintedText} inputMode="numeric" onInput={(e) => setTaintedText((e.target as HTMLInputElement).value)} />
        </label>
        {parsed.error && <p class="error">{parsed.error}</p>}
      </section>

      {ready && (
        <section class="sandbox-cards">
          <CardRow label="You" cards={hero} />
          {board.length > 0 && <CardRow label="Board" cards={board} />}
          {villain.length === 2 && <CardRow label="Villain" cards={villain} />}
          {heroNow && (
            <p class="now">
              You: {heroNow}.{villNow ? ` Villain: ${villNow}. You are ${ahead ? 'ahead' : 'behind or tied'}.` : ''}
            </p>
          )}
        </section>
      )}

      {ready && (
        <div class="panels">
          <section class="panel">
            <h3>Outs</h3>
            {!onFlopOrTurn && <p class="muted">Out counting applies on the flop or turn.</p>}
            {onFlopOrTurn && (
              <>
                <table>
                  <tbody>
                    {outsVsVillain && (
                      <tr>
                        <th>Cards that beat villain after the next card</th>
                        <td>{outsVsVillain.count}</td>
                      </tr>
                    )}
                    {drawRows.map((r) => (
                      <tr key={r.target.label}>
                        <th>Outs to {r.target.label}</th>
                        <td>{r.outs.count}</td>
                      </tr>
                    ))}
                    <tr>
                      <th>Outs used ({detectedLabel}{outsOverride.trim() !== '' ? ', overridden' : ''})</th>
                      <td>
                        {rawOuts}
                        {tainted > 0 ? ` - ${tainted} tainted = ${outs}` : ''}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {probs && (
                  <table>
                    <tbody>
                      <tr>
                        <th>Next card, exact</th>
                        <td>
                          {pct(probs.nextCard)} ({formatOddsAgainst(percentToOddsAgainst(Math.max(1e-9, probs.nextCard * 100)))})
                        </td>
                      </tr>
                      {r2 && (
                        <tr>
                          <th>Rule of 2</th>
                          <td>
                            {r2.estimate}% (error {r2.error >= 0 ? '+' : ''}
                            {r2.error.toFixed(1)})
                          </td>
                        </tr>
                      )}
                      {probs.cardsToCome === 2 && (
                        <tr>
                          <th>By the river, exact (two cards)</th>
                          <td>
                            {pct(probs.byRiver)} ({formatOddsAgainst(percentToOddsAgainst(Math.max(1e-9, probs.byRiver * 100)))})
                          </td>
                        </tr>
                      )}
                      {r4 && (
                        <tr>
                          <th>Rule of 4</th>
                          <td>
                            {r4.estimate}% (error {r4.error >= 0 ? '+' : ''}
                            {r4.error.toFixed(1)})
                          </td>
                        </tr>
                      )}
                      {sol && (
                        <tr>
                          <th>Solomon</th>
                          <td>
                            {sol.estimate}% (error {sol.error >= 0 ? '+' : ''}
                            {sol.error.toFixed(1)})
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
                <Working>
                  {outsVsVillain && (
                    <Step
                      text={`Every unseen card is dealt as the next card and both hands re-evaluated. Cards that put you ahead: ${outsVsVillain.count === 0 ? 'none' : formatCards(outsVsVillain.outs)}.`}
                    />
                  )}
                  {drawRows.map((r) => (
                    <Step key={r.target.label} text={`Cards that make ${r.target.label}: ${formatCards(r.outs.outs)}.`} result={`${r.outs.count}`} />
                  ))}
                  {probs && (
                    <>
                      <Step text="Unseen cards." formula={`52 - 2 - ${board.length}${deadCount ? ` - ${deadCount}` : ''}`} result={String(probs.unseen)} />
                      <Step text="Next card." formula={`${outs} / ${probs.unseen}`} result={pct(probs.nextCard, 2)} />
                      {probs.cardsToCome === 2 && (
                        <Step
                          text="By the river: one minus the chance of missing twice."
                          formula={`1 - C(${probs.unseen - outs}, 2) / C(${probs.unseen}, 2) = 1 - ${choose(probs.unseen - outs, 2)} / ${choose(probs.unseen, 2)}`}
                          result={pct(probs.byRiver, 2)}
                        />
                      )}
                      {tainted > 0 && <Step text={`Tainted outs are subtracted before the formula: ${rawOuts} - ${tainted} = ${outs}. The number subtracted is a judgement, not a calculation.`} />}
                    </>
                  )}
                </Working>
              </>
            )}
          </section>

          <section class="panel">
            <h3>Exact equity</h3>
            {villain.length !== 2 && (
              <>
                <label>
                  Villain range, top
                  <input value={rangePctText} inputMode="numeric" onInput={(e) => setRangePctText((e.target as HTMLInputElement).value)} />
                  %
                </label>
                {rangeLoading && <p class="muted">Weighing every combo in the range equally...</p>}
                {rangeError && <p class="error">{rangeError}</p>}
                {rangeEquity && (
                  <table>
                    <tbody>
                      <tr>
                        <th>Equity vs top {rangePctText}%</th>
                        <td>
                          {pct(rangeEquity.equity, 2)}
                          {rangeEquity.method === 'montecarlo' ? ` ± ${pct(rangeEquity.ci95, 2)}` : ''}
                        </td>
                      </tr>
                      <tr>
                        <th>Combos in range</th>
                        <td>{rangeEquity.combos}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
                <Working>
                  <Step
                    text={`Every combo in the top ${rangePctText}% of starting hands, by the static ranking, is weighted equally. ${board.length >= 3 ? 'Each is enumerated exactly against every remaining runout.' : 'Preflop this is sampled rather than enumerated.'}`}
                  />
                </Working>
              </>
            )}
            {villain.length === 2 && (
              <>
                {progress && !equity && (
                  <p class="muted">
                    Enumerating {progress[1].toLocaleString()} runouts: {Math.round((100 * progress[0]) / progress[1])}%
                  </p>
                )}
                {!progress && !equity && !equityError && <p class="muted">Enumerating {runoutCount([hero, villain], board).toLocaleString()} runouts...</p>}
                {equityError && <p class="error">{equityError}</p>}
                {equity && (
                  <table>
                    <thead>
                      <tr>
                        <th></th>
                        <th>Win</th>
                        <th>Tie</th>
                        <th>Lose</th>
                        <th>Equity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equity.hands.map((h, i) => (
                        <tr key={i}>
                          <th>{i === 0 ? 'You' : 'Villain'}</th>
                          <td>{pct(h.win)}</td>
                          <td>{pct(h.tie)}</td>
                          <td>{pct(h.loss)}</td>
                          <td>{pct(h.equity, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <Working>
                  <Step
                    text={`All ${runoutCount([hero, villain], board).toLocaleString()} ways to complete the board are dealt out. Each hand's best five cards from seven are scored. Equity is wins plus half of ties, divided by runouts.`}
                  />
                  {equity && <Step text="Equities sum to one." result={pct(equity.hands.reduce((a, h) => a + h.equity, 0), 4)} />}
                  {probs && heroEquity !== null && (
                    <Step
                      text="Compare with the out-based figure. The difference is what outs miss: villain improving, running cards, ties, and hero winning without hitting."
                      result={`outs say ${pct(probs.byRiver)}, enumeration says ${pct(heroEquity)}`}
                    />
                  )}
                </Working>
              </>
            )}
          </section>

          <section class="panel">
            <h3>Pot odds</h3>
            {!po && <p class="muted">Enter a pot and a positive bet.</p>}
            {po && (
              <>
                <table>
                  <tbody>
                    <tr>
                      <th>Odds offered</th>
                      <td>{formatOddsAgainst(po.oddsOffered, 2)}</td>
                    </tr>
                    <tr>
                      <th>Break-even equity</th>
                      <td>{pct(po.breakEven)}</td>
                    </tr>
                    <tr>
                      <th>Bet as fraction of pot</th>
                      <td>{pot > 0 ? po.betFraction.toFixed(2) : '—'}</td>
                    </tr>
                    <tr>
                      <th>Minimum defence frequency</th>
                      <td>{pct(po.mdf)}</td>
                    </tr>
                    <tr>
                      <th>Alpha</th>
                      <td>{pct(po.alpha)}</td>
                    </tr>
                  </tbody>
                </table>
                {compareEquity !== null && compareLabel && (
                  <p class={`decision ${compareEquity > po.breakEven ? 'ok' : 'miss'}`}>
                    {compareEquity > po.breakEven ? 'Call' : 'Fold'}: {compareLabel} {pct(compareEquity)} against {pct(po.breakEven)} needed.
                    {heroEquity === null && rangeEquity === null && probs && probs.cardsToCome === 2 && ' This uses the two-card figure, which only applies if villain is all-in.'}
                  </p>
                )}
                <Working>
                  <Step text="Final pot if you call." formula={`${pot} + ${bet} + ${bet}`} result={String(po.finalPot)} />
                  <Step text="Break-even equity: your call over the final pot." formula={`${bet} / ${po.finalPot}`} result={pct(po.breakEven, 2)} />
                  <Step text="Odds offered: what is in the middle against what you pay." formula={`(${pot} + ${bet}) : ${bet}`} result={formatOddsAgainst(po.oddsOffered, 2)} />
                  <Step text="Minimum defence frequency: pot over pot plus bet. A heads-up construct." formula={`${pot} / (${pot} + ${bet})`} result={pct(po.mdf, 2)} />
                  <Step text="Alpha: how often a bluff of this size must work." formula={`${bet} / (${pot} + ${bet})`} result={pct(po.alpha, 2)} />
                </Working>
              </>
            )}
          </section>

          <section class="panel panel-wide">
            <h3>Villain profile</h3>
            <p class="muted">
              Four estimated parameters feed the terms already above: range width sets the equity comparison, fold frequency and
              payoff propensity feed implied odds, and aggression feeds a raise-behind discount. The output is only as precise
              as these inputs.
            </p>
            <div class="profile-presets">
              {PROFILE_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.name}
                  class={presetName === p.name ? 'active' : ''}
                  title={p.note}
                  onClick={() => {
                    setPresetName(p.name);
                    setProfile({ rangeWidth: p.rangeWidth, foldFrequency: p.foldFrequency, payoffPropensity: p.payoffPropensity, aggression: p.aggression });
                    setRangePctText(String(Math.round(p.rangeWidth * 100)));
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div class="profile-sliders">
              <label>
                Range width: top {Math.round(profile.rangeWidth * 100)}%
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={profile.rangeWidth * 100}
                  onInput={(e) => {
                    const v = Number((e.target as HTMLInputElement).value) / 100;
                    setPresetName(null);
                    setProfile({ ...profile, rangeWidth: v });
                    setRangePctText(String(Math.round(v * 100)));
                  }}
                />
              </label>
              <label>
                Fold frequency to a bet: {pct(profile.foldFrequency, 0)}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={profile.foldFrequency * 100}
                  onInput={(e) => {
                    setPresetName(null);
                    setProfile({ ...profile, foldFrequency: Number((e.target as HTMLInputElement).value) / 100 });
                  }}
                />
              </label>
              <label>
                Payoff propensity: {profile.payoffPropensity.toFixed(2)}x pot when you hit
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={profile.payoffPropensity * 100}
                  onInput={(e) => {
                    setPresetName(null);
                    setProfile({ ...profile, payoffPropensity: Number((e.target as HTMLInputElement).value) / 100 });
                  }}
                />
              </label>
              <label>
                Aggression: {pct(profile.aggression, 0)}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={profile.aggression * 100}
                  onInput={(e) => {
                    setPresetName(null);
                    setProfile({ ...profile, aggression: Number((e.target as HTMLInputElement).value) / 100 });
                  }}
                />
              </label>
              <label>
                Players still to act behind you
                <input value={playersBehindText} inputMode="numeric" onInput={(e) => setPlayersBehindText((e.target as HTMLInputElement).value)} />
              </label>
            </div>
            {!profileResult && <p class="muted">Enter a pot, a bet, and either a villain hand or a board to compare, to see the decision.</p>}
            {profileResult && (
              <>
                <table>
                  <tbody>
                    <tr>
                      <th>Immediate break-even equity</th>
                      <td>{pct(profileResult.immediateBreakEven)}</td>
                    </tr>
                    <tr>
                      <th>Implied gain when you hit (estimate)</th>
                      <td>{num(profileResult.inputs.impliedGain, 1)}</td>
                    </tr>
                    <tr>
                      <th>Reverse implied loss (estimate)</th>
                      <td>{num(profileResult.inputs.reverseLoss, 1)}</td>
                    </tr>
                    <tr>
                      <th>Equity needed after implied odds</th>
                      <td>{pct(Math.min(1, profileResult.equityNeeded))}</td>
                    </tr>
                    <tr>
                      <th>EV, immediate odds only</th>
                      <td>{num(profileResult.evImmediate.total, 1)}</td>
                    </tr>
                    <tr>
                      <th>EV, with implied odds</th>
                      <td>{num(profileResult.evWithImplied, 1)}</td>
                    </tr>
                    {playersBehind > 0 && (
                      <tr>
                        <th>Raise-behind probability</th>
                        <td>{pct(profileResult.raiseBehindProb)}</td>
                      </tr>
                    )}
                    <tr>
                      <th>Total EV</th>
                      <td>{num(profileResult.total, 1)}</td>
                    </tr>
                  </tbody>
                </table>
                <p class={`decision ${profileResult.call ? 'ok' : 'miss'}`}>
                  {profileResult.call ? 'Call' : 'Fold'} against this profile: total EV {num(profileResult.total, 1)}.
                </p>
                <Working>
                  <Step text="Net implied winnings: what you expect to win when you hit, minus what you expect to lose when it completes but is still beaten." formula={`${num(profileResult.inputs.impliedGain, 1)} - ${num(profileResult.inputs.reverseLoss, 1)}`} result={num(profileResult.implied.net, 1)} />
                  <Step
                    text="EV including that net figure: e(P + B + net) - (1 - e)B."
                    formula={`${num(compareEquity ?? 0, 3)} x (${pot} + ${bet} + ${num(profileResult.implied.net, 1)}) - ${num(1 - (compareEquity ?? 0), 3)} x ${bet}`}
                    result={num(profileResult.evWithImplied, 1)}
                  />
                  {playersBehind > 0 && (
                    <Step
                      text="Action behind: with probability r a raise forces a fold and the call is forfeited. r = 1 - (1 - aggression)^players."
                      formula={`(1 - ${num(profileResult.raiseBehindProb, 2)}) x ${num(profileResult.evWithImplied, 1)} - ${num(profileResult.raiseBehindProb, 2)} x ${bet}`}
                      result={num(profileResult.total, 1)}
                    />
                  )}
                  <Step text="These four parameters are estimates from observation. The arithmetic on top of them is exact." />
                </Working>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export { Category };
