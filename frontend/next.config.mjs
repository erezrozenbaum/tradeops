/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone: produces a minimal production bundle for Docker (run with `node server.js`).
  // Incompatible with `next start` CLI — always run via `node .next/standalone/server.js` in prod.
  output: "standalone",
  async rewrites() {
    return {
      // fallback: checked after all pages and Route Handlers, so dedicated API route
      // files in app/api/ take precedence over this backend proxy rewrite.
      fallback: [
        {
          source: "/api/:path*",
          destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
