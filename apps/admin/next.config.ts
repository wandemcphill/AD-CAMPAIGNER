import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  transpilePackages: ["@fliptrybe/ui", "@fliptrybe/design-system"],
  typedRoutes: true
};

export default nextConfig;
