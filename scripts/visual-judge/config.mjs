// Visual judge: shared configuration.
//
// Routes and viewports are the site's real audience, not round numbers:
//   wide    John's own Chrome window (3061 CSS px). Gutters, capped heroes
//           and flattened figures have shipped at this width before.
//   laptop  the common desktop.
//   duo-*   iPhone Duo poses (owner order 2026-11-24, see e2e/duo.spec.ts).
//   phone   390 x 844, the iPhone baseline every mobile audit uses.

export const VIEWPORTS = {
  wide: { width: 3061, height: 1779, deviceScaleFactor: 1 },
  laptop: { width: 1440, height: 900, deviceScaleFactor: 1 },
  'duo-open': { width: 951, height: 669, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  'duo-closed': { width: 466, height: 678, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  phone: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};

// The nightly set. `--viewports all` adds duo-closed.
export const DEFAULT_VIEWPORTS = ['wide', 'laptop', 'duo-open', 'phone'];

export const ROUTES = [
  '/',
  '/work/',
  '/work/enforcement-gates/',
  '/work/verification-gate/',
  '/work/agent-governance/',
  '/about/',
  '/photography/',
  '/photography/7r50580-enhanced-sr/',
  '/beyond/',
  '/links/',
  '/privacy/',
];

// Frames per page: the first screen, then real wheel scrolls down the page.
// Long pages are sampled evenly rather than truncated.
export const MAX_FRAMES = 6;

// Retired colors (CLAUDE.md palette). Matched against COMPUTED styles of
// what is actually on screen, so a new stylesheet cannot slip past the way
// a single-file source grep can.
export const RETIRED_COLORS = {
  'navy-hour #7E9CB8 (retired 2026-07-28)': '126, 156, 184',
  'gold #B8973F (retired 2026-05-31)': '184, 151, 63',
};

// Severity of each deterministic check. blocker fails the run.
export const CHECK_SEVERITY = {
  overflow: 'blocker',
  brokenImages: 'blocker',
  hiddenReveals: 'blocker',
  titleUnderHeader: 'blocker',
  retiredColors: 'major',
  emDash: 'major',
  pageErrors: 'major',
  csp: 'major',
  consoleErrors: 'minor',
};
