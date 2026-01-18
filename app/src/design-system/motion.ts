/**
 * Motion Presets
 * ===============
 * Framer Motion animation presets for premium micro-interactions.
 * Inspired by Apple's fluid animations.
 */

import type { Transition, Variants, TargetAndTransition } from 'framer-motion';

// Easing curves
export const easing = {
  // Apple's default easing - smooth and natural
  default: [0.25, 0.1, 0.25, 1],
  // Ease out for elements entering
  easeOut: [0, 0, 0.2, 1],
  // Ease in for elements leaving
  easeIn: [0.4, 0, 1, 1],
  // Ease in-out for transformations
  easeInOut: [0.4, 0, 0.2, 1],
  // Spring-like for playful interactions
  spring: [0.175, 0.885, 0.32, 1.275],
} as const;

// Duration presets (in seconds)
export const duration = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
  slower: 0.6,
} as const;

// Spring configurations
export const spring = {
  // Quick, snappy response
  snappy: { type: 'spring', stiffness: 400, damping: 30 } as Transition,
  // Smooth, gentle motion
  gentle: { type: 'spring', stiffness: 200, damping: 25 } as Transition,
  // Bouncy, playful feel
  bouncy: { type: 'spring', stiffness: 300, damping: 15 } as Transition,
  // Very soft landing
  soft: { type: 'spring', stiffness: 150, damping: 20 } as Transition,
} as const;

// Common transitions
export const transitions = {
  default: { duration: duration.normal, ease: easing.default } as Transition,
  fast: { duration: duration.fast, ease: easing.easeOut } as Transition,
  slow: { duration: duration.slow, ease: easing.easeInOut } as Transition,
} as const;

// Message bubble animation variants
export const messageBubbleVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: duration.fast,
    },
  },
};

// Fade in animation variants
export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitions.default,
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.fast },
  },
};

// Slide up animation variants
export const slideUpVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 16,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: duration.fast },
  },
};

// Scale animation variants
export const scaleVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: spring.snappy,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: duration.fast },
  },
};

// Panel slide animation (for overlays)
export const panelSlideVariants: Variants = {
  hidden: {
    x: '100%',
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: {
      duration: duration.normal,
      ease: easing.easeIn,
    },
  },
};

// Backdrop animation
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.normal },
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.fast },
  },
};

// Chart/visualization reveal
export const chartRevealVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.98,
    y: 8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 25,
      delay: 0.1,
    },
  },
};

// Stagger children container
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

// Stagger item
export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: spring.gentle,
  },
};

// Typing indicator dots
export const typingDotVariants: Variants = {
  initial: { y: 0 },
  animate: {
    y: [-2, 2, -2],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Pulse glow effect
export const pulseGlowVariants: Variants = {
  initial: { opacity: 0.5, scale: 1 },
  animate: {
    opacity: [0.5, 0.8, 0.5],
    scale: [1, 1.02, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Button press animation
export const buttonPressAnimation: TargetAndTransition = {
  scale: 0.98,
  transition: { duration: duration.instant },
};

// Hover glow animation
export const hoverGlowAnimation: TargetAndTransition = {
  boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)',
  transition: { duration: duration.fast },
};

// Input focus animation
export const inputFocusVariants: Variants = {
  unfocused: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  focused: {
    borderColor: 'rgba(6, 182, 212, 0.5)',
    boxShadow: '0 0 0 2px rgba(6, 182, 212, 0.1)',
    transition: { duration: duration.fast },
  },
};

// Sparkline draw animation
export const sparklineDrawVariants: Variants = {
  hidden: {
    pathLength: 0,
    opacity: 0,
  },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: {
        duration: duration.slow,
        ease: easing.easeOut,
      },
      opacity: {
        duration: duration.fast,
      },
    },
  },
};

// Number counter animation helper
export function createCounterAnimation(from: number, to: number, duration: number = 0.5) {
  return {
    initial: { value: from },
    animate: {
      value: to,
      transition: { duration, ease: easing.easeOut },
    },
  };
}
