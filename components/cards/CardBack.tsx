"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SIZES: Record<"sm" | "md" | "lg", string> = {
  sm: "w-11 sm:w-12",
  md: "w-16 sm:w-[4.5rem]",
  lg: "w-24 sm:w-28",
};

export interface CardBackProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
  count?: number;
}

export const CardBack = React.forwardRef<HTMLDivElement, CardBackProps>(
  ({ size = "md", className, style, count }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative select-none aspect-[5/7] rounded-[14%] shadow-lg overflow-hidden",
          SIZES[size],
          className,
        )}
        style={{
          background: "linear-gradient(135deg, #1a1a2e 0%, #0a0a14 100%)",
          boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
          containerType: "inline-size",
          ...style,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[14%]"
          style={{
            background:
              "linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 45%)",
          }}
        />
        <div
          className="absolute rounded-[11%]"
          style={{ inset: "6%", border: "2cqw solid rgba(255,255,255,0.12)" }}
        />
        {/* red UNO oval */}
        <div
          className="absolute left-1/2 top-1/2 flex items-center justify-center rounded-full"
          style={{
            width: "66%",
            height: "84%",
            transform: "translate(-50%,-50%) rotate(-22deg)",
            background: "linear-gradient(135deg, #ff4b4b 0%, #c81e1e 100%)",
            boxShadow: "inset 0 2cqw 6cqw rgba(0,0,0,0.3)",
          }}
        >
          <span
            style={{
              transform: "rotate(22deg)",
              fontFamily: "var(--font-display), sans-serif",
              fontSize: "22cqw",
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "0.04em",
              fontStyle: "italic",
              textShadow: "0 2cqw 3cqw rgba(0,0,0,0.4)",
            }}
          >
            UNO
          </span>
        </div>
        {typeof count === "number" && (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ display: "none" }}
          />
        )}
      </div>
    );
  },
);
CardBack.displayName = "CardBack";
