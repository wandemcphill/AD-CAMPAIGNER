import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fliptrybe/ui", "@fliptrybe/types", "@fliptrybe/design-system"],
  typedRoutes: true
};

export default nextConfig;
