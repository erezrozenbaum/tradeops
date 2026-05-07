/** @type {import('next').NextConfig} */
const nextConfig = {
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
