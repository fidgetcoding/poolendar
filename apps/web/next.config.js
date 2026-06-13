/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@poolendar/types', '@poolendar/validators', '@poolendar/api-client'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

module.exports = nextConfig
