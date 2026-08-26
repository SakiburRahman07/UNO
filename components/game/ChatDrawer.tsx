"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare } from "lucide-react";
import { ChatPanel } from "@/components/game/ChatPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/chat";

export function ChatDrawer({
  open,
  onClose,
  messages,
  sendMessage,
  myPlayerId,
  unreadCount,
}: {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  sendMessage: (text: string) => void;
  myPlayerId: string;
  unreadCount: number;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[70vh] flex-col gap-2 overflow-hidden rounded-t-[2rem] glass-strong border-t border-border-subtle pb-6"
          >
            {/* top accent gradient bar */}
            <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-fuchsia-500" />
            {/* drag handle */}
            <div className="flex justify-center pt-1">
              <span className="h-1.5 w-10 rounded-full bg-white/20" />
            </div>

            <div className="flex items-center justify-between px-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-fuchsia-400" />
                  <span className="font-display text-sm font-semibold">Chat</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {messages.length > 0
                    ? `${messages.length} message${messages.length === 1 ? "" : "s"}`
                    : "No messages yet"}
                </span>
              </div>
              <Button variant="glass" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide px-4">
              <ChatPanel
                messages={messages}
                sendMessage={sendMessage}
                myPlayerId={myPlayerId}
                maxH="flex-1"
                className="flex-1"
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function ChatToggleButton({
  onClick,
  unreadCount,
}: {
  onClick: () => void;
  unreadCount: number;
}) {
  const hasUnread = unreadCount > 0;
  return (
    <div className="relative">
      <Button
        variant={hasUnread ? "neon" : "glass"}
        size="icon"
        onClick={onClick}
        aria-label="Open chat"
        className={cn(hasUnread && "animate-pulse")}
      >
        <MessageSquare className="h-4 w-4" />
      </Button>
      {hasUnread && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[9px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </div>
  );
}
