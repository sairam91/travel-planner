import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Let Node.js require() cassandra-driver directly at runtime instead of
  // bundling it — avoids issues with optional native deps like kerberos.
  serverExternalPackages: ["cassandra-driver"],
};

export default nextConfig;
