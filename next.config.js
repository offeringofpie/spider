// debug-twcss/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  reactStrictMode: true,
  experimental: {
    concurrentFeatures: true, // <- Turn this option to false
    serverComponents: true,
  },
};
module.exports = nextConfig;
