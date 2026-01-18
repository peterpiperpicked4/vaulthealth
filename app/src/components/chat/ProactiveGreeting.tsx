/**
 * ProactiveGreeting Component
 * ============================
 * AI greeting message that appears on app open.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildProactiveGreeting } from '../../chat/proactiveGreeting';
import { VisualizationRenderer } from '../visualizations/VisualizationRenderer';
import type { Visualization } from '../../chat/types';

interface ProactiveGreetingProps {
  onGreetingComplete?: () => void;
}

export function ProactiveGreeting({ onGreetingComplete }: ProactiveGreetingProps) {
  const [greeting, setGreeting] = useState<string>('');
  const [visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [displayedText, setDisplayedText] = useState('');

  // Load greeting on mount
  useEffect(() => {
    async function loadGreeting() {
      try {
        const result = await buildProactiveGreeting();
        setGreeting(result.greeting);
        setVisualizations(result.visualizations);
      } catch (error) {
        console.error('Failed to load greeting:', error);
        setGreeting('Hello! How can I help you understand your health data today?');
      } finally {
        setIsLoading(false);
      }
    }

    loadGreeting();
  }, []);

  // Typing animation effect
  useEffect(() => {
    if (isLoading || !greeting) return;

    let index = 0;
    const typingSpeed = 20; // ms per character

    const timer = setInterval(() => {
      if (index <= greeting.length) {
        setDisplayedText(greeting.slice(0, index));
        index++;
      } else {
        clearInterval(timer);
        onGreetingComplete?.();
      }
    }, typingSpeed);

    return () => clearInterval(timer);
  }, [greeting, isLoading, onGreetingComplete]);

  if (isLoading) {
    return (
      <motion.div
        className="flex justify-start"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="message-bubble-ai">
          <div className="text-xs text-violet-400 mb-1.5 font-medium">VaultHealth AI</div>
          <div className="typing-indicator py-1">
            <motion.span
              className="typing-dot"
              animate={{ y: [-2, 2, -2] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
            />
            <motion.span
              className="typing-dot"
              animate={{ y: [-2, 2, -2] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
            />
            <motion.span
              className="typing-dot"
              animate={{ y: [-2, 2, -2] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
            />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex justify-start"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="message-bubble-ai max-w-[85%] md:max-w-[75%]">
        <div className="text-xs text-violet-400 mb-1.5 font-medium">VaultHealth AI</div>

        {/* Greeting text with typing effect */}
        <div className="text-body-md text-white leading-relaxed">
          {displayedText}
          <AnimatePresence>
            {displayedText.length < greeting.length && (
              <motion.span
                className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 align-text-bottom"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                exit={{ opacity: 0 }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Visualizations appear after text finishes */}
        <AnimatePresence>
          {displayedText.length === greeting.length && visualizations.length > 0 && (
            <motion.div
              className="mt-3 space-y-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {visualizations.map((viz, idx) => (
                <VisualizationRenderer key={idx} visualization={viz} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
