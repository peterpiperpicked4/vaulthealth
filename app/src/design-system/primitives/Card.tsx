/**
 * Card Primitive
 * ===============
 * Container component with premium styling and animations.
 */

import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { colors, radii, spacing } from '../tokens';
import { fadeInVariants } from '../motion';

type CardVariant = 'default' | 'elevated' | 'outlined' | 'ghost' | 'ai' | 'user';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  glow?: 'cyan' | 'violet' | 'emerald' | 'coral' | 'none';
  animate?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const paddingMap: Record<CardPadding, string> = {
  none: '0',
  sm: spacing[3],
  md: spacing[4],
  lg: spacing[6],
};

const variantStyles: Record<CardVariant, CSSProperties> = {
  default: {
    backgroundColor: colors.background.elevated,
    border: `1px solid ${colors.border.subtle}`,
  },
  elevated: {
    backgroundColor: colors.background.tertiary,
    border: `1px solid ${colors.border.muted}`,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
  },
  outlined: {
    backgroundColor: 'transparent',
    border: `1px solid ${colors.border.default}`,
  },
  ghost: {
    backgroundColor: 'transparent',
    border: 'none',
  },
  ai: {
    backgroundColor: colors.ai.bubble,
    border: `1px solid ${colors.ai.bubbleBorder}`,
  },
  user: {
    backgroundColor: colors.user.bubble,
    border: `1px solid ${colors.user.bubbleBorder}`,
  },
};

const glowStyles: Record<Exclude<CardProps['glow'], undefined>, string> = {
  cyan: `0 0 20px rgba(6, 182, 212, 0.15)`,
  violet: `0 0 20px rgba(139, 92, 246, 0.15)`,
  emerald: `0 0 20px rgba(52, 211, 153, 0.15)`,
  coral: `0 0 20px rgba(244, 63, 94, 0.15)`,
  none: 'none',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  function Card(
    {
      variant = 'default',
      padding = 'md',
      interactive = false,
      glow = 'none',
      animate = true,
      style,
      className = '',
      children,
    },
    ref
  ) {
    const baseStyles: CSSProperties = {
      ...variantStyles[variant],
      padding: paddingMap[padding],
      borderRadius: radii.lg,
      boxShadow: glow !== 'none'
        ? glowStyles[glow]
        : variantStyles[variant].boxShadow,
      cursor: interactive ? 'pointer' : undefined,
      transition: 'all 0.2s ease',
      ...style,
    };

    const interactiveProps = interactive
      ? {
          whileHover: {
            scale: 1.01,
            borderColor: colors.border.default,
          },
          whileTap: { scale: 0.99 },
        }
      : {};

    return (
      <motion.div
        ref={ref}
        className={className}
        style={baseStyles as any}
        variants={animate ? fadeInVariants : undefined}
        initial={animate ? 'hidden' : undefined}
        animate={animate ? 'visible' : undefined}
        {...interactiveProps}
      >
        {children}
      </motion.div>
    );
  }
);

// Message bubble specialized card
export interface MessageBubbleProps extends Omit<CardProps, 'variant'> {
  role: 'user' | 'assistant';
}

export const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(
  function MessageBubble({ role, style, ...props }, ref) {
    const bubbleStyles: CSSProperties = {
      ...style,
      borderRadius: role === 'user'
        ? `${radii.xl} ${radii.xl} ${radii.sm} ${radii.xl}`
        : `${radii.xl} ${radii.xl} ${radii.xl} ${radii.sm}`,
      maxWidth: '85%',
    };

    return (
      <Card
        ref={ref}
        variant={role === 'user' ? 'user' : 'ai'}
        padding="md"
        glow={role === 'user' ? 'cyan' : 'violet'}
        style={bubbleStyles}
        {...props}
      />
    );
  }
);

// Inline visualization card
export const VisualizationCard = forwardRef<HTMLDivElement, CardProps>(
  function VisualizationCard({ style, ...props }, ref) {
    return (
      <Card
        ref={ref}
        variant="outlined"
        padding="sm"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(8px)',
          ...style,
        }}
        {...props}
      />
    );
  }
);
