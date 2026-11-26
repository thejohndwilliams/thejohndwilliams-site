// Proximity without a NEAR operator (2026-11-25).
//
// Listening platforms offer word-distance operators (NEAR/n). A public
// post-search API offers phrases, AND, OR and NOT, but no word distance. This
// module runs both forms over the six hand-written specimen posts on
// /work/signal-triage/ so the page can show the difference computed, not
// asserted. The word lists are illustrative, not a live query.

export type Group = 'product' | 'person' | 'symptom';
export type Mode = 'near' | 'groups' | 'relevance';

export const GROUPS: Record<Group, readonly string[]> = {
  product: ['app', 'apps', 'checkout', 'login', 'payment', 'payments', 'card'],
  person: ['i', "i'm", "i've", 'me', 'my', 'mine', 'we', 'our', 'us'],
  symptom: ['offline', 'down', 'outage', 'outages', 'failing', 'fails', 'error', '502', 'timeout', 'time', 'times', 'load'],
};

/** Words a relevance pass after the pull treats as off-topic: offers, reshares, planned work. */
export const OFF_TOPIC: readonly string[] = ['credit', 'claim', 'repost', 'thread', 'maintenance', 'scheduled'];

export const NEAR_DISTANCE = 6;

export interface Token {
  text: string;
  word: string | null;
  group: Group | null;
}

/** Split into display tokens, keeping punctuation and spaces so the text renders verbatim. */
export function tokenize(text: string): Token[] {
  const parts = text.match(/[A-Za-z0-9']+|[^A-Za-z0-9']+/g) ?? [];
  return parts.map((p) => {
    if (!/[A-Za-z0-9]/.test(p)) return { text: p, word: null, group: null };
    const w = p.toLowerCase();
    const group = (Object.keys(GROUPS) as Group[]).find((g) => GROUPS[g].includes(w)) ?? null;
    return { text: p, word: w, group };
  });
}

function words(text: string): { word: string; group: Group | null }[] {
  return tokenize(text)
    .filter((t) => t.word !== null)
    .map((t) => ({ word: t.word as string, group: t.group }));
}

/** (symptom) NEAR/6 (product): a symptom word within six words of a product word, either order. */
export function passesNear(text: string, distance = NEAR_DISTANCE): boolean {
  const ws = words(text);
  const at = (g: Group) => ws.flatMap((w, i) => (w.group === g ? [i] : []));
  const prod = at('product');
  return at('symptom').some((s) => prod.some((p) => Math.abs(s - p) <= distance));
}

/** API form: product AND first-person AND symptom anywhere in the same post. */
export function passesGroups(text: string): boolean {
  const groups = new Set(words(text).map((w) => w.group));
  return groups.has('product') && groups.has('person') && groups.has('symptom');
}

export function isOffTopic(text: string): boolean {
  return words(text).some((w) => OFF_TOPIC.includes(w.word));
}

export function passes(text: string, mode: Mode): boolean {
  if (mode === 'near') return passesNear(text);
  if (mode === 'groups') return passesGroups(text);
  return passesGroups(text) && !isOffTopic(text);
}

export interface ModeTally {
  signalKept: number;
  signalTotal: number;
  noiseKept: number;
  noiseTotal: number;
}

export function tally(posts: { text: string; label: number }[], mode: Mode): ModeTally {
  let signalKept = 0;
  let noiseKept = 0;
  const signalTotal = posts.filter((p) => p.label === 1).length;
  for (const p of posts) {
    if (!passes(p.text, mode)) continue;
    if (p.label === 1) signalKept += 1;
    else noiseKept += 1;
  }
  return { signalKept, signalTotal, noiseKept, noiseTotal: posts.length - signalTotal };
}
