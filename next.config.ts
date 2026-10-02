import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM and data files that must be loaded from node_modules, not bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migrations are read from disk at runtime (src/db/client.ts), so tracing can't see them.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*"],
  },
};

export default nextConfig;
