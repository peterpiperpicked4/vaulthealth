/**
 * IconButton Primitive
 * =====================
 * Subtle icon buttons for quick actions.
 */

import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { colors, radii, spacing } from '../tokens';
import { buttonPressAnimation } from '../motion';

type IconButtonVariant = 'ghost' | 'subtle' | 'solid';
type IconButtonSize = 'sm' | 'md' | 'lg';
type IconButtonColor = 'default' | 'cyan' | 'violet' | 'coral' | 'emerald';

interface IconButtonProps {
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  color?: IconButtonColor;
  label: string;
  badge?: number | string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  onClick?: () => void;
}

const sizeMap: Record<IconButtonSize, { size: string; iconSize: string; padding: string }> = {
  sm: { size: '32px', iconSize: '16px', padding: spacing[2] },
  md: { size: '40px', iconSize: '20px', padding: spacing[2] },
  lg: { size: '48px', iconSize: '24px', padding: spacing[3] },
};

const colorMap: Record<IconButtonColor, { text: string; hover: string; active: string }> = {
  default: {
    text: colors.text.secondary,
    hover: colors.text.primary,
    active: colors.text.primary,
  },
  cyan: {
    text: colors.data.cyan,
    hover: '#22d3ee',
    active: colors.data.cyan,
  },
  violet: {
    text: colors.data.violet,
    hover: '#a78bfa',
    active: colors.data.violet,
  },
  coral: {
    text: colors.data.coral,
    hover: '#fb7185',
    active: colors.data.coral,
  },
  emerald: {
    text: colors.data.emerald,
    hover: '#34d399',
    active: colors.data.emerald,
  },
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      variant = 'ghost',
      size = 'md',
      color = 'default',
      label,
      badge,
      style,
      className = '',
      disabled,
      onClick,
    },
    ref
  ) {
    const sizeStyles = sizeMap[size];
    const colorStyles = colorMap[color];

    const variantStyles: Record<IconButtonVariant, CSSProperties> = {
      ghost: {
        backgroundColor: 'transparent',
        border: 'none',
      },
      subtle: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        border: 'none',
      },
      solid: {
        backgroundColor: colors.background.elevated,
        border: `1px solid ${colors.border.subtle}`,
      },
    };

    const baseStyles: CSSProperties = {
      ...variantStyles[variant],
      width: sizeStyles.size,
      height: sizeStyles.size,
      padding: sizeStyles.padding,
      borderRadius: radii.lg,
      color: colorStyles.text,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'all 0.15s ease',
      position: 'relative' as const,
      ...style,
    };

    return (
      <motion.button
        ref={ref}
        type="button"
        className={className}
        style={baseStyles as any}
        disabled={disabled}
        aria-label={label}
        onClick={onClick}
        whileHover={!disabled ? {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          color: colorStyles.hover,
        } : undefined}
        whileTap={!disabled ? buttonPressAnimation : undefined}
      >
        <span style={{
          width: sizeStyles.iconSize,
          height: sizeStyles.iconSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {icon}
        </span>

        {badge !== undefined && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              borderRadius: radii.full,
              backgroundColor: colors.data.coral,
              color: colors.text.primary,
              fontSize: '11px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {badge}
          </span>
        )}
      </motion.button>
    );
  }
);

// Common icon components using SVG
export function SettingsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function ImportIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function ClearIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function SendIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function CloseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function ChartIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export function MoonIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
