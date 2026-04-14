/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        midnight: {
          DEFAULT: '#0a0a0a',
          50: '#1a1a1a',
          100: '#141414',
          200: '#111111',
          300: '#0f0f0f',
          900: '#050505',
        },
        cream: {
          DEFAULT: '#FDFCFA',
          100: '#f5f4f2',
          200: '#e8e6e1',
          300: '#d4d0c8',
          600: '#a09a8c',
          700: '#7a756a',
        },
        gold: {
          DEFAULT: '#B8973F',
          light: '#d4b85a',
          dark: '#8a7230',
        },
        charcoal: {
          DEFAULT: '#1A1A1A',
          700: '#3D3D3D',
          900: '#0a0a0a',
        },
        /* Muted text — WCAG AA pass on midnight (#0a0a0a): 5.1:1.
           Use in place of opacity-40 for any prose or functional text. */
        mute: '#787878',
        /* Secondary accent — warm stone. Cool counterpoint to the
           gold. Use for secondary actions, hover states, subtle
           highlights. Leaves gold free to mean "primary / most
           important" per surface. */
        stone: {
          DEFAULT: '#A89F8C',
          light: '#C7C0AF',
          dark: '#7A7366',
        },
      },
      fontFamily: {
        serif: ['Libre Baskerville', 'Georgia', 'serif'],
        sans: ['Source Sans 3', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        /* 8pt-grid aligned type scale on 18px base */
        'display': ['4rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],     /* 72px */
        'headline': ['3.111rem', { lineHeight: '1.1', letterSpacing: '-0.025em' }], /* 56px */
        'title': ['2.667rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],    /* 48px */
        'subhead': ['0.778rem', { lineHeight: '1.5', letterSpacing: '0.1em' }],     /* 14px */
      },
      spacing: {
        /* 8pt grid — multiples of 8px expressed in rem at 18px base */
        '1': '0.444rem',   /* 8px */
        '2': '0.889rem',   /* 16px */
        '3': '1.333rem',   /* 24px */
        '4': '1.778rem',   /* 32px */
        '5': '2.222rem',   /* 40px */
        '6': '2.667rem',   /* 48px */
        '8': '3.556rem',   /* 64px */
        '10': '4.444rem',  /* 80px */
        '12': '5.333rem',  /* 96px */
        '16': '7.111rem',  /* 128px */
        '20': '8.889rem',  /* 160px */
        '24': '10.667rem', /* 192px */
      },
      animation: {
        'fade-in': 'fadeIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'slide-up': 'slideUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'scale-in': 'scaleIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'glass-shimmer': 'glassShimmer 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glassShimmer: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      borderRadius: {
        'card': '0.75rem', /* 12px — modern card radius */
      },
    },
  },
  plugins: [],
}
