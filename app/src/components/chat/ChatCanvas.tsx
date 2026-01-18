/**
 * ChatCanvas Component
 * =====================
 * Scrollable message container with smooth animations.
 */

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage, HealthContext } from '../../chat/types';

interface ChatCanvasProps {
  messages: ChatMessage[];
  healthContext: HealthContext | null;
  isLoading: boolean;
  onStarterClick?: (question: string) => void;
  serverStatus?: 'online' | 'offline' | 'connecting';
}

// Starter questions
const STARTER_QUESTIONS = [
  "How was my sleep last night?",
  "What's my sleep trend this week?",
  "How do my workouts affect my sleep?",
  "What can I do to improve my deep sleep?",
];

export function ChatCanvas({
  messages,
  healthContext,
  isLoading,
  onStarterClick,
  serverStatus = 'online',
}: ChatCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const showWelcome = messages.length === 0 && healthContext;

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-6"
    >
      <div className="max-w-3xl mx-auto space-y-4">
        <AnimatePresence mode="popLayout">
          {/* Welcome state with starter questions */}
          {showWelcome && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center py-12"
            >
              {/* Status indicator */}
              <div className="flex justify-center items-center gap-2 mb-8">
                <span className={`status-dot ${
                  serverStatus === 'online' ? 'status-dot-online' :
                  serverStatus === 'offline' ? 'status-dot-offline' :
                  'status-dot-connecting'
                }`} />
                <span className="text-xs text-zinc-500">
                  {serverStatus === 'online' ? 'AI Ready' :
                   serverStatus === 'offline' ? 'Offline' : 'Connecting...'}
                </span>
              </div>

              {/* Welcome message */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-8"
              >
                <h2 className="text-display-sm text-white mb-3">
                  Ask me about your health data
                </h2>
                <p className="text-body-md text-zinc-500 max-w-md mx-auto">
                  I have access to {healthContext.summary.totalNights} nights of sleep data
                  and can help you understand patterns and insights.
                </p>
              </motion.div>

              {/* Data summary cards */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-xl mx-auto mb-10"
              >
                <SummaryCard
                  label="Nights"
                  value={healthContext.summary.totalNights.toString()}
                  color="cyan"
                />
                <SummaryCard
                  label="Avg Sleep"
                  value={`${healthContext.summary.avgSleepHours}h`}
                  color="cyan"
                />
                <SummaryCard
                  label="Quality"
                  value={`${healthContext.summary.avgQuality}%`}
                  color="violet"
                />
                <SummaryCard
                  label="Insights"
                  value={healthContext.insights.length.toString()}
                  color="emerald"
                />
              </motion.div>

              {/* Starter questions */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="starter-questions"
              >
                {STARTER_QUESTIONS.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => onStarterClick?.(question)}
                    disabled={isLoading || serverStatus !== 'online'}
                    className="starter-question-btn"
                  >
                    {question}
                  </button>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Loading health context */}
          {!healthContext && (
            <motion.div
              key="loading-context"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20"
            >
              <div className="inline-flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                <p className="text-zinc-500 text-sm">Loading your health data...</p>
              </div>
            </motion.div>
          )}

          {/* Messages */}
          {messages.map((message, idx) => (
            <MessageBubble
              key={message.id}
              message={message}
              isLatest={idx === messages.length - 1}
            />
          ))}
        </AnimatePresence>

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

/**
 * Summary card for welcome screen
 */
function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'cyan' | 'violet' | 'emerald' | 'coral';
}) {
  const colorClasses = {
    cyan: 'text-cyan-400',
    violet: 'text-violet-400',
    emerald: 'text-emerald-400',
    coral: 'text-coral-400',
  };

  return (
    <div className="metric-inline">
      <div>
        <div className={`text-lg font-mono font-semibold ${colorClasses[color]}`}>
          {value}
        </div>
        <div className="text-xs text-zinc-600 uppercase tracking-wider">
          {label}
        </div>
      </div>
    </div>
  );
}
