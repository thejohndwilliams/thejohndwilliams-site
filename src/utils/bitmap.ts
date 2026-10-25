import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

/** Pixel size of a file under /public, for an img width and height. */
export async function publicBitmap(publicPath: string): Promise<{ width: number; height: number }> {
  const abs = fileURLToPath(new URL(`../../public${publicPath}`, import.meta.url));
  const meta = await sharp(abs).metadata();
  if (!meta.width || !meta.height) {
    throw new Error(`missing bitmap dimensions: ${publicPath}`);
  }
  return { width: meta.width, height: meta.height };
}
