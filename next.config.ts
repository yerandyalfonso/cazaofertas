import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cazaofertas/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "static.kiabi.es" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "**.media-amazon.com" },
      { protocol: "https", hostname: "**.ssl-images-amazon.com" },
      { protocol: "https", hostname: "**.amazon-adsystem.com" },
      { protocol: "https", hostname: "fb-es.mrvcdn.com" },
      { protocol: "https", hostname: "**.mrvcdn.com" },
      { protocol: "https", hostname: "**.miravia.es" },
      { protocol: "https", hostname: "img2.miravia.es" },
    ],
  },
};

export default nextConfig;
