import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: ["primd"],
  turbopack: {},
};

export default nextConfig;
