/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: false,
  },
  async rewrites() {
    return [
      {
        source: "/favicon.ico",
        destination: "/beengie/beengie-logo.png",
      },
    ];
  },
};

export default nextConfig;
