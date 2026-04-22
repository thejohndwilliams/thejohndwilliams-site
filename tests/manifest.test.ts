import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  categories,
  totalImages,
  getAllSlugs,
  getAllSlugsSequential,
  getPhotoBySlug,
} from '../src/data/photography';

const PHOTO_ROOT = path.join(process.cwd(), 'public', 'images', 'photography');
const TIERS = ['thumb', 'gallery', 'hero'] as const;
const FORMATS = ['avif', 'webp'] as const;

describe('Photography manifest ↔ disk contract', () => {
  it('every manifest file ref has all 6 variants on disk (3 tiers × 2 formats)', () => {
    const missing: string[] = [];
    for (const cat of categories) {
      for (const img of cat.images) {
        for (const tier of TIERS) {
          for (const fmt of FORMATS) {
            const p = path.join(PHOTO_ROOT, tier, `${img.file}.${fmt}`);
            if (!fs.existsSync(p)) missing.push(`${cat.id}/${img.file}.${fmt} (${tier})`);
          }
        }
      }
    }
    expect(missing, `missing variants:\n${missing.join('\n')}`).toEqual([]);
  });

  it('totalImages matches sum of category images (including showcase re-listings)', () => {
    const sum = categories.reduce((n, c) => n + c.images.length, 0);
    expect(totalImages).toBe(sum);
  });
});

describe('Slug lookup invariants', () => {
  it('getAllSlugs returns unique values', () => {
    const slugs = getAllSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('getAllSlugsSequential returns unique values (keyboard nav does not revisit)', () => {
    const seq = getAllSlugsSequential();
    expect(new Set(seq).size).toBe(seq.length);
  });

  it('first-seen wins: duplicated files resolve to their home (non-showcase) category', () => {
    // These two images are listed in both a home category (earth/water) AND the
    // `light` showcase. Home must win so canonical URLs stay semantically correct.
    const dupes: Array<{ file: string; expectedHome: string }> = [
      { file: 'img-7055-enhanced-enhanced-sr', expectedHome: 'earth' },
      { file: '7r50971-enhanced-sr',          expectedHome: 'water' },
    ];
    for (const { file, expectedHome } of dupes) {
      const entry = getPhotoBySlug(file);
      expect(entry, `slug ${file} not found`).toBeDefined();
      expect(entry!.category.id, `${file} should resolve to home '${expectedHome}', got '${entry!.category.id}'`).toBe(expectedHome);
    }
  });

  it('every slug resolves to a valid PhotoLookup', () => {
    for (const slug of getAllSlugs()) {
      const entry = getPhotoBySlug(slug);
      expect(entry, `slug ${slug} did not resolve`).toBeDefined();
      expect(entry!.image.file).toBe(slug);
    }
  });
});

describe('Placeholder coverage', () => {
  it('every manifest file has a placeholder entry (run npm run build:placeholders if this fails)', async () => {
    const { getPlaceholder } = await import('../src/data/photography');
    const missing: string[] = [];
    for (const cat of categories) {
      for (const img of cat.images) {
        if (!getPlaceholder(img.file)) missing.push(img.file);
      }
    }
    expect(missing, `missing placeholders:\n${missing.join('\n')}`).toEqual([]);
  });

  it('placeholders have plausible dimensions and LQIP data', async () => {
    const { getPlaceholder } = await import('../src/data/photography');
    for (const cat of categories) {
      for (const img of cat.images) {
        const ph = getPlaceholder(img.file);
        if (!ph) continue;
        expect(ph.width, `${img.file} width`).toBeGreaterThan(100);
        expect(ph.height, `${img.file} height`).toBeGreaterThan(100);
        expect(ph.lqip, `${img.file} lqip`).toMatch(/^data:image\/webp;base64,/);
      }
    }
  });
});
