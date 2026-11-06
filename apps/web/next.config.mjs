/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // The deploy script type-checks the whole workspace in its own step (or the caller has just done so); `next build`
  // repeating it costs minutes on a small machine. Off unless the deploy asks, so a plain `next build` still checks types.
  typescript: { ignoreBuildErrors: process.env.DD_SKIP_NEXT_TYPECHECK === "1" },
  transpilePackages: ["@donordesk/domain", "@donordesk/contracts"],
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  },
};

export default nextConfig;
