import type { NextConfig } from "next";

type WebpackConfig = {
  output?: {
    chunkFilename?: string;
  };
};

const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  ...(process.env.NEXT_OUTPUT === "export" ? { output: "export" as const } : {}),
  transpilePackages: ["@fliptrybe/ui", "@fliptrybe/types", "@fliptrybe/design-system"],
  typedRoutes: true,
  webpack(config: WebpackConfig, { isServer }: { isServer: boolean }) {
    if (isServer && config.output) {
      config.output.chunkFilename = "chunks/[name].js";
    }

    return config;
  }
};

export default nextConfig;
