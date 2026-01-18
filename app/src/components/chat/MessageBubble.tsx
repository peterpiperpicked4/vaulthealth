/**
 * MessageBubble Component
 * ========================
 * Premium message bubbles with inline visualization support.
 */

import { motion } from 'framer-motion';
import { messageBubbleVariants } from '../../design-system/motion';
import type { ChatMessage } from '../../chat/types';
import { VisualizationRenderer } from '../visualizations/VisualizationRenderer';

interface MessageBubbleProps {
  message: ChatMessage;
  isLatest?: boolean;
}

export function MessageBubble({ message, isLatest: _isLatest = false }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming && !message.content;

  return (
    <motion.div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      variants={messageBubbleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
      <div
        className={`max-w-[85%] md:max-w-[75%] ${
          isUser
            ? 'message-bubble-user'
            : 'message-bubble-ai'
        }`}
      >
        {/* Role indicator */}
        <div className={`text-xs mb-1.5 font-medium ${
          isUser ? 'text-cyan-400' : 'text-violet-400'
        }`}>
          {isUser ? 'You' : 'VaultHealth AI'}
        </div>

        {/* Message content */}
        <div className="text-body-md text-white leading-relaxed">
          {isStreaming ? (
            <TypingIndicator />
          ) : (
            <MessageContent content={message.content} />
          )}
        </div>

        {/* Streaming cursor */}
        {message.isStreaming && message.content && (
          <motion.span
            className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 align-text-bottom"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        )}

        {/* Inline visualizations */}
        {message.visualizations && message.visualizations.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.visualizations.map((viz, idx) => (
              <VisualizationRenderer key={idx} visualization={viz} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Typing indicator dots animation
 */
function TypingIndicator() {
  return (
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
  );
}

/**
 * Renders message content with basic markdown support
 */
function MessageContent({ content }: { content: string }) {
  // Simple markdown-like parsing for bold and line breaks
  const parts = content.split(/(\*\*.*?\*\*|\n)/g);

  return (
    <>
      {parts.map((part, idx) => {
        if (part === '\n') {
          return <br key={idx} />;
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={idx} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}
