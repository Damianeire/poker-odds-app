// Drill 16: classic preflop matchups. Drill 18: multiway equity.

import { fullDeck, formatCards, makeCard, RANK_CHARS, type Card } from '../engine/cards';
import { enumerate } from '../engine/enumerate';
import { describeScore, evaluate } from '../engine/evaluator';
import { type Rng } from '../engine/rng';
import { formatOddsAgainst, percentToOddsAgainst } from '../engine/shortcuts';
import { type Drill, type DrillInstance, num } from './types';

interface Matchup {
  name: string;
  hero: Card[];
  villain: Card[];
  note: string;
}

function dealMatchup(rng: Rng, difficulty: 1 | 2 | 3): Matchup {
  const kinds = difficulty === 1 ? ['pairVsOver', 'pairVsUnder', 'dominated'] : ['pairVsOver', 'pairVsUnder', 'dominated', 'suitedness', 'pairVsPair', 'twoLive'];
  const kind = rng.pick(kinds);
  const suits = () => rng.sample([0, 1, 2, 3], 4);
  const s = suits();
  switch (kind) {
    case 'pairVsOver': {
      const p = rng.range(2, 12);
      const a = rng.range(p + 2, 14);
      const b = rng.range(p + 1, a - 1);
      return { name: 'pair against two overcards', hero: [makeCard(p, s[0]!), makeCard(p, s[1]!)], villain: [makeCard(a, s[2]!), makeCard(b, s[3]!)], note: 'Roughly a coinflip, slightly favouring the pair.' };
    }
    case 'pairVsUnder': {
      const p = rng.range(5, 14);
      const a = rng.range(3, p - 1);
      const b = rng.range(2, a - 1);
      return { name: 'pair against two undercards', hero: [makeCard(p, s[0]!), makeCard(p, s[1]!)], villain: [makeCard(a, s[2]!), makeCard(b, s[3]!)], note: 'The pair is a large favourite.' };
    }
    case 'dominated': {
      const top = rng.range(10, 14);
      const k1 = rng.range(3, top - 1);
      let k2 = rng.range(2, top - 1);
      while (k2 === k1) k2 = rng.range(2, top - 1);
      const hi = Math.max(k1, k2);
      const lo = Math.min(k1, k2);
      return { name: 'dominated hand', hero: [makeCard(top, s[0]!), makeCard(hi, s[1]!)], villain: [makeCard(top, s[2]!), makeCard(lo, s[3]!)], note: 'Sharing the top card, the better kicker dominates.' };
    }
    case 'suitedness': {
      const a = rng.range(8, 14);
      const b = rng.range(2, a - 1);
      const p = rng.range(2, 14);
      if (p === a || p === b) return dealMatchup(rng, difficulty);
      const suited = rng.next() < 0.5;
      const villainSuits = rng.sample([0, 1, 2, 3].filter((x) => x !== s[0]), 2);
      return {
        name: suited ? 'suited hand against a pair' : 'offsuit hand against a pair',
        hero: [makeCard(a, s[0]!), makeCard(b, suited ? s[0]! : s[1]!)],
        villain: [makeCard(p, villainSuits[0]!), makeCard(p, villainSuits[1]!)],
        note: 'Suitedness is worth a few points of equity, not more.',
      };
    }
    case 'pairVsPair': {
      const a = rng.range(3, 14);
      const b = rng.range(2, a - 1);
      return { name: 'pair against a lower pair', hero: [makeCard(a, s[0]!), makeCard(a, s[1]!)], villain: [makeCard(b, s[2]!), makeCard(b, s[3]!)], note: 'The higher pair is about a 4 to 1 favourite.' };
    }
    default: {
      const ranks = rng.sample([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], 4);
      return { name: 'two unpaired hands, no shared cards', hero: [makeCard(ranks[0]!, s[0]!), makeCard(ranks[1]!, s[1]!)], villain: [makeCard(ranks[2]!, s[2]!), makeCard(ranks[3]!, s[3]!)], note: 'Higher cards win more often; connectedness and suitedness add a little.' };
    }
  }
}

export const preflopEquity: Drill = {
  id: 'preflop-equity',
  module: 'M6',
  title: 'Preflop matchup equity',
  description: 'A classic all-in matchup. Estimate your equity. Graded against full enumeration of every runout.',
  generate(rng, difficulty): DrillInstance {
    const m = dealMatchup(rng, difficulty);
    const r = enumerate([m.hero, m.villain], []);
    const e = r.hands[0]!.equity * 100;
    const tolerance = difficulty === 1 ? 5 : difficulty === 2 ? 3 : 2;
    return {
      prompt: {
        text: `All-in preflop: ${m.name}. Estimate your equity.`,
        heroCards: m.hero,
        villainCards: m.villain,
        answerLabel: 'Equity',
        ...(difficulty === 3 ? { timeLimitSeconds: 20 } : {}),
      },
      answer: e,
      unit: 'percent',
      tolerance,
      explanation: {
        steps: [
          { text: `All ${r.runouts.toLocaleString()} five-card boards were dealt and both hands scored.`, result: `win ${num(r.hands[0]!.win * 100, 1)}%, tie ${num(r.hands[0]!.tie * 100, 1)}%, lose ${num(r.hands[0]!.loss * 100, 1)}%` },
          { text: 'Equity is wins plus half of ties.', formula: `${num(r.hands[0]!.win * 100, 1)} + ${num(r.hands[0]!.tie * 100, 1)} / 2`, result: `${num(e, 1)}%` },
          { text: m.note },
        ],
        summary: `${formatCards(m.hero)} has ${num(e, 1)}% against ${formatCards(m.villain)}.`,
        alternate: `As odds: ${e > 50 ? `${formatOddsAgainst(percentToOddsAgainst(100 - e), 2)} in your favour` : `${formatOddsAgainst(percentToOddsAgainst(e), 2)} against you`}.`,
      },
    };
  },
};

export const multiwayEquity: Drill = {
  id: 'multiway-equity',
  module: 'M6',
  title: 'Multiway equity',
  description: 'The same hand and board against one, two or three opponents. Estimate your equity against the number shown.',
  generate(rng, difficulty): DrillInstance {
    const opponents = difficulty === 1 ? rng.pick([1, 2]) : rng.range(1, 3);
    let hero: Card[] = [];
    let villains: Card[][] = [];
    let board: Card[] = [];
    let results: number[] = [];
    let e = 0;
    // Retry until hero is neither drawing dead nor locked, so the estimate is a real question.
    for (let attempt = 0; attempt < 1000; attempt++) {
      const cards = rng.sample(fullDeck(), 2 + 2 * 3 + 3);
      hero = cards.slice(0, 2);
      villains = [cards.slice(2, 4), cards.slice(4, 6), cards.slice(6, 8)];
      board = cards.slice(8, 11);
      results = [1, 2, 3].map((n) => enumerate([hero, ...villains.slice(0, n)], board).hands[0]!.equity * 100);
      e = results[opponents - 1]!;
      if (e > 0.5 && e < 99.5) break;
    }
    const shown = villains.slice(0, opponents);
    return {
      prompt: {
        text: `Flop, ${opponents} opponent${opponents > 1 ? 's' : ''} all-in with the hands shown. Estimate your equity.`,
        heroCards: hero,
        board,
        villainCards: shown.flat(),
        facts: [{ label: 'Your hand now', value: describeScore(evaluate([...hero, ...board])) }],
        answerLabel: 'Equity',
        ...(difficulty === 3 ? { timeLimitSeconds: 30 } : {}),
      },
      answer: e,
      unit: 'percent',
      tolerance: 5,
      explanation: {
        steps: [
          { text: `Every runout enumerated against ${opponents} hand${opponents > 1 ? 's' : ''}.`, result: `${num(e, 1)}%` },
          { text: 'The same hand and board as opponents are added one at a time:', result: `vs 1: ${num(results[0]!, 1)}%, vs 2: ${num(results[1]!, 1)}%, vs 3: ${num(results[2]!, 1)}%` },
          { text: `Villain hands: ${shown.map((v) => `${formatCards(v)} (${describeScore(evaluate([...v, ...board]))})`).join('; ')}.` },
          { text: 'Equity collapses multiway because you must beat every hand, and each extra hand takes some of the runouts you were winning.' },
        ],
        summary: `${num(e, 1)}% against ${opponents} opponent${opponents > 1 ? 's' : ''}.`,
        alternate: `As odds: ${formatOddsAgainst(percentToOddsAgainst(e), 2)} against.`,
      },
    };
  },
};

export { RANK_CHARS };
