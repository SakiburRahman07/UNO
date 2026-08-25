"use client";

import { useEffect, useState } from "react";
import type { AppSocket } from "@/lib/socket";
import type { PublicRoom } from "@/types/uno";

export function useRoom(socket: AppSocket | null): PublicRoom | null {
  const [room, setRoom] = useState<PublicRoom | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = (r: PublicRoom) => setRoom(r);
    socket.on("room:update", onUpdate);
    return () => {
      socket.off("room:update", onUpdate);
    };
  }, [socket]);

  return room;
}
