"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ArrowLeft, Check } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { UnoCard } from "@/components/cards/UnoCard";
import { STORAGE_KEYS } from "@/lib/constants";
import type { Card } from "@/types/uno";

interface Step {
  title: string;
  body: string;
  visual?: React.ReactNode;
}

const SAMPLE_CARDS: Record<string, Card> = {
  red7: { id: "s1", color: "red", value: "7" },
  blueSkip: { id: "s2", color: "blue", value: "skip" },
  greenReverse: { id: "s3", color: "green", value: "reverse" },
  yellowDraw2: { id: "s4", color: "yellow", value: "draw2" },
  wild: { id: "s5", color: "wild", value: "wild" },
  wild4: { id: "s6", color: "wild", value: "wild4" },
};

const STEPS: Step[] = [
  {
    title: "Match by color or number",
    body: "Play a card that matches the top card's color OR number/symbol. Glowing cards in your hand are playable — dimmed ones aren't. If you can't play, click the draw pile.",
    visual: (
      <div className="flex items-center gap-3">
        <UnoCard card={SAMPLE_CARDS.red7} size="md" highlight />
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
        <UnoCard card={SAMPLE_CARDS.blueSkip} size="md" />
        <span className="text-xs text-muted-foreground">No match → draw</span>
      </div>
    ),
  },
  {
    title: "Action cards",
    body: "Skip skips the next player. Reverse changes turn direction (in 2-player games it acts as a Skip). Draw 2 forces the next player to draw 2 cards and lose their turn.",
    visual: (
      <div className="flex items-center gap-2">
        <UnoCard card={SAMPLE_CARDS.greenReverse} size="sm" />
        <UnoCard card={SAMPLE_CARDS.yellowDraw2} size="sm" />
      </div>
    ),
  },
  {
    title: "Wild cards & color choice",
    body: "Wild lets you choose any color. Wild Draw 4 forces the next player to draw 4 cards AND you pick the color. After playing a wild, a color picker appears — pick wisely!",
    visual: (
      <div className="flex items-center gap-2">
        <UnoCard card={SAMPLE_CARDS.wild} size="sm" />
        <UnoCard card={SAMPLE_CARDS.wild4} size="sm" />
      </div>
    ),
  },
  {
    title: "Call UNO!",
    body: "When you're about to play your second-to-last card, tap the pulsing UNO! button BEFORE playing your last card. Forget to call? You draw a 2-card penalty. Catch an opponent who forgot? Tap UNO to penalize them!",
    visual: (
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-700 font-display text-xs font-extrabold italic text-white shadow-lg ring-2 ring-white/40">
          UNO
        </div>
        <span className="text-xs text-muted-foreground">Tap before your last card!</span>
      </div>
    ),
  },
  {
    title: "Draw stacking",
    body: "When someone plays Draw 2 or Wild Draw 4, you can stack a matching Draw 2 / Wild Draw 4 on top to pass the penalty along. Can't stack? You must draw all the accumulated cards. The badge shows how many you'd draw.",
    visual: (
      <div className="flex items-center gap-2">
        <UnoCard card={SAMPLE_CARDS.yellowDraw2} size="sm" highlight />
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <UnoCard card={{ id: "s7", color: "yellow", value: "draw2" }} size="sm" highlight />
        <span className="text-xs text-muted-foreground">Stack it!</span>
      </div>
    ),
  },
];

export function HowToPlay({
  open,
  onClose,
  autoShow = false,
}: {
  open: boolean;
  onClose: () => void;
  autoShow?: boolean;
}) {
  const [step, setStep] = React.useState(0);
  const [prevOpen, setPrevOpen] = React.useState(open);
  const isLast = step === STEPS.length - 1;

  // Reset step when the modal opens (adjust state during render, not in effect).
  if (open && !prevOpen) {
    setStep(0);
  }
  if (open !== prevOpen) {
    setPrevOpen(open);
  }

  const handleGotIt = () => {
    if (autoShow && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.hasSeenOnboarding, "1");
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="glass-strong w-full max-w-md rounded-3xl p-6 sm:max-w-lg"
          >
            {/* close */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-surface-hover"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* progress dots */}
            <div className="mb-4 flex justify-center gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "w-6 bg-fuchsia-500" : "w-1.5 bg-white/20"
                  }`}
                />
              ))}
            </div>

            {/* step content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="font-display text-xl font-bold">{STEPS[step].title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {STEPS[step].body}
                </p>
                {STEPS[step].visual && (
                  <div className="mt-5 flex items-center justify-center rounded-2xl bg-surface-subtle p-5">
                    {STEPS[step].visual}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* nav buttons */}
            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <span className="text-xs text-muted-foreground">
                {step + 1} / {STEPS.length}
              </span>
              {isLast ? (
                <Button variant="neon" size="sm" onClick={handleGotIt}>
                  <Check className="h-4 w-4" />
                  Got it!
                </Button>
              ) : (
                <Button variant="neon" size="sm" onClick={() => setStep((s) => s + 1)}>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
