# thejohndwilliams.com

Personal website for John D. Williams. Built with Astro, styled with Tailwind CSS, deployed on Cloudflare Pages.

## Tech Stack

- **Framework**: Astro 4.x
- **Styling**: Tailwind CSS
- **Fonts**: Libre Baskerville (serif), Source Sans 3 (sans), JetBrains Mono (mono)
- **Deployment**: Cloudflare Pages

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm

### Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The dev server runs at `http://localhost:4321`.

## Project Structure

```
src/
├── components/       # Reusable components
│   ├── Header.astro
│   └── Footer.astro
├── layouts/          # Page layouts
│   ├── BaseLayout.astro
│   └── PostLayout.astro
├── pages/            # File-based routing
│   ├── index.astro
│   ├── about.astro
│   ├── links.astro
│   ├── work.astro
│   ├── writing.astro
│   ├── 404.astro
│   └── writing/      # Blog posts
│       └── *.astro
├── styles/
│   └── global.css    # Global styles + Tailwind
public/
└── favicon.svg
```

## Deployment (Cloudflare Pages)

1. Push this repo to GitHub
2. In Cloudflare Dashboard → Pages → Create project
3. Connect to GitHub repo
4. Build settings:
   - **Framework preset**: Astro
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Deploy

Custom domain setup:
1. In your Pages project → Settings → Custom domains
2. Add `thejohndwilliams.com` (and `www.thejohndwilliams.com`)
3. Cloudflare handles SSL automatically

## Customization

### Colors

Edit `tailwind.config.mjs` to adjust the palette:

```js
colors: {
  cream: { ... },    // Background tones
  charcoal: { ... }, // Text colors
  gold: { ... },     // Accent color
  slate: { ... },    // Secondary text
}
```

### Typography

Fonts loaded via Google Fonts in `global.css`. To change:

1. Update the `@import` URL in `src/styles/global.css`
2. Update `fontFamily` in `tailwind.config.mjs`

### Adding Blog Posts

Create new `.astro` files in `src/pages/writing/`:

```astro
---
import PostLayout from '../../layouts/PostLayout.astro';

const frontmatter = {
  title: 'Your Title',
  description: 'Your description',
  date: '2025-01-01',
  readTime: '5 min'
};
---

<PostLayout {...frontmatter}>
  <p>Your content here...</p>
</PostLayout>
```

Then add the post metadata to the array in `src/pages/writing.astro`.

## Future Enhancements

- [ ] E-commerce integration (Snipcart or similar) for prints/books
- [ ] Markdown blog posts with content collections
- [ ] Newsletter signup
- [ ] Cloudflare Web Analytics integration
- [ ] Open Graph images generation

## License

© John D. Williams. All rights reserved.
