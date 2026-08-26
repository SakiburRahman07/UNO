import type {
  Card,
  CardColor,
  GameState,
  Player,
  PlayerRanking,
  PublicGameState,
  Room,
} from "@/types/uno";
import { INITIAL_HAND_SIZE, MIN_PLAYERS, UNO_PENALTY_CARDS } from "@/lib/constants";
import {
  advanceTurn,
  applyCardEffect,
  canPlay,
  chooseBotCard,
  chooseBotColor,
  createDeck,
  drawFromDeck,
  getPlayableCards,
  isActionCard,
  isWild,
  shuffle,
} from "@/server/unoRules";
import { toPublicPlayer } from "@/server/roomManager";

function now(): number {
  return Date.now();
}

function assertTurn(state: GameState, playerId: string): Player {
  const current = state.players[state.turn];
  if (!current) throw new Error("No active player");
  if (current.id !== playerId) throw new Error("It's not your turn");
  return current;
}

function assertNoPending(state: GameState): void {
  if (state.pendingColorPick) throw new Error("Waiting for a color choice");
}

function resetTurnFlags(state: GameState): void {
  state.hasDrawnThisTurn = false;
  state.lastDrawnCardId = null;
}

function syncUno(player: Player): void {
  if (player.hand.length !== 1) player.saidUno = false;
}

function buildRankings(state: GameState): PlayerRanking[] {
  const sorted = [...state.players].sort((a, b) => a.hand.length - b.hand.length);
  const rankings: PlayerRanking[] = [];
  let lastCards = -1;
  let lastRank = 0;
  sorted.forEach((p, i) => {
    if (p.hand.length === lastCards) {
      // tie: same rank as previous
    } else {
      lastRank = i + 1;
      lastCards = p.hand.length;
    }
    rankings.push({
      playerId: p.id,
      name: p.name,
      isBot: p.isBot,
      cardsLeft: p.hand.length,
      rank: lastRank,
      isWinner: p.id === state.winnerId,
    });
  });
  return rankings;
}

function declareWinner(state: GameState, player: Player): void {
  state.winnerId = player.id;
  state.phase = "finished";
  state.lastEvent = `${player.name} wins!`;
  state.lastEventAt = now();
  state.rankings = buildRankings(state);
}

/** Place a card onto the discard pile and handle the win / forgot-UNO penalty. */
function placeCardOnTable(
  state: GameState,
  player: Player,
  card: Card,
): "ok" | "win" | "penalty" {
  const hadCalledUno = player.saidUno;
  player.hand = player.hand.filter((c) => c.id !== card.id);
  state.discard.push(card);
  if (player.hand.length === 0) {
    if (hadCalledUno) {
      declareWinner(state, player);
      return "win";
    }
    // Forgot to call UNO — penalty.
    drawFromDeck(state, player.id, UNO_PENALTY_CARDS);
    syncUno(player);
    state.lastEvent = `${player.name} forgot to call UNO! +${UNO_PENALTY_CARDS} penalty`;
    state.lastEventAt = now();
    return "penalty";
  }
  syncUno(player);
  return "ok";
}

function setEvent(state: GameState, event: string): void {
  state.lastEvent = event;
  state.lastEventAt = now();
}

/** Start a new game for a room. Re-deals hands and resets all state. */
export function startGame(room: Room): GameState {
  if (room.players.length < MIN_PLAYERS) {
    throw new Error(`Need at least ${MIN_PLAYERS} players to start`);
  }
  room.players.forEach((p, i) => {
    p.hand = [];
    p.saidUno = false;
    p.position = i;
    p.ready = true;
  });

  let deck = shuffle(createDeck());

  for (let i = 0; i < INITIAL_HAND_SIZE; i++) {
    for (const player of room.players) {
      if (deck.length === 0) deck = shuffle(createDeck());
      player.hand.push(deck.pop()!);
    }
  }

  // First face-up card: keep drawing until a plain number card appears.
  let firstCard: Card | undefined;
  while (deck.length > 0) {
    const c = deck.pop()!;
    if (!isWild(c) && !isActionCard(c.value)) {
      firstCard = c;
      break;
    }
    deck.unshift(c);
  }
  if (!firstCard) {
    firstCard = { id: "fallback-top", color: "red", value: "0" };
  }

  const state: GameState = {
    roomId: room.code,
    phase: "playing",
    players: room.players,
    turn: 0,
    direction: 1,
    deck,
    discard: [firstCard],
    activeColor: firstCard.color,
    drawStack: 0,
    winnerId: null,
    pendingColorPick: null,
    startedAt: now(),
    lastEvent: "Game started",
    lastEventAt: now(),
    rankings: [],
    lastSkippedId: null,
    hasDrawnThisTurn: false,
    lastDrawnCardId: null,
  };
  room.state = state;
  return state;
}

/** Human plays a card. For wilds, sets pendingColorPick and returns needsColor. */
export function playCard(
  state: GameState,
  playerId: string,
  cardId: string,
): { needsColor: boolean } {
  if (state.phase !== "playing") throw new Error("Game is not active");
  const player = assertTurn(state, playerId);
  assertNoPending(state);
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) throw new Error("Card not in your hand");
  const top = state.discard[state.discard.length - 1];
  if (!canPlay(card, player.hand, top, state.activeColor, state.drawStack)) {
    throw new Error("You can't play that card right now");
  }
  // After drawing, only the just-drawn card may be played.
  if (state.hasDrawnThisTurn && state.lastDrawnCardId && card.id !== state.lastDrawnCardId) {
    throw new Error("You can only play the card you just drew");
  }

  const result = placeCardOnTable(state, player, card);
  if (result === "win") return { needsColor: false };
  if (result === "penalty") {
    // Penalty applied; still resolve the card's effect normally below.
  }

  if (isWild(card)) {
    state.pendingColorPick = playerId;
    setEvent(
      state,
      card.value === "wild4"
        ? `${player.name} played Wild Draw Four — choosing color…`
        : `${player.name} played Wild — choosing color…`,
    );
    return { needsColor: true };
  }

  state.activeColor = card.color;
  const { event, skippedId } = applyCardEffect(state, card);
  state.lastSkippedId = skippedId;
  if (event) setEvent(state, event);
  resetTurnFlags(state);
  return { needsColor: false };
}

/** Player who played a wild chooses its color. */
export function chooseColor(
  state: GameState,
  playerId: string,
  color: CardColor,
): void {
  if (state.pendingColorPick !== playerId) throw new Error("Not your color choice");
  if (color === "wild") throw new Error("Pick a real color");
  const player = state.players.find((p) => p.id === playerId);
  state.pendingColorPick = null;
  state.activeColor = color;
  const top = state.discard[state.discard.length - 1];
  const { event, skippedId } = applyCardEffect(state, top);
  state.lastSkippedId = skippedId;
  const colorName = color.charAt(0).toUpperCase() + color.slice(1);
  setEvent(state, event ? `${player?.name ?? "Player"} chose ${colorName} — ${event}` : `${player?.name ?? "Player"} chose ${colorName}`);
  resetTurnFlags(state);
}

/** C6 fix: auto-resolve a pending color pick when its owner disconnects.
 *  Picks a sensible color (the picker's dominant hand color) and applies the effect. */
export function resolvePendingColorPick(state: GameState): boolean {
  if (!state.pendingColorPick) return false;
  const pickerId = state.pendingColorPick;
  const picker = state.players.find((p) => p.id === pickerId);
  const color = picker ? chooseBotColor(picker.hand) : "red";
  state.pendingColorPick = null;
  state.activeColor = color;
  const top = state.discard[state.discard.length - 1];
  const { event, skippedId } = applyCardEffect(state, top);
  state.lastSkippedId = skippedId;
  const colorName = color.charAt(0).toUpperCase() + color.slice(1);
  setEvent(state, `${picker?.name ?? "Player"} (away) chose ${colorName}${event ? " — " + event : ""}`);
  resetTurnFlags(state);
  return true;
}

/** C5 fix: end the game if all humans are away (declare the bot with fewest cards winner). */
export function endGameIfAllAway(state: GameState, connectedHumans: number): boolean {
  if (state.phase !== "playing") return false;
  if (connectedHumans > 0) return false;
  // Find the player with the fewest cards.
  const sorted = [...state.players].sort((a, b) => a.hand.length - b.hand.length);
  const winner = sorted[0];
  if (winner) {
    declareWinner(state, winner);
  }
  return true;
}

/** Draw a card (or the full stacked penalty). */
export function drawCards(state: GameState, playerId: string): Card[] {
  if (state.phase !== "playing") throw new Error("Game is not active");
  const player = assertTurn(state, playerId);
  assertNoPending(state);

  if (state.drawStack > 0) {
    const n = state.drawStack;
    const drawn = drawFromDeck(state, playerId, n);
    state.drawStack = 0;
    syncUno(player);
    setEvent(state, `${player.name} drew ${n} cards`);
    advanceTurn(state, 1);
    resetTurnFlags(state);
    return drawn;
  }

  if (state.hasDrawnThisTurn) throw new Error("You already drew this turn");

  const drawn = drawFromDeck(state, playerId, 1);
  syncUno(player);
  state.hasDrawnThisTurn = true;
  state.lastDrawnCardId = drawn[0]?.id ?? null;

  const top = state.discard[state.discard.length - 1];
  const drawnCard = drawn[0];
  if (drawnCard && canPlay(drawnCard, player.hand, top, state.activeColor, 0)) {
    setEvent(state, `${player.name} drew a card`);
    return drawn; // may play it or pass
  }
  setEvent(state, `${player.name} drew a card`);
  advanceTurn(state, 1);
  resetTurnFlags(state);
  return drawn;
}

/** Pass after drawing (only valid when drawStack is 0 and already drew). */
export function passTurn(state: GameState, playerId: string): void {
  if (state.phase !== "playing") throw new Error("Game is not active");
  assertTurn(state, playerId);
  assertNoPending(state);
  if (state.drawStack > 0) throw new Error("You must draw the penalty");
  if (!state.hasDrawnThisTurn) throw new Error("Draw a card before passing");
  const player = state.players[state.turn];
  advanceTurn(state, 1);
  resetTurnFlags(state);
  setEvent(state, `${player.name} passed`);
}

/** Call UNO (self, when at one card) or catch another player who forgot. */
export function callUno(
  state: GameState,
  callerId: string,
): { event: string } {
  const caller = state.players.find((p) => p.id === callerId);
  if (!caller) throw new Error("Player not found");

  if (caller.hand.length === 1 && !caller.saidUno) {
    caller.saidUno = true;
    setEvent(state, `${caller.name} called UNO!`);
    return { event: `${caller.name} called UNO!` };
  }

  const vulnerable = state.players.find(
    (p) => p.hand.length === 1 && !p.saidUno && p.id !== callerId,
  );
  if (vulnerable) {
    drawFromDeck(state, vulnerable.id, UNO_PENALTY_CARDS);
    syncUno(vulnerable);
    setEvent(
      state,
      `${caller.name} caught ${vulnerable.name}! +${UNO_PENALTY_CARDS} for forgetting UNO`,
    );
    return { event: `${vulnerable.name} forgot UNO!` };
  }

  throw new Error("No one to call UNO on right now");
}

/** Auto-play for a disconnected human: draw the penalty (or one card) and pass. */
export function performAutoMove(state: GameState, playerId: string): {
  event: string;
} {
  const player = state.players[state.turn];
  if (!player || player.id !== playerId) return { event: "" };
  if (state.drawStack > 0) {
    const n = state.drawStack;
    drawFromDeck(state, playerId, n);
    state.drawStack = 0;
    syncUno(player);
    advanceTurn(state, 1);
    resetTurnFlags(state);
    setEvent(state, `${player.name} (away) drew ${n} cards`);
    return { event: state.lastEvent ?? "" };
  }
  drawFromDeck(state, playerId, 1);
  syncUno(player);
  advanceTurn(state, 1);
  resetTurnFlags(state);
  setEvent(state, `${player.name} (away) drew a card`);
  return { event: state.lastEvent ?? "" };
}

/** Fully resolve a bot's turn (plays/draws, chooses wild colors, auto-calls UNO). */
export function performBotMove(state: GameState, botId: string): {
  event: string;
  played?: boolean;
} {
  if (state.phase !== "playing") return { event: "" };
  const bot = state.players[state.turn];
  if (!bot || bot.id !== botId || !bot.isBot) return { event: "" };

  const top = state.discard[state.discard.length - 1];

  const resolveWild = (card: Card): void => {
    state.pendingColorPick = null;
    const color = chooseBotColor(bot.hand);
    state.activeColor = color;
    const { event, skippedId } = applyCardEffect(state, card);
    state.lastSkippedId = skippedId;
    const colorName = color.charAt(0).toUpperCase() + color.slice(1);
    setEvent(state, event ? `${bot.name} chose ${colorName} — ${event}` : `${bot.name} chose ${colorName}`);
    resetTurnFlags(state);
  };

  const playCardBot = (card: Card): void => {
    const result = placeCardOnTable(state, bot, card);
    if (result === "win") return;
    if (isWild(card)) {
      resolveWild(card);
    } else {
      state.activeColor = card.color;
      const { event, skippedId } = applyCardEffect(state, card);
      state.lastSkippedId = skippedId;
      if (event) setEvent(state, event);
      resetTurnFlags(state);
    }
    if (bot.hand.length === 1) bot.saidUno = true;
  };

  if (state.drawStack > 0) {
    const playable = getPlayableCards(bot.hand, top, state.activeColor, state.drawStack);
    if (playable.length > 0) {
      const card = chooseBotCard(playable, bot.hand);
      if (!card) return { event: state.lastEvent ?? "", played: false };
      playCardBot(card);
      return { event: state.lastEvent ?? "", played: true };
    }
    const n = state.drawStack;
    drawFromDeck(state, botId, n);
    state.drawStack = 0;
    syncUno(bot);
    advanceTurn(state, 1);
    resetTurnFlags(state);
    setEvent(state, `${bot.name} drew ${n} cards`);
    return { event: state.lastEvent ?? "", played: false };
  }

  const playable = getPlayableCards(bot.hand, top, state.activeColor, 0);
  if (playable.length > 0) {
    const card = chooseBotCard(playable, bot.hand);
    if (!card) return { event: state.lastEvent ?? "", played: false };
    playCardBot(card);
    return { event: state.lastEvent ?? "", played: true };
  }

  // No playable card: draw one.
  const drawn = drawFromDeck(state, botId, 1);
  syncUno(bot);
  state.hasDrawnThisTurn = true;
  state.lastDrawnCardId = drawn[0]?.id ?? null;
  const drawnCard = drawn[0];
  if (drawnCard && canPlay(drawnCard, bot.hand, top, state.activeColor, 0)) {
    playCardBot(drawnCard);
    return { event: state.lastEvent ?? "", played: true };
  }
  advanceTurn(state, 1);
  resetTurnFlags(state);
  setEvent(state, `${bot.name} drew a card`);
  return { event: state.lastEvent ?? "", played: false };
}

export function isBotTurn(state: GameState): boolean {
  if (state.phase !== "playing") return false;
  if (state.pendingColorPick) return false;
  const current = state.players[state.turn];
  return !!current?.isBot;
}

/** Whether the game is waiting on a bot to choose a wild color (always false — bots resolve immediately). */
export function needsBotAttention(): boolean {
  return false;
}

/** Convert authoritative state into a viewer-specific public snapshot. */
export function toPublicGameState(state: GameState, viewerId: string): PublicGameState {
  const me = state.players.find((p) => p.id === viewerId);
  const currentPlayer = state.players[state.turn];
  const isMyTurn = currentPlayer?.id === viewerId;
  return {
    roomId: state.roomId,
    phase: state.phase,
    players: state.players.map(toPublicPlayer),
    turn: state.turn,
    direction: state.direction,
    topCard: state.discard[state.discard.length - 1],
    discardCount: state.discard.length,
    activeColor: state.activeColor,
    drawStack: state.drawStack,
    winnerId: state.winnerId,
    pendingColorPick: state.pendingColorPick,
    myHand: me?.hand ?? [],
    myPlayerId: viewerId,
    lastEvent: state.lastEvent,
    lastEventAt: state.lastEventAt,
    rankings: state.rankings,
    deckCount: state.deck.length,
    hasDrawnThisTurn: isMyTurn ? state.hasDrawnThisTurn : false,
    lastDrawnCardId: isMyTurn ? state.lastDrawnCardId : null,
    isMyTurn,
  };
}
