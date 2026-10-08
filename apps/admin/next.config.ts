import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; transpile them in the admin app.
  transpilePackages: [
    "@presensia/types",
    "@presensia/constants",
    "@presensia/validation",
    "@presensia/utils",
  ],
};

export default nextConfig;
