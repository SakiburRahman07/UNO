"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  Check,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  RefreshCw,
  RotateCcw,
  LogOut,
  Hand,
  Layers,
  Gamepad2,
  Loader2,
  HelpCircle,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UnoCard } from "@/components/cards/UnoCard";
import { CardBack } from "@/components/cards/CardBack";
import { PlayerSeat } from "@/components/game/PlayerSeat";
import { ColorPicker } from "@/components/game/ColorPicker";
import { WinnerModal } from "@/components/game/WinnerModal";
import { UnoButton } from "@/components/game/UnoButton";
import { ChatPanel } from "@/components/game/ChatPanel";
import { ChatDrawer, ChatToggleButton } from "@/components/game/ChatDrawer";
import {
  AudioCallDrawer,
  CallToggleButton,
} from "@/components/game/AudioCallDrawer";
import { HowToPlay } from "@/components/game/HowToPlay";
import { useSocket } from "@/hooks/useSocket";
import { useGameState } from "@/hooks/useGameState";
import { useSound } from "@/hooks/useSound";
import { useChat } from "@/hooks/useChat";
import { useAudioCall } from "@/hooks/useAudioCall";
import { useTheme } from "@/components/theme-provider";
import { getPlayableCards } from "@/server/unoRules";
import { NAV_ROUTES, STORAGE_KEYS } from "@/lib/constants";
import { getStoredSession, clearSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import type { CardColor } from "@/types/uno";

const COLOR_RING: Record<CardColor, string> = {
  red: "ring-red-500",
  blue: "ring-blue-500",
  green: "ring-green-500",
  yellow: "ring-yellow-500",
  wild: "ring-fuchsia-500",
};

export default function GamePage() {
  const params = useParams();
  const code = (params?.code as string) ?? "";
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const { state, gameEnd, unoCaller } = useGameState(socket);
  const { play, muted: soundMuted, toggleMute: toggleSoundMute } = useSound();
  const { messages, sendMessage } = useChat(socket);
  const { theme, toggleTheme } = useTheme();
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEYS.hasSeenOnboarding) !== "1";
  });
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [callOpen, setCallOpen] = React.useState(false);
  const [callJoining, setCallJoining] = React.useState(false);

  const myId = socket?.id ?? "";
  const audioCall = useAudioCall(socket, myId);
  const me = state?.players.find((p) => p.id === myId);
  const isMyTurn = state?.isMyTurn ?? false;
  const pendingColor = state?.pendingColorPick === myId;

  // (Re)join on mount to receive game state.
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
        // Try token-based reconnection first (C7/H8 fix).
        const stored = getStoredSession();
        if (stored && stored.code === code.toUpperCase() && stored.sessionToken) {
          const reconRes = await socket.emitWithAck("room:reconnect", {
            code,
            sessionToken: stored.sessionToken,
          });
          if (reconRes.ok) return; // success
          clearSession(); // token invalid, fall through to name join
        }
        // Fallback: name-based join.
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

  // If not in a game after a moment, go to the lobby for this code.
  React.useEffect(() => {
    if (!socket) return;
    const t = setTimeout(() => {
      if (!state) router.replace(NAV_ROUTES.lobby(code));
    }, 5000);
    return () => clearTimeout(t);
  }, [socket, state, code, router]);

  // Sound cues on transitions.
  const prevTurn = React.useRef(false);
  React.useEffect(() => {
    if (isMyTurn && !prevTurn.current) play("turn");
    prevTurn.current = isMyTurn;
  }, [isMyTurn, play]);
  React.useEffect(() => {
    if (gameEnd) play("win");
  }, [gameEnd, play]);

  // M5: play sound when an opponent calls UNO.
  React.useEffect(() => {
    if (unoCaller && unoCaller !== myId) play("uno");
  }, [unoCaller, myId, play]);

  // H3: show toast when a player forgot UNO (penalty fired).
  const prevEventAt = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!state?.lastEvent || !state.lastEventAt) return;
    if (prevEventAt.current === state.lastEventAt) return;
    prevEventAt.current = state.lastEventAt;
    if (state.lastEvent.includes("forgot to call UNO")) {
      const isMe = state.lastEvent.includes(me?.name ?? "\x00");
      if (isMe) {
        toast.error("You forgot to call UNO! Tap the UNO button before playing your last card. +2 penalty cards.");
      } else {
        toast.info(state.lastEvent);
      }
      play("error");
    }
  }, [state?.lastEvent, state?.lastEventAt, state, me?.name, play]);

  // Track unread chat messages when drawer is closed.
  const [lastSeenCount, setLastSeenCount] = React.useState(0);
  const unreadChat = chatOpen ? 0 : Math.max(0, messages.length - lastSeenCount);

  // Playable card ids (client-side highlight).
  const playableIds = React.useMemo(() => {
    if (!state) return new Set<string>();
    if (isMyTurn && state.hasDrawnThisTurn && state.lastDrawnCardId) {
      return new Set([state.lastDrawnCardId]);
    }
    if (!isMyTurn || state.pendingColorPick) return new Set<string>();
    return new Set(
      getPlayableCards(state.myHand, state.topCard, state.activeColor, state.drawStack).map(
        (c) => c.id,
      ),
    );
  }, [state, isMyTurn]);

  const opponents = (state?.players ?? []).filter((p) => p.id !== myId);
  const someoneVulnerable = (state?.players ?? []).some(
    (p) => p.id !== myId && p.handSize === 1 && !p.saidUno,
  );
  const needSelfCall = !!me && me.handSize === 1 && !me.saidUno;
  const showUno = needSelfCall || someoneVulnerable;
  const unoLabel = needSelfCall ? "Call UNO!" : "Catch them!";
  const canDraw = isMyTurn && !state?.pendingColorPick;
  const canPass =
    isMyTurn && !state?.pendingColorPick && !!state?.hasDrawnThisTurn && state.drawStack === 0;

  const handlePlay = async (cardId: string) => {
    if (!socket || !isMyTurn || !playableIds.has(cardId) || busy) return;
    setBusy(true);
    play("play");
    try {
      const res = await socket.emitWithAck("card:play", { cardId });
      if (!res.ok) {
        toast.error(res.error);
        play("error");
      }
    } catch {
      play("error");
    } finally {
      setBusy(false);
    }
  };

  const handleDraw = async () => {
    if (!socket || !canDraw || busy) return;
    setBusy(true);
    play("draw");
    try {
      const res = await socket.emitWithAck("card:draw");
      if (!res.ok) {
        toast.error(res.error);
        play("error");
      }
    } catch {
      play("error");
    } finally {
      setBusy(false);
    }
  };

  const handlePass = () => {
    if (!socket || !canPass) return;
    play("draw");
    socket.emit("turn:pass");
  };

  const handleChooseColor = (color: CardColor) => {
    play("click");
    socket?.emit("color:choose", { color });
  };

  const handleUno = () => {
    play("uno");
    socket?.emit("uno:call");
  };

  const handleRestart = () => {
    play("click");
    socket?.emit("game:restart");
  };

  const handleLeave = () => {
    socket?.emit("room:leave");
    clearSession();
    router.replace(NAV_ROUTES.home);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.toUpperCase());
      setCopied(true);
      play("click");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleCallToggle = async () => {
    play("click");
    if (audioCall.inCall) {
      setCallOpen(true);
      return;
    }
    setCallJoining(true);
    await audioCall.joinCall();
    setCallJoining(false);
    setCallOpen(true);
  };

  const handleCallLeave = () => {
    play("click");
    audioCall.leaveCall();
    setCallOpen(false);
  };

  const handleCallMute = () => {
    play("click");
    audioCall.toggleMute();
  };

  if (!state) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-radial">
        <Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" />
        <p className="text-sm text-muted-foreground">Loading the table…</p>
      </div>
    );
  }

  const currentPlayer = state.players[state.turn];
  const currentName = currentPlayer?.name;
  const isBotTurn = !!currentPlayer?.isBot && state.phase === "playing";
  const isHost = me?.isHost ?? false;

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden lg:flex-row">
      <div className="fixed inset-0 -z-10 bg-radial" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-radial-glow" />

      {/* game content */}
      <div className="flex min-w-0 flex-1 flex-col">
      {/* header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="glass" size="icon" onClick={() => setConfirmLeave(true)} aria-label="Leave">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <button
            onClick={handleCopy}
            className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs font-bold tracking-widest"
          >
            {code.toUpperCase()}
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-muted-foreground sm:flex">
            <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
            {isConnected ? "Live" : "Reconnecting"}
          </div>
          <Button variant="glass" size="icon" onClick={() => { toggleSoundMute(); play("click"); }}>
            {soundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Button variant="glass" size="icon" onClick={() => { toggleTheme(); play("click"); }}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="glass" size="icon" onClick={() => { setShowHelp(true); play("click"); }} aria-label="How to play">
            <HelpCircle className="h-4 w-4" />
          </Button>
          <CallToggleButton
            onClick={handleCallToggle}
            active={audioCall.inCall}
            callerCount={audioCall.participants.length}
          />
          <div className="lg:hidden">
            <ChatToggleButton onClick={() => { setLastSeenCount(messages.length); setChatOpen(true); }} unreadCount={unreadChat} />
          </div>
        </div>
      </header>

      {/* opponents */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-1">
        <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
          {opponents.map((p) => (
            <PlayerSeat
              key={p.id}
              player={p}
              isCurrent={state.players[state.turn]?.id === p.id}
              isMe={false}
            />
          ))}
        </div>
      </section>

      {/* center table */}
      <section className="relative flex flex-1 flex-col items-center justify-center gap-3 px-4 py-4">
        {/* status */}
        <div className="flex min-h-[2.5rem] items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.lastEventAt}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              className="text-center"
            >
              {state.pendingColorPick && state.pendingColorPick !== myId ? (
                <p className="text-sm font-medium text-fuchsia-300">
                  {state.players.find((p) => p.id === state.pendingColorPick)?.name} is choosing a color…
                </p>
              ) : isBotTurn ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="flex gap-1">
                    <motion.span
                      className="h-1.5 w-1.5 rounded-full bg-fuchsia-400"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                    />
                    <motion.span
                      className="h-1.5 w-1.5 rounded-full bg-fuchsia-400"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                    />
                    <motion.span
                      className="h-1.5 w-1.5 rounded-full bg-fuchsia-400"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                    />
                  </span>
                  {currentName} is thinking…
                </p>
              ) : isMyTurn ? (
                <p className="text-base font-bold text-fuchsia-300 neon-text">
                  Your turn
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {state.lastEvent || `${currentName ?? ""}'s turn`}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* piles */}
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          {/* draw pile */}
          <div className="flex flex-col items-center gap-2">
            <motion.button
              whileHover={canDraw ? { scale: 1.05, y: -3 } : {}}
              whileTap={canDraw ? { scale: 0.96 } : {}}
              onClick={handleDraw}
              disabled={!canDraw}
              className={cn(
                "relative transition-opacity",
                !canDraw && "cursor-not-allowed opacity-70",
                isMyTurn && state.drawStack > 0 && "rounded-2xl ring-4 ring-red-500/70 ring-offset-2 ring-offset-background",
              )}
              aria-label={isMyTurn && state.drawStack > 0 ? `Draw ${state.drawStack} penalty cards` : "Draw a card"}
            >
              <CardBack size="lg" />
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-overlay text-[10px] font-bold text-white ring-2 ring-background">
                {state.deckCount}
              </div>
              {state.drawStack > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-700 text-xs font-extrabold text-white shadow-lg ring-2 ring-background"
                >
                  +{state.drawStack}
                </motion.div>
              )}
            </motion.button>
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Layers className="h-3 w-3" />
              {isMyTurn && state.drawStack > 0 ? "Must draw" : "Draw"}
            </span>
          </div>

          {/* discard pile */}
          <div className="flex flex-col items-center gap-2">
            <div className={cn("rounded-2xl p-1 ring-4", COLOR_RING[state.pendingColorPick ? "wild" : state.activeColor])}>
              <motion.div
                key={state.topCard?.id}
                initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
              >
                <UnoCard card={state.topCard} size="lg" />
              </motion.div>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <RefreshCw
                className={cn("h-3 w-3 transition-transform", state.direction === -1 && "scale-x-[-1]")}
              />
              {state.pendingColorPick ? "choosing…" : state.activeColor}
            </span>
          </div>
        </div>

        {/* penalty / status badges */}
        <div className="flex min-h-[2.5rem] flex-wrap items-center justify-center gap-2">
          {state.drawStack > 0 && isMyTurn && (
            <Badge variant="destructive">
              {state.topCard.value === "wild4" ? "Stack a +4" : "Stack a +2"} or draw {state.drawStack}
            </Badge>
          )}
          {canPass && (
            <div className="flex items-center gap-2">
              <Button variant="glass" size="sm" onClick={handlePass}>
                Pass turn
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Play the highlighted card or pass
              </span>
            </div>
          )}
        </div>
      </section>

      {/* my area */}
      <section className="relative mx-auto w-full max-w-6xl px-4 pb-4">
        {/* uno button */}
        <div className="pointer-events-none absolute inset-x-0 -top-4 z-20 flex justify-center">
          {showUno && <UnoButton onClick={handleUno} label={unoLabel} />}
        </div>

        {/* my hand */}
        <div className="overflow-x-auto scrollbar-hide pb-2 pt-16">
          <div className="mx-auto flex w-max min-w-full items-end justify-center gap-1.5 sm:gap-2">
            <AnimatePresence mode="popLayout">
              {state.myHand.map((card, i) => {
                const playable = playableIds.has(card.id);
                const center = (state.myHand.length - 1) / 2;
                const rot = (i - center) * 3;
                return (
                  <motion.div
                    key={card.id}
                    layout
                    initial={{ opacity: 0, y: 60, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1, rotate: rot }}
                    exit={{ opacity: 0, y: 40, scale: 0.7 }}
                    transition={{ type: "spring", stiffness: 280, damping: 24 }}
                    whileHover={playable ? { y: -16, scale: 1.06, rotate: 0, zIndex: 30 } : {}}
                    whileTap={playable ? { scale: 0.96 } : {}}
                    onClick={() => playable && handlePlay(card.id)}
                    className={cn(
                      "shrink-0",
                      playable ? "cursor-pointer" : "cursor-default",
                    )}
                    style={{ rotate: rot }}
                  >
                    <UnoCard
                      card={card}
                      size="md"
                      highlight={playable}
                      dim={!playable && isMyTurn && !state.pendingColorPick}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* my info bar */}
        <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Gamepad2 className="h-3.5 w-3.5 text-fuchsia-400" />
            {me?.name}
            {me?.isHost && <Badge variant="warning" className="ml-1 text-[9px]">Host</Badge>}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Hand className="h-3.5 w-3.5" /> {me?.handSize} cards
          </span>
          {isMyTurn && <Badge variant="glow" className="text-[9px]">Your turn</Badge>}
        </div>
      </section>

      {/* color picker */}
      <ColorPicker open={pendingColor} onChoose={handleChooseColor} />

      {/* how to play */}
      <HowToPlay open={showHelp} onClose={() => setShowHelp(false)} />

      {/* leave confirmation */}
      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave the game?</DialogTitle>
            <DialogDescription>
              Your seat will be saved — you can rejoin with the room code. Bots will take over your turn while you are away.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmLeave(false)}>Stay</Button>
            <Button variant="destructive" onClick={() => { setConfirmLeave(false); handleLeave(); }}>
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* winner modal */}
      {gameEnd && (
        <WinnerModal
          winnerId={gameEnd.winnerId}
          rankings={gameEnd.rankings}
          myPlayerId={myId}
          isHost={isHost}
          onRestart={handleRestart}
          onLeave={handleLeave}
        />
      )}
      </div>

      {/* chat sidebar (desktop lg+) */}
      <aside className="hidden w-72 shrink-0 flex-col border-l border-border-subtle p-4 lg:flex">
        <div className="mb-2 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-fuchsia-400" />
          <span className="font-display text-sm font-semibold">Chat</span>
        </div>
        <ChatPanel
          messages={messages}
          sendMessage={sendMessage}
          myPlayerId={myId}
          maxH="flex-1"
          className="flex-1"
        />
      </aside>

      {/* chat drawer (mobile) */}
      <ChatDrawer
        open={chatOpen}
        onClose={() => { setLastSeenCount(messages.length); setChatOpen(false); }}
        messages={messages}
        sendMessage={sendMessage}
        myPlayerId={myId}
        unreadCount={unreadChat}
      />

      {/* audio call drawer (all sizes) */}
      <AudioCallDrawer
        open={callOpen}
        onClose={() => setCallOpen(false)}
        participants={audioCall.participants}
        myPlayerId={myId}
        muted={audioCall.muted}
        speaking={audioCall.speaking}
        error={audioCall.error}
        joining={callJoining}
        onToggleMute={handleCallMute}
        onLeave={handleCallLeave}
      />
    </main>
  );
}
