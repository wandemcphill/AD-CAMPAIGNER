import type { MetadataRoute } from "next";

import { APP_URL } from "./lib/app-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/os/", "/settings/", "/wallet/", "/reports/", "/admin/"]
    },
    sitemap: `${APP_URL}/sitemap.xml`
  };
}
