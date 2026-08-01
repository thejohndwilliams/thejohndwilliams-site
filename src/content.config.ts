// Writing collection (re-homed under Work, owner architecture 2026-07-31:
// "the work section will host GitHub projects, writings, and research").
// Ported 2026-08-01 from the July 28 branch to the Astro 7 Content Layer
// (glob loader); the index-page-by-law austerity moves into work.astro.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    category: z.enum(['Engineering forensics', 'Operations discipline', 'Craft']),
    draft: z.boolean().default(false),
  }),
});

export const collections = { writing };
