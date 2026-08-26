"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioCallPanel } from "@/components/game/AudioCallPanel";
import type { CallParticipant } from "@/types/call";

export function AudioCallDrawer({
  open,
  onClose,
  participants,
  myPlayerId,
  muted,
  speaking,
  error,
  joining,
  onToggleMute,
  onLeave,
}: {
  open: boolean;
  onClose: () => void;
  participants: CallParticipant[];
  myPlayerId: string;
  muted: boolean;
  speaking: Record<string, boolean>;
  error: string | null;
  joining: boolean;
  onToggleMute: () => void;
  onLeave: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[70vh] flex-col gap-2 rounded-t-3xl glass-strong border-t border-border-subtle p-4 pb-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-fuchsia-400" />
                <span className="font-display text-sm font-semibold">Voice call</span>
              </div>
              <Button variant="glass" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <AudioCallPanel
              participants={participants}
              myPlayerId={myPlayerId}
              muted={muted}
              speaking={speaking}
              error={error}
              joining={joining}
              onToggleMute={onToggleMute}
              onLeave={onLeave}
              className="flex-1 overflow-y-auto scrollbar-hide"
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function CallToggleButton({
  onClick,
  active,
  callerCount,
}: {
  onClick: () => void;
  active: boolean;
  callerCount: number;
}) {
  return (
    <div className="relative">
      <Button
        variant={active ? "neon" : "glass"}
        size="icon"
        onClick={onClick}
        aria-label={active ? "Open voice call" : "Start voice call"}
      >
        {active ? <Phone className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
      </Button>
      {callerCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[9px] font-bold text-white">
          {callerCount > 9 ? "9+" : callerCount}
        </span>
      )}
    </div>
  );
}
