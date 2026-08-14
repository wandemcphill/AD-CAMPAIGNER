import type { MetadataRoute } from "next";

import { APP_URL } from "./lib/app-url";

const PUBLIC_ROUTES = ["/", "/pricing", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${APP_URL}${route}`,
    lastModified: new Date()
  }));
}
