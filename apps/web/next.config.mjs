import path from "node:path";
import { fileURLToPath } from "node:url";

const lowMemoryBuild = process.env.DD_LOW_MEMORY_BUILD === "1";
const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // The deploy script type-checks the whole workspace in its own step (or the caller has just done so); `next build`
  // repeating it costs minutes on a small machine. Off unless the deploy asks, so a plain `next build` still checks types.
  typescript: { ignoreBuildErrors: process.env.DD_SKIP_NEXT_TYPECHECK === "1" },
  transpilePackages: ["@donordesk/domain", "@donordesk/contracts"],
  // DD_LOW_MEMORY_BUILD=1 (set by scripts/host-build.sh): the host builds inside a 3 GB cap shared with production, which the
  // default build exceeds. Fewer workers and webpack's memory optimisations trade build speed for a smaller peak.
  ...(lowMemoryBuild ? { eslint: { ignoreDuringBuilds: true } } : {}),
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
    ...(lowMemoryBuild ? { webpackMemoryOptimizations: true, cpus: 1, workerThreads: false } : {}),
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  },
};

export default nextConfig;
