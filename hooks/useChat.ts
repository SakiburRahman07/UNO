"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppSocket } from "@/lib/socket";
import type { ChatMessage } from "@/types/chat";
import { MAX_CHAT_MESSAGES } from "@/types/chat";

export function useChat(socket: AppSocket | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (m: ChatMessage) => {
      setMessages((prev) => {
        const next = [...prev, m];
        if (next.length > MAX_CHAT_MESSAGES) next.shift();
        return next;
      });
    };
    socket.on("chat:message", onMessage);
    return () => {
      socket.off("chat:message", onMessage);
    };
  }, [socket]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!socket) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      socket.emit("chat:send", { text: trimmed });
    },
    [socket],
  );

  return { messages, sendMessage };
}
