/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── shadcn/ui semantic tokens ──
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // ── Legacy aliases (mapped onto shadcn tokens in index.css) ──
        'c-bg':       'var(--c-bg)',
        'c-sidebar':  'var(--c-sidebar)',
        'c-surface':  'var(--c-surface)',
        'c-elevated': 'var(--c-elevated)',
        'c-input':    'var(--c-input)',
        'c-border':   'var(--c-border)',
        'c-border2':  'var(--c-border2)',
        'c-text':     'var(--c-text)',
        'c-text2':    'var(--c-text2)',
        'c-text3':    'var(--c-text3)',
        'c-text4':    'var(--c-text4)',
        'c-bubble':   'var(--c-bubble)',
      },
      borderRadius: {
        // shadcn radius scale, driven by --radius. Overrides the default
        // rounded-sm/md/lg utilities so existing classes adopt the new scale.
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        // Single-font app: every Tailwind font-* class resolves to Geist so the
        // UI never visually mixes typefaces.
        sans:  ['Geist', 'system-ui', 'sans-serif'],
        mono:  ['Geist', 'system-ui', 'sans-serif'],
        serif: ['Geist', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
