"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SoundName =
  | "click"
  | "play"
  | "draw"
  | "turn"
  | "win"
  | "error"
  | "uno"
  | "join"
  | "leave";

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    sharedCtx = new Ctor();
  }
  if (sharedCtx.state === "suspended") void sharedCtx.resume();
  return sharedCtx;
}

interface Tone {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  sweepTo?: number;
}

const PRESETS: Record<SoundName, Tone[]> = {
  click: [{ freq: 520, duration: 0.06, type: "triangle", gain: 0.18 }],
  play: [
    { freq: 440, duration: 0.09, type: "sawtooth", gain: 0.16, sweepTo: 660 },
  ],
  draw: [
    { freq: 300, duration: 0.12, type: "sine", gain: 0.16, sweepTo: 200 },
  ],
  turn: [
    { freq: 660, duration: 0.12, type: "sine", gain: 0.14 },
    { freq: 880, duration: 0.1, type: "sine", gain: 0.12, delay: 0.08 },
  ],
  win: [
    { freq: 523, duration: 0.14, type: "triangle", gain: 0.2 },
    { freq: 659, duration: 0.14, type: "triangle", gain: 0.2, delay: 0.12 },
    { freq: 784, duration: 0.18, type: "triangle", gain: 0.22, delay: 0.24 },
    { freq: 1046, duration: 0.3, type: "triangle", gain: 0.24, delay: 0.4 },
  ],
  error: [{ freq: 180, duration: 0.2, type: "square", gain: 0.16, sweepTo: 120 }],
  uno: [
    { freq: 700, duration: 0.1, type: "square", gain: 0.2 },
    { freq: 1000, duration: 0.16, type: "square", gain: 0.2, delay: 0.1 },
  ],
  join: [
    { freq: 440, duration: 0.1, type: "sine", gain: 0.16 },
    { freq: 660, duration: 0.12, type: "sine", gain: 0.16, delay: 0.08 },
  ],
  leave: [{ freq: 400, duration: 0.14, type: "sine", gain: 0.14, sweepTo: 240 }],
};

function playTone(ctx: AudioContext, tone: Tone) {
  const start = ctx.currentTime + (tone.delay ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = tone.type ?? "sine";
  osc.frequency.setValueAtTime(tone.freq, start);
  if (tone.sweepTo) {
    osc.frequency.exponentialRampToValueAtTime(tone.sweepTo, start + tone.duration);
  }
  const peak = tone.gain ?? 0.2;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + tone.duration + 0.02);
}

export function useSound() {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current =
      typeof window !== "undefined" && window.localStorage.getItem("uno-muted") === "1";
    setMuted(mutedRef.current);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("uno-muted", next ? "1" : "0");
      }
      return next;
    });
  }, []);

  const play = useCallback((name: SoundName) => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const tones = PRESETS[name];
    if (!tones) return;
    for (const tone of tones) playTone(ctx, tone);
  }, []);

  return { play, muted, toggleMute };
}
