"use client";

import { motion } from "framer-motion";
import { Bot, Crown, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardBack } from "@/components/cards/CardBack";
import { avatarGradient, cn, initials } from "@/lib/utils";
import type { PublicPlayer } from "@/types/uno";

export function PlayerSeat({
  player,
  isCurrent,
  isMe,
}: {
  player: PublicPlayer;
  isCurrent: boolean;
  isMe: boolean;
}) {
  return (
    <motion.div
      layout
      animate={isCurrent ? { scale: 1.04 } : { scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn(
        "glass relative flex w-20 flex-col items-center gap-1 rounded-2xl p-2 text-center sm:w-28 sm:gap-1.5 sm:p-3",
        isCurrent && "ring-2 ring-fuchsia-500/70 shadow-lg shadow-fuchsia-500/30",
      )}
    >
      {isCurrent && (
        <motion.span
          className="absolute -top-1.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-fuchsia-400"
          animate={{ opacity: [1, 0.3, 1], scale: [1, 1.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}
      <div className="relative">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow sm:h-12 sm:w-12 sm:text-base",
            avatarGradient(player.id + player.name),
          )}
        >
          {player.isBot ? <Bot className="h-4 w-4 sm:h-5 sm:w-5" /> : initials(player.name)}
        </div>
        {player.isHost && (
          <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white ring-2 ring-background sm:h-5 sm:w-5">
            <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-1">
        <span className="max-w-[6rem] truncate text-xs font-semibold">
          {player.name}
        </span>
        {isMe && <span className="text-[9px] text-fuchsia-400">you</span>}
      </div>

      <div className="relative flex items-center justify-center">
        <CardBack size="sm" className="!w-8 !shadow-md" />
        <span className="absolute -right-3 top-1/2 -translate-y-1/2 rounded-full bg-overlay px-1.5 py-0.5 text-[10px] font-bold text-white">
          {player.handSize}
        </span>
      </div>

      <div className="flex h-5 items-center gap-1">
        {player.handSize === 1 && player.saidUno && (
          <Badge variant="glow" className="text-[9px]">UNO!</Badge>
        )}
        {player.handSize === 1 && !player.saidUno && (
          <Badge variant="destructive" className="text-[9px]">UNO?</Badge>
        )}
        {!player.connected && !player.isBot && (
          <span className="flex items-center gap-1 text-[9px] text-amber-400">
            <AlertCircle className="h-3 w-3" /> away
          </span>
        )}
      </div>
    </motion.div>
  );
}
