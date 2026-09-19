// Drill 17: dirty outs. Drill 21: villain-dependent call.
// Drill 25: which multiplier. Drill 26: which tool.

import { formatCards, fullDeck } from '../engine/cards';
import { evaluate, describeScore, categoryOf, Category } from '../engine/evaluator';
import { detectOutsToCategory, detectOutsVsHand, heroAhead, outProbabilities, probTwoCards, probNextCard } from '../engine/outs';
import { profiledCall, type VillainProfile } from '../engine/profile';
import { ruleOf2, ruleOf4, solomon } from '../engine/shortcuts';
import { dealDrawSpot, pickPot, pickBet, DRAW_TARGETS, isGenuineDraw } from './deal';
import { type Drill, type DrillInstance, num } from './types';

// Level 1 accepts about one deal in 600, so the count needed is roughly geometric with that mean.
// A cap of 5,000 failed about once in 3,000 seeds; this one makes a failure practically impossible.
const DIRTY_OUTS_MAX_ATTEMPTS = 50000;

export const dirtyOuts: Drill = {
  id: 'dirty-outs',
  repeatIgnoresCards: true,
  module: 'M2',
  title: 'Dirty outs',
  description: 'A coordinated board and a villain hand face up. Start from the raw out count for your draw and discount the cards that complete it but still lose.',
  generate(rng, difficulty): DrillInstance {
    for (let attempt = 0; attempt < DIRTY_OUTS_MAX_ATTEMPTS; attempt++) {
      const cards = rng.sample(fullDeck(), 7);
      const hero = cards.slice(0, 2);
      const villain = cards.slice(2, 4);
      const board = cards.slice(4, 7);
      if (heroAhead(hero, villain, board)) continue;
      const heroCat = categoryOf(evaluate([...hero, ...board]));
      // Villain's cards are dead: they cannot be your outs.
      const drawTo = (t: (typeof DRAW_TARGETS)[number]) => detectOutsToCategory(hero, board, t.category, villain);
      const target = DRAW_TARGETS.find(
        (t) => t.category > heroCat && (t.category === Category.Flush || t.category === Category.Straight) && isGenuineDraw(hero, board, t.category, drawTo(t)),
      );
      if (!target) continue;
      const raw = drawTo(target);
      const clean = detectOutsVsHand(hero, villain, board);
      const rawSet = new Set(raw.outs);
      const tainted = raw.outs.filter((c) => !clean.outs.includes(c));
      const extra = clean.outs.filter((c) => !rawSet.has(c));
      if (tainted.length < 1) continue;
      if (difficulty === 1 && extra.length > 0) continue;
      if (difficulty === 1 && tainted.length > 3) continue;
      const winning = clean.count;
      return {
        prompt: {
          text: `You are drawing to ${target.label}, ${raw.count} raw outs. Villain’s hand is face up. How many cards actually win for you on the next card?`,
          heroCards: hero,
          board,
          villainCards: villain,
          facts: [{ label: 'Raw outs', value: String(raw.count) }],
          answerLabel: 'Clean outs',
          ...(difficulty === 3 ? { timeLimitSeconds: 60 } : {}),
        },
        answer: winning,
        unit: 'count',
        tolerance: 0,
        explanation: {
          steps: [
            { text: `You: ${describeScore(evaluate([...hero, ...board]))}. Villain: ${describeScore(evaluate([...villain, ...board]))}.` },
            { text: `Raw outs to ${target.label}: ${formatCards(raw.outs)}.`, result: String(raw.count) },
            { text: `Tainted: they complete your hand but villain still wins: ${formatCards(tainted)}.`, result: `-${tainted.length}` },
            ...(extra.length > 0 ? [{ text: `Cards that win without completing the draw: ${formatCards(extra)}.`, result: `+${extra.length}` }] : []),
            { text: 'Cards that put you ahead after the next card.', result: String(winning) },
            { text: 'With villain’s hand hidden the discount is a judgement. The more coordinated the board, the more you should take off.' },
          ],
          summary: `${winning} clean outs from ${raw.count} raw.`,
        },
      };
    }
    throw new Error('could not build a dirty outs spot');
  },
};

type Param = 'payoffPropensity' | 'aggression' | 'foldFrequency' | 'rangeWidth';

export const villainDependent: Drill = {
  id: 'villain-dependent',
  repeatIgnoresCards: true,
  module: 'M7',
  title: 'Villain-dependent call',
  description: 'The same hand, board and bet against two villain profiles. Decide for each; the explanation names the parameter that flipped the answer.',
  generate(rng, difficulty): DrillInstance {
    for (let attempt = 0; attempt < 500; attempt++) {
      const spot = dealDrawSpot(rng, { clean: difficulty === 1, boardLength: 4 });
      const outs = spot.outs.count;
      const e = outProbabilities(outs, 4).nextCard;
      const pot = pickPot(rng, difficulty);
      const { bet, label } = pickBet(rng, pot, difficulty);
      const param: Param = rng.pick(['payoffPropensity', 'aggression']);
      const base: VillainProfile = { rangeWidth: 0.3, foldFrequency: 0.4, payoffPropensity: rng.pick([0.4, 0.6, 0.8]), aggression: rng.pick([0.2, 0.4]) };
      const a: VillainProfile = { ...base };
      const b: VillainProfile = { ...base };
      if (param === 'payoffPropensity') {
        a.payoffPropensity = rng.pick([0, 0.1, 0.2]);
        b.payoffPropensity = rng.pick([1, 1.5, 2]);
      } else {
        a.aggression = 0;
        b.aggression = 1;
      }
      const ra = profiledCall(a, pot, bet, e);
      const rb = profiledCall(b, pot, bet, e);
      const wantFlip = difficulty < 3 || rng.next() < 0.7;
      if (wantFlip && ra.call === rb.call) continue;
      const answer = ra.call && rb.call ? 2 : ra.call ? 0 : rb.call ? 1 : 3;
      const describe = (p: VillainProfile) => `pays off ${num(p.payoffPropensity, 1)} x pot when you hit, aggression ${num(p.aggression, 1)}`;
      const flipped = ra.call === rb.call ? 'No parameter flipped the answer.' : param === 'payoffPropensity' ? 'Payoff propensity flipped it: it sets the implied gain X.' : 'Aggression flipped it: it sets the reverse implied loss.';
      return {
        prompt: {
          text: `Turn. Villain bets ${bet}${label ? ` (${label})` : ''} into ${pot}. You have ${outs} outs to ${spot.target.label}. Villain A: ${describe(a)}. Villain B: ${describe(b)}. Against whom is calling correct?`,
          heroCards: spot.hero,
          board: spot.board,
          facts: [
            { label: 'Pot', value: String(pot) },
            { label: 'Bet', value: String(bet) },
            { label: 'Outs', value: String(outs) },
          ],
          choices: ['A only', 'B only', 'Both', 'Neither'],
          ...(difficulty === 3 ? { timeLimitSeconds: 90 } : {}),
        },
        answer,
        unit: 'count',
        tolerance: 0,
        explanation: {
          steps: [
            { text: 'Your chance on the river.', formula: `${outs} / 46`, result: `${num(e * 100, 1)}%` },
            { text: 'Immediate break-even.', formula: `${bet} / (${pot} + 2 x ${bet})`, result: `${num(ra.immediateBreakEven * 100, 1)}%` },
            { text: `Villain A: net implied ${num(ra.implied.net, 0)} (gain ${num(ra.implied.impliedGain, 0)}, reverse loss ${num(ra.implied.reverseLoss, 0)}). Equity needed ${num(ra.equityNeeded * 100, 1)}%. EV ${num(ra.total, 1)}.`, result: ra.call ? 'call' : 'fold' },
            { text: `Villain B: net implied ${num(rb.implied.net, 0)} (gain ${num(rb.implied.impliedGain, 0)}, reverse loss ${num(rb.implied.reverseLoss, 0)}). Equity needed ${num(rb.equityNeeded * 100, 1)}%. EV ${num(rb.total, 1)}.`, result: rb.call ? 'call' : 'fold' },
            { text: flipped },
            { text: 'Reverse loss here is modelled as aggression x bet, and implied gain as payoff propensity x pot. Both are estimates fed into exact formulas.' },
          ],
          summary: `${['Call against A only', 'Call against B only', 'Call against both', 'Fold against both'][answer]}. ${flipped}`,
        },
      };
    }
    throw new Error('could not build a villain-dependent spot');
  },
};

export const whichMultiplier: Drill = {
  id: 'which-multiplier',
  repeatIgnoresCards: true,
  module: 'M4',
  title: 'Which multiplier',
  description: 'A flop spot. Villain is either all-in or has chips behind. Choose the Rule of 2 or the Rule of 4 before you estimate. The choice is what is graded.',
  generate(rng, difficulty): DrillInstance {
    const spot = dealDrawSpot(rng, { clean: difficulty === 1, boardLength: 3 });
    const outs = spot.outs.count;
    const allIn = rng.next() < 0.5;
    const pot = pickPot(rng, difficulty);
    const { bet, label } = pickBet(rng, pot, difficulty);
    const stackNote = allIn ? `Villain bets ${bet}${label ? ` (${label})` : ''} and is all-in.` : `Villain bets ${bet}${label ? ` (${label})` : ''} with ${Math.round(pot * rng.pick([2, 3, 4]))} behind.`;
    const two = ruleOf2(outs);
    const four = ruleOf4(outs);
    const sol = solomon(outs);
    return {
      prompt: {
        text: `Flop. ${stackNote} You have ${outs} outs. Which multiplier applies to this call?`,
        heroCards: spot.hero,
        board: spot.board,
        facts: [
          { label: 'Pot', value: String(pot) },
          { label: 'Bet', value: String(bet) },
          { label: 'Villain', value: allIn ? 'all-in' : 'has chips behind' },
        ],
        choices: ['Rule of 2 (one card)', 'Rule of 4 (two cards)'],
        ...(difficulty === 3 ? { timeLimitSeconds: 15 } : {}),
      },
      answer: allIn ? 1 : 0,
      unit: 'count',
      tolerance: 0,
      explanation: {
        steps: [
          {
            text: allIn
              ? 'Villain is all-in, so no more betting is possible. Your call buys both the turn and the river.'
              : 'Villain has chips behind and will usually bet again on the turn. Your call buys one card only.',
            result: allIn ? 'Rule of 4' : 'Rule of 2',
          },
          { text: 'Rule of 2 estimate and exact one-card figure.', formula: `${outs} x 2`, result: `${two.estimate}% vs ${num(two.exact, 1)}%` },
          { text: 'Rule of 4 estimate, Solomon, and exact two-card figure.', formula: `${outs} x 4`, result: `${four.estimate}% (Solomon ${sol.estimate}%) vs ${num(four.exact, 1)}%` },
          { text: allIn ? 'Using the Rule of 2 here would understate your equity by about half.' : 'Using the Rule of 4 here would overstate your equity by about double. This is one of the most expensive beginner errors.' },
        ],
        summary: `${allIn ? 'Rule of 4' : 'Rule of 2'}: ${allIn ? `${num(probTwoCards(outs) * 100, 1)}% by the river` : `${num(probNextCard(outs, 47) * 100, 1)}% on the turn`}.`,
      },
    };
  },
};

interface ToolSpot {
  text: string;
  tool: 0 | 1;
  why: string;
}

const TOOL_SPOTS: ToolSpot[] = [
  { text: 'Flop. You have a flush draw. Villain bets and is all-in.', tool: 0, why: 'No further betting is possible, so the price you see is the whole price.' },
  { text: 'River. Villain bets. You have a hand that beats some bluffs.', tool: 0, why: 'There are no later streets. The decision is the current price against your equity.' },
  { text: 'River. You are considering a pure bluff with no showdown value.', tool: 0, why: 'A bluff is priced by the pot now: alpha = B / (P + B). Nothing later changes it.' },
  { text: 'Flop. You have a flush draw. Villain bets a third of the pot with 4 pots behind.', tool: 1, why: 'Money can still go in on later streets, so what you win when you hit is not fixed by the current pot.' },
  { text: 'Turn. You have a gutshot. Villain bets half pot with a large stack behind.', tool: 1, why: 'A river bet can still be won or lost, so future winnings are part of the price.' },
  { text: 'Preflop. You have a small pocket pair. Villain raises with 100 big blinds behind.', tool: 1, why: 'Set mining is the canonical implied odds decision: the call is for what you win after you hit.' },
  { text: 'Turn. Villain bets and is all-in for less than the pot.', tool: 0, why: 'All-in means no further betting. Pot odds only.' },
  { text: 'Flop. You have an open-ended straight draw. Villain bets two thirds of the pot with 2 pots behind.', tool: 1, why: 'There are chips behind and a turn and river to come. The current price understates the real one.' },
  { text: 'River. Villain checks to you. You hold the best possible hand and are choosing a bet size.', tool: 0, why: 'Sizing a value bet on the river is about the price you offer villain now. Pot odds, from the other side.' },
];

export const whichTool: Drill = {
  id: 'which-tool',
  module: 'M5',
  title: 'Which tool',
  description: 'A described spot. Say whether the decision is a pot odds calculation or an implied odds calculation. Choosing the tool is a separate skill from using it.',
  generate(rng, difficulty): DrillInstance {
    const spot = rng.pick(TOOL_SPOTS);
    return {
      prompt: {
        text: `${spot.text} Which calculation does this spot call for?`,
        choices: ['Pot odds', 'Implied odds'],
        ...(difficulty === 3 ? { timeLimitSeconds: 12 } : difficulty === 2 ? { timeLimitSeconds: 25 } : {}),
      },
      answer: spot.tool,
      unit: 'count',
      tolerance: 0,
      explanation: {
        steps: [
          { text: spot.why },
          { text: 'Pot odds apply when no further betting can occur: villain is all-in, it is the river, or you are pricing a bluff. Everywhere else, future streets matter and implied odds are the right frame.' },
        ],
        summary: `${spot.tool === 0 ? 'Pot odds' : 'Implied odds'}. ${spot.why}`,
      },
    };
  },
};
