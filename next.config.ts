import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GFive Job-Work (production) app: static page built into public/production by scripts/build-production.mjs
  async rewrites() {
    return [{ source: "/production", destination: "/production/index.html" }];
  },
  async headers() {
    return [
      {
        source: "/production/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Service-Worker-Allowed", value: "/production" },
        ],
      },
      { source: "/production", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/production/index.html", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      {
        // logo, icons and invoice fonts rarely change — let phones keep them for a week
        source: "/:dir(brand|fonts)/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
