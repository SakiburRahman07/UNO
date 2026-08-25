// Core domain types for the UNO game — shared by client and server.

export type CardColor = "red" | "blue" | "green" | "yellow" | "wild";

export type CardValue =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "skip"
  | "reverse"
  | "draw2"
  | "wild"
  | "wild4";

export interface Card {
  id: string;
  color: CardColor;
  value: CardValue;
}

export type GamePhase = "idle" | "playing" | "finished";

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
  ready: boolean;
  hand: Card[];
  saidUno: boolean;
  position: number;
}

export interface PlayerRanking {
  playerId: string;
  name: string;
  isBot: boolean;
  cardsLeft: number;
  rank: number;
  isWinner: boolean;
}

/** Authoritative server-side game state. */
export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  turn: number;
  direction: 1 | -1;
  deck: Card[];
  discard: Card[];
  activeColor: CardColor;
  drawStack: number;
  winnerId: string | null;
  /** id of the player who must choose a color after playing a wild */
  pendingColorPick: string | null;
  startedAt: number;
  lastEvent: string | null;
  lastEventAt: number;
  rankings: PlayerRanking[];
  /** ids of players who have been skipped (used for event messaging) */
  lastSkippedId: string | null;
  /** Whether the current player has already drawn a card this turn (no-stack case). */
  hasDrawnThisTurn: boolean;
  /** The card just drawn this turn, if any — may be played immediately. */
  lastDrawnCardId: string | null;
}

export interface Room {
  code: string;
  hostId: string;
  players: Player[];
  state: GameState | null;
  createdAt: number;
}

/** Player info safe to broadcast to everyone (no hand contents). */
export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  connected: boolean;
  ready: boolean;
  handSize: number;
  saidUno: boolean;
  position: number;
}

/** Room info for the lobby view. */
export interface PublicRoom {
  code: string;
  hostId: string;
  players: PublicPlayer[];
  phase: GamePhase;
  inGame: boolean;
}

/** Game state tailored to a single viewer — hides other players' hands. */
export interface PublicGameState {
  roomId: string;
  phase: GamePhase;
  players: PublicPlayer[];
  turn: number;
  direction: 1 | -1;
  topCard: Card;
  discardCount: number;
  activeColor: CardColor;
  drawStack: number;
  winnerId: string | null;
  pendingColorPick: string | null;
  myHand: Card[];
  myPlayerId: string;
  lastEvent: string | null;
  lastEventAt: number;
  rankings: PlayerRanking[];
  deckCount: number;
  hasDrawnThisTurn: boolean;
  lastDrawnCardId: string | null;
  isMyTurn: boolean;
}

// ----- Acknowledgement helpers -----

export type AckSuccess<T> = { ok: true; data: T };
export type AckError = { ok: false; error: string };
export type Ack<T> = (res: AckSuccess<T> | AckError) => void;

export interface CreateRoomResult {
  code: string;
  playerId: string;
}
export interface JoinRoomResult {
  code: string;
  playerId: string;
  isNew: boolean;
}
export interface PlayCardResult {
  needsColor: boolean;
}
export interface DrawCardResult {
  drawn: Card[];
  /** true if the player was forced to draw due to a stacked draw penalty */
  forced: boolean;
}

// ----- Socket event maps -----

export interface ServerToClientEvents {
  "room:created": (data: CreateRoomResult) => void;
  "room:joined": (data: { code: string; playerId: string }) => void;
  "room:update": (room: PublicRoom) => void;
  "game:state": (state: PublicGameState) => void;
  "game:started": (data: { code: string }) => void;
  "game:end": (data: { winnerId: string; rankings: PlayerRanking[] }) => void;
  "uno:called": (data: { playerId: string }) => void;
  "player:joined": (data: { playerId: string; name: string }) => void;
  "player:left": (data: { playerId: string }) => void;
  error: (message: string) => void;
}

export interface ClientToServerEvents {
  "room:create": (data: { name: string }, ack: Ack<CreateRoomResult>) => void;
  "room:join": (
    data: { code: string; name: string },
    ack: Ack<JoinRoomResult>,
  ) => void;
  "room:leave": () => void;
  "room:toggle-ready": () => void;
  "room:add-bot": (ack: Ack<{ playerId: string }>) => void;
  "room:kick": (data: { playerId: string }) => void;
  "game:start": (ack: Ack<null>) => void;
  "card:play": (data: { cardId: string }, ack: Ack<PlayCardResult>) => void;
  "card:draw": (ack: Ack<DrawCardResult>) => void;
  "turn:pass": () => void;
  "color:choose": (data: { color: CardColor }) => void;
  "uno:call": () => void;
  "game:restart": () => void;
}

export type GameSocket = import("socket.io-client").Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;
