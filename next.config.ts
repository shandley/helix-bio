import type { NextConfig } from "next";
import path from "path";

const primdDist = path.resolve(__dirname, "../primd/dist/index.js");

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: ["primd"],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      primd: primdDist,
    };
    return config;
  },
};

export default nextConfig;
