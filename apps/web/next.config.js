/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@poolendar/types', '@poolendar/validators'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

module.exports = nextConfig
