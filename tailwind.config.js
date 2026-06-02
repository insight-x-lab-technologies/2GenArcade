/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "Sunset Arcade" palette — deep indigo night + warm amber horizon.
        night: {
          DEFAULT: '#0d0820',
          900: '#0d0820',
          800: '#140b2b',
          700: '#1a1030',
          600: '#241640',
          500: '#2f1d52',
        },
        amber: {
          DEFAULT: '#ffb347',
          glow: '#ffce7a',
          deep: '#ff8c42',
        },
        coral: '#ff5d73',
        violet: {
          DEFAULT: '#b06cff',
          deep: '#7a44d6',
        },
        ink: '#f5ecff',
        muted: '#a796c9',
      },
      fontFamily: {
        display: ['Silkscreen', 'monospace'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        arcade: '0.625rem',
      },
      boxShadow: {
        'glow-amber': '0 0 0 1px rgba(255,179,71,0.5), 0 0 18px -2px rgba(255,140,66,0.55)',
        'glow-violet': '0 0 0 1px rgba(176,108,255,0.5), 0 0 18px -2px rgba(122,68,214,0.55)',
        'glow-coral': '0 0 0 1px rgba(255,93,115,0.5), 0 0 18px -2px rgba(255,93,115,0.5)',
        inset: 'inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -3px 0 rgba(0,0,0,0.35)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '94%': { opacity: '0.82' },
          '96%': { opacity: '1' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 280ms ease-out both',
        'slide-up': 'slide-up 320ms cubic-bezier(0.22,1,0.36,1) both',
        flicker: 'flicker 6s linear infinite',
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
