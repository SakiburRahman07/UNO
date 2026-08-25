"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles,
  Users,
  Bot,
  Zap,
  Gamepad2,
  ArrowRight,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Loader2,
  Swords,
  Shield,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSocket } from "@/hooks/useSocket";
import { useSound } from "@/hooks/useSound";
import { useTheme } from "@/components/theme-provider";
import { FloatingCards } from "@/components/game/FloatingCards";
import { ParticleField } from "@/components/game/ParticleField";
import { NAV_ROUTES, STORAGE_KEYS } from "@/lib/constants";
import { toast } from "@/components/ui/toaster";

function ensureConnected(socket: import("@/lib/socket").AppSocket): Promise<void> {
  return new Promise((resolve) => {
    if (socket.connected) return resolve();
    const onConn = () => {
      socket.off("connect", onConn);
      resolve();
    };
    socket.on("connect", onConn);
    setTimeout(resolve, 4000);
  });
}

export default function HomePage() {
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const { play, muted, toggleMute } = useSound();
  const { theme, toggleTheme } = useTheme();

  const [name, setName] = React.useState(
    () =>
      typeof window !== "undefined"
        ? (localStorage.getItem(STORAGE_KEYS.playerName) ?? "")
        : "",
  );
  const [joinCode, setJoinCode] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [joinOpen, setJoinOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const saveName = (n: string) => {
    localStorage.setItem(STORAGE_KEYS.playerName, n);
    setName(n);
  };

  const handleCreate = async () => {
    const n = name.trim();
    if (!n) {
      toast.error("Please enter your name");
      return;
    }
    if (!socket) return;
    setBusy(true);
    play("click");
    await ensureConnected(socket);
    try {
      const res = await socket.emitWithAck("room:create", { name: n });
      if (res.ok) {
        saveName(n);
        play("join");
        router.push(NAV_ROUTES.lobby(res.data.code));
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Could not create room");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    const n = name.trim();
    const code = joinCode.trim().toUpperCase();
    if (!n) {
      toast.error("Please enter your name");
      return;
    }
    if (!code) {
      toast.error("Please enter a room code");
      return;
    }
    if (!socket) return;
    setBusy(true);
    play("click");
    await ensureConnected(socket);
    try {
      const res = await socket.emitWithAck("room:join", { code, name: n });
      if (res.ok) {
        saveName(n);
        play("join");
        router.push(NAV_ROUTES.lobby(res.data.code));
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Could not join room");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* animated gradient backdrop */}
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,#2a1247_0%,#0a0a12_55%)]" />
      <div className="absolute inset-0 -z-10">
        <ParticleField />
        <FloatingCards />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.18),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(6,182,212,0.16),transparent_45%)]" />

      {/* header */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-400 text-white shadow-lg shadow-fuchsia-500/30">
            <Gamepad2 className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            UNO <span className="text-gradient">Arena</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-muted-foreground sm:flex">
            <span
              className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400 shadow-emerald-400/50 shadow" : "bg-amber-400"}`}
            />
            {isConnected ? "Connected" : "Connecting…"}
          </div>
          <Button variant="glass" size="icon" onClick={() => { toggleMute(); play("click"); }} aria-label="Toggle sound">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Button variant="glass" size="icon" onClick={() => { toggleTheme(); play("click"); }} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-5 pb-20 pt-10 text-center sm:pt-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
          Real-time multiplayer · No sign-up · Free
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl"
        >
          Play <span className="text-gradient neon-text">UNO</span> Online
          <br className="hidden sm:block" /> With Friends
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg"
        >
          Fast, fun and competitive multiplayer UNO experience. Create a room,
          share the code, and play together in real time.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
        >
          <Button
            variant="neon"
            size="xl"
            className="w-full sm:w-auto group"
            onClick={() => { play("click"); setCreateOpen(true); }}
          >
            Create Room
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
          <Button
            variant="glass"
            size="xl"
            className="w-full sm:w-auto"
            onClick={() => { play("click"); setJoinOpen(true); }}
          >
            Join Room
          </Button>
        </motion.div>

        {/* stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 grid w-full max-w-2xl grid-cols-3 gap-3 sm:gap-6"
        >
          {[
            { icon: Users, label: "Up to 10 players" },
            { icon: Bot, label: "Solo with bots" },
            { icon: Zap, label: "Live sync" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="glass flex flex-col items-center gap-1.5 rounded-2xl px-3 py-4">
              <Icon className="h-5 w-5 text-fuchsia-400" />
              <span className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</span>
            </div>
          ))}
        </motion.div>
      </section>

      {/* features */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Swords, title: "Full UNO rules", desc: "Skip, reverse, draw two, wild and wild draw four — all validated server-side." },
            { icon: Shield, title: "Fair play", desc: "The server is the single source of truth. No client-side cheating." },
            { icon: Globe, title: "Instant rooms", desc: "Generate a code, share it, and you're playing in seconds." },
            { icon: Bot, title: "Bots fill seats", desc: "Add AI opponents so any game can start right away." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="glass rounded-2xl p-5"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-cyan-400/30 text-fuchsia-300">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 px-5 py-6 text-center text-xs text-muted-foreground">
        Built with Next.js · Socket.IO · In-memory rooms reset on server restart
      </footer>

      {/* Create room dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (o) play("click"); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a room</DialogTitle>
            <DialogDescription>Enter your name to host a new UNO room.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Input
              autoFocus
              placeholder="Your name"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="neon" onClick={handleCreate} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join room dialog */}
      <Dialog open={joinOpen} onOpenChange={(o) => { setJoinOpen(o); if (o) play("click"); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join a room</DialogTitle>
            <DialogDescription>Enter the room code and your name.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              autoFocus
              placeholder="Room code"
              className="uppercase tracking-[0.3em] font-mono"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
            />
            <Input
              placeholder="Your name"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setJoinOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="neon" onClick={handleJoin} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Join
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
