/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium OLED-optimized palette
        void: {
          950: '#000000',      // True black for OLED
          900: '#0a0a0a',
          850: '#0d0d0d',
          800: '#141414',
          700: '#1c1c1e',
          600: '#2c2c2e',
        },
        // Sleep spectrum
        sleep: {
          deep: '#1e40af',
          rem: '#7c3aed',
          light: '#475569',
          awake: '#dc2626',
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
          600: '#7c3aed',
        },
        // UI elements
        zinc: {
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
        },
        // AI bubble colors
        ai: {
          bubble: 'rgba(139, 92, 246, 0.15)',
          border: 'rgba(139, 92, 246, 0.25)',
        },
        user: {
          bubble: 'rgba(6, 182, 212, 0.15)',
          border: 'rgba(6, 182, 212, 0.25)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Apple-inspired typography scale
        'display-lg': ['3rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '-0.02em' }],
        'display-md': ['2rem', { lineHeight: '1.1', fontWeight: '600', letterSpacing: '-0.015em' }],
        'display-sm': ['1.5rem', { lineHeight: '1.2', fontWeight: '600', letterSpacing: '-0.01em' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['1.0625rem', { lineHeight: '1.5', fontWeight: '400' }], // 17px - Apple's body
        'body-sm': ['0.9375rem', { lineHeight: '1.5', fontWeight: '400' }],
        'label-lg': ['0.8125rem', { lineHeight: '1.3', fontWeight: '500', letterSpacing: '0.02em' }],
        'label-md': ['0.75rem', { lineHeight: '1.3', fontWeight: '500', letterSpacing: '0.03em' }],
        'label-sm': ['0.6875rem', { lineHeight: '1.2', fontWeight: '500', letterSpacing: '0.04em' }],
        // Legacy metric sizes
        'metric': ['3.5rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '-0.02em' }],
        'metric-sm': ['2rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '-0.01em' }],
        'label': ['0.6875rem', { lineHeight: '1.2', fontWeight: '500', letterSpacing: '0.05em' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'typing': 'typing 1.4s ease-in-out infinite',
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
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        typing: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.3)',
        'glow-violet': '0 0 20px rgba(139, 92, 246, 0.3)',
        'glow-emerald': '0 0 20px rgba(52, 211, 153, 0.3)',
        'glow-coral': '0 0 20px rgba(244, 63, 94, 0.3)',
      },
    },
  },
  plugins: [],
}
