import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: { cpus: 2 },
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;
