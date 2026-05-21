import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "FlipTrybe Ads Campaigner",
  description: "Global campaign operating system for creators, commerce, and growth teams."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
