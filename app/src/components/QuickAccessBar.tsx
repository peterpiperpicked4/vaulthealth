/**
 * QuickAccessBar Component
 * =========================
 * Subtle top-right icons for settings and import.
 */

import { motion } from 'framer-motion';
import { IconButton, SettingsIcon, ImportIcon, ClearIcon } from '../design-system/primitives';

interface QuickAccessBarProps {
  onSettingsClick: () => void;
  onImportClick: () => void;
  onClearClick?: () => void;
  showClear?: boolean;
}

export function QuickAccessBar({
  onSettingsClick,
  onImportClick,
  onClearClick,
  showClear = false,
}: QuickAccessBarProps) {
  return (
    <motion.div
      className="quick-access-bar"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      {/* Clear conversation button */}
      {showClear && onClearClick && (
        <IconButton
          icon={<ClearIcon size={18} />}
          label="Clear conversation"
          variant="ghost"
          size="md"
          color="coral"
          onClick={onClearClick}
        />
      )}

      {/* Import button */}
      <IconButton
        icon={<ImportIcon size={18} />}
        label="Import data"
        variant="ghost"
        size="md"
        color="default"
        onClick={onImportClick}
      />

      {/* Settings button */}
      <IconButton
        icon={<SettingsIcon size={18} />}
        label="Settings"
        variant="ghost"
        size="md"
        color="default"
        onClick={onSettingsClick}
      />
    </motion.div>
  );
}
