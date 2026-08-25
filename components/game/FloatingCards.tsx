"use client";

import { motion } from "framer-motion";
import { UnoCard } from "@/components/cards/UnoCard";
import type { Card } from "@/types/uno";

const SAMPLE: { card: Card; left: string; top: string; rot: number; size: "sm" | "md" | "lg"; delay: number; dur: number }[] = [
  { card: { id: "f1", color: "red", value: "7" }, left: "6%", top: "16%", rot: -14, size: "lg", delay: 0, dur: 7 },
  { card: { id: "f2", color: "blue", value: "skip" }, left: "82%", top: "12%", rot: 12, size: "md", delay: 1.2, dur: 8 },
  { card: { id: "f3", color: "green", value: "reverse" }, left: "14%", top: "68%", rot: 8, size: "md", delay: 0.6, dur: 9 },
  { card: { id: "f4", color: "yellow", value: "5" }, left: "88%", top: "62%", rot: -10, size: "lg", delay: 1.8, dur: 7.5 },
  { card: { id: "f5", color: "wild", value: "wild" }, left: "46%", top: "8%", rot: 4, size: "sm", delay: 0.3, dur: 10 },
  { card: { id: "f6", color: "red", value: "draw2" }, left: "72%", top: "78%", rot: -6, size: "sm", delay: 2.1, dur: 8.5 },
  { card: { id: "f7", color: "blue", value: "3" }, left: "30%", top: "82%", rot: 16, size: "md", delay: 1.5, dur: 9.5 },
  { card: { id: "f8", color: "wild", value: "wild4" }, left: "58%", top: "44%", rot: -18, size: "md", delay: 0.9, dur: 11 },
];

export function FloatingCards() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {SAMPLE.map(({ card, left, top, rot, size, delay, dur }) => (
        <motion.div
          key={card.id}
          className="absolute opacity-60 blur-[1px]"
          style={{ left, top, rotate: rot }}
          initial={{ y: 20, opacity: 0, scale: 0.9 }}
          animate={{
            y: [0, -28, 0],
            opacity: [0, 0.6, 0.6],
            scale: 1,
            rotate: [rot, rot + 5, rot],
          }}
          transition={{
            duration: dur,
            repeat: Infinity,
            ease: "easeInOut",
            delay,
          }}
        >
          <UnoCard card={card} size={size} />
        </motion.div>
      ))}
    </div>
  );
}
