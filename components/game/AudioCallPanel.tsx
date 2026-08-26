"use client";

import * as React from "react";
import { Mic, MicOff, PhoneOff, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { avatarGradient, cn, initials } from "@/lib/utils";
import { CALL_WARN_THRESHOLD } from "@/types/call";
import type { CallParticipant } from "@/types/call";

export function AudioCallPanel({
  participants,
  myPlayerId,
  muted,
  speaking,
  error,
  joining,
  onToggleMute,
  onLeave,
  className,
}: {
  participants: CallParticipant[];
  myPlayerId: string;
  muted: boolean;
  speaking: Record<string, boolean>;
  error: string | null;
  joining: boolean;
  onToggleMute: () => void;
  onLeave: () => void;
  className?: string;
}) {
  const callerCount = participants.length;
  const showWarn = callerCount > CALL_WARN_THRESHOLD;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-sm font-semibold">Audio call</span>
          <Badge variant="glow" className="text-[9px]">{callerCount} live</Badge>
        </div>
        {showWarn && (
          <span className="flex items-center gap-1 text-[10px] text-amber-400">
            <AlertCircle className="h-3 w-3" />
            {callerCount} callers
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* participants */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {participants.map((p) => {
          const isMe = p.playerId === myPlayerId;
          const isActive = !!speaking[p.playerId] && !p.muted;
          return (
            <div
              key={p.playerId}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition-colors",
                isActive
                  ? "border-fuchsia-500/60 bg-fuchsia-500/10 shadow-lg shadow-fuchsia-500/20"
                  : "border-border-subtle bg-surface-subtle",
              )}
            >
              <div className="relative">
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white transition-transform",
                    avatarGradient(p.playerId + p.name),
                    isActive && "scale-105",
                  )}
                >
                  {initials(p.name)}
                </div>
                <div
                  className={cn(
                    "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background",
                    p.muted ? "bg-rose-500/80" : "bg-emerald-500/80",
                  )}
                >
                  {p.muted ? (
                    <MicOff className="h-2.5 w-2.5 text-white" />
                  ) : (
                    <Mic className="h-2.5 w-2.5 text-white" />
                  )}
                </div>
              </div>
              <span className="max-w-full truncate text-[11px] font-medium">
                {isMe ? "You" : p.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant={muted ? "destructive" : "glass"}
          size="sm"
          onClick={onToggleMute}
          disabled={joining}
          className="gap-1.5"
        >
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {muted ? "Unmute" : "Mute"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onLeave}
          disabled={joining}
          className="gap-1.5"
        >
          {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
          Leave
        </Button>
      </div>
    </div>
  );
}
