// Drill 8: call or fold. Compare the draw's equity to the price.

import { formatCards } from '../engine/cards';
import { outProbabilities } from '../engine/outs';
import { potOdds } from '../engine/potodds';
import { formatOddsAgainst, percentToOddsAgainst, ruleOf2, ruleOf4, solomon } from '../engine/shortcuts';
import { dealDrawSpot, pickPot, BET_FRACTIONS } from './deal';
import { type Rng } from '../engine/rng';

function chooseBet(
  rng: Rng,
  pot: number,
  hit: number,
  wantCall: boolean,
  minGap: number,
  difficulty: 1 | 2 | 3,
): { bet: number; label: string | null } | null {
  const fits = (bet: number): boolean => {
    const gap = (hit - potOdds(pot, bet).breakEven) * 100;
    return Math.abs(gap) >= minGap && gap > 0 === wantCall;
  };
  if (difficulty <= 2) {
    const options = BET_FRACTIONS.map((f) => ({ bet: Math.round(pot * f.fraction), label: f.label })).filter(
      (o) => o.bet > 0 && fits(o.bet),
    );
    return options.length > 0 ? rng.pick(options) : null;
  }
  for (let i = 0; i < 20; i++) {
    const bet = Math.max(1, Math.round(pot * (0.15 + rng.next() * 2.0)));
    if (fits(bet)) return { bet, label: null };
  }
  return null;
}
import { type Drill, type DrillInstance, type Fact, type PromptSpec, num } from './types';

export const callOrFold: Drill = {
  id: 'call-or-fold',
  repeatIgnoresCards: true,
  answerMayRepeat: true,
  module: 'M5',
  title: 'Call or fold',
  description:
    'A draw, a pot and a bet. Decide, then check the two numbers being compared: your chance of hitting against the equity the price demands.',
  generate(rng, difficulty): DrillInstance {
    const minGap = difficulty === 1 ? 5 : difficulty === 2 ? 2 : 0.5;
    for (let attempt = 0; attempt < 500; attempt++) {
      const boardLength: 3 | 4 = rng.pick([3, 4]);
      const spot = dealDrawSpot(rng, { clean: difficulty === 1, boardLength });
      const outs = spot.outs.count;
      // Difficulty 1 keeps flop spots all-in so the multiplier is never in doubt.
      const allIn = boardLength === 3 && (difficulty === 1 || rng.next() < 0.5);
      const probs = outProbabilities(outs, boardLength);
      // Calling on the flop against a live villain buys one card; all-in buys two.
      const hit = boardLength === 3 && allIn ? probs.byRiver : probs.nextCard;
      const pot = pickPot(rng, difficulty);
      // Decide the intended answer first, then find a sizing that produces it,
      // so the drill is balanced between calls and folds.
      const wantCall = rng.next() < 0.5;
      const sizing = chooseBet(rng, pot, hit, wantCall, minGap, difficulty);
      if (!sizing) continue;
      const { bet, label } = sizing;
      const po = potOdds(pot, bet);
      const gap = (hit - po.breakEven) * 100;
      const call = gap > 0;
      const facts: Fact[] = [
        { label: 'Pot before the bet', value: String(pot) },
        { label: 'Bet faced', value: `${bet}${label ? ` (${label})` : ''}` },
        { label: 'Street', value: boardLength === 3 ? (allIn ? 'flop, villain all-in' : 'flop, villain has chips behind') : 'turn' },
      ];
      if (difficulty === 1) facts.push({ label: 'Outs', value: String(outs) });
      const cardsToCome = boardLength === 3 && allIn ? 2 : 1;
      const shortcut = cardsToCome === 2 ? (outs > 8 ? solomon(outs) : ruleOf4(outs)) : ruleOf2(outs, probs.unseen);
      const prompt: PromptSpec = {
        text:
          difficulty === 1
            ? `You have ${outs} outs to ${spot.target.label}. Call or fold?`
            : `You are drawing to ${spot.target.label}. Call or fold?`,
        heroCards: spot.hero,
        board: spot.board,
        facts,
        choices: ['Call', 'Fold'],
        ...(difficulty === 3 ? { timeLimitSeconds: 45 } : {}),
      };
      const hitPct = hit * 100;
      const needPct = po.breakEven * 100;
      return {
        prompt,
        answer: call ? 0 : 1,
        unit: 'count',
        tolerance: 0,
        explanation: {
          steps: [
            { text: `Outs to ${spot.target.label}: ${formatCards(spot.outs.outs)}.`, result: `${outs} outs` },
            {
              text:
                cardsToCome === 2
                  ? 'Villain is all-in, so you see two cards for this call.'
                  : boardLength === 3
                    ? 'Villain has chips behind, so this call buys only the turn card. Use the one-card figure.'
                    : 'One card to come.',
              formula: cardsToCome === 2 ? `1 - C(${probs.unseen - outs}, 2) / C(${probs.unseen}, 2)` : `${outs} / ${probs.unseen}`,
              result: `${num(hitPct, 1)}% (${shortcut.name}: ${shortcut.estimate}%)`,
            },
            {
              text: 'Equity the price demands: bet over the final pot.',
              formula: `${bet} / (${pot} + 2 x ${bet})`,
              result: `${num(needPct, 1)}%`,
            },
            {
              text: `Compare: ${num(hitPct, 1)}% to hit against ${num(needPct, 1)}% needed.`,
              result: call ? 'Call. Your chance exceeds the price.' : 'Fold. The price is higher than your chance.',
            },
          ],
          summary: `${call ? 'Call' : 'Fold'}: ${num(hitPct, 1)}% to hit versus ${num(needPct, 1)}% needed.`,
          alternate: `In ratios: pot offers ${formatOddsAgainst(po.oddsOffered, 1)}, draw is ${formatOddsAgainst(percentToOddsAgainst(hitPct), 1)} against.`,
        },
      };
    }
    throw new Error('could not build a call-or-fold spot');
  },
};
