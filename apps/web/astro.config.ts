import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwind from '@astrojs/tailwind'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import cloudflare from '@astrojs/cloudflare'

export default defineConfig({
  site: 'https://hypercerts-guide.pages.dev',
  output: 'static',
  integrations: [react(), tailwind(), mdx(), sitemap({
    i18n: {
      defaultLocale: 'zh',
      locales: { zh: 'zh-TW', en: 'en' },
    },
  })],
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: { prefixDefaultLocale: false },
  },
})
