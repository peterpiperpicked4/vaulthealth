/**
 * OverlayPanel Component
 * =======================
 * Slide-out panel for settings and import.
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { panelSlideVariants, backdropVariants } from '../../design-system/motion';
import { IconButton, CloseIcon } from '../../design-system/primitives';

interface OverlayPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function OverlayPanel({
  isOpen,
  onClose,
  title,
  children,
}: OverlayPanelProps) {
  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="overlay-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="overlay-panel"
            variants={panelSlideVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h2 id="panel-title" className="text-lg font-semibold text-white">
                {title}
              </h2>
              <IconButton
                icon={<CloseIcon size={20} />}
                label="Close panel"
                variant="ghost"
                size="md"
                onClick={onClose}
              />
            </div>

            {/* Content */}
            <div className="overflow-y-auto h-[calc(100vh-64px)] p-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
