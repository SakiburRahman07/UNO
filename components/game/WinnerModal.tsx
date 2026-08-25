"use client";

import * as React from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Crown, RotateCcw, LogOut, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { avatarGradient, cn, initials } from "@/lib/utils";
import type { PlayerRanking } from "@/types/uno";

function fireConfetti() {
  const colors = ["#a855f7", "#22d3ee", "#f43f5e", "#facc15", "#22c55e"];
  const end = Date.now() + 1800;
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({
    particleCount: 120,
    spread: 100,
    origin: { y: 0.5 },
    colors,
    scalar: 1.1,
  });
}

export function WinnerModal({
  winnerId,
  rankings,
  myPlayerId,
  isHost,
  onRestart,
  onLeave,
}: {
  winnerId: string;
  rankings: PlayerRanking[];
  myPlayerId: string;
  isHost: boolean;
  onRestart: () => void;
  onLeave: () => void;
}) {
  React.useEffect(() => {
    fireConfetti();
  }, []);

  const winner = rankings.find((r) => r.isWinner);
  const sorted = [...rankings].sort((a, b) => a.rank - b.rank);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="glass-strong w-full max-w-md rounded-3xl p-7 text-center"
      >
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 220, damping: 12 }}
          className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-xl shadow-amber-500/40"
        >
          <Crown className="h-10 w-10" />
        </motion.div>
        <h2 className="font-display text-2xl font-extrabold">
          {winner?.name ?? "Player"} wins!
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {winner?.playerId === myPlayerId ? "Congratulations — amazing play!" : "Better luck next round."}
        </p>

        <div className="mt-5 space-y-2 text-left">
          {sorted.map((r) => (
            <div
              key={r.playerId}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2",
                r.isWinner ? "bg-amber-500/15 ring-1 ring-amber-500/40" : "bg-white/5",
              )}
            >
              <span className="w-6 text-center font-display text-sm font-bold text-muted-foreground">
                #{r.rank}
              </span>
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white",
                  avatarGradient(r.playerId + r.name),
                )}
              >
                {r.isBot ? <Bot className="h-4 w-4" /> : initials(r.name)}
              </div>
              <span className="flex-1 truncate text-sm font-medium">
                {r.name}
                {r.playerId === myPlayerId && (
                  <span className="ml-1 text-[10px] text-fuchsia-400">you</span>
                )}
              </span>
              {r.isWinner ? (
                <Badge variant="warning">Winner</Badge>
              ) : (
                <span className="text-xs text-muted-foreground">{r.cardsLeft} left</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          {isHost ? (
            <Button variant="neon" className="flex-1" onClick={onRestart}>
              <RotateCcw className="h-4 w-4" />
              Play again
            </Button>
          ) : (
            <div className="flex-1 rounded-lg bg-white/5 py-2 text-center text-xs text-muted-foreground">
              Waiting for host to restart…
            </div>
          )}
          <Button variant="glass" onClick={onLeave}>
            <LogOut className="h-4 w-4" />
            Leave
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
