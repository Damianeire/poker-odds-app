import { type LearnPage } from './types';
import { parseCards } from '../engine/cards';
import { enumerate } from '../engine/enumerate';
import { probTwoCards } from '../engine/outs';
import { pc, odds } from './helpers';

const eq = (hero: string, villain: string, board = ''): number => enumerate([parseCards(hero), parseCards(villain)], parseCards(board)).hands[0]!.equity;

export const m6: LearnPage = {
  id: 'M6',
  title: 'Equity',
  summary: 'Your share of the pot in expectation, computed by dealing out every runout.',
  drills: ['preflop-equity', 'multiway-equity'],
  blocks: [
    {
      kind: 'p',
      text: () =>
        'Equity is the fraction of the pot you would collect on average if the hand were played to showdown with no more betting: wins plus half of ties, over all possible runouts. Outs measure one thing you are drawing to. Equity measures everything: hitting, villain hitting, both hitting, running cards nobody expected.',
    },
    {
      kind: 'p',
      text: () =>
        `The two are related but not equal. A flush draw with nine outs on the flop hits ${pc(probTwoCards(9))} of the time, but against a set it has only ${pc(eq('Ah 7h', 'Kc Kd', 'Kh 9h 2c'))}, because some flush cards fill the full house and the set can improve too. Against a lone pair of nines it has ${pc(eq('Ah 7h', '9c 9d', 'Kh 9h 2c'))}. Same draw, same outs, different equity.`,
    },
    { kind: 'h', text: 'Classic matchups, computed' },
    {
      kind: 'table',
      caption: 'Preflop, all-in, every one of the possible boards dealt out.',
      slow: true,
      build: () => {
        const rows: [string, string, string][] = [
          ['Pair against two overcards', '7h 7c', 'As Kd'],
          ['Pair against two undercards', 'Ts Td', '8h 7c'],
          ['Higher pair against lower pair', 'Kh Kc', '7s 7d'],
          ['Dominated: shared top card', 'As Kd', 'Ah Qc'],
          ['Suited version of the same hand', 'As Ks', 'Ah Qc'],
          ['Suited connectors against a big pair', '8h 7h', 'Ac Ad'],
        ];
        return {
          head: ['Matchup', 'Hero', 'Villain', 'Hero equity', 'Odds'],
          rows: rows.map(([name, h, v]) => {
            const e = eq(h, v);
            return [name, h, v, pc(e), e > 0.5 ? `${odds(1 - e)} in favour` : `${odds(e)} against`];
          }),
        };
      },
    },
    {
      kind: 'p',
      text: () =>
        `Read the table for the shape, not the digits. A pair against two overcards is close to a coinflip, slightly favouring the pair. A pair against two undercards is a large favourite. A dominated hand, sharing its top card with a better kicker, is in bad shape because the shared card cancels. Suitedness adds a few points: As Ks against Ah Qc has ${pc(eq('As Ks', 'Ah Qc'))} against ${pc(eq('As Kd', 'Ah Qc'))} offsuit.`,
    },
    { kind: 'h', text: 'Multiway' },
    {
      kind: 'p',
      text: () => {
        const hero = parseCards('Ah Kh');
        const board = parseCards('Kd 8s 3c');
        const vs = [parseCards('Qc Qd'), parseCards('Ts 9s'), parseCards('7h 6h')];
        const e1 = enumerate([hero, vs[0]!], board).hands[0]!.equity;
        const e2 = enumerate([hero, vs[0]!, vs[1]!], board).hands[0]!.equity;
        const e3 = enumerate([hero, ...vs], board).hands[0]!.equity;
        return `Equity collapses as opponents are added, because you must beat all of them and each takes some of the runouts you were winning. Ah Kh on Kd 8s 3c has ${pc(e1)} against Qc Qd alone, ${pc(e2)} when Ts 9s joins, and ${pc(e3)} against all three including 7h 6h. A hand that is a favourite heads-up is often an underdog three ways. The sandbox lets you add opponents one at a time and watch this happen.`;
      },
    },
    { kind: 'h', text: 'Equity realisation' },
    {
      kind: 'p',
      text: () =>
        'Having equity and collecting it are not the same. Equity assumes the hand goes to showdown with no more betting. In practice you may be bet off a hand before your outs arrive, or fail to get paid when they do, or pay off when they do not. Position, stack depth and initiative all affect how much of your equity you realise. Keep the caveat in mind; the numbers here are a ceiling, not a promise.',
    },
  ],
};
