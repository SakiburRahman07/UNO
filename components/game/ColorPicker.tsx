"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { CardColor } from "@/types/uno";

const COLORS: { color: CardColor; bg: string; label: string }[] = [
  { color: "red", bg: "linear-gradient(135deg,#ff6b6b,#c81e1e)", label: "Red" },
  { color: "blue", bg: "linear-gradient(135deg,#5eb8ff,#2563eb)", label: "Blue" },
  { color: "green", bg: "linear-gradient(135deg,#5ee08a,#16a34a)", label: "Green" },
  { color: "yellow", bg: "linear-gradient(135deg,#ffe25e,#f59e0b)", label: "Yellow" },
];

export function ColorPicker({
  open,
  onChoose,
}: {
  open: boolean;
  onChoose: (color: CardColor) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="glass-strong rounded-3xl p-6 text-center"
          >
            <h3 className="font-display text-lg font-semibold">Choose a color</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick the next active color
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {COLORS.map(({ color, bg, label }) => (
                <motion.button
                  key={color}
                  whileHover={{ scale: 1.06, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onChoose(color)}
                  className="flex h-20 w-28 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-lg transition-shadow hover:shadow-xl"
                  style={{ background: bg }}
                >
                  {label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
