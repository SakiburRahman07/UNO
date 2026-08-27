"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Send, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { avatarGradient, cn, initials } from "@/lib/utils";
import { QUICK_MESSAGES, MAX_CHAT_LENGTH } from "@/types/chat";
import type { ChatMessage } from "@/types/chat";

function relativeTime(at: number): string {
  const diff = Date.now() - at;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  return `${Math.floor(diff / 3_600_000)}h`;
}

export function ChatPanel({
  messages,
  sendMessage,
  myPlayerId,
  className,
}: {
  messages: ChatMessage[];
  sendMessage: (text: string) => void;
  myPlayerId: string;
  className?: string;
}) {
  const [text, setText] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(text);
    setText("");
  };

  return (
    <div className={cn("flex min-h-0 flex-col gap-2.5", className)}>
      {/* messages */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto scrollbar-hide rounded-2xl bg-surface-subtle p-3"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="glass flex h-12 w-12 items-center justify-center rounded-full">
              <MessageSquare className="h-5 w-5 text-fuchsia-400" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-medium">No messages yet</p>
              <p className="text-[11px] text-muted-foreground">Say hi to your friends!</p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            if (m.system) {
              return (
                <div key={m.id} className="flex justify-center">
                  <span className="rounded-full bg-white/5 px-3 py-1 text-center text-[11px] italic text-muted-foreground">
                    {m.text}
                  </span>
                </div>
              );
            }
            const isMe = m.playerId === myPlayerId;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className={cn("flex items-start gap-2", isMe && "flex-row-reverse")}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white ring-2 ring-white/10",
                    avatarGradient(m.playerId + m.name),
                  )}
                >
                  {initials(m.name)}
                </div>
                <div className={cn("flex flex-col gap-0.5", isMe && "items-end")}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-foreground">
                      {isMe ? "You" : m.name}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {relativeTime(m.at)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "max-w-[15rem] rounded-2xl px-3 py-1.5 text-sm leading-snug",
                      isMe
                        ? "rounded-tr-sm border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-600/25 to-cyan-500/15 text-foreground shadow-lg shadow-fuchsia-500/10"
                        : "glass rounded-tl-sm text-foreground",
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* quick presets */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {QUICK_MESSAGES.map((preset) => (
          <button
            key={preset}
            onClick={() => sendMessage(preset)}
            className="shrink-0 rounded-full border border-border-subtle bg-surface-subtle px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-all hover:scale-105 hover:border-fuchsia-500/50 hover:text-fuchsia-300 active:scale-95"
          >
            {preset}
          </button>
        ))}
      </div>

      {/* unified composer */}
      <div className="glass flex items-center gap-1 rounded-2xl p-1">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHAT_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message…"
          className="h-9 flex-1 border-none bg-transparent px-2.5 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          aria-label="Send message"
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-40",
            "bg-gradient-to-br from-fuchsia-500 to-cyan-500 shadow-lg shadow-fuchsia-500/30 hover:brightness-110",
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
