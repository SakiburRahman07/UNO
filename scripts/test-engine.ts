import { createRoom, addBot, getRoom } from "@/server/roomManager";
import {
  startGame,
  playCard,
  drawCards,
  passTurn,
  chooseColor,
  performBotMove,
  callUno,
} from "@/server/gameEngine";
import { canPlay, getPlayableCards } from "@/server/unoRules";

function runGame(label: string, botCount: number) {
  // reset is automatic since modules hold maps; create a fresh room each call.
  const { code } = createRoom("Alice", "sock-alice-" + label);
  for (let i = 0; i < botCount; i++) addBot(code);
  const room = getRoom(code)!;
  startGame(room);
  const state = room.state;
  let safety = 0;
  let humanPlayed = 0;
  let humanDrew = 0;

  while (state.phase === "playing" && safety++ < 5000) {
    const cur = state.players[state.turn];

    if (safety % 500 === 0) {
      const sizes = state.players.map((p) => p.name + ":" + p.hand.length).join(" ");
      const top = state.discard[state.discard.length - 1];
      console.log(
        `  iter=${safety} turn=${cur.name} dir=${state.direction} ` +
          `top=${top?.color}/${top?.value} ` +
          `color=${state.activeColor} stack=${state.drawStack} hands=[${sizes}] deck=${state.deck.length}`,
      );
    }

    if (state.pendingColorPick) {
      // resolve any pending color pick (human)
      chooseColor(state, state.pendingColorPick, "red");
      continue;
    }

    if (cur.isBot) {
      performBotMove(state, cur.id);
      continue;
    }

    // Human (Alice) turn.
    if (cur.id !== "sock-alice-" + label) {
      // a disconnected/other human seat we don't drive in this test
      drawCards(state, cur.id);
      continue;
    }

    const top = state.discard[state.discard.length - 1];
    const playable = getPlayableCards(cur.hand, top, state.activeColor, state.drawStack);

    if (playable.length > 0) {
      const card = playable[0];
      try {
        const r = playCard(state, cur.id, card.id);
        humanPlayed++;
        if (r.needsColor) chooseColor(state, cur.id, "red");
        if (cur.hand.length === 1 && !cur.saidUno) callUno(state, cur.id);
      } catch {
        drawCards(state, cur.id);
      }
    } else {
      drawCards(state, cur.id);
      humanDrew++;
      if (
        state.players[state.turn].id === cur.id &&
        state.hasDrawnThisTurn &&
        state.lastDrawnCardId
      ) {
        const drawn = cur.hand.find((c) => c.id === state.lastDrawnCardId);
        if (drawn && canPlay(drawn, cur.hand, top, state.activeColor, 0)) {
          try {
            const r = playCard(state, cur.id, drawn.id);
            humanPlayed++;
            if (r.needsColor) chooseColor(state, cur.id, "red");
            if (cur.hand.length === 1 && !cur.saidUno) callUno(state, cur.id);
          } catch {
            passTurn(state, cur.id);
          }
        } else {
          passTurn(state, cur.id);
        }
      }
    }
  }

  const winner = state.players.find((p) => p.id === state.winnerId);
  console.log(
    `[${label}] ${botCount} bots — phase=${state.phase} winner=${winner?.name ?? "none"} ` +
      `humanPlayed=${humanPlayed} humanDrew=${humanDrew} iters=${safety} ` +
      `deckLeft=${state.deck.length} discard=${state.discard.length}`,
  );
  if (state.phase !== "finished") throw new Error(`[${label}] game did not finish`);
  if (!state.winnerId) throw new Error(`[${label}] no winner`);
  return state.rankings;
}

runGame(`diag`, 3);

let ok = 0;
const configs = [1, 2, 3, 5];
for (const bots of configs) {
  for (let i = 0; i < 10; i++) {
    runGame(`b${bots}-${i}`, bots);
    ok++;
  }
}
console.log(`\nALL ${ok + 1} GAMES COMPLETED SUCCESSFULLY`);
