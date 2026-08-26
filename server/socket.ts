import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  GamePhase,
  ServerToClientEvents,
} from "@/types/uno";
import type { ChatMessage } from "@/types/chat";
import { MAX_CHAT_LENGTH } from "@/types/chat";
import type { CallParticipant } from "@/types/call";
import * as rooms from "@/server/roomManager";
import {
  callUno,
  chooseColor,
  drawCards,
  endGameIfAllAway,
  passTurn,
  performAutoMove,
  performBotMove,
  playCard,
  resolvePendingColorPick,
  startGame,
  toPublicGameState,
} from "@/server/gameEngine";
import { BOT_TURN_DELAY_MS, CALL_SIGNAL_RATE_MS, RECONNECT_GRACE_MS } from "@/lib/constants";

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

  let chatMsgCounter = 0;
  function nextChatId(): string {
    chatMsgCounter += 1;
    return `m${chatMsgCounter.toString(36)}`;
  }

  function emitSystemChat(code: string, text: string): void {
    const msg: ChatMessage = {
      id: nextChatId(),
      playerId: "system",
      name: "System",
      text,
      at: Date.now(),
      system: true,
    };
    io.to(code).emit("chat:message", msg);
  }

  function emitGameEndChat(code: string, winnerId: string): void {
    const room = rooms.getRoom(code);
    const winner = room?.players.find((p) => p.id === winnerId);
    emitSystemChat(code, winner ? `${winner.name} wins!` : "Game over!");
  }

  // Per-player rate limiting: 1 msg / 500ms
  const lastChatAt = new Map<string, number>();
  function canPlayerChat(playerId: string): boolean {
    const now = Date.now();
    const last = lastChatAt.get(playerId) ?? 0;
    if (now - last < 500) return false;
    lastChatAt.set(playerId, now);
    return true;
  }

  // ---- Audio call roster ----
  // code -> (playerId -> CallParticipant). Callers also join a sub-room
  // `${code}__call` so call:state broadcasts only reach participants.
  const callRosters = new Map<string, Map<string, CallParticipant>>();
  const lastCallSignalAt = new Map<string, number>();

  function getCallRoster(code: string): Map<string, CallParticipant> {
    let m = callRosters.get(code);
    if (!m) {
      m = new Map();
      callRosters.set(code, m);
    }
    return m;
  }

  function emitCallState(code: string): void {
    const roster = callRosters.get(code);
    if (!roster) {
      io.to(`${code}__call`).emit("call:state", []);
      return;
    }
    io.to(`${code}__call`).emit("call:state", [...roster.values()]);
  }

  /** Rate-limit WebRTC signaling (offer/answer/ice) per player. */
  function canSignal(playerId: string): boolean {
    const now = Date.now();
    const last = lastCallSignalAt.get(playerId) ?? 0;
    if (now - last < CALL_SIGNAL_RATE_MS) return false;
    lastCallSignalAt.set(playerId, now);
    return true;
  }

  /** Remove a socket from its room's call roster (if present) + notify callers. */
  function cleanupCall(socketId: string, code: string | null): void {
    if (!code) return;
    const roster = callRosters.get(code);
    if (roster?.delete(socketId)) {
      if (roster.size === 0) callRosters.delete(code);
      emitCallState(code);
    }
    // The socket auto-leaves the sub-room on disconnect; for room:leave we
    // explicitly leave below.
  }

  /** Emit game state OR room update depending on phase (C2 fix — finished games too). */
  function emitCurrentState(code: string): void {
    const room = rooms.getRoom(code);
    if (!room) return;
    if (room.state && room.state.phase !== "idle") {
      emitGameState(code);
    }
    emitRoomUpdate(code);
  }

  /** Determine whether the current player needs automatic action and schedule it. */
  function scheduleAutoIfNeeded(code: string): void {
    const room = rooms.getRoom(code);
    if (!room?.state) return;
    const state = room.state;
    if (state.phase !== "playing") return;

    // C6 fix: if the pending color picker is disconnected, auto-resolve.
    if (state.pendingColorPick) {
      const picker = state.players.find((p) => p.id === state.pendingColorPick);
      if (picker && !picker.connected && !picker.isBot) {
        resolvePendingColorPick(state);
        emitGameState(code);
        emitRoomUpdate(code);
        // Continue scheduling for the next turn.
      } else {
        return;
      }
    }

    // C5 fix: if no connected humans remain, end the game.
    const connectedHumans = rooms.connectedHumansCount(room);
    if (connectedHumans === 0) {
      if (endGameIfAllAway(state, connectedHumans)) {
        io.to(code).emit("game:end", {
          winnerId: state.winnerId!,
          rankings: state.rankings,
        });
        emitGameState(code);
        emitRoomUpdate(code);
        emitGameEndChat(code, state.winnerId!);
      }
      return;
    }

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
      const st = r.state;
      if (st.pendingColorPick) {
        // Check if picker is away and resolve.
        const picker = st.players.find((p) => p.id === st.pendingColorPick);
        if (picker && !picker.connected && !picker.isBot) {
          resolvePendingColorPick(r.state);
          emitGameState(code);
          emitRoomUpdate(code);
          scheduleAutoIfNeeded(code);
        }
        return;
      }
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
        emitGameEndChat(code, r.state.winnerId!);
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
    emitSystemChat(code, "Game started!");
    scheduleAutoIfNeeded(code);
  }

  io.on("connection", (socket) => {
    socket.on("room:create", (data, ack) => {
      try {
        const name = data.name?.trim();
        if (!name) return ack({ ok: false, error: "Please enter a name" });
        const { code, playerId, sessionToken } = rooms.createRoom(name, socket.id);
        socket.join(code);
        ack({ ok: true, data: { code, playerId, sessionToken } });
        io.to(code).emit("room:created", { code, playerId, sessionToken });
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
        const { code: joinedCode, playerId, isNew, sessionToken } = rooms.joinRoom(code, name, socket.id);
        socket.join(joinedCode);
        ack({ ok: true, data: { code: joinedCode, playerId, isNew, sessionToken } });
        io.to(joinedCode).emit("room:joined", { code: joinedCode, playerId });
        if (isNew) {
          socket.to(joinedCode).emit("player:joined", { playerId, name });
          emitSystemChat(joinedCode, `${name} joined the room`);
        }
        emitRoomUpdate(joinedCode);
        // C2 fix: emit game state for ALL non-idle phases (playing AND finished).
        const room = rooms.getRoom(joinedCode);
        if (room?.state && room.state.phase !== "idle") {
          io.to(socket.id).emit("game:state", toPublicGameState(room.state, playerId));
        }
      } catch (e) {
        ack({ ok: false, error: errMsg(e) });
      }
    });

    // C7 fix: token-based reconnect.
    socket.on("room:reconnect", (data, ack) => {
      try {
        const code = data.code?.trim().toUpperCase();
        if (!code) return ack({ ok: false, error: "Missing room code" });
        const { code: reconCode, playerId, sessionToken } = rooms.reconnectWithToken(code, data.sessionToken, socket.id);
        socket.join(reconCode);
        ack({ ok: true, data: { code: reconCode, playerId, isNew: false, sessionToken } });
        emitRoomUpdate(reconCode);
        // C2 fix: emit game state for all non-idle phases.
        const room = rooms.getRoom(reconCode);
        if (room?.state && room.state.phase !== "idle") {
          io.to(socket.id).emit("game:state", toPublicGameState(room.state, playerId));
        }
      } catch (e) {
        ack({ ok: false, error: errMsg(e) });
      }
    });

    socket.on("room:leave", () => {
      const session = rooms.getSession(socket.id);
      const room = rooms.getRoomBySocket(socket.id);
      const leavingName = room?.players.find((p) => p.id === session?.playerId)?.name;
      const callCode = session?.code ?? null;
      // Audio call cleanup: leave the call sub-room + drop from roster first.
      if (callCode) {
        socket.leave(`${callCode}__call`);
        cleanupCall(socket.id, callCode);
      }
      const { code } = rooms.leaveRoom(socket.id);
      if (code) socket.leave(code);
      if (code) emitRoomUpdate(code);
      if (code && leavingName) emitSystemChat(code, `${leavingName} left the room`);
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
          emitGameEndChat(room.code, room.state.winnerId!);
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
        callUno(room.state, player.id);
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

    socket.on("chat:send", (data) => {
      try {
        const { room, player } = rooms.getPlayerBySocket(socket.id) ?? {};
        if (!room || !player || player.isBot) return;
        if (!canPlayerChat(player.id)) return;
        const text = (data.text ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_CHAT_LENGTH);
        if (!text) return;
        const msg: ChatMessage = {
          id: nextChatId(),
          playerId: player.id,
          name: player.name,
          text,
          at: Date.now(),
        };
        io.to(room.code).emit("chat:message", msg);
      } catch {
        // ignore
      }
    });

    // ---- Audio call (WebRTC signaling relay) ----
    socket.on("call:join", (ack) => {
      try {
        const { room, player } = rooms.getPlayerBySocket(socket.id) ?? {};
        if (!room || !player) return ack({ ok: false, error: "Not in a room" });
        if (player.isBot) return ack({ ok: false, error: "Bots cannot join calls" });
        const callRoom = `${room.code}__call`;
        socket.join(callRoom);
        const roster = getCallRoster(room.code);
        roster.set(player.id, { playerId: player.id, name: player.name, muted: false });
        ack({ ok: true, data: [...roster.values()] });
        emitCallState(room.code);
      } catch (e) {
        ack({ ok: false, error: errMsg(e) });
      }
    });

    socket.on("call:leave", () => {
      const room = rooms.getRoomBySocket(socket.id);
      if (!room) return;
      socket.leave(`${room.code}__call`);
      cleanupCall(socket.id, room.code);
    });

    socket.on("call:offer", (data) => {
      const room = rooms.getRoomBySocket(socket.id);
      if (!room) return;
      const roster = callRosters.get(room.code);
      if (!roster?.has(socket.id) || !roster.has(data.to)) return; // both must be in call
      if (!canSignal(socket.id)) return;
      io.to(data.to).emit("call:offer", { from: socket.id, sdp: data.sdp });
    });

    socket.on("call:answer", (data) => {
      const room = rooms.getRoomBySocket(socket.id);
      if (!room) return;
      const roster = callRosters.get(room.code);
      if (!roster?.has(socket.id) || !roster.has(data.to)) return;
      if (!canSignal(socket.id)) return;
      io.to(data.to).emit("call:answer", { from: socket.id, sdp: data.sdp });
    });

    socket.on("call:ice", (data) => {
      const room = rooms.getRoomBySocket(socket.id);
      if (!room) return;
      const roster = callRosters.get(room.code);
      if (!roster?.has(socket.id) || !roster.has(data.to)) return;
      if (!canSignal(socket.id)) return;
      io.to(data.to).emit("call:ice", { from: socket.id, candidate: data.candidate });
    });

    socket.on("call:toggle-mute", () => {
      const room = rooms.getRoomBySocket(socket.id);
      if (!room) return;
      const roster = callRosters.get(room.code);
      const me = roster?.get(socket.id);
      if (!me) return;
      me.muted = !me.muted;
      emitCallState(room.code);
    });

    socket.on("disconnect", () => {
      const session = rooms.getSession(socket.id);
      const room = rooms.getRoomBySocket(socket.id);
      const hasGame = room?.state && room.state.phase !== "idle";
      const leavingName = room?.players.find((p) => p.id === session?.playerId)?.name;

      if (hasGame && room) {
        // C1/C3/C4 fix: keep seat, reassign host immediately, emit game state.
        const { room: r, hostReassigned } = rooms.markDisconnected(socket.id);
        if (r) {
          emitRoomUpdate(r.code);
          emitGameState(r.code);
          if (leavingName) emitSystemChat(r.code, `${leavingName} left the game`);
          // C6 fix: resolve pending color pick if the picker left.
          if (r.state && r.state.pendingColorPick) {
            const st2 = r.state;
            const picker = st2.players.find((p) => p.id === st2.pendingColorPick);
            if (picker && !picker.connected && !picker.isBot) {
              resolvePendingColorPick(st2);
              emitGameState(r.code);
              emitRoomUpdate(r.code);
            }
          }
          scheduleAutoIfNeeded(r.code);
        }
        void hostReassigned;
      } else if (session && room) {
        // Lobby: give a short grace period for a refresh/reconnect, then remove.
        const code = session.code;
        const playerId = session.playerId;
        const { room: r } = rooms.markDisconnected(socket.id);
        if (r) {
          emitRoomUpdate(code);
          if (leavingName) emitSystemChat(code, `${leavingName} left the room`);
        }
        setTimeout(() => {
          if (rooms.removePlayerIfAway(code, playerId)) {
            emitRoomUpdate(code);
          }
        }, RECONNECT_GRACE_MS);
      }
      // Audio call cleanup: drop the disconnected peer from the roster + notify
      // remaining callers. The socket auto-leaves the `${code}__call` sub-room.
      cleanupCall(socket.id, room?.code ?? null);
      void session;
    });
  });
}
