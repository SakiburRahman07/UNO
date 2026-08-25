"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      theme="dark"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "glass-strong !border !border-white/10",
        },
      }}
    />
  );
}

export { toast };
