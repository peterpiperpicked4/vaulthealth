/**
 * ChatInput Component
 * ====================
 * Premium input bar with auto-resize and animations.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SendIcon } from '../../design-system/primitives';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  serverStatus?: 'online' | 'offline' | 'connecting';
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Ask about your sleep, workouts, or health trends...',
  serverStatus = 'online',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && !disabled && serverStatus === 'online') {
      onSend(trimmed);
      setValue('');
      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [value, disabled, serverStatus, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isDisabled = disabled || serverStatus !== 'online';
  const canSend = value.trim().length > 0 && !isDisabled;

  return (
    <div className="relative">
      <motion.div
        className="relative"
        animate={{
          boxShadow: isFocused
            ? '0 0 0 3px rgba(6, 182, 212, 0.1)'
            : '0 0 0 0px transparent',
        }}
        style={{ borderRadius: '1rem' }}
        transition={{ duration: 0.2 }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={
            serverStatus === 'offline'
              ? 'Server offline - check connection...'
              : serverStatus === 'connecting'
              ? 'Connecting...'
              : placeholder
          }
          disabled={isDisabled}
          className={`
            w-full bg-void-700 border rounded-2xl px-4 py-3 pr-14
            text-white text-body-md placeholder-zinc-600
            focus:outline-none resize-none
            transition-colors duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${isFocused ? 'border-cyan-500/50' : 'border-void-600'}
          `}
          rows={1}
          style={{ minHeight: '52px', maxHeight: '200px' }}
        />

        {/* Send button */}
        <motion.button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          className={`
            absolute right-2 bottom-2 p-2.5 rounded-xl
            transition-all duration-200
            ${canSend
              ? 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-void-950 cursor-pointer'
              : 'bg-void-600 text-zinc-600 cursor-not-allowed'
            }
          `}
          whileHover={canSend ? { scale: 1.05 } : undefined}
          whileTap={canSend ? { scale: 0.95 } : undefined}
          aria-label="Send message"
        >
          <AnimatePresence mode="wait">
            {disabled ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0, rotate: 0 }}
                animate={{ opacity: 1, rotate: 360 }}
                exit={{ opacity: 0 }}
                transition={{ rotate: { duration: 1, repeat: Infinity, ease: 'linear' } }}
                className="block w-5 h-5 border-2 border-void-950 border-t-transparent rounded-full"
              />
            ) : (
              <motion.span
                key="send"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <SendIcon size={18} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      {/* Character count hint */}
      <AnimatePresence>
        {value.length > 500 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute right-2 -bottom-6 text-xs text-zinc-600"
          >
            {value.length} characters
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
