import { io } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types/uno";
import { getPlayableCards } from "@/server/unoRules";

const socket = io("http://localhost:3000", {
  transports: ["websocket"],
  reconnection: false,
  timeout: 5000,
}) as unknown as import("socket.io-client").Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

async function main() {
  await new Promise<void>((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
    setTimeout(() => reject(new Error("connect timeout")), 8000);
  });
  console.log("connected");

  const created = await socket.emitWithAck("room:create", { name: "Tester" });
  if (!created.ok) throw new Error("create failed: " + created.error);
  const code = created.data.code;
  console.log("room:", code);

  for (let i = 0; i < 3; i++) {
    const r = await socket.emitWithAck("room:add-bot");
    if (!r.ok) throw new Error("add-bot failed: " + r.error);
  }
  console.log("added 3 bots");

  const start = await socket.emitWithAck("game:start");
  if (!start.ok) throw new Error("start failed: " + start.error);
  console.log("game started");

  await new Promise<void>((resolve, reject) => {
    let acting = false;
    const timer = setTimeout(() => reject(new Error("game timeout")), 90000);
    socket.on("game:end", (d) => {
      clearTimeout(timer);
      const winner = d.rankings.find((r) => r.isWinner);
      console.log("GAME END — winner:", winner?.name, "rankings:", d.rankings.length);
      resolve();
    });
    socket.on("game:state", async (state) => {
      if (acting) return;
      if (state.phase === "finished") return;
      if (state.pendingColorPick === state.myPlayerId) {
        acting = true;
        socket.emit("color:choose", { color: "red" });
        acting = false;
        return;
      }
      if (!state.isMyTurn) return;
      acting = true;
      try {
        const me = state.players.find((p) => p.id === state.myPlayerId);
        if (state.myHand.length === 1 && me && !me.saidUno) {
          socket.emit("uno:call");
        }

        if (state.hasDrawnThisTurn && state.lastDrawnCardId) {
          const res = await socket.emitWithAck("card:play", {
            cardId: state.lastDrawnCardId,
          });
          if (res.ok && res.data.needsColor) socket.emit("color:choose", { color: "red" });
          return;
        }

        const playable = getPlayableCards(
          state.myHand,
          state.topCard,
          state.activeColor,
          state.drawStack,
        );
        if (playable.length > 0) {
          const res = await socket.emitWithAck("card:play", { cardId: playable[0].id });
          if (res.ok && res.data.needsColor) socket.emit("color:choose", { color: "red" });
        } else {
          await socket.emitWithAck("card:draw");
        }
      } finally {
        acting = false;
      }
    });
  });

  socket.disconnect();
  console.log("SOCKET E2E TEST PASSED");
  process.exit(0);
}

main().catch((e) => {
  console.error("SOCKET E2E TEST FAILED:", e);
  socket.disconnect();
  process.exit(1);
});
