import path from 'node:path';
import sharp from 'sharp';

/** Pixel size of a file under /public, for an img width and height.
    Resolved from the project root because the build bundles this module. */
export async function publicBitmap(publicPath: string): Promise<{ width: number; height: number }> {
  const abs = path.join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
  const meta = await sharp(abs).metadata();
  if (!meta.width || !meta.height) {
    throw new Error(`missing bitmap dimensions: ${publicPath}`);
  }
  return { width: meta.width, height: meta.height };
}
