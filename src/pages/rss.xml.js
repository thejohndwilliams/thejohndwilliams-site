import rss from '@astrojs/rss';
import { getPublishedWriting } from '../utils/writing';

/**
 * Feed for the writing surface. Drafts are excluded upstream by
 * getPublishedWriting, so the gate is inherited rather than repeated.
 */
export async function GET(context) {
  const essays = await getPublishedWriting();

  return rss({
    title: 'John D. Williams',
    description:
      'Essays on attention: making things visible in networks, in data, and in the natural world.',
    site: context.site ?? 'https://thejohndwilliams.com',
    items: essays.map((essay) => ({
      title: essay.data.title,
      description: essay.data.description,
      pubDate: essay.data.pubDate,
      link: `/writing/${essay.id}/`,
    })),
    customData: '<language>en-us</language>',
  });
}
