import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(appDir, "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@cazaofertas/shared"],
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.amazon.es" },
      { protocol: "https", hostname: "**.amazon.com" },
      { protocol: "https", hostname: "**.media-amazon.com" },
      { protocol: "https", hostname: "**.mrvcdn.com" },
      { protocol: "https", hostname: "fb-es.mrvcdn.com" },
      { protocol: "https", hostname: "**.miravia.es" },
      { protocol: "https", hostname: "**.kiabi.es" },
      { protocol: "https", hostname: "img2.miravia.es" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
