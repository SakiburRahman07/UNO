"use client";

import { motion } from "framer-motion";

export function UnoButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-700 font-display text-sm font-extrabold italic text-white shadow-xl shadow-red-500/40 ring-2 ring-white/40"
      style={{ animation: "pulse-glow 1.4s ease-in-out infinite" }}
      aria-label="Call UNO"
    >
      UNO
    </motion.button>
  );
}
