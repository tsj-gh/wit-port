/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    const longCache =
      "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400";
    return [
      {
        source: "/assets/tap-coloring/Pictures/SVG/:path*",
        headers: [{ key: "Cache-Control", value: longCache }],
      },
      {
        source: "/assets/tap-coloring/Frame/SVG/:path*",
        headers: [{ key: "Cache-Control", value: longCache }],
      },
      {
        source: "/assets/tap-coloring/Splatter/:path*",
        headers: [{ key: "Cache-Control", value: longCache }],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/games/pair-link", destination: "/lab/pair-link", permanent: true },
      { source: "/games/skyscraper", destination: "/lab/skyscraper", permanent: true },
      { source: "/games/pres-sure-judge", destination: "/lab/pres-sure-judge", permanent: true },
    ];
  },
  env: {
    NEXT_PUBLIC_BUILD_DATE: new Date().toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7),
  },
};

module.exports = nextConfig;
