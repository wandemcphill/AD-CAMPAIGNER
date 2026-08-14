import type { Metadata } from "next";

import { DEFAULT_THEME, themeInitScript } from "@fliptrybe/ui";

import "./globals.css";

export const metadata: Metadata = {
  title: "FlipTrybe Ads Campaigner",
  description: "FlipTrybe's AI growth operating system for creators, commerce, and growth teams.",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon.ico" }
    ],
    apple: [{ url: "/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" }]
  },
  openGraph: {
    title: "FlipTrybe Ads Campaigner",
    description: "FlipTrybe's AI growth operating system for creators, commerce, and growth teams.",
    images: [{ url: "/og-image-1200x630.png", width: 1200, height: 630 }]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-theme={DEFAULT_THEME} lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {/* Themed page ground. This used to hardcode the retired marketing palette
            (#050507/#0B0F19), which fought the light theme wherever a route didn't
            paint an opaque surface of its own. */}
        <div className="min-h-screen bg-[var(--ft-bg-base)]">
          {children}
        </div>
      </body>
    </html>
  );
}
