import type { NextConfig } from "next";

const config: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.boatsetter.com" },
      { protocol: "https", hostname: "**.mvpmiami.com" },
      { protocol: "https", hostname: "**.airbnb.com" },
      { protocol: "https", hostname: "a0.muscache.com" },
      { protocol: "https", hostname: "msiljtrmujznyuocytzq.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default config;
