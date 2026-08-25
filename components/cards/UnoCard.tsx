"use client";

import * as React from "react";
import { Ban, Repeat2 } from "lucide-react";
import type { Card, CardColor, CardValue } from "@/types/uno";
import { cn } from "@/lib/utils";

const COLOR_BG: Record<CardColor, string> = {
  red: "linear-gradient(135deg, #ff6b6b 0%, #d32f2f 60%, #9a1414 100%)",
  blue: "linear-gradient(135deg, #5eb8ff 0%, #2563eb 60%, #143a8f 100%)",
  green: "linear-gradient(135deg, #5ee08a 0%, #16a34a 60%, #0a5c2a 100%)",
  yellow: "linear-gradient(135deg, #ffe25e 0%, #f59e0b 60%, #b45309 100%)",
  wild: "linear-gradient(135deg, #2a2a3a 0%, #131320 60%, #050509 100%)",
};

const COLOR_INK: Record<CardColor, string> = {
  red: "#9a1414",
  blue: "#143a8f",
  green: "#0a5c2a",
  yellow: "#a85a07",
  wild: "#0a0a12",
};

const SIZES: Record<"sm" | "md" | "lg", string> = {
  sm: "w-11 sm:w-12",
  md: "w-16 sm:w-[4.5rem]",
  lg: "w-24 sm:w-28",
};

const WILD_OVAL =
  "conic-gradient(from -45deg, #ef4444 0deg 90deg, #facc15 90deg 180deg, #22c55e 180deg 270deg, #3b82f6 270deg 360deg)";

function FaceGlyph({
  value,
  ink,
  isWild,
}: {
  value: CardValue;
  ink: string;
  isWild: boolean;
}) {
  if (value === "skip") return <Ban className="drop-shadow-sm" style={{ width: "26cqw", height: "26cqw", color: ink }} strokeWidth={3} />;
  if (value === "reverse")
    return (
      <Repeat2
        className="drop-shadow-sm"
        style={{ width: "28cqw", height: "28cqw", color: ink, transform: "rotate(0deg)" }}
        strokeWidth={3}
      />
    );
  if (value === "draw2")
    return (
      <span style={{ fontSize: "30cqw", fontWeight: 800, color: ink, lineHeight: 1 }}>
        +2
      </span>
    );
  if (value === "wild") return null;
  if (value === "wild4")
    return (
      <span
        style={{
          fontSize: "26cqw",
          fontWeight: 800,
          color: "#fff",
          lineHeight: 1,
          textShadow: "0 2cqw 4cqw rgba(0,0,0,0.6)",
        }}
      >
        +4
      </span>
    );
  return (
    <span style={{ fontSize: "34cqw", fontWeight: 800, color: ink, lineHeight: 1 }}>
      {value}
    </span>
  );
}

function CornerGlyph({
  value,
  isWild,
}: {
  value: CardValue;
  isWild: boolean;
}) {
  const style: React.CSSProperties = { fontSize: "13cqw", fontWeight: 800, color: "#fff", lineHeight: 1 };
  if (value === "skip")
    return <Ban style={{ width: "12cqw", height: "12cqw", color: "#fff" }} strokeWidth={3} />;
  if (value === "reverse")
    return <Repeat2 style={{ width: "13cqw", height: "13cqw", color: "#fff" }} strokeWidth={3} />;
  if (value === "draw2") return <span style={style}>+2</span>;
  if (value === "wild") return <span style={{ ...style, fontSize: "10cqw" }}>W</span>;
  if (value === "wild4") return <span style={style}>+4</span>;
  return <span style={style}>{value}</span>;
}

export interface UnoCardProps {
  card: Card;
  size?: "sm" | "md" | "lg";
  className?: string;
  highlight?: boolean;
  dim?: boolean;
  style?: React.CSSProperties;
}

export const UnoCard = React.forwardRef<HTMLDivElement, UnoCardProps>(
  ({ card, size = "md", className, highlight, dim, style }, ref) => {
    const isWild = card.color === "wild";
    const ink = COLOR_INK[card.color];

    return (
      <div
        ref={ref}
        className={cn(
          "relative select-none aspect-[5/7] rounded-[14%] shadow-lg",
          SIZES[size],
          highlight && "ring-2 ring-white/90",
          dim && "opacity-40 saturate-50",
          className,
        )}
        style={{
          background: COLOR_BG[card.color],
          boxShadow: highlight
            ? "0 0 0 3px rgba(255,255,255,0.9), 0 10px 25px rgba(0,0,0,0.5)"
            : "0 8px 20px rgba(0,0,0,0.45)",
          containerType: "inline-size",
          ...style,
        }}
      >
        {/* glossy highlight */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[14%]"
          style={{
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 42%)",
          }}
        />
        {/* inner frame */}
        <div
          className="pointer-events-none absolute rounded-[11%]"
          style={{ inset: "6%", border: "2cqw solid rgba(255,255,255,0.18)", borderRadius: "11%" }}
        />

        {/* center oval */}
        <div
          className="absolute left-1/2 top-1/2 flex items-center justify-center overflow-hidden rounded-full"
          style={{
            width: "62%",
            height: "80%",
            transform: "translate(-50%,-50%) rotate(-22deg)",
            background: isWild ? WILD_OVAL : "#ffffff",
            boxShadow: "inset 0 2cqw 6cqw rgba(0,0,0,0.18)",
          }}
        >
          <div style={{ transform: "rotate(22deg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FaceGlyph value={card.value} ink={ink} isWild={isWild} />
          </div>
        </div>

        {/* corner pips */}
        <div className="absolute" style={{ top: "7%", left: "8%" }}>
          <CornerGlyph value={card.value} isWild={isWild} />
        </div>
        <div
          className="absolute"
          style={{ bottom: "7%", right: "8%", transform: "rotate(180deg)" }}
        >
          <CornerGlyph value={card.value} isWild={isWild} />
        </div>
      </div>
    );
  },
);
UnoCard.displayName = "UnoCard";
