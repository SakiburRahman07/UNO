"use client";

import { Toaster as SonnerToaster, toast } from "sonner";
import { useTheme } from "@/components/theme-provider";

export function Toaster() {
  const { theme } = useTheme();
  return (
    <SonnerToaster
      position="top-center"
      theme={theme}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "glass-strong !border !border-border-subtle",
        },
      }}
    />
  );
}

export { toast };
