import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    incomingRequests: false,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
