"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { createPortal } from "react-dom";

const BTN_SIZE = 64; // h-16 w-16
const LABEL_HEIGHT = 30; // caption below the button
const PAD_X = 16;
const PAD_TOP = 72; // clear top status bar
const PAD_BOTTOM = 96; // clear bottom hand / controls

function randomPosition() {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  const w = window.innerWidth;
  const h = window.innerHeight;
  const maxX = Math.max(PAD_X, w - BTN_SIZE - PAD_X);
  const maxY = Math.max(PAD_TOP, h - BTN_SIZE - LABEL_HEIGHT - PAD_BOTTOM);
  return {
    x: PAD_X + Math.random() * (maxX - PAD_X),
    y: PAD_TOP + Math.random() * (maxY - PAD_TOP),
  };
}

export function UnoButton({
  onClick,
  label = "UNO",
}: {
  onClick: () => void;
  label?: string;
}) {
  const isCatch = label !== "UNO";
  const [pos] = useState(randomPosition);

  return createPortal(
    <motion.div
      className="pointer-events-auto fixed z-50 flex flex-col items-center gap-1"
      style={{ left: pos.x, top: pos.y }}
      initial={{ scale: 0, rotate: -20, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
    >
      <button
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
      </button>
      <span className="rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-medium text-white">
        {isCatch ? "Tap to penalize" : "Before your last card"}
      </span>
    </motion.div>,
    document.body,
  );
}
