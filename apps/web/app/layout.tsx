import type { Metadata } from "next";

import { DEFAULT_THEME, themeInitScript } from "@fliptrybe/ui";

import "./globals.css";

export const metadata: Metadata = {
  title: "FlipTrybe Ads Campaigner",
  description: "Global campaign operating system for creators, commerce, and growth teams."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-theme={DEFAULT_THEME} lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
