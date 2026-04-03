/** @type {import('next').NextConfig} */
const nextConfig = {
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
