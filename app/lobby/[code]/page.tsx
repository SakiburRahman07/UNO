"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  Check,
  Users,
  Bot,
  Crown,
  Plus,
  Play,
  LogOut,
  Loader2,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  X,
  Gamepad2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSocket } from "@/hooks/useSocket";
import { useRoom } from "@/hooks/useRoom";
import { useSound } from "@/hooks/useSound";
import { useTheme } from "@/components/theme-provider";
import { avatarGradient, cn, initials } from "@/lib/utils";
import { MIN_PLAYERS, NAV_ROUTES, STORAGE_KEYS } from "@/lib/constants";
import { toast } from "@/components/ui/toaster";
import type { PublicPlayer } from "@/types/uno";

function PlayerCard({
  player,
  isMe,
  isHost,
  canKick,
  onKick,
  index,
}: {
  player: PublicPlayer;
  isMe: boolean;
  isHost: boolean;
  canKick: boolean;
  onKick: () => void;
  index: number;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={cn(
        "glass relative flex flex-col items-center gap-2 rounded-2xl p-4 text-center",
        isMe && "ring-2 ring-fuchsia-500/60",
      )}
    >
      {canKick && (
        <button
          onClick={onKick}
          className="absolute right-2 top-2 rounded-full bg-black/40 p-1 text-muted-foreground hover:text-destructive"
          aria-label="Remove bot"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="relative">
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br text-lg font-bold text-white shadow-lg",
            avatarGradient(player.id + player.name),
          )}
        >
          {player.isBot ? <Bot className="h-6 w-6" /> : initials(player.name)}
        </div>
        {player.isHost && (
          <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow ring-2 ring-background">
            <Crown className="h-3.5 w-3.5" />
          </div>
        )}
        {!player.connected && !player.isBot && (
          <div className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-amber-400 ring-2 ring-background" title="Disconnected" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center justify-center gap-1.5">
          <span className="max-w-[8rem] truncate text-sm font-semibold">
            {player.name}
          </span>
          {isMe && <span className="text-[10px] text-fuchsia-400">you</span>}
        </div>
        <div className="mt-1">
          {player.isBot ? (
            <Badge variant="secondary">Bot</Badge>
          ) : player.isHost ? (
            <Badge variant="warning">Host</Badge>
          ) : player.ready ? (
            <Badge variant="success">Ready</Badge>
          ) : (
            <Badge variant="outline">Not ready</Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function LobbyPage() {
  const params = useParams();
  const code = (params?.code as string) ?? "";
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const room = useRoom(socket);
  const { play, muted, toggleMute } = useSound();
  const { theme, toggleTheme } = useTheme();
  const [copied, setCopied] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [addBotBusy, setAddBotBusy] = React.useState(false);

  const myId = socket?.id ?? "";
  const me = room?.players.find((p) => p.id === myId);
  const isHost = me?.isHost ?? false;

  // (Re)join on mount to get fresh room state (idempotent on the server).
  React.useEffect(() => {
    const name = localStorage.getItem(STORAGE_KEYS.playerName) ?? "";
    if (!name || !socket) {
      router.replace(NAV_ROUTES.home);
      return;
    }
    let cancelled = false;
    (async () => {
      await new Promise<void>((resolve) => {
        if (socket.connected) resolve();
        else {
          const onConn = () => { socket.off("connect", onConn); resolve(); };
          socket.on("connect", onConn);
          setTimeout(resolve, 4000);
        }
      });
      if (cancelled) return;
      try {
        const res = await socket.emitWithAck("room:join", { code, name });
        if (!res.ok) {
          toast.error(res.error);
          router.replace(NAV_ROUTES.home);
        }
      } catch {
        router.replace(NAV_ROUTES.home);
      }
    })();
    return () => { cancelled = true; };
  }, [socket, code, router]);

  // When the game starts, move to the game board.
  React.useEffect(() => {
    if (room?.inGame) {
      play("join");
      router.replace(NAV_ROUTES.game(room.code));
    }
  }, [room?.inGame, room?.code, router, play]);

  const allReady = (room?.players ?? []).every((p) => p.ready);
  const canStart =
    (room?.players.length ?? 0) >= MIN_PLAYERS && allReady;
  const startReason = !canStart
    ? (room?.players.length ?? 0) < MIN_PLAYERS
      ? `Need at least ${MIN_PLAYERS} players`
      : "Waiting for all players to be ready"
    : "";

  const handleCopy = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      play("click");
      toast.success("Room code copied!");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy");
    }
  };

  const handleAddBot = async () => {
    if (!socket) return;
    setAddBotBusy(true);
    play("click");
    try {
      const res = await socket.emitWithAck("room:add-bot");
      if (!res.ok) toast.error(res.error);
    } catch {
      toast.error("Could not add bot");
    } finally {
      setAddBotBusy(false);
    }
  };

  const handleStart = async () => {
    if (!socket || !canStart) return;
    setStarting(true);
    play("click");
    try {
      const res = await socket.emitWithAck("game:start");
      if (!res.ok) {
        toast.error(res.error);
        setStarting(false);
      }
    } catch {
      toast.error("Could not start game");
      setStarting(false);
    }
  };

  const handleLeave = () => {
    socket?.emit("room:leave");
    router.replace(NAV_ROUTES.home);
  };

  const handleToggleReady = () => {
    play("click");
    socket?.emit("room:toggle-ready");
  };

  const handleKick = (playerId: string) => {
    socket?.emit("room:kick", { playerId });
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,#241047_0%,#0a0a12_60%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_20%,rgba(6,182,212,0.14),transparent_45%),radial-gradient(circle_at_15%_75%,rgba(168,85,247,0.16),transparent_45%)]" />

      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Button variant="glass" size="icon" onClick={handleLeave} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-400 text-white">
            <Gamepad2 className="h-4.5 w-4.5" />
          </div>
          <span className="font-display text-base font-bold">Game Lobby</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="glass" size="icon" onClick={() => { toggleMute(); play("click"); }}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Button variant="glass" size="icon" onClick={() => { toggleTheme(); play("click"); }}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 pb-24">
        {/* room code card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-strong mx-auto mt-4 flex max-w-md flex-col items-center gap-3 rounded-3xl p-6 text-center"
        >
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Room code
          </span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-4xl font-extrabold tracking-[0.3em] text-gradient sm:text-5xl">
              {room?.code ?? code.toUpperCase()}
            </span>
            <Button variant="glass" size="icon" onClick={handleCopy} aria-label="Copy code">
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Share this code with friends so they can join.
          </p>
        </motion.div>

        {/* players */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="font-display text-lg font-semibold">Players</h2>
            <Badge variant="outline">
              <Users className="h-3.5 w-3.5" />
              {room?.players.length ?? 0} / 10
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {(room?.players ?? []).map((p, i) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  isMe={p.id === myId}
                  isHost={p.isHost}
                  canKick={isHost && p.isBot}
                  onKick={() => handleKick(p.id)}
                  index={i}
                />
              ))}
            </AnimatePresence>
            {isHost && (room?.players.length ?? 0) < 10 && (
              <button
                onClick={handleAddBot}
                disabled={addBotBusy}
                className="glass flex min-h-[7.5rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 text-muted-foreground transition-colors hover:border-fuchsia-500/50 hover:text-fuchsia-300 disabled:opacity-50"
              >
                {addBotBusy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-6 w-6" />
                    <span className="text-xs font-medium">Add bot</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* actions */}
        <div className="mt-10 flex flex-col items-center gap-3">
          {isHost ? (
            <Button
              variant="neon"
              size="xl"
              className="w-full max-w-sm"
              disabled={!canStart || starting}
              onClick={handleStart}
            >
              {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              Start Game
            </Button>
          ) : (
            <Button
              variant={me?.ready ? "secondary" : "neon"}
              size="xl"
              className="w-full max-w-sm"
              onClick={handleToggleReady}
            >
              {me?.ready ? "Not Ready" : "Ready Up"}
            </Button>
          )}
          {!canStart && isHost && (
            <span className="text-sm text-muted-foreground">{startReason}</span>
          )}
          <Button variant="ghost" onClick={handleLeave}>
            <LogOut className="h-4 w-4" />
            Leave room
          </Button>
        </div>

        {!isConnected && (
          <p className="mt-6 text-center text-xs text-amber-400">
            Reconnecting to server…
          </p>
        )}
      </div>
    </main>
  );
}
