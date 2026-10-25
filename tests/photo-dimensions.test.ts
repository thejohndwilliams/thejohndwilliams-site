import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import dims from '../src/data/photo-dimensions.json';
import { photoSrcset, plateSizes } from '../src/utils/photo-src';

const root = path.resolve('public/images/photography');
const rows = Object.entries(dims) as Array<[
  string,
  {
    thumb: { w: number; h: number };
    gallery: { w: number; h: number };
    hero: { w: number; h: number };
    portrait?: { w: number; h: number };
  },
]>;

describe('photo dimension manifest', () => {
  it('matches every committed tier bitmap', async () => {
    for (const [file, row] of rows) {
      for (const tier of ['thumb', 'gallery', 'hero'] as const) {
        for (const ext of ['webp', 'avif'] as const) {
          const filePath = path.join(root, tier, `${file}.${ext}`);
          expect(fs.existsSync(filePath), filePath).toBe(true);
          const meta = await sharp(filePath).metadata();
          expect(meta.width, `${file} ${tier} ${ext}`).toBe(row[tier].w);
          expect(meta.height, `${file} ${tier} ${ext}`).toBe(row[tier].h);
        }
      }
      if (row.portrait) {
        for (const ext of ['webp', 'avif'] as const) {
          const filePath = path.join(root, 'portrait', `${file}.${ext}`);
          expect(fs.existsSync(filePath), filePath).toBe(true);
          const meta = await sharp(filePath).metadata();
          expect(meta.width, `${file} portrait ${ext}`).toBe(row.portrait.w);
          expect(meta.height, `${file} portrait ${ext}`).toBe(row.portrait.h);
        }
      }
    }
  }, 120_000);

  it('srcset descriptors never claim more pixels than the bitmap', () => {
    for (const [file, row] of rows) {
      const srcset = photoSrcset(file, 'webp');
      expect(srcset).toContain(`${row.thumb.w}w`);
      expect(srcset).toContain(`${row.gallery.w}w`);
      expect(srcset).toContain(`${row.hero.w}w`);
      const sizes = plateSizes(file);
      expect(sizes).toContain(`${row.hero.w}px`);
      expect(sizes).toContain('80svh');
    }
  });
});
