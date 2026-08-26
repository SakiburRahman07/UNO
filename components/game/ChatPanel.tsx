"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  maxH,
}: {
  messages: ChatMessage[];
  sendMessage: (text: string) => void;
  myPlayerId: string;
  className?: string;
  maxH?: string;
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
    <div className={cn("flex flex-col gap-2", className)}>
      {/* messages */}
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 space-y-2 overflow-y-auto scrollbar-hide rounded-2xl bg-surface-subtle p-3",
          maxH ?? "max-h-64",
        )}
      >
        {messages.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Say hi to your friends!
          </p>
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
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={cn("flex items-start gap-2", isMe && "flex-row-reverse")}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white",
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
                      "max-w-[14rem] rounded-2xl px-3 py-1.5 text-sm",
                      isMe
                        ? "rounded-tr-sm bg-primary/20 text-primary-foreground"
                        : "rounded-tl-sm bg-white/8 text-foreground",
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
            className="shrink-0 rounded-full border border-border-subtle bg-surface-subtle px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-fuchsia-500/50 hover:text-fuchsia-300"
          >
            {preset}
          </button>
        ))}
      </div>

      {/* input */}
      <div className="flex items-center gap-2">
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
          className="h-9 flex-1 text-sm"
        />
        <Button
          size="icon"
          variant="neon"
          className="h-9 w-9 shrink-0"
          onClick={handleSend}
          disabled={!text.trim()}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
