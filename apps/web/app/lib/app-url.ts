// Canonical public URL for this app — used for metadataBase, canonical/OG
// tags, sitemap.xml, and robots.txt. Falls back to localhost for dev.
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
