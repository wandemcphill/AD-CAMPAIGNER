import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "FlipTrybe Admin",
  description: "Governance, moderation, payments, audit, and system monitoring for FlipTrybe."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
