/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure proper handling of environment variables
  env: {
    // NEXT_PUBLIC_* vars are automatically available, no need to explicitly list
  },
  // Optimize for Vercel deployment
  swcMinify: true,
  // Ensure images are optimized
  images: {
    unoptimized: false,
  },
}

module.exports = nextConfig

