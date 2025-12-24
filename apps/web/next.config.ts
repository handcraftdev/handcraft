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
    // Solana packages - transpile to fix PublicKey prototype issues
    "@solana/web3.js",
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-wallets",
  ],
  // Exclude Solana/Anchor packages from server bundling to prevent PublicKey issues
  serverExternalPackages: [
    "@solana/web3.js",
    "@coral-xyz/anchor",
  ],
  // Fix hot reload for pnpm workspace packages
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Use polling to detect changes in symlinked workspace packages
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        aggregateTimeout: 300,
      };
    }

    // Ensure @solana/web3.js is not broken by webpack optimization
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        os: false,
        path: false,
        crypto: false,
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
    // Don't optimize Solana packages - it breaks PublicKey prototype chain
    optimizePackageImports: ["tamagui"],
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
