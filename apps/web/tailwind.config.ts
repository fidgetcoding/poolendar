import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef3e2',
          100: '#fde4b9',
          200: '#fcd48c',
          300: '#fbc35f',
          400: '#fab63d',
          500: '#f9a825',
          600: '#f59b20',
          700: '#ef8a1a',
          800: '#e97a15',
          900: '#df5f0c',
        },
      },
    },
  },
  plugins: [],
}

export default config
