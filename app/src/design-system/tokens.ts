/**
 * Design System Tokens
 * =====================
 * Premium typography, colors, and spacing inspired by Apple's design language.
 * Optimized for OLED displays and conversational interfaces.
 */

// Typography Scale - Apple-inspired sizing
export const typography = {
  // Display sizes for hero metrics
  display: {
    lg: {
      fontSize: '3rem', // 48px
      lineHeight: '1',
      fontWeight: '600',
      letterSpacing: '-0.02em',
    },
    md: {
      fontSize: '2rem', // 32px
      lineHeight: '1.1',
      fontWeight: '600',
      letterSpacing: '-0.015em',
    },
    sm: {
      fontSize: '1.5rem', // 24px
      lineHeight: '1.2',
      fontWeight: '600',
      letterSpacing: '-0.01em',
    },
  },
  // Body text
  body: {
    lg: {
      fontSize: '1.125rem', // 18px
      lineHeight: '1.6',
      fontWeight: '400',
    },
    md: {
      fontSize: '1.0625rem', // 17px - Apple's preferred body size
      lineHeight: '1.5',
      fontWeight: '400',
    },
    sm: {
      fontSize: '0.9375rem', // 15px
      lineHeight: '1.5',
      fontWeight: '400',
    },
  },
  // Labels and captions
  label: {
    lg: {
      fontSize: '0.8125rem', // 13px
      lineHeight: '1.3',
      fontWeight: '500',
      letterSpacing: '0.02em',
    },
    md: {
      fontSize: '0.75rem', // 12px
      lineHeight: '1.3',
      fontWeight: '500',
      letterSpacing: '0.03em',
    },
    sm: {
      fontSize: '0.6875rem', // 11px
      lineHeight: '1.2',
      fontWeight: '500',
      letterSpacing: '0.04em',
    },
  },
} as const;

// Color Palette - OLED-optimized with premium feel
export const colors = {
  // True black for OLED - saves battery, perfect contrast
  background: {
    primary: '#000000',
    secondary: '#0a0a0a',
    tertiary: '#141414',
    elevated: '#1c1c1e',
  },
  // Text hierarchy
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.7)',
    tertiary: 'rgba(255, 255, 255, 0.5)',
    quaternary: 'rgba(255, 255, 255, 0.3)',
  },
  // AI bubble - subtle violet
  ai: {
    bubble: 'rgba(139, 92, 246, 0.15)',
    bubbleBorder: 'rgba(139, 92, 246, 0.25)',
    accent: '#a78bfa',
    glow: 'rgba(139, 92, 246, 0.2)',
  },
  // User bubble - subtle cyan
  user: {
    bubble: 'rgba(6, 182, 212, 0.15)',
    bubbleBorder: 'rgba(6, 182, 212, 0.25)',
    accent: '#22d3ee',
    glow: 'rgba(6, 182, 212, 0.2)',
  },
  // Semantic colors
  semantic: {
    success: '#34d399',
    warning: '#fbbf24',
    error: '#fb7185',
    info: '#60a5fa',
  },
  // Sleep stage colors
  sleep: {
    deep: '#1e40af',
    rem: '#7c3aed',
    light: '#475569',
    awake: '#dc2626',
  },
  // Data visualization
  data: {
    cyan: '#06b6d4',
    violet: '#8b5cf6',
    coral: '#f43f5e',
    emerald: '#10b981',
    amber: '#f59e0b',
  },
  // Borders and dividers
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    muted: 'rgba(255, 255, 255, 0.1)',
    default: 'rgba(255, 255, 255, 0.15)',
  },
} as const;

// Spacing Scale - 8px grid
export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
} as const;

// Border Radius
export const radii = {
  none: '0',
  sm: '0.375rem',   // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  full: '9999px',
} as const;

// Shadows - subtle glows for dark mode
export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 4px 6px rgba(0, 0, 0, 0.4)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.5)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.6)',
  glow: {
    cyan: '0 0 20px rgba(6, 182, 212, 0.3)',
    violet: '0 0 20px rgba(139, 92, 246, 0.3)',
    emerald: '0 0 20px rgba(52, 211, 153, 0.3)',
  },
} as const;

// Z-index scale
export const zIndex = {
  hide: -1,
  base: 0,
  raised: 1,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  popover: 50,
  toast: 60,
} as const;

// Breakpoints
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;
