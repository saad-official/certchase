import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Certificates can be up to 10 MB; the default is 1 MB.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
