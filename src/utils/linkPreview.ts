import * as fs from 'node:fs';
import * as path from 'node:path';

export interface LinkMetadata {
  url: string;
  title: string;
  description: string;
  image: string | null;
  domain: string;
  fetchedAt: number;
}

const CACHE_DIR = '.link-preview-cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

function getCacheFilePath(url: string): string {
  const hash = Buffer.from(url).toString('base64url');
  return path.join(process.cwd(), CACHE_DIR, `${hash}.json`);
}

function ensureCacheDir(): void {
  const cacheDir = path.join(process.cwd(), CACHE_DIR);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
}

function getFromCache(url: string): LinkMetadata | null {
  const cacheFile = getCacheFilePath(url);
  if (!fs.existsSync(cacheFile)) {
    return null;
  }

  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as LinkMetadata;
    if (Date.now() - cached.fetchedAt < CACHE_TTL) {
      return cached;
    }
  } catch {
    // Cache corrupted, ignore
  }
  return null;
}

function saveToCache(metadata: LinkMetadata): void {
  ensureCacheDir();
  const cacheFile = getCacheFilePath(metadata.url);
  fs.writeFileSync(cacheFile, JSON.stringify(metadata, null, 2));
}

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function extractMetaContent(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHTMLEntities(match[1].trim());
    }
  }
  return null;
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

function resolveImageUrl(imageUrl: string | null, baseUrl: string): string | null {
  if (!imageUrl) return null;

  try {
    // Handle protocol-relative URLs
    if (imageUrl.startsWith('//')) {
      return `https:${imageUrl}`;
    }
    // Handle relative URLs
    if (!imageUrl.startsWith('http')) {
      const base = new URL(baseUrl);
      return new URL(imageUrl, base.origin).href;
    }
    return imageUrl;
  } catch {
    return null;
  }
}

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  // Check cache first
  const cached = getFromCache(url);
  if (cached) {
    console.log(`[LinkPreview] Cache hit for: ${url}`);
    return cached;
  }

  console.log(`[LinkPreview] Fetching metadata for: ${url}`);

  const domain = extractDomain(url);

  // Default fallback metadata
  const fallback: LinkMetadata = {
    url,
    title: domain,
    description: '',
    image: null,
    domain,
    fetchedAt: Date.now(),
  };

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.warn(`[LinkPreview] HTTP ${response.status} for: ${url}`);
      saveToCache(fallback);
      return fallback;
    }

    const html = await response.text();

    // Extract Open Graph metadata
    const ogTitle = extractMetaContent(html, [
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i,
    ]);

    const ogDescription = extractMetaContent(html, [
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i,
    ]);

    const ogImage = extractMetaContent(html, [
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    ]);

    // Fallback to standard meta tags
    const metaDescription = extractMetaContent(html, [
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i,
    ]);

    // Fallback to Twitter card
    const twitterImage = extractMetaContent(html, [
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
    ]);

    // Extract page title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : null;

    const metadata: LinkMetadata = {
      url,
      title: ogTitle || pageTitle || domain,
      description: ogDescription || metaDescription || '',
      image: resolveImageUrl(ogImage || twitterImage, url),
      domain,
      fetchedAt: Date.now(),
    };

    saveToCache(metadata);
    return metadata;
  } catch (error) {
    console.warn(`[LinkPreview] Error fetching ${url}:`, error);
    saveToCache(fallback);
    return fallback;
  }
}
