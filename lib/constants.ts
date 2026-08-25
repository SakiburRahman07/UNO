export const ROOM_CODE_LENGTH = 6;

export const MAX_PLAYERS = 10;
export const MIN_PLAYERS = 2;

export const INITIAL_HAND_SIZE = 7;

export const BOT_TURN_DELAY_MS = 1400;
export const BOT_NAME_PREFIX = "Bot";

export const UNO_PENALTY_CARDS = 2;
export const FORGOT_UNO_WINDOW_MS = 4000;

export const UNO_COLORS = ["red", "blue", "green", "yellow"] as const;
export const UNO_COLOR_HEX: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
  wild: "#1f2937",
};

export const STORAGE_KEYS = {
  playerName: "uno-player-name",
  socketSession: "uno-socket-session",
} as const;

export const NAV_ROUTES = {
  home: "/",
  lobby: (code: string) => `/lobby/${code}`,
  game: (code: string) => `/game/${code}`,
} as const;
