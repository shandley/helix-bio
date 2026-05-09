import type { NextConfig } from "next";
import path from "path";

const primdDir = path.resolve(__dirname, "../primd");
const primdDist = path.join(primdDir, "dist/index.js");

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: ["primd"],
  webpack(config, { dev }) {
    config.resolve.alias = {
      ...config.resolve.alias,
      primd: primdDist,
    };
    if (dev) {
      // primd is a pre-built library accessed via symlink alias — exclude it
      // from webpack's file watcher so file-system events on the primd dist
      // directory don't trigger spurious rebuilds that transiently empty the
      // RSC client-component manifest and cause an infinite Fast Refresh loop.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: new RegExp(primdDir.replace(/[/\\]/g, "[/\\\\]")),
      };
    }
    return config;
  },
};

export default nextConfig;
