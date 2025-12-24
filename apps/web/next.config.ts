import type { NextConfig } from "next";
import { withTamagui } from "@tamagui/next-plugin";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@handcraft/ui",
    "@handcraft/sdk",
    "@handcraft/types",
    "tamagui",
    "@tamagui/core",
    "@tamagui/config",
    "@tamagui/animations-css",
  ],
  // Fix hot reload for pnpm workspace packages
  webpack: (config, { dev }) => {
    if (dev) {
      // Use polling to detect changes in symlinked workspace packages
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["@solana/wallet-adapter-react-ui", "tamagui"],
  },
};

const tamaguiPlugin = withTamagui({
  config: "../../packages/ui/src/tamagui.config.ts",
  components: ["tamagui"],
  appDir: true,
  outputCSS: "./public/tamagui.css",
  disableExtraction: process.env.NODE_ENV === "development",
});

export default tamaguiPlugin(nextConfig);
