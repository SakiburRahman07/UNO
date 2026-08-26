"use client";

import { motion } from "framer-motion";

export function UnoButton({
  onClick,
  label = "UNO",
}: {
  onClick: () => void;
  label?: string;
}) {
  const isCatch = label !== "UNO";
  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1">
      <motion.button
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={onClick}
        className={`flex h-16 w-16 items-center justify-center rounded-full font-display text-sm font-extrabold italic text-white shadow-xl ring-2 ring-white/40 ${
          isCatch
            ? "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/40"
            : "bg-gradient-to-br from-red-500 to-rose-700 shadow-red-500/40"
        }`}
        style={{ animation: "pulse-glow 1.4s ease-in-out infinite" }}
        aria-label={label}
      >
        {label}
      </motion.button>
      <span className="rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-medium text-white">
        {isCatch ? "Tap to penalize" : "Before your last card"}
      </span>
    </div>
  );
}
