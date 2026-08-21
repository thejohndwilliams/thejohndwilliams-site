import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Writing collection - the essay surface.
 *
 * Plumbing shape follows Writing_Surface_Plan_2026-05-30, updated for the
 * Astro 5+ content layer (glob loader) that Astro 7 ships; the original plan
 * predates it and specified the legacy src/content/config.ts form.
 *
 * `draft: true` is the DEFAULT and the publish gate. A draft never reaches
 * the index, a detail route, the sitemap, or the feed. Flipping it to false
 * is the deliberate act of publishing.
 */
const writing = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(true),
    tags: z.array(z.string()).default([]),
    /** Photograph basename; reuses the existing 3-tier image + OG pipeline. */
    heroImage: z.string().optional(),
    /** Alt text for the hero photograph. Required when heroImage is set. */
    heroAlt: z.string().optional(),
  }),
});

export const collections = { writing };
