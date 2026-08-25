import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  GamePhase,
  ServerToClientEvents,
} from "@/types/uno";
import * as rooms from "@/server/roomManager";
import {
  callUno,
  chooseColor,
  drawCards,
  passTurn,
  performAutoMove,
  performBotMove,
  playCard,
  startGame,
  toPublicGameState,
} from "@/server/gameEngine";
import { BOT_TURN_DELAY_MS } from "@/lib/constants";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export function registerSocketHandlers(io: IO): void {
  const botTimers = new Map<string, NodeJS.Timeout>();

  function emitRoomUpdate(code: string): void {
    const room = rooms.getRoom(code);
    if (!room) return;
    io.to(code).emit("room:update", rooms.toPublicRoom(room));
  }

  function emitGameState(code: string): void {
    const room = rooms.getRoom(code);
    if (!room?.state) return;
    for (const p of room.players) {
      if (p.isBot) continue;
      io.to(p.id).emit("game:state", toPublicGameState(room.state, p.id));
    }
  }

  /** Determine whether the current player needs automatic action and schedule it. */
  function scheduleAutoIfNeeded(code: string): void {
    const room = rooms.getRoom(code);
    if (!room?.state) return;
    const state = room.state;
    if (state.phase !== "playing" || state.pendingColorPick) return;
    const current = state.players[state.turn];
    if (!current) return;

    const isBot = current.isBot;
    const isAway = !current.isBot && !current.connected;
    if (!isBot && !isAway) return;

    if (botTimers.has(code)) clearTimeout(botTimers.get(code)!);
    const timer = setTimeout(() => {
      botTimers.delete(code);
      const r = rooms.getRoom(code);
      if (!r?.state || r.state.phase !== "playing") return;
      if (r.state.pendingColorPick) return;
      const cur = r.state.players[r.state.turn];
      if (!cur) return;

      if (cur.isBot) {
        performBotMove(r.state, cur.id);
      } else if (!cur.connected) {
        performAutoMove(r.state, cur.id);
      } else {
        return;
      }

      const phase = r.state.phase as GamePhase;
      if (phase === "finished") {
        io.to(code).emit("game:end", {
          winnerId: r.state.winnerId!,
          rankings: r.state.rankings,
        });
      }
      emitGameState(code);
      emitRoomUpdate(code);
      if (phase === "playing") scheduleAutoIfNeeded(code);
    }, BOT_TURN_DELAY_MS);
    botTimers.set(code, timer);
  }

  function handleGameStart(code: string): void {
    emitGameState(code);
    io.to(code).emit("game:started", { code });
    emitRoomUpdate(code);
    scheduleAutoIfNeeded(code);
  }

  io.on("connection", (socket) => {
    socket.on("room:create", (data, ack) => {
      try {
        const name = data.name?.trim();
        if (!name) return ack({ ok: false, error: "Please enter a name" });
        const { code, playerId } = rooms.createRoom(name, socket.id);
        socket.join(code);
        ack({ ok: true, data: { code, playerId } });
        io.to(code).emit("room:created", { code, playerId });
        emitRoomUpdate(code);
      } catch (e) {
        ack({ ok: false, error: errMsg(e) });
      }
    });

    socket.on("room:join", (data, ack) => {
      try {
        const name = data.name?.trim();
        const code = data.code?.trim().toUpperCase();
        if (!name) return ack({ ok: false, error: "Please enter a name" });
        if (!code) return ack({ ok: false, error: "Please enter a room code" });
        const { code: joinedCode, playerId, isNew } = rooms.joinRoom(code, name, socket.id);
        socket.join(joinedCode);
        ack({ ok: true, data: { code: joinedCode, playerId, isNew } });
        io.to(joinedCode).emit("room:joined", { code: joinedCode, playerId });
        if (isNew) socket.to(joinedCode).emit("player:joined", { playerId, name });
        emitRoomUpdate(joinedCode);
        const room = rooms.getRoom(joinedCode);
        if (room?.state && room.state.phase === "playing") {
          io.to(socket.id).emit("game:state", toPublicGameState(room.state, playerId));
        }
      } catch (e) {
        ack({ ok: false, error: errMsg(e) });
      }
    });

    socket.on("room:leave", () => {
      const session = rooms.getSession(socket.id);
      const { code } = rooms.leaveRoom(socket.id);
      if (code) socket.leave(code);
      if (code) emitRoomUpdate(code);
      if (code && session) scheduleAutoIfNeeded(code);
    });

    socket.on("room:toggle-ready", () => {
      rooms.toggleReady(socket.id);
      const room = rooms.getRoomBySocket(socket.id);
      if (room) emitRoomUpdate(room.code);
    });

    socket.on("room:add-bot", (ack) => {
      try {
        const room = rooms.getRoomBySocket(socket.id);
        if (!room) return ack({ ok: false, error: "Not in a room" });
        if (room.hostId !== socket.id)
          return ack({ ok: false, error: "Only the host can add bots" });
        const bot = rooms.addBot(room.code);
        ack({ ok: true, data: { playerId: bot.id } });
        emitRoomUpdate(room.code);
      } catch (e) {
        ack({ ok: false, error: errMsg(e) });
      }
    });

    socket.on("room:kick", (data) => {
      try {
        const room = rooms.getRoomBySocket(socket.id);
        if (!room) return;
        if (room.hostId !== socket.id) return;
        rooms.kickPlayer(room.code, data.playerId);
        emitRoomUpdate(room.code);
      } catch {
        // ignore
      }
    });

    socket.on("game:start", (ack) => {
      try {
        const session = rooms.getSession(socket.id);
        if (!session) return ack({ ok: false, error: "Not in a room" });
        const check = rooms.canStart(socket.id);
        if (!check.ok) return ack({ ok: false, error: check.reason! });
        const room = rooms.getRoom(session.code);
        if (!room) return ack({ ok: false, error: "Room not found" });
        startGame(room);
        ack({ ok: true, data: null });
        handleGameStart(room.code);
      } catch (e) {
        ack({ ok: false, error: errMsg(e) });
      }
    });

    socket.on("card:play", (data, ack) => {
      try {
        const { room, player } = rooms.getPlayerBySocket(socket.id) ?? {};
        if (!room?.state || !player)
          return ack({ ok: false, error: "No active game" });
        const result = playCard(room.state, player.id, data.cardId);
        ack({ ok: true, data: { needsColor: result.needsColor } });
        emitGameState(room.code);
        if (room.state.phase === "finished") {
          io.to(room.code).emit("game:end", {
            winnerId: room.state.winnerId!,
            rankings: room.state.rankings,
          });
        }
        emitRoomUpdate(room.code);
        if (room.state.phase === "playing") scheduleAutoIfNeeded(room.code);
      } catch (e) {
        ack({ ok: false, error: errMsg(e) });
      }
    });

    socket.on("card:draw", (ack) => {
      try {
        const { room, player } = rooms.getPlayerBySocket(socket.id) ?? {};
        if (!room?.state || !player)
          return ack({ ok: false, error: "No active game" });
        const drawn = drawCards(room.state, player.id);
        const forced = drawn.length > 1;
        ack({ ok: true, data: { drawn, forced } });
        emitGameState(room.code);
        emitRoomUpdate(room.code);
        if (room.state.phase === "playing") scheduleAutoIfNeeded(room.code);
      } catch (e) {
        ack({ ok: false, error: errMsg(e) });
      }
    });

    socket.on("turn:pass", () => {
      try {
        const { room, player } = rooms.getPlayerBySocket(socket.id) ?? {};
        if (!room?.state || !player) return;
        passTurn(room.state, player.id);
        emitGameState(room.code);
        emitRoomUpdate(room.code);
        if (room.state.phase === "playing") scheduleAutoIfNeeded(room.code);
      } catch {
        // ignore
      }
    });

    socket.on("color:choose", (data) => {
      try {
        const { room, player } = rooms.getPlayerBySocket(socket.id) ?? {};
        if (!room?.state || !player) return;
        chooseColor(room.state, player.id, data.color);
        emitGameState(room.code);
        emitRoomUpdate(room.code);
        if (room.state.phase === "playing") scheduleAutoIfNeeded(room.code);
      } catch {
        // ignore
      }
    });

    socket.on("uno:call", () => {
      try {
        const { room, player } = rooms.getPlayerBySocket(socket.id) ?? {};
        if (!room?.state || !player) return;
        const res = callUno(room.state, player.id);
        io.to(room.code).emit("uno:called", { playerId: player.id });
        emitGameState(room.code);
        emitRoomUpdate(room.code);
      } catch {
        // ignore — invalid UNO call
      }
    });

    socket.on("game:restart", () => {
      try {
        const session = rooms.getSession(socket.id);
        if (!session) return;
        const room = rooms.getRoom(session.code);
        if (!room) return;
        if (room.hostId !== session.playerId) return;
        startGame(room);
        handleGameStart(room.code);
      } catch {
        // ignore
      }
    });

    socket.on("disconnect", () => {
      const session = rooms.getSession(socket.id);
      const room = rooms.getRoomBySocket(socket.id);
      const inGame = room?.state && room.state.phase === "playing";
      if (inGame && room) {
        // Keep the seat so the player can reconnect; auto-play while away.
        rooms.markDisconnected(socket.id);
        emitRoomUpdate(room.code);
        emitGameState(room.code);
        scheduleAutoIfNeeded(room.code);
      } else if (session && room) {
        // Lobby: give a short grace period for a refresh/reconnect, then remove.
        const code = session.code;
        const playerId = session.playerId;
        rooms.markDisconnected(socket.id);
        emitRoomUpdate(code);
        setTimeout(() => {
          if (rooms.removePlayerIfAway(code, playerId)) {
            emitRoomUpdate(code);
          }
        }, 8000);
      }
      void session;
    });
  });
}
