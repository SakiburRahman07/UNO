"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare } from "lucide-react";
import { ChatPanel } from "@/components/game/ChatPanel";
import { Button } from "@/components/ui/button";
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
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[60vh] flex-col gap-2 rounded-t-3xl glass-strong border-t border-border-subtle p-4 pb-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-fuchsia-400" />
                <span className="font-display text-sm font-semibold">Chat</span>
              </div>
              <Button variant="glass" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ChatPanel
              messages={messages}
              sendMessage={sendMessage}
              myPlayerId={myPlayerId}
              maxH="flex-1"
              className="flex-1"
            />
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
  return (
    <div className="relative">
      <Button variant="glass" size="icon" onClick={onClick} aria-label="Open chat">
        <MessageSquare className="h-4 w-4" />
      </Button>
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[9px] font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </div>
  );
}
