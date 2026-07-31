// Tailwind 3.4 via plain PostCSS (Glass Build A1, 2026-07-31).
// @astrojs/tailwind is deprecated upstream and peers only to astro<=5;
// Astro processes postcss.config natively, so the integration was pure
// plumbing. Tailwind 4 + CSS-first config lands with the A2 token refactor.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
