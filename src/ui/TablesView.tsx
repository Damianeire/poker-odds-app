import { sizingTable } from '../engine/potodds';
import { shortcutTable, formatOddsAgainst, percentToOddsAgainst } from '../engine/shortcuts';
import { Working, Step } from './Working';

const OUTS = Array.from({ length: 20 }, (_, i) => i + 1);

/** Reference tables, generated live from the engine on every render. */
export function TablesView() {
  const sizings = sizingTable();
  const rows = shortcutTable(OUTS);
  return (
    <div class="tables">
      <section class="panel">
        <h3>Bet size, equity needed, defence</h3>
        <table>
          <thead>
            <tr>
              <th>Bet</th>
              <th>Odds offered</th>
              <th>Equity to call</th>
              <th>MDF</th>
              <th>Alpha</th>
            </tr>
          </thead>
          <tbody>
            {sizings.map((r) => (
              <tr key={r.label}>
                <th>{r.label}</th>
                <td>{formatOddsAgainst(r.odds.oddsOffered, 2)}</td>
                <td>{(r.odds.breakEven * 100).toFixed(1)}%</td>
                <td>{(r.odds.mdf * 100).toFixed(1)}%</td>
                <td>{(r.odds.alpha * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Working>
          <Step text="For a bet B into pot P: equity to call = B / (P + 2B). MDF = P / (P + B). Alpha = B / (P + B) = 1 - MDF. Computed for P = 1." />
        </Working>
      </section>

      <section class="panel">
        <h3>Outs, shortcuts and exact figures</h3>
        <table>
          <thead>
            <tr>
              <th>Outs</th>
              <th>Rule of 2</th>
              <th>Next card</th>
              <th>Rule of 4</th>
              <th>Solomon</th>
              <th>By river</th>
              <th>Odds against, by river</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.outs}>
                <th>{r.outs}</th>
                <td>
                  {r.ruleOf2.estimate}% <span class="err">({r.ruleOf2.error >= 0 ? '+' : ''}{r.ruleOf2.error.toFixed(1)})</span>
                </td>
                <td>{r.exactNextCard.toFixed(1)}%</td>
                <td>
                  {r.ruleOf4.estimate}% <span class="err">({r.ruleOf4.error >= 0 ? '+' : ''}{r.ruleOf4.error.toFixed(1)})</span>
                </td>
                <td>
                  {r.solomon.estimate}% <span class="err">({r.solomon.error >= 0 ? '+' : ''}{r.solomon.error.toFixed(1)})</span>
                </td>
                <td>{r.exactTwoCards.toFixed(1)}%</td>
                <td>{formatOddsAgainst(percentToOddsAgainst(r.exactTwoCards))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Working>
          <Step text="Next card: outs / 47 on the flop. By river: 1 - C(47 - outs, 2) / C(47, 2). Rule of 2: outs x 2. Rule of 4: outs x 4. Solomon: outs x 4 - max(0, outs - 8). Bracketed figures are estimate minus exact, in percentage points." />
        </Working>
      </section>
    </div>
  );
}
