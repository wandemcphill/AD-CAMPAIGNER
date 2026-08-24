import type { Metadata } from "next";

import { DEFAULT_THEME, themeInitScript } from "@fliptrybe/ui";
import "./globals.css";
import "./customer-experience.css";
import { APP_URL } from "./lib/app-url";
import { CustomerExperienceLayer } from "./components/customer-experience-layer";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "FlipTrybe Technology | One intelligent operating layer",
  description: "FlipTrybe Technology connects money movement, digital services, commerce and growth infrastructure in one intelligent operating system.",
  alternates: { canonical: "/" },
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
    title: "FlipTrybe Technology | One intelligent operating layer",
    description: "Money movement, digital services, commerce and growth infrastructure in one intelligent operating system.",
    url: "/",
    images: [{ url: "/og-image-1200x630.png", width: 1200, height: 630 }]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-theme={DEFAULT_THEME} lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body>
        <div className="ft-page-frame min-h-screen bg-[var(--ft-bg-base)]">
          {children}
          <CustomerExperienceLayer />
        </div>
      </body>
    </html>
  );
}
