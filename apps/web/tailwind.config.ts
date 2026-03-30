import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Noto Serif TC"', 'Georgia', 'serif'],
      },
      colors: {
        accent: '#2D7D6B',
        'accent-dark': '#246B5B',
        warm: '#C4956A',
        destructive: '#C83C2D',
        light: {
          background: '#F7F3EE',
          surface: '#FFFFFF',
          text: '#1C1917',
          'text-secondary': '#6B7164',
          'text-muted': '#A39E95',
          border: '#D6CFC5',
        },
        dark: {
          background: '#141816',
          surface: '#1E2220',
          text: '#EDEBE7',
          'text-secondary': '#8A8A82',
          'text-muted': '#5C5C56',
          border: '#2A2E2B',
        },
      },
    },
  },
  plugins: [typography],
} satisfies Config
