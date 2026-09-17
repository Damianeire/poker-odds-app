import { type Card, rankChar, rankOf, suitOf, SUITS, SUIT_GLYPHS, describeCard } from '../engine/cards';

export function CardView({ card }: { card: Card }) {
  const s = suitOf(card);
  return (
    <span class={`card suit-${SUITS[s]}`} role="img" aria-label={describeCard(card)}>
      <span class="rank">{rankChar(rankOf(card))}</span>
      <span class="suit" aria-hidden="true">
        {SUIT_GLYPHS[s]}
      </span>
    </span>
  );
}

export function CardRow({ label, cards }: { label: string; cards: readonly Card[] }) {
  return (
    <div class="card-row">
      <span class="card-row-label">{label}</span>
      <span class="cards">
        {cards.map((c) => (
          <CardView key={c} card={c} />
        ))}
      </span>
    </div>
  );
}
