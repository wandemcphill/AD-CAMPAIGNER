import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fliptrybe/ui", "@fliptrybe/design-system"],
  typedRoutes: true
};

export default nextConfig;
