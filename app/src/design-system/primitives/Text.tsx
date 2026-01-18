/**
 * Text Primitive
 * ===============
 * Typography component with premium styling.
 */

import { forwardRef, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { typography, colors } from '../tokens';

type TextVariant = 'display-lg' | 'display-md' | 'display-sm' |
                   'body-lg' | 'body-md' | 'body-sm' |
                   'label-lg' | 'label-md' | 'label-sm';

type TextColor = 'primary' | 'secondary' | 'tertiary' | 'quaternary' |
                 'cyan' | 'violet' | 'coral' | 'emerald' | 'amber' |
                 'success' | 'warning' | 'error';

interface TextProps {
  variant?: TextVariant;
  color?: TextColor;
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div' | 'label';
  mono?: boolean;
  uppercase?: boolean;
  glow?: boolean;
  className?: string;
  style?: CSSProperties;
  children: React.ReactNode;
}

const variantStyles: Record<TextVariant, CSSProperties> = {
  'display-lg': typography.display.lg as CSSProperties,
  'display-md': typography.display.md as CSSProperties,
  'display-sm': typography.display.sm as CSSProperties,
  'body-lg': typography.body.lg as CSSProperties,
  'body-md': typography.body.md as CSSProperties,
  'body-sm': typography.body.sm as CSSProperties,
  'label-lg': typography.label.lg as CSSProperties,
  'label-md': typography.label.md as CSSProperties,
  'label-sm': typography.label.sm as CSSProperties,
};

const colorStyles: Record<TextColor, string> = {
  primary: colors.text.primary,
  secondary: colors.text.secondary,
  tertiary: colors.text.tertiary,
  quaternary: colors.text.quaternary,
  cyan: colors.data.cyan,
  violet: colors.data.violet,
  coral: colors.data.coral,
  emerald: colors.data.emerald,
  amber: colors.data.amber,
  success: colors.semantic.success,
  warning: colors.semantic.warning,
  error: colors.semantic.error,
};

export const Text = forwardRef<HTMLSpanElement, TextProps>(
  function Text(
    {
      variant = 'body-md',
      color = 'primary',
      as = 'span',
      mono = false,
      uppercase = false,
      glow = false,
      style,
      className = '',
      children,
    },
    ref
  ) {
    const Component = motion[as] as typeof motion.span;

    const baseStyles: CSSProperties = {
      ...variantStyles[variant],
      color: colorStyles[color],
      fontFamily: mono ? "'JetBrains Mono', monospace" : "'Inter', sans-serif",
      textTransform: uppercase ? 'uppercase' : undefined,
      textShadow: glow ? `0 0 20px ${colorStyles[color]}` : undefined,
      ...style,
    };

    return (
      <Component
        ref={ref}
        className={className}
        style={baseStyles as any}
      >
        {children}
      </Component>
    );
  }
);

// Convenience components
export function DisplayText({
  size = 'md',
  ...props
}: Omit<TextProps, 'variant'> & { size?: 'lg' | 'md' | 'sm' }) {
  return <Text variant={`display-${size}`} as="h1" {...props} />;
}

export function BodyText({
  size = 'md',
  ...props
}: Omit<TextProps, 'variant'> & { size?: 'lg' | 'md' | 'sm' }) {
  return <Text variant={`body-${size}`} as="p" {...props} />;
}

export function Label({
  size = 'md',
  ...props
}: Omit<TextProps, 'variant'> & { size?: 'lg' | 'md' | 'sm' }) {
  return <Text variant={`label-${size}`} as="span" uppercase {...props} />;
}

export function MetricText({
  children,
  color = 'cyan',
  ...props
}: Omit<TextProps, 'variant'>) {
  return (
    <Text variant="display-md" color={color} mono glow {...props}>
      {children}
    </Text>
  );
}
