import type { PublicPlayer, PublicRoom, Room, Player } from "@/types/uno";
import { MAX_PLAYERS, MIN_PLAYERS, ROOM_CODE_LENGTH } from "@/lib/constants";

const ROOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I

const rooms = new Map<string, Room>();
/** socketId -> { code, playerId } */
const sessions = new Map<string, { code: string; playerId: string }>();

function generateRoomCode(): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
    }
    if (!rooms.has(code)) return code;
  }
  // Fallback (astronomically unlikely to collide).
  return Math.random().toString(36).slice(2, 2 + ROOM_CODE_LENGTH).toUpperCase();
}

let botCounter = 0;
function nextBotId(): string {
  botCounter += 1;
  return `bot-${botCounter}`;
}

const BOT_NAMES = [
  "Spark",
  "Nova",
  "Blaze",
  "Echo",
  "Vortex",
  "Pixel",
  "Cypher",
  "Quartz",
  "Riptide",
  "Zenith",
];

function nextBotName(): string {
  const used = new Set<string>();
  for (const room of rooms.values()) {
    for (const p of room.players) {
      if (p.isBot) used.add(p.name);
    }
  }
  const available = BOT_NAMES.filter((n) => !used.has(n));
  const pool = available.length > 0 ? available : BOT_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

function makePlayer(
  id: string,
  name: string,
  isHost: boolean,
  isBot: boolean,
  position: number,
): Player {
  return {
    id,
    name: name.slice(0, 20) || "Player",
    isHost,
    isBot,
    connected: true,
    ready: isHost || isBot,
    hand: [],
    saidUno: false,
    position,
  };
}

export function createRoom(name: string, socketId: string): { code: string; playerId: string } {
  if (sessions.has(socketId)) {
    leaveRoom(socketId);
  }
  const code = generateRoomCode();
  const playerId = socketId;
  const player = makePlayer(playerId, name, true, false, 0);
  const room: Room = {
    code,
    hostId: playerId,
    players: [player],
    state: null,
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  sessions.set(socketId, { code, playerId });
  return { code, playerId };
}

export function joinRoom(
  code: string,
  name: string,
  socketId: string,
): { code: string; playerId: string; isNew: boolean } {
  const upper = code.toUpperCase().trim();
  const room = rooms.get(upper);
  if (!room) throw new Error("Room not found");

  // Already in this room (client-side navigation / socket still active): no-op.
  const prior = sessions.get(socketId);
  if (prior && prior.code === upper) {
    const p = room.players.find((pp) => pp.id === prior.playerId);
    if (p) {
      p.connected = true;
      return { code: upper, playerId: p.id, isNew: false };
    }
  }
  // In a different room: leave it first.
  if (prior && prior.code !== upper) {
    leaveRoom(socketId);
  }

  const inProgress = room.state && room.state.phase === "playing";

  // Reconnect by name: revive a disconnected human with the same name.
  const byName = room.players.find(
    (p) => !p.isBot && !p.connected && p.name.toLowerCase() === name.toLowerCase(),
  );
  if (byName) {
    byName.connected = true;
    byName.id = socketId;
    sessions.set(socketId, { code: upper, playerId: byName.id });
    return { code: upper, playerId: byName.id, isNew: false };
  }

  if (inProgress) throw new Error("Game already in progress");

  const humanCount = room.players.filter((p) => !p.isBot).length;
  if (humanCount >= MAX_PLAYERS) throw new Error("Room is full");

  const playerId = socketId;
  const position = room.players.length;
  const player = makePlayer(playerId, name, false, false, position);
  room.players.push(player);
  sessions.set(socketId, { code: upper, playerId });
  return { code: upper, playerId, isNew: true };
}

export function leaveRoom(socketId: string): { code: string | null } {
  const session = sessions.get(socketId);
  if (!session) return { code: null };
  const room = rooms.get(session.code);
  sessions.delete(socketId);
  if (!room) return { code: session.code };

  const idx = room.players.findIndex((p) => p.id === session.playerId);
  if (idx === -1) return { code: session.code };

  const leaving = room.players[idx];
  room.players.splice(idx, 1);

  if (room.players.length === 0) {
    rooms.delete(session.code);
    return { code: session.code };
  }

  // Reassign positions and host if needed.
  room.players.forEach((p, i) => (p.position = i));
  if (room.hostId === leaving.id) {
    const nextHuman = room.players.find((p) => !p.isBot && p.connected);
    const newHost = nextHuman ?? room.players[0];
    if (newHost) {
      newHost.isHost = true;
      newHost.ready = true;
      room.hostId = newHost.id;
    }
  }
  return { code: session.code };
}

/** Remove a specific player if they are still marked disconnected (used by the grace timer). */
export function removePlayerIfAway(code: string, playerId: string): boolean {
  const room = rooms.get(code);
  if (!room) return false;
  const p = room.players.find((pp) => pp.id === playerId);
  if (!p || p.connected) return false;
  room.players = room.players.filter((pp) => pp.id !== playerId);
  if (room.players.length === 0) {
    rooms.delete(code);
    return true;
  }
  room.players.forEach((pp, i) => (pp.position = i));
  if (room.hostId === playerId) {
    const next = room.players.find((pp) => !pp.isBot && pp.connected) ?? room.players[0];
    if (next) {
      next.isHost = true;
      next.ready = true;
      room.hostId = next.id;
    }
  }
  return true;
}
export function addBot(code: string): Player {
  const room = rooms.get(code);
  if (!room) throw new Error("Room not found");
  if (room.state && room.state.phase === "playing")
    throw new Error("Game already in progress");
  if (room.players.length >= MAX_PLAYERS) throw new Error("Room is full");
  const id = nextBotId();
  const bot = makePlayer(id, nextBotName(), false, true, room.players.length);
  room.players.push(bot);
  return bot;
}

export function kickPlayer(code: string, playerId: string): void {
  const room = rooms.get(code);
  if (!room) throw new Error("Room not found");
  const target = room.players.find((p) => p.id === playerId);
  if (!target) throw new Error("Player not found");
  if (!target.isBot) throw new Error("Only bots can be removed");
  room.players = room.players.filter((p) => p.id !== playerId);
  room.players.forEach((p, i) => (p.position = i));
}

export function toggleReady(socketId: string): void {
  const session = sessions.get(socketId);
  if (!session) return;
  const room = rooms.get(session.code);
  if (!room) return;
  const player = room.players.find((p) => p.id === session.playerId);
  if (!player || player.isHost) return;
  player.ready = !player.ready;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase().trim());
}

export function getRoomBySocket(socketId: string): Room | undefined {
  const session = sessions.get(socketId);
  if (!session) return undefined;
  return rooms.get(session.code);
}

export function getPlayerBySocket(socketId: string): {
  room: Room;
  player: Player;
} | null {
  const session = sessions.get(socketId);
  if (!session) return null;
  const room = rooms.get(session.code);
  if (!room) return null;
  const player = room.players.find((p) => p.id === session.playerId);
  if (!player) return null;
  return { room, player };
}

export function getSession(socketId: string) {
  return sessions.get(socketId);
}

export function canStart(socketId: string): { ok: boolean; reason?: string } {
  const session = sessions.get(socketId);
  if (!session) return { ok: false, reason: "Not in a room" };
  const room = rooms.get(session.code);
  if (!room) return { ok: false, reason: "Room not found" };
  if (room.hostId !== session.playerId)
    return { ok: false, reason: "Only the host can start the game" };
  if (room.players.length < MIN_PLAYERS)
    return { ok: false, reason: `Need at least ${MIN_PLAYERS} players` };
  const notReady = room.players.find((p) => !p.ready);
  if (notReady) return { ok: false, reason: `${notReady.name} is not ready` };
  if (room.state && room.state.phase === "playing")
    return { ok: false, reason: "Game already in progress" };
  return { ok: true };
}

export function toPublicPlayer(player: Player): PublicPlayer {
  return {
    id: player.id,
    name: player.name,
    isHost: player.isHost,
    isBot: player.isBot,
    connected: player.connected,
    ready: player.ready,
    handSize: player.hand.length,
    saidUno: player.saidUno,
    position: player.position,
  };
}

export function toPublicRoom(room: Room): PublicRoom {
  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map(toPublicPlayer),
    phase: room.state?.phase ?? "idle",
    inGame: room.state !== null && room.state.phase !== "idle",
  };
}

/** Mark a socket's player as disconnected (do not remove, so they can reconnect). */
export function markDisconnected(socketId: string): Room | undefined {
  const session = sessions.get(socketId);
  if (!session) return undefined;
  const room = rooms.get(session.code);
  if (!room) return undefined;
  const player = room.players.find((p) => p.id === session.playerId);
  if (player) player.connected = false;
  sessions.delete(socketId);
  return room;
}

/** Total room count (for diagnostics / future lobby list). */
export function roomCount(): number {
  return rooms.size;
}
