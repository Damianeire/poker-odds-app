import { type LearnPage } from './types';
import { parseCards, formatCards } from '../engine/cards';
import { detectOutsToCategory, detectOutsVsHand } from '../engine/outs';
import { Category, outs, pc, one } from './helpers';

const list = (hero: string, board: string, cat: Category): string => formatCards(detectOutsToCategory(parseCards(hero), parseCards(board), cat).outs);

export const m2: LearnPage = {
  id: 'M2',
  title: 'Counting outs',
  summary: 'An out is an unseen card that improves your hand. Count them exactly, then learn when to discount.',
  drills: ['count-outs', 'dirty-outs'],
  blocks: [
    {
      kind: 'terms',
      items: [
        { term: 'Out', definition: () => 'An unseen card that, if dealt next, improves your hand to one you expect to win with.' },
        { term: 'Draw', definition: () => 'A hand that is not yet made but can become strong if the right card comes. A flush draw is four cards to a flush.' },
        { term: 'Open-ended straight draw', definition: () => 'Four consecutive ranks, completed by a card at either end.' },
        { term: 'Gutshot', definition: () => 'A straight draw with a gap in the middle, completed by one rank only.' },
        { term: 'Overcard', definition: () => 'A hole card higher than every card on the board. Pairing it usually makes the best pair.' },
        { term: 'Set', definition: () => 'Three of a kind made with a pocket pair and one board card.' },
        { term: 'Backdoor draw', definition: () => 'A draw that needs both the turn and the river to complete, such as three cards to a flush on the flop.' },
        { term: 'Tainted out', definition: () => 'A card that completes your hand but plausibly gives an opponent a better one.' },
      ],
    },
    { kind: 'h', text: 'Two ways to count' },
    {
      kind: 'p',
      text: () =>
        'The honest definition of an out is a card after which you have the best hand. That depends on what the opponent holds, which you do not know. The practical definition is a card that makes the hand you are drawing to. The app leads with the honest one wherever a villain hand is shown, and drills the practical one everywhere else, because the practical count is what you can do at the table.',
    },
    { kind: 'h', text: 'The standard counts' },
    {
      kind: 'table',
      caption: 'Standard draws, counted by the engine from example hands',
      build: () => ({
        head: ['Draw', 'Example', 'Outs', 'Which cards'],
        rows: [
          ['Flush draw', 'Ah 7h on Kh 9h 2c', String(outs('Ah 7h', 'Kh 9h 2c', Category.Flush)), list('Ah 7h', 'Kh 9h 2c', Category.Flush)],
          ['Open-ended straight draw', '9s 8d on 7h 6c 2s', String(outs('9s 8d', '7h 6c 2s', Category.Straight)), list('9s 8d', '7h 6c 2s', Category.Straight)],
          ['Gutshot', '9s 8d on 6h 5c Kd', String(outs('9s 8d', '6h 5c Kd', Category.Straight)), list('9s 8d', '6h 5c Kd', Category.Straight)],
          ['Two overcards to a pair', 'As Kd on Qh 7c 2d', String(outs('As Kd', 'Qh 7c 2d', Category.OnePair)), list('As Kd', 'Qh 7c 2d', Category.OnePair)],
          ['Pair to three of a kind', '7s 7d on Kh 9c 4d', String(outs('7s 7d', 'Kh 9c 4d', Category.ThreeOfAKind)), list('7s 7d', 'Kh 9c 4d', Category.ThreeOfAKind)],
          ['Set to a full house or better', '8s 8d on 8h Kc 5d', String(outs('8s 8d', '8h Kc 5d', Category.FullHouse)), list('8s 8d', '8h Kc 5d', Category.FullHouse)],
          ['Flush draw plus open-ender', 'Jh Th on 9h 8h 2c', String(outs('Jh Th', '9h 8h 2c', Category.Straight)), list('Jh Th', '9h 8h 2c', Category.Straight)],
          ['Flush draw plus gutshot', 'Jh Th on 9h 7h 2c', String(outs('Jh Th', '9h 7h 2c', Category.Straight)), list('Jh Th', '9h 7h 2c', Category.Straight)],
        ],
      }),
    },
    { kind: 'h', text: 'Double counting' },
    {
      kind: 'p',
      text: () =>
        `With a flush draw and an open-ended straight draw together, the two cards that complete both are counted once. The engine lists them: ${list('Jh Th', '9h 8h 2c', Category.Straight)}. Adding ${outs('Jh Th', '9h 8h 2c', Category.Flush)} flush outs to ${outs('Jh Th', '9h 8h 2c', Category.Straight) - outs('Jh Th', '9h 8h 2c', Category.Flush) + 2} straight outs and getting a number above ${outs('Jh Th', '9h 8h 2c', Category.Straight)} is the classic error.`,
    },
    { kind: 'h', text: 'Backdoor draws' },
    {
      kind: 'p',
      text: () =>
        `Three to a flush on the flop needs two running cards of that suit. Ten of the suit remain among ${47} unseen cards, so the chance is 10/47 times 9/46, about ${pc((10 / 47) * (9 / 46))}. Compare a single out, which hits by the river about ${pc(1 - ((46 / 47) * 45) / 46)} of the time. A backdoor flush draw is worth roughly one out, and a backdoor straight draw somewhat less. Treat them as a small bonus, never as the reason to call.`,
    },
    { kind: 'h', text: 'Tainted outs and discounting' },
    {
      kind: 'p',
      text: () => {
        const hero = parseCards('Ah 7h');
        const villain = parseCards('Kc Kd');
        const board = parseCards('Kh 9h 2c');
        const raw = detectOutsToCategory(hero, board, Category.Flush);
        const clean = detectOutsVsHand(hero, villain, board);
        const tainted = raw.outs.filter((c) => !clean.outs.includes(c));
        return `Holding Ah 7h on Kh 9h 2c, the flush draw has ${raw.count} outs. Against a set of kings, ${formatCards(tainted)} completes the flush but fills villain's full house, so only ${clean.count} cards win. When the villain's hand is hidden, you do not know which outs are tainted. Discounting is a judgement: knock off one or two on a paired or heavily coordinated board, and more when several opponents are in. The engine treats the reduction as plain subtraction; deciding how much to subtract is yours.`;
      },
    },
    {
      kind: 'p',
      text: () =>
        `A worked discount: a flush draw's nine outs on a paired board are perhaps seven clean ones. On the next card that moves the chance from ${pc(one(9))} to ${pc(one(7))}. Small as that looks, it is often the difference between a call and a fold at common bet sizes, which is the subject of module 5.`,
    },
  ],
};
