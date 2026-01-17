/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Precision Observatory Palette
        void: {
          950: '#030508',
          900: '#060a12',
          850: '#0a0e1a',
          800: '#0d1424',
          700: '#131c32',
          600: '#1a2642',
        },
        // Sleep spectrum
        sleep: {
          deep: '#1e40af',      // Deep indigo-blue
          rem: '#7c3aed',       // Violet-purple
          light: '#475569',     // Slate
          awake: '#dc2626',     // Red
        },
        // Data colors
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        coral: {
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
        },
        violet: {
          400: '#a78bfa',
          500: '#8b5cf6',
        },
        // UI elements
        zinc: {
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'metric': ['3.5rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '-0.02em' }],
        'metric-sm': ['2rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '-0.01em' }],
        'label': ['0.6875rem', { lineHeight: '1.2', fontWeight: '500', letterSpacing: '0.05em' }],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
