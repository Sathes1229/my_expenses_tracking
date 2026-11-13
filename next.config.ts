import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Invite links carry their secret token in the path; keep them out of the development request log.
  logging: { incomingRequests: { ignore: [/\/invite\//] } },
  // Only the Docker image runs the standalone server; `next start` warns when this is set.
  output: process.env.STANDALONE_BUILD === '1' ? 'standalone' : undefined,
  // sharp's native file links to libvips, which no import names, so tracing alone leaves it out.
  outputFileTracingIncludes: { '/api/receipts': ['./node_modules/@img/sharp-*/**/*'] },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
