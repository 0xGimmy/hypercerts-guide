import { defineCollection, z } from 'astro:content'

const orgs = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    address: z.string().optional(),
    verified: z.boolean().default(false),
    image: z.string().optional(),
    link: z.string().optional(),
    locale: z.enum(['en', 'zh']),
  }),
})

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    locale: z.enum(['en', 'zh']),
  }),
})

export const collections = { orgs, pages }
