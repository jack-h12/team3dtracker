/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Remove standalone output for Vercel (Vercel handles this automatically)
  // output: 'standalone', // Commented out - not needed for Vercel
  // Add timeout for serverless functions
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig

