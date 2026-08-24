import type { Metadata } from "next";
import { DEFAULT_THEME, themeInitScript } from "@fliptrybe/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlipTrybe Technology | Control Center",
  description: "The operational control center for FlipTrybe Technology.",
  icons: { icon: [{ url: "/favicon-16.png", sizes: "16x16", type: "image/png" }, { url: "/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/favicon-48.png", sizes: "48x48", type: "image/png" }, { url: "/favicon.ico" }], apple: [{ url: "/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" }] },
  openGraph: { title: "FlipTrybe Technology | Control Center", description: "Operations, finance, risk, governance, fulfilment and system intelligence in one control center.", images: [{ url: "/og-image-1200x630.png", width: 1200, height: 630 }] }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html data-theme={DEFAULT_THEME} lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head><body>{children}</body></html>;
}
