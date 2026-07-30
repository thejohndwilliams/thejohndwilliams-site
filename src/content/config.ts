// Writing surface (Phase 1, 2026-07-28). Native Astro content collections,
// plain markdown, zero new dependencies. The index stays austere by law:
// date, category, title. Three categories only.
import { defineCollection, z } from 'astro:content';

const writing = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    category: z.enum(['Engineering forensics', 'Operations discipline', 'Craft']),
    draft: z.boolean().default(false),
  }),
});

export const collections = { writing };
