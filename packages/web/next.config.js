const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@web3auth/modal"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
  webpack(config) {
    config.resolve.alias["@segment/analytics-next"] = path.resolve(
      __dirname,
      "src/lib/segment-noop.ts"
    );
    return config;
  },
};

module.exports = nextConfig;
