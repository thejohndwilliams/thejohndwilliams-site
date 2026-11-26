// Pre-send check scenarios for /work/signal-triage/ (2026-11-25).
// Illustrative, hand-written: they show what each check does when it fails.
// Shared by the page (no-script render) and the console script.

export type CheckId = 'refetch' | 'links' | 'quotes' | 'map' | 'pulls';
export type ScenarioId = 'clean' | 'deleted' | 'map' | 'pull';

export const CHECKS: { id: CheckId; label: string }[] = [
  { id: 'refetch', label: 'Cited posts re-fetched' },
  { id: 'links', label: 'Every citation keeps its link' },
  { id: 'quotes', label: 'Quotes found in their post' },
  { id: 'map', label: 'Map matches the counts' },
  { id: 'pulls', label: 'Failed pulls named' },
];

export interface Scenario {
  id: ScenarioId;
  button: string;
  outcome: string;
  detail: string;
  /** Check state text; a check absent here passes. `fail: true` lights it. */
  states: Partial<Record<CheckId, { text: string; fail?: boolean }>>;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'clean',
    button: 'Clean run',
    outcome: 'Sends',
    detail: 'All five checks pass.',
    states: { pulls: { text: 'None failed' } },
  },
  {
    id: 'deleted',
    button: 'A cited post was deleted',
    outcome: 'Recounts, then sends',
    detail: 'The missing post is dropped, the gate re-runs on what remains, and the brief notes the withdrawn citation.',
    states: { refetch: { text: '1 gone', fail: true }, pulls: { text: 'None failed' } },
  },
  {
    id: 'map',
    button: 'Map disagrees with counts',
    outcome: 'Held',
    detail: 'Nothing sends until the image is rebuilt from the counts. A map is evidence, not decoration.',
    states: { map: { text: 'Mismatch', fail: true }, pulls: { text: 'None failed' } },
  },
  {
    id: 'pull',
    button: 'A source failed to load',
    outcome: 'Sends, gap named',
    detail: 'The brief lists the failed source under collection gaps instead of quietly substituting another.',
    states: { pulls: { text: '1 named' } },
  },
];
