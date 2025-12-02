import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@handcraft/ui", "@handcraft/sdk", "@handcraft/types"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["@solana/wallet-adapter-react-ui"],
  },
};

export default nextConfig;
