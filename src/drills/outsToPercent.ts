// Drill 2: outs to percentage, one card to come.
// Drill 3: outs to percentage, two cards to come.

import { probNextCard, probTwoCards, unseenCount } from '../engine/outs';
import { ruleOf2, ruleOf4, solomon, percentToOddsAgainst, formatOddsAgainst } from '../engine/shortcuts';
import { choose } from '../engine/math';
import { pickOuts } from './deal';
import { type Drill, type DrillInstance, toleranceForShortcut, num } from './types';

export const outsToPercentOneCard: Drill = {
  id: 'outs-to-percent-one-card',
  module: 'M3',
  title: 'Outs to percentage, one card',
  description: 'Given an out count and the street, state the chance of hitting on the next card.',
  generate(rng, difficulty): DrillInstance {
    const outs = pickOuts(rng, difficulty);
    const boardLength: 3 | 4 = difficulty === 1 ? 3 : rng.pick([3, 4]);
    const unseen = unseenCount(boardLength);
    const exact = probNextCard(outs, unseen) * 100;
    const shortcut = ruleOf2(outs, unseen);
    const street = boardLength === 3 ? 'the flop' : 'the turn';
    const next = boardLength === 3 ? 'turn' : 'river';
    return {
      prompt: {
        text: `You are on ${street} with ${outs} outs. What is the chance the ${next} card is one of them?`,
        facts: [
          { label: 'Outs', value: String(outs) },
          { label: 'Street', value: street },
        ],
        answerLabel: 'Percent',
        ...(difficulty === 3 ? { timeLimitSeconds: 30 } : {}),
      },
      answer: exact,
      unit: 'percent',
      tolerance: toleranceForShortcut([shortcut.error]),
      shortcutAnswer: shortcut.estimate,
      shortcutName: shortcut.name,
      explanation: {
        steps: [
          {
            text: `Unseen cards on ${street}: 52 minus 2 hole cards minus ${boardLength} board cards.`,
            formula: `52 - 2 - ${boardLength}`,
            result: String(unseen),
          },
          {
            text: 'One card to come, so the probability is outs divided by unseen cards.',
            formula: `${outs} / ${unseen}`,
            result: `${num(exact, 2)}%`,
          },
          {
            text: `Rule of 2 estimate: ${outs} x 2.`,
            formula: `${outs} x 2`,
            result: `${shortcut.estimate}%, error ${num(shortcut.error, 2)} points`,
          },
        ],
        summary: `${num(exact, 1)}% on the next card.`,
        alternate: `As odds against: ${formatOddsAgainst(percentToOddsAgainst(exact))}.`,
      },
    };
  },
};

export const outsToPercentTwoCards: Drill = {
  id: 'outs-to-percent-two-cards',
  module: 'M3',
  title: 'Outs to percentage, two cards',
  description: 'On the flop with villain all-in, state the chance of hitting by the river.',
  generate(rng, difficulty): DrillInstance {
    const outs = pickOuts(rng, difficulty);
    const unseen = 47;
    const exact = probTwoCards(outs, unseen) * 100;
    const r4 = ruleOf4(outs);
    const sol = solomon(outs);
    const taught = outs > 8 ? sol : r4;
    const missTwo = choose(unseen - outs, 2);
    const allTwo = choose(unseen, 2);
    return {
      prompt: {
        text: `You are on the flop with ${outs} outs. Villain is all-in, so you will see both the turn and the river. What is the chance you hit by the river?`,
        facts: [
          { label: 'Outs', value: String(outs) },
          { label: 'Cards to come', value: '2' },
        ],
        answerLabel: 'Percent',
        ...(difficulty === 3 ? { timeLimitSeconds: 30 } : {}),
      },
      answer: exact,
      unit: 'percent',
      tolerance: toleranceForShortcut([r4.error, sol.error]),
      shortcutAnswer: taught.estimate,
      shortcutName: taught.name,
      explanation: {
        steps: [
          { text: 'Unseen cards on the flop.', formula: '52 - 2 - 3', result: String(unseen) },
          {
            text: 'Count the two-card runouts that miss every out, over all two-card runouts.',
            formula: `C(${unseen - outs}, 2) / C(${unseen}, 2)`,
            result: `${missTwo} / ${allTwo} = ${num((missTwo / allTwo) * 100, 2)}% miss`,
          },
          {
            text: 'Hitting at least once is one minus missing both.',
            formula: `1 - ${missTwo} / ${allTwo}`,
            result: `${num(exact, 2)}%`,
          },
          {
            text: `Rule of 4: ${outs} x 4.`,
            formula: `${outs} x 4`,
            result: `${r4.estimate}%, error ${num(r4.error, 2)} points`,
          },
          {
            text: `Solomon's correction: subtract one point per out above 8.`,
            formula: `${outs} x 4 - max(0, ${outs} - 8)`,
            result: `${sol.estimate}%, error ${num(sol.error, 2)} points`,
          },
        ],
        summary: `${num(exact, 1)}% by the river.`,
        alternate: `As odds against: ${formatOddsAgainst(percentToOddsAgainst(exact))}.`,
      },
    };
  },
};
