export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
  system?: boolean;
}

export const MAX_CHAT_LENGTH = 200;
export const MAX_CHAT_MESSAGES = 100;

export const QUICK_MESSAGES = [
  "Nice!",
  "UNO!",
  "Good game",
  "Your turn",
  "Oof",
  "Gotcha!",
] as const;
