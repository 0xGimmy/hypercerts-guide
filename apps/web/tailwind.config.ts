import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        primary: '#00D951',
        light: {
          background: '#EFF0E8',
          foreground: '#FFFFFF',
          text: '#25323A',
        },
        dark: {
          background: '#25323A',
          foreground: '#3D625F',
          text: '#FFFFFF',
        },
      },
    },
  },
  plugins: [typography],
} satisfies Config
