import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["drizzle-orm", "postgres"],
  pageExtensions: ["tsx", "ts", "jsx", "js"],
};

export default nextConfig;
