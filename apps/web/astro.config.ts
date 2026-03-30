import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwind from '@astrojs/tailwind'
import mdx from '@astrojs/mdx'
import cloudflare from '@astrojs/cloudflare'

export default defineConfig({
  output: 'static',
  integrations: [react(), tailwind(), mdx()],
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: { prefixDefaultLocale: false },
  },
})
