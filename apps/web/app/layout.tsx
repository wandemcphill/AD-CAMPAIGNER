import type { Metadata } from "next";

import { DEFAULT_THEME, themeInitScript } from "@fliptrybe/ui";

import "./globals.css";

export const metadata: Metadata = {
  title: "FlipTrybe Ads Campaigner",
  description: "FlipTrybe's AI growth operating system for creators, commerce, and growth teams."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-theme={DEFAULT_THEME} lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,102,255,0.08),_transparent_30%),radial-gradient(circle_at_80%_10%,_rgba(139,92,246,0.08),_transparent_24%),linear-gradient(180deg,_#050507_0%,_#0B0F19_38%,_#050507_100%)]">
          {children}
        </div>
      </body>
    </html>
  );
}
