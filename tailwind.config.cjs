/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

module.exports = {
  darkMode: ['variant', ['&:is(.dark *)', '&:is([data-theme="dark"] *)']],
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral charcoal greys everywhere the components say slate.
        slate: colors.neutral,
        brand: { DEFAULT: 'var(--brand)', foreground: 'var(--brand-foreground)' },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          // Solid signal-orange brand scale (600 = --brand #FF5F00).
          50: '#fff4ed', 100: '#ffe6d4', 200: '#ffc9a8', 300: '#ffa370', 400: '#ff7a33',
          500: '#ff7314', 600: '#ff5f00', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407',
        },
        secondary: { DEFAULT: 'hsl(var(--secondary) / <alpha-value>)', foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)' },
        destructive: { DEFAULT: 'hsl(var(--destructive) / <alpha-value>)', foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)' },
        muted: { DEFAULT: 'hsl(var(--muted) / <alpha-value>)', foreground: 'hsl(var(--muted-foreground) / <alpha-value>)' },
        accent: { DEFAULT: 'hsl(var(--accent) / <alpha-value>)', foreground: 'hsl(var(--accent-foreground) / <alpha-value>)' },
        card: { DEFAULT: 'hsl(var(--card) / <alpha-value>)', foreground: 'hsl(var(--card-foreground) / <alpha-value>)' },
        code: { DEFAULT: 'hsl(var(--code) / <alpha-value>)', foreground: 'hsl(var(--code-foreground) / <alpha-value>)', border: 'hsl(var(--code-border) / <alpha-value>)' },
        lightbox: { overlay: 'var(--lightbox-overlay)', fg: 'var(--lightbox-fg)', btn: 'var(--lightbox-btn)', 'btn-hover': 'var(--lightbox-btn-hover)', 'btn-border': 'var(--lightbox-btn-border)' },
        popover: { DEFAULT: 'hsl(var(--card) / <alpha-value>)', foreground: 'hsl(var(--card-foreground) / <alpha-value>)' },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 6px)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography'), require('tailwindcss-animate')],
};
