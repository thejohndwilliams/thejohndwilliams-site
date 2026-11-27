import type { APIRoute } from 'astro';

interface FeedItem {
  title: string;
  path: string;
  description: string;
  published: string;
  category: string;
}

// Static RSS 2.0 syndication for published technical case studies (2026-11-26).
// Kept OPSEC-clean and em-dash-free in lockstep with /work/* JSON-LD metadata.
const SITE = 'https://thejohndwilliams.com';

const ITEMS: FeedItem[] = [
  {
    title: 'Public-Signal Triage and Outage Detection',
    path: '/work/signal-triage/',
    description:
      'Boolean query gates, burst detection and a structured brief: separating early outage witnesses from public noise before an official status update.',
    published: '2026-11-24T00:00:00Z',
    category: 'Public signals',
  },
  {
    title: 'Adversarial Verification for AI Claims',
    path: '/work/verification-gate/',
    description:
      'A gate for work done by AI agents: two models from different vendors are told a claim is wrong, must cite raw evidence to pass it, and block anything they cannot prove.',
    published: '2026-11-24T00:00:00Z',
    category: 'AI assurance',
  },
  {
    title: 'Human Oversight for a Multi-Agent System',
    path: '/work/agent-governance/',
    description:
      'How one person stays in control of a group of AI agents: approval gates, role boundaries, separation of duties and an evidence trail anyone can check.',
    published: '2026-11-24T00:00:00Z',
    category: 'AI governance',
  },
  {
    title: 'Precision-Gated Enforcement',
    path: '/work/enforcement-gates/',
    description:
      'A classifier run as an enforcement system: where it may act alone, where a person decides, and what a sample of decisions can actually certify.',
    published: '2026-11-17T00:00:00Z',
    category: 'Trust and safety',
  },
];

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const GET: APIRoute = () => {
  const lastBuildDate = new Date('2026-11-26T00:00:00Z').toUTCString();
  const itemsXml = ITEMS.map((item) => {
    const url = `${SITE}${item.path}`;
    const pubDate = new Date(item.published).toUTCString();
    return [
      '    <item>',
      `      <title>${esc(item.title)}</title>`,
      `      <link>${esc(url)}</link>`,
      `      <guid isPermaLink="true">${esc(url)}</guid>`,
      `      <pubDate>${esc(pubDate)}</pubDate>`,
      `      <category>${esc(item.category)}</category>`,
      `      <description>${esc(item.description)}</description>`,
      '    </item>',
    ].join('\n');
  }).join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>John D. Williams · Selected Work</title>',
    `    <link>${SITE}/work/</link>`,
    '    <description>Case studies in controls, evidence, adversarial verification, agent governance and public-signal triage by John D. Williams.</description>',
    '    <language>en-us</language>',
    `    <lastBuildDate>${esc(lastBuildDate)}</lastBuildDate>`,
    '    <copyright>CC BY 4.0 John D. Williams (text and figures); photographs all rights reserved.</copyright>',
    `    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />`,
    itemsXml,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};
