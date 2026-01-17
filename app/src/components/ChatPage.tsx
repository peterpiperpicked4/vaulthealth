/**
 * ChatPage - AI Health Assistant
 * ================================
 * The primary interface for users to "speak to their data" using Claude.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { buildHealthContext } from '../chat/contextBuilder';
import { streamChat, checkServerHealth, generateMessageId } from '../chat/chatService';
import type { ChatMessage, HealthContext } from '../chat/types';

// Suggested starter questions
const STARTER_QUESTIONS = [
  "How was my sleep last night?",
  "What's my sleep trend this week?",
  "How do my workouts affect my sleep?",
  "What can I do to improve my deep sleep?",
  "Compare my weekday vs weekend sleep",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [healthContext, setHealthContext] = useState<HealthContext | null>(null);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load health context and check server on mount
  useEffect(() => {
    async function initialize() {
      try {
        // Check server health
        const isOnline = await checkServerHealth();
        setServerStatus(isOnline ? 'online' : 'offline');

        // Load health context
        const context = await buildHealthContext();
        setHealthContext(context);
      } catch (err) {
        console.error('Failed to initialize chat:', err);
        setError('Failed to load your health data');
      }
    }

    initialize();

    // Load saved messages from localStorage
    const saved = localStorage.getItem('vaulthealth_chat_messages');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('vaulthealth_chat_messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending a message
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !healthContext || isLoading) return;

    setError(null);
    setInput('');

    // Add user message
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Create placeholder for assistant response
    const assistantMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(true);

    try {
      // Stream the response
      const allMessages = [...messages, userMessage];
      let fullContent = '';

      for await (const chunk of streamChat(allMessages, healthContext)) {
        if (chunk.error) {
          throw new Error(chunk.error);
        }

        if (chunk.text) {
          fullContent += chunk.text;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMessage.id
                ? { ...m, content: fullContent }
                : m
            )
          );
        }

        if (chunk.done) {
          break;
        }
      }

      // Mark streaming as complete
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessage.id
            ? { ...m, isStreaming: false }
            : m
        )
      );
    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get response');

      // Remove the empty assistant message on error
      setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
    } finally {
      setIsLoading(false);
    }
  }, [healthContext, isLoading, messages]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Clear conversation
  const clearConversation = () => {
    setMessages([]);
    localStorage.removeItem('vaulthealth_chat_messages');
  };

  return (
    <div className="min-h-screen flex flex-col bg-void-950">
      {/* Header */}
      <header className="border-b border-void-700/50 bg-void-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-zinc-500 hover:text-white transition-colors">
              ← Dashboard
            </Link>
            <div className="h-4 w-px bg-void-700" />
            <h1 className="font-semibold text-white tracking-tight flex items-center gap-2">
              Health Assistant
              <span className="text-xs font-normal px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded-full">
                AI
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Server status indicator */}
            <div className="flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${
                serverStatus === 'online' ? 'bg-emerald-400' :
                serverStatus === 'offline' ? 'bg-coral-400' :
                'bg-amber-400 animate-pulse'
              }`} />
              <span className="text-zinc-500 hidden sm:inline">
                {serverStatus === 'online' ? 'Connected' :
                 serverStatus === 'offline' ? 'Server offline' :
                 'Connecting...'}
              </span>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearConversation}
                className="btn-ghost px-2 py-1 text-xs text-zinc-500 hover:text-coral-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Messages container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Welcome message when empty */}
          {messages.length === 0 && healthContext && (
            <div className="py-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 mb-6">
                <span className="text-3xl">🧠</span>
              </div>
              <h2 className="text-2xl font-semibold text-white mb-3">
                Ask me about your health data
              </h2>
              <p className="text-zinc-500 max-w-md mx-auto mb-8">
                I have access to {healthContext.summary.totalNights} nights of sleep data
                and can help you understand patterns, trends, and insights.
              </p>

              {/* Starter questions */}
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                {STARTER_QUESTIONS.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(question)}
                    disabled={isLoading || serverStatus !== 'online'}
                    className="px-3 py-2 text-sm bg-void-800 hover:bg-void-700 text-zinc-400 hover:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {question}
                  </button>
                ))}
              </div>

              {/* Data summary */}
              <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                <div className="data-panel p-3 text-center">
                  <div className="text-xl font-mono text-cyan-400">{healthContext.summary.totalNights}</div>
                  <div className="text-xs text-zinc-600">Nights tracked</div>
                </div>
                <div className="data-panel p-3 text-center">
                  <div className="text-xl font-mono text-cyan-400">{healthContext.summary.avgSleepHours}h</div>
                  <div className="text-xs text-zinc-600">Avg sleep</div>
                </div>
                <div className="data-panel p-3 text-center">
                  <div className="text-xl font-mono text-violet-400">{healthContext.summary.avgQuality}%</div>
                  <div className="text-xs text-zinc-600">Avg quality</div>
                </div>
                <div className="data-panel p-3 text-center">
                  <div className="text-xl font-mono text-emerald-400">{healthContext.insights.length}</div>
                  <div className="text-xs text-zinc-600">Active insights</div>
                </div>
              </div>
            </div>
          )}

          {/* Loading health context */}
          {!healthContext && (
            <div className="py-12 text-center">
              <div className="animate-pulse">
                <div className="h-16 w-16 rounded-full bg-void-800 mx-auto mb-6" />
                <div className="h-6 w-48 bg-void-800 rounded mx-auto mb-3" />
                <div className="h-4 w-64 bg-void-800 rounded mx-auto" />
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {/* Error message */}
          {error && (
            <div className="p-4 bg-coral-500/10 border border-coral-500/20 rounded-lg text-coral-400 text-sm">
              <strong>Error:</strong> {error}
              {serverStatus === 'offline' && (
                <p className="mt-2 text-zinc-500">
                  Make sure the backend server is running: <code className="text-xs bg-void-800 px-1 py-0.5 rounded">cd server && npm run dev</code>
                </p>
              )}
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-void-700/50 bg-void-900/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  serverStatus === 'offline'
                    ? 'Server offline - start with: cd server && npm run dev'
                    : 'Ask about your sleep, workouts, or health trends...'
                }
                disabled={isLoading || serverStatus !== 'online'}
                className="w-full bg-void-800 border border-void-600 rounded-xl px-4 py-3 pr-24 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '200px' }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading || serverStatus !== 'online'}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-void-700 disabled:text-zinc-600 text-void-950 font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-void-600 border-t-cyan-400 rounded-full animate-spin" />
                  </span>
                ) : (
                  'Send'
                )}
              </button>
            </div>
            <p className="text-xs text-zinc-600 mt-2 text-center">
              Powered by Claude • Your data stays local • Not medical advice
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

/**
 * Message bubble component
 */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-cyan-500/20 text-white rounded-br-md'
            : 'bg-void-800 text-zinc-300 rounded-bl-md'
        }`}
      >
        {/* Role indicator */}
        <div className={`text-xs mb-1 ${isUser ? 'text-cyan-400' : 'text-violet-400'}`}>
          {isUser ? 'You' : 'Health Assistant'}
        </div>

        {/* Message content */}
        <div className="prose prose-invert prose-sm max-w-none">
          {message.content || (
            <span className="flex items-center gap-2 text-zinc-500">
              <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
              <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
            </span>
          )}
        </div>

        {/* Streaming indicator */}
        {message.isStreaming && message.content && (
          <span className="inline-block w-2 h-4 bg-violet-400 ml-1 animate-pulse" />
        )}
      </div>
    </div>
  );
}
