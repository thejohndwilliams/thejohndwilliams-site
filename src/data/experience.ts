// The record on /work: roles and degrees, newest first.
// Owner rulings 2026-11-24: SpaceX by name with title and years only (no
// product, team, segments, numbers or programs; the site's OPSEC law);
// one SpaceX entry, Process Specialist; Apple both roles, the fintech
// co-founder role, and both Baylor degrees. Each entry opens to one plain
// line and a few chips. Source: 01_Career/MASTER_CAREER_INDEX.md.
// Voice: no GPA, no unfinished credentials, no metrics, no em dashes.

export type Lane = 'work' | 'study';

export type RecordEntry = {
  id: string;
  org: string;
  mark: 'spacex' | 'apple' | 'monogram';
  monogram?: string;
  role: string;
  lane: Lane;
  /** 'YYYY-MM'. */
  from: string;
  /** 'YYYY-MM', or null while current. */
  to: string | null;
  line: string;
  chips: string[];
};

export const RECORD: RecordEntry[] = [
  {
    id: 'spacex',
    org: 'SpaceX',
    mark: 'spacex',
    role: 'Process Specialist',
    lane: 'work',
    from: '2025-03',
    to: null,
    line: 'Operations, risk and controls: how the work is designed, measured and kept honest.',
    chips: ['Process Controls', 'Risk', 'Analytics', 'Automation'],
  },
  {
    id: 'baylor-mba',
    org: 'Baylor University',
    mark: 'monogram',
    monogram: 'Bu',
    role: 'MBA, Cybersecurity',
    lane: 'study',
    from: '2022-08',
    to: '2024-05',
    line: 'Hankamer School of Business. The capstone was a NIST 800-53 security framework for a healthcare organization.',
    chips: ['Risk', 'Security architecture', 'Compliance', 'Statistics'],
  },
  {
    id: 'apple-business',
    org: 'Apple',
    mark: 'apple',
    role: 'SMB Account Manager',
    lane: 'work',
    from: '2022-10',
    to: '2023-04',
    line: 'Business accounts and the device fleets behind them: deployment, identity and security.',
    chips: ['Account management', 'Device management', 'Identity', 'Endpoint security'],
  },
  {
    id: 'pennies-to-dollars',
    org: 'Pennies to Dollars',
    mark: 'monogram',
    monogram: 'Pd',
    role: 'Co-Founder, Technology Operations',
    lane: 'work',
    from: '2020-07',
    to: '2022-11',
    line: 'A fintech startup, run from the first member to a paying community.',
    chips: ['Operations', 'Platform reliability', 'Community', 'Data protection'],
  },
  {
    id: 'apple-support',
    org: 'Apple',
    mark: 'apple',
    role: 'Technical Support Expert',
    lane: 'work',
    from: '2017-09',
    to: '2019-04',
    line: 'Diagnosis and repair at the counter, and the training that kept a team consistent.',
    chips: ['Diagnostics', 'Training', 'Compliance', 'Customer experience'],
  },
  {
    id: 'baylor-ba',
    org: 'Baylor University',
    mark: 'monogram',
    monogram: 'Bu',
    role: 'BA, Film and Digital Media',
    lane: 'study',
    from: '2013-08',
    to: '2015-12',
    line: 'Story, camera and the edit. The first discipline, and still the one behind the photographs.',
    chips: ['Film', 'Editing', 'Lighting', 'Photography'],
  },
];

/** Tools carried across the work, from the former expertise list. */
export const TOOLS = ['Python', 'SQL', 'Power BI'];

export const RIBBON_START = 2013;

export function monthIndex(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return (y - RIBBON_START) * 12 + (m - 1);
}

export function yearsLabel(e: RecordEntry): string {
  const a = e.from.slice(0, 4);
  const b = e.to ? e.to.slice(0, 4) : 'Now';
  // En dash (U+2013) for ranges; the copy law bans the em dash only.
  return a === b ? a : `${a}–${b}`;
}
