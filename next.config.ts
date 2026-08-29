import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: process.env.AMP_ORB ? ["*.onamp.dev"] : undefined,
  poweredByHeader: false,
};

export default nextConfig;
