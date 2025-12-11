import { Card, CardColor, CardValue } from '../types';

export const COLORS = [CardColor.Red, CardColor.Blue, CardColor.Green, CardColor.Yellow];

export const createDeck = (): Card[] => {
  let deck: Card[] = [];
  let idCounter = 0;

  COLORS.forEach(color => {
    deck.push({ id: `c-${idCounter++}`, color, value: CardValue.Zero });
    const values = [
      CardValue.One, CardValue.Two, CardValue.Three, CardValue.Four,
      CardValue.Five, CardValue.Six, CardValue.Seven, CardValue.Eight, CardValue.Nine,
      CardValue.Skip, CardValue.Reverse, CardValue.DrawTwo
    ];
    values.forEach(val => {
      deck.push({ id: `c-${idCounter++}`, color, value: val });
      deck.push({ id: `c-${idCounter++}`, color, value: val });
    });
  });

  for (let i = 0; i < 4; i++) {
    deck.push({ id: `c-${idCounter++}`, color: CardColor.Wild, value: CardValue.Wild });
    deck.push({ id: `c-${idCounter++}`, color: CardColor.Wild, value: CardValue.WildDrawFour });
  }

  return shuffle(deck);
};

export const shuffle = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const isValidMove = (card: Card, topCard: Card, activeColor: CardColor): boolean => {
  if (card.color === CardColor.Wild) return true;
  if (card.color === activeColor) return true;
  if (card.value === topCard.value) return true;
  return false;
};
