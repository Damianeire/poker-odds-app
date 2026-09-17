import { type LearnPage } from './types';
import { ruleOf2, ruleOf4, solomon } from '../engine/shortcuts';
import { probNextCard, probTwoCards } from '../engine/outs';
import { pc, n } from './helpers';

const OUTS = [2, 4, 6, 8, 9, 10, 12, 14, 15, 17, 20];
const signed = (x: number): string => `${x >= 0 ? '+' : ''}${n(x, 1)}`;

export const m4: LearnPage = {
  id: 'M4',
  title: 'The Rule of 2 and 4',
  summary: 'The shortcut, its error, the correction, and the case where using it is a mistake.',
  drills: ['rule-of-2-and-4', 'spot-the-error', 'which-multiplier'],
  blocks: [
    { kind: 'h', text: 'The shortcut' },
    { kind: 'formula', label: 'Rule of 2', formula: 'chance on the next card, in percent = outs x 2', value: () => `9 outs: ${ruleOf2(9).estimate}% against an exact ${pc(probNextCard(9, 47))}.` },
    { kind: 'formula', label: 'Rule of 4', formula: 'chance by the river with two cards to come, in percent = outs x 4', value: () => `9 outs: ${ruleOf4(9).estimate}% against an exact ${pc(probTwoCards(9))}.` },
    {
      kind: 'p',
      text: () =>
        `The Rule of 2 is close everywhere that matters: it understates by about ${n(Math.abs(ruleOf2(9).error), 1)} points at nine outs. The Rule of 4 is close up to about eight outs and then drifts high, because the two-card formula counts the double hit only once while multiplying by 4 counts it twice.`,
    },
    { kind: 'h', text: 'Solomon’s correction' },
    { kind: 'formula', label: 'Corrected Rule of 4', formula: 'outs x 4 - max(0, outs - 8)', value: () => `15 outs: 60 - 7 = ${solomon(15).estimate}%, against an exact ${pc(probTwoCards(15))}. The raw rule says ${ruleOf4(15).estimate}%.` },
    {
      kind: 'table',
      caption: 'Estimate, exact, and signed error in percentage points. Positive means the shortcut overstates.',
      build: () => ({
        head: ['Outs', 'Rule of 2', 'Exact', 'Error', 'Rule of 4', 'Solomon', 'Exact', 'Rule of 4 error', 'Solomon error'],
        rows: OUTS.map((o) => {
          const r2 = ruleOf2(o);
          const r4 = ruleOf4(o);
          const s = solomon(o);
          return [String(o), `${r2.estimate}%`, pc(r2.exact / 100), signed(r2.error), `${r4.estimate}%`, `${s.estimate}%`, pc(r4.exact / 100), signed(r4.error), signed(s.error)];
        }),
      }),
    },
    {
      kind: 'p',
      text: () =>
        'The goal of this module is not to memorise the table. It is to be able to say, for any out count, roughly what the estimate is and roughly how wrong it is. Leaving with both is what makes the estimate usable at the table.',
    },
    { kind: 'h', text: 'When the Rule of 4 is legitimate at all' },
    {
      kind: 'p',
      text: () =>
        'Multiplying by 4 assumes you will see both the turn and the river for the price of this call. That is only guaranteed when villain is all-in, so that no further bet can be made. In a normal spot, calling on the flop buys one card. Villain will usually bet again on the turn, and you will face a new price for the river.',
    },
    {
      kind: 'p',
      text: () =>
        `Using the Rule of 4 on a live flop overstates your equity by roughly double: nine outs is ${pc(probNextCard(9, 47))} for the turn card, not ${pc(probTwoCards(9))}. Default to the Rule of 2. Reach for the Rule of 4 only when villain is all-in. The drill "Which multiplier" grades the choice before any arithmetic, because picking the wrong one is one of the most expensive beginner errors available.`,
    },
  ],
};
