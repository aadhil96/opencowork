/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme-aware colors via CSS variables
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
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono', 'Fira Code', 'monospace'],
        serif: ['Georgia', 'Times New Roman', 'serif'],
      }
    }
  },
  plugins: []
}
