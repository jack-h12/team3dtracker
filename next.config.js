/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // SWC minification is enabled by default in Next.js 14
  // Optimize for Vercel deployment
  swcMinify: true,
}

module.exports = nextConfig

