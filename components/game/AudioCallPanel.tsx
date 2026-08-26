"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, PhoneOff, Loader2, AlertCircle, Phone } from "lucide-react";
import { avatarGradient, cn, formatTime, initials } from "@/lib/utils";
import { CALL_WARN_THRESHOLD } from "@/types/call";
import type { CallParticipant } from "@/types/call";

/** 4 vertical audio-level bars that react to a 0..1 level value. */
function LevelBars({ level, active }: { level: number; active: boolean }) {
  const heights = [0.4, 0.7, 1, 0.65];
  return (
    <div className="flex h-3 items-end justify-center gap-0.5">
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className={cn(
            "w-1 rounded-full",
            active ? "bg-fuchsia-400" : "bg-white/15",
          )}
          animate={{
            scaleY: active ? Math.max(0.12, level * h) : 0.12,
          }}
          transition={{ duration: 0.08 }}
          style={{ height: `${h * 100}%`, transformOrigin: "bottom" }}
        />
      ))}
    </div>
  );
}

export function AudioCallPanel({
  participants,
  myPlayerId,
  muted,
  speaking,
  levels,
  startedAt,
  connecting,
  error,
  onToggleMute,
  onLeave,
  className,
}: {
  participants: CallParticipant[];
  myPlayerId: string;
  muted: boolean;
  speaking: Record<string, boolean>;
  levels: Record<string, number>;
  startedAt: number | null;
  connecting: boolean;
  error: string | null;
  onToggleMute: () => void;
  onLeave: () => void;
  className?: string;
}) {
  const callerCount = participants.length;
  const showWarn = callerCount > CALL_WARN_THRESHOLD;

  // Live call duration timer. Updates via async callbacks only (rAF + interval)
  // to avoid synchronous setState / impure calls during render.
  const [seconds, setSeconds] = React.useState(0);
  React.useEffect(() => {
    if (!startedAt) return;
    const tick = () => setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    const raf = requestAnimationFrame(tick);
    const id = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, [startedAt]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="font-display text-sm font-semibold">Voice call</span>
          {startedAt && (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {formatTime(seconds)}
            </span>
          )}
        </div>
        <span className="rounded-full bg-fuchsia-500/15 px-2.5 py-0.5 text-[10px] font-bold text-fuchsia-300">
          {callerCount} {callerCount === 1 ? "caller" : "live"}
        </span>
      </div>

      {/* muted banner */}
      {muted && !connecting && (
        <button
          onClick={onToggleMute}
          className="group flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-[11px] text-amber-300 transition-colors hover:bg-amber-500/15"
        >
          <MicOff className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">Mic is off — tap to unmute</span>
          <span className="text-[10px] text-amber-400/70 group-hover:text-amber-300">Unmute</span>
        </button>
      )}

      {/* error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* connecting state */}
      {connecting ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-fuchsia-500/10">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-500/30 opacity-75" />
            <Loader2 className="relative h-7 w-7 animate-spin text-fuchsia-400" />
          </div>
          <p className="text-xs text-muted-foreground">Connecting to the call…</p>
        </div>
      ) : (
        <>
          {/* participants */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {participants.map((p) => {
              const isMe = p.playerId === myPlayerId;
              const isActive = !!speaking[p.playerId] && !p.muted;
              const lvl = levels[p.playerId] ?? 0;
              return (
                <motion.div
                  key={p.playerId}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22 }}
                  className={cn(
                    "glass relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl p-3 transition-all",
                    isActive && "shadow-lg shadow-fuchsia-500/25",
                  )}
                >
                  {/* glow wash when speaking */}
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 transition-opacity duration-200",
                      isActive
                        ? "bg-gradient-to-br from-fuchsia-500/15 to-cyan-500/10 opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <div className="relative">
                    {/* animated ring */}
                    {isActive && (
                      <span className="absolute -inset-1 animate-ping rounded-full bg-fuchsia-500/30" />
                    )}
                    <div
                      className={cn(
                        "relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white transition-transform",
                        avatarGradient(p.playerId + p.name),
                        isActive ? "scale-105 ring-2 ring-fuchsia-400/60" : "ring-2 ring-white/10",
                      )}
                    >
                      {initials(p.name)}
                    </div>
                    {/* mic badge */}
                    <div
                      className={cn(
                        "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background",
                        p.muted ? "bg-rose-500/90" : "bg-emerald-500/90",
                      )}
                    >
                      {p.muted ? (
                        <MicOff className="h-2.5 w-2.5 text-white" />
                      ) : (
                        <Mic className="h-2.5 w-2.5 text-white" />
                      )}
                    </div>
                  </div>
                  <span className="relative max-w-full truncate text-[11px] font-medium">
                    {isMe ? "You" : p.name}
                  </span>
                  <LevelBars level={lvl} active={isActive} />
                </motion.div>
              );
            })}
          </div>

          {showWarn && (
            <p className="flex items-center justify-center gap-1.5 text-center text-[10px] text-amber-400/80">
              <AlertCircle className="h-3 w-3" />
              {callerCount} callers — quality may dip on slow connections
            </p>
          )}

          {/* big circular controls */}
          <div className="flex items-end justify-center gap-8 pt-1">
            <button
              onClick={onToggleMute}
              className="group flex flex-col items-center gap-1.5"
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            >
              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all group-active:scale-90 group-hover:brightness-110",
                  muted
                    ? "bg-gradient-to-br from-rose-500 to-rose-700 shadow-rose-500/40"
                    : "bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-fuchsia-500/40",
                )}
              >
                {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                {muted ? "Unmute" : "Mute"}
              </span>
            </button>
            <button
              onClick={onLeave}
              className="group flex flex-col items-center gap-1.5"
              aria-label="Leave call"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-700 text-white shadow-lg shadow-rose-500/40 transition-all group-active:scale-90 group-hover:brightness-110">
                <PhoneOff className="h-6 w-6" />
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">Leave</span>
            </button>
          </div>
        </>
      )}

      {/* subtle footer hint when not in call yet */}
      {!connecting && participants.length === 0 && !error && (
        <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-muted-foreground">
          <Phone className="h-3.5 w-3.5 text-fuchsia-400" />
          Tap the call button to start talking
        </div>
      )}
    </div>
  );
}
