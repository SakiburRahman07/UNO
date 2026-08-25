"use client";

import { useEffect, useState } from "react";
import type { AppSocket } from "@/lib/socket";
import type { PlayerRanking, PublicGameState } from "@/types/uno";

export interface GameEndInfo {
  winnerId: string;
  rankings: PlayerRanking[];
}

export function useGameState(socket: AppSocket | null) {
  const [state, setState] = useState<PublicGameState | null>(null);
  const [gameEnd, setGameEnd] = useState<GameEndInfo | null>(null);
  const [unoCaller, setUnoCaller] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    const onState = (s: PublicGameState) => {
      setState(s);
      if (s.phase === "finished" && s.winnerId) {
        setGameEnd({ winnerId: s.winnerId, rankings: s.rankings });
      } else if (s.phase !== "finished") {
        setGameEnd(null);
      }
    };
    const onEnd = (d: GameEndInfo) => setGameEnd(d);
    const onUno = (d: { playerId: string }) => {
      setUnoCaller(d.playerId);
      window.setTimeout(() => setUnoCaller(null), 1800);
    };

    socket.on("game:state", onState);
    socket.on("game:end", onEnd);
    socket.on("uno:called", onUno);

    return () => {
      socket.off("game:state", onState);
      socket.off("game:end", onEnd);
      socket.off("uno:called", onUno);
    };
  }, [socket]);

  return { state, gameEnd, unoCaller };
}
