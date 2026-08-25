"use client";

import { useEffect, useState } from "react";
import { getSocket, type AppSocket } from "@/lib/socket";

export function useSocket() {
  const [socket] = useState<AppSocket | null>(
    () => (typeof window !== "undefined" ? getSocket() : null),
  );
  const [isConnected, setIsConnected] = useState(() => socket?.connected ?? false);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  return { socket, isConnected };
}
