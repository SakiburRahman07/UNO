import type { Card, CardColor, CardValue, GameState, Player } from "@/types/uno";

const COLORS: CardColor[] = ["red", "blue", "green", "yellow"];

let cardIdCounter = 0;
function nextCardId(): string {
  cardIdCounter += 1;
  return `c${cardIdCounter.toString(36)}`;
}

/** Build the standard 108-card UNO deck. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const color of COLORS) {
    deck.push({ id: nextCardId(), color, value: "0" });
    for (let n = 1; n <= 9; n++) {
      const value = String(n) as CardValue;
      deck.push({ id: nextCardId(), color, value });
      deck.push({ id: nextCardId(), color, value });
    }
    for (const value of ["skip", "reverse", "draw2"] as CardValue[]) {
      deck.push({ id: nextCardId(), color, value });
      deck.push({ id: nextCardId(), color, value });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: nextCardId(), color: "wild", value: "wild" });
    deck.push({ id: nextCardId(), color: "wild", value: "wild4" });
  }
  return deck;
}

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function isWild(card: Card): boolean {
  return card.color === "wild";
}

export function isActionCard(value: CardValue): boolean {
  return (
    value === "skip" || value === "reverse" || value === "draw2"
  );
}

export function isDrawCard(value: CardValue): boolean {
  return value === "draw2" || value === "wild4";
}

/** Does the hand contain a card matching the given color? (for Wild Draw Four rule) */
export function hasMatchingColorCard(hand: Card[], color: CardColor): boolean {
  if (color === "wild") return false;
  return hand.some((c) => c.color === color);
}

/** Basic color/value match against the active color and top card. */
export function matchesTop(card: Card, top: Card, activeColor: CardColor): boolean {
  if (isWild(card)) return true;
  if (card.color === activeColor) return true;
  if (!isWild(top) && card.value === top.value) return true;
  return false;
}

/**
 * Full validation of whether a card can be played right now.
 * - When a draw stack is pending, only a matching draw card may stack.
 * - Wild Draw Four may only be played when the player holds no card of the active color.
 */
export function canPlay(
  card: Card,
  hand: Card[],
  top: Card,
  activeColor: CardColor,
  drawStack: number,
): boolean {
  if (drawStack > 0) {
    if (top.value === "draw2") return card.value === "draw2";
    if (top.value === "wild4") return card.value === "wild4";
    return false;
  }
  if (!matchesTop(card, top, activeColor)) return false;
  if (card.value === "wild4") {
    // Official rule: only when you have no card of the active color.
    return !hasMatchingColorCard(hand, activeColor);
  }
  return true;
}

/** All cards in the hand that are legal to play right now. */
export function getPlayableCards(
  hand: Card[],
  top: Card,
  activeColor: CardColor,
  drawStack: number,
): Card[] {
  return hand.filter((c) => canPlay(c, hand, top, activeColor, drawStack));
}

/** Advance the turn pointer by `steps` in the current direction. */
export function advanceTurn(state: GameState, steps = 1): void {
  const n = state.players.length;
  if (n === 0) return;
  state.turn = ((state.turn + state.direction * steps) % n + n) % n;
}

export function nextPlayerId(state: GameState, steps = 1): string | null {
  const n = state.players.length;
  if (n === 0) return null;
  const idx = ((state.turn + state.direction * steps) % n + n) % n;
  return state.players[idx].id;
}

/**
 * Apply the effect of a freshly-played card onto the game state.
 * Assumes the card has already been removed from the player's hand and pushed
 * onto the discard pile, and `activeColor` has been set for wilds.
 * Returns a human-readable event string and the id of a skipped player if any.
 * Does NOT perform penalty draws (those happen in the engine draw action).
 */
export function applyCardEffect(state: GameState, card: Card): {
  event: string;
  skippedId: string | null;
} {
  let skippedId: string | null = null;

  switch (card.value) {
    case "skip": {
      skippedId = nextPlayerId(state, 1);
      advanceTurn(state, 2);
      return { event: `Skip — ${playerName(state, skippedId)} is skipped`, skippedId };
    }
    case "reverse": {
      if (state.players.length === 2) {
        // Two-player reverse acts like a skip.
        skippedId = nextPlayerId(state, 1);
        advanceTurn(state, 2);
        return { event: "Reverse", skippedId };
      }
      state.direction *= -1;
      advanceTurn(state, 1);
      return { event: "Direction reversed", skippedId };
    }
    case "draw2": {
      state.drawStack += 2;
      advanceTurn(state, 1);
      return { event: `Draw Two — stack is ${state.drawStack}`, skippedId };
    }
    case "wild4": {
      state.drawStack += 4;
      advanceTurn(state, 1);
      return { event: `Wild Draw Four — stack is ${state.drawStack}`, skippedId };
    }
    case "wild": {
      advanceTurn(state, 1);
      return { event: "Wild played", skippedId };
    }
    default: {
      advanceTurn(state, 1);
      return { event: "", skippedId };
    }
  }
}

function playerName(state: GameState, id: string | null): string {
  if (!id) return "player";
  return state.players.find((p) => p.id === id)?.name ?? "player";
}

/** Draw `count` cards from the deck into a player's hand. Reshuffles the discard
 *  if needed, and generates a fresh deck if still empty — the draw pile never
 *  runs out, so players can always draw. */
export function drawFromDeck(state: GameState, playerId: string, count: number): Card[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) reshuffleDiscardIntoDeck(state);
    if (state.deck.length === 0) state.deck = shuffle(createDeck());
    const card = state.deck.pop()!;
    player.hand.push(card);
    drawn.push(card);
  }
  return drawn;
}

/** Move all but the top discard card back into the deck and reshuffle. */
export function reshuffleDiscardIntoDeck(state: GameState): void {
  if (state.discard.length <= 1) return;
  const top = state.discard.pop()!;
  const rest = state.discard;
  state.discard = [top];
  state.deck = shuffle(rest);
}

/** Pick a representative bot card: prefer action/draw cards, then any playable. */
export function chooseBotCard(playable: Card[], hand: Card[]): Card | null {
  if (playable.length === 0) return null;
  // Prefer draw2/wild4 to pile pressure, then skip/reverse, then numbers.
  const priority: CardValue[] = ["wild4", "draw2", "skip", "reverse", "wild"];
  for (const value of priority) {
    const match = playable.find((c) => c.value === value);
    if (match) return match;
  }
  // Otherwise play the highest number we have that's playable.
  const numbers = playable
    .filter((c) => !Number.isNaN(Number(c.value)))
    .sort((a, b) => Number(b.value) - Number(a.value));
  if (numbers.length > 0) return numbers[0];
  return playable[0];
}

/** Choose a wild color for a bot — the most common color in its hand. */
export function chooseBotColor(hand: Card[]): CardColor {
  const counts: Record<string, number> = { red: 0, blue: 0, green: 0, yellow: 0 };
  for (const c of hand) {
    if (c.color !== "wild") counts[c.color] = (counts[c.color] ?? 0) + 1;
  }
  let best: CardColor = "red";
  let bestCount = -1;
  for (const color of COLORS) {
    if (counts[color] > bestCount) {
      best = color;
      bestCount = counts[color];
    }
  }
  return best;
}

export { COLORS };
