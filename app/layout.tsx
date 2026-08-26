import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "UNO Arena — Play UNO Online With Friends",
  description:
    "Fast, fun and competitive multiplayer UNO experience. Create a room, invite friends, and play in real time.",
  applicationName: "UNO Arena",
  keywords: ["UNO", "online", "multiplayer", "card game", "play with friends"],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a12" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('uno-theme');if(t==='light'){document.documentElement.classList.add('theme-light');}var m=window.matchMedia('(prefers-color-scheme: light)').matches;if(!t&&m){document.documentElement.classList.add('theme-light');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} ${display.variable} antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
