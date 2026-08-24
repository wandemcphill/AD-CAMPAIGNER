import type { NextConfig } from "next";

type WebpackConfig = {
  output?: {
    chunkFilename?: string;
  };
};

const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  output: "export",
  trailingSlash: true,
  transpilePackages: ["@fliptrybe/ui", "@fliptrybe/design-system"],
  // The admin shell already uses the generated Route type where practical,
  // but the app is exported with trailingSlash. Keep Next's route checker
  // off here until the generated route literals and export-path convention
  // can be made identical across every Admin navigation surface.
  typedRoutes: false,
  webpack(config: WebpackConfig, { isServer }: { isServer: boolean }) {
    if (isServer && config.output) {
      config.output.chunkFilename = "chunks/[name].js";
    }

    return config;
  }
};

export default nextConfig;
