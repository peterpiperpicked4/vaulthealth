/**
 * ConversationalHome Component
 * =============================
 * The main AI-first conversational interface.
 * Chat IS the home page - no dashboard, land directly on conversation.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatInput } from './chat/ChatInput';
import { ProactiveGreeting } from './chat/ProactiveGreeting';
import { QuickAccessBar } from './QuickAccessBar';
import { OverlayPanel, ImportPanel, SettingsPanel } from './panels';
import { buildHealthContext } from '../chat/contextBuilder';
import { streamChat, checkServerHealth, generateMessageId } from '../chat/chatService';
import type { ChatMessage, HealthContext } from '../chat/types';

export function ConversationalHome() {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [healthContext, setHealthContext] = useState<HealthContext | null>(null);
  const [serverStatus, setServerStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGreeting, setShowGreeting] = useState(true);
  const [greetingComplete, setGreetingComplete] = useState(false);

  // Panel states
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Initialize on mount
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
        console.error('Failed to initialize:', err);
        setServerStatus('offline');
      }
    }

    initialize();

    // Load saved messages
    const saved = localStorage.getItem('vaulthealth_chat_messages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
          setMessages(parsed);
          setShowGreeting(false);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('vaulthealth_chat_messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Handle sending a message
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !healthContext || isLoading) return;

    setError(null);
    setShowGreeting(false);

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
      setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
    } finally {
      setIsLoading(false);
    }
  }, [healthContext, isLoading, messages]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setMessages([]);
    setShowGreeting(true);
    setGreetingComplete(false);
    localStorage.removeItem('vaulthealth_chat_messages');
  }, []);

  // Handle import complete
  const handleImportComplete = useCallback(async () => {
    // Refresh health context
    const context = await buildHealthContext();
    setHealthContext(context);
    setShowGreeting(true);
    setGreetingComplete(false);
  }, []);

  return (
    <div className="chat-canvas bg-black">
      {/* Quick Access Bar */}
      <QuickAccessBar
        onSettingsClick={() => setSettingsOpen(true)}
        onImportClick={() => setImportOpen(true)}
        onClearClick={clearConversation}
        showClear={messages.length > 0}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Messages or Welcome */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <AnimatePresence mode="popLayout">
              {/* Show proactive greeting or welcome */}
              {showGreeting && healthContext && (
                <ProactiveGreeting
                  key="greeting"
                  onGreetingComplete={() => setGreetingComplete(true)}
                />
              )}

              {/* Show starter questions after greeting completes */}
              {showGreeting && greetingComplete && healthContext && (
                <motion.div
                  key="starters"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-wrap justify-center gap-2 mt-6"
                >
                  {[
                    "How does my sleep compare to my average?",
                    "What affects my deep sleep?",
                    "Show my weekly trends",
                    "Any recommendations?",
                  ].map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(question)}
                      disabled={isLoading || serverStatus !== 'online'}
                      className="starter-question-btn"
                    >
                      {question}
                    </button>
                  ))}
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
                    <motion.div
                      className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    <p className="text-zinc-500 text-sm">Loading your health data...</p>
                  </div>
                </motion.div>
              )}

              {/* Messages */}
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'message-bubble-user rounded-br-md'
                        : 'message-bubble-ai rounded-bl-md'
                    }`}
                  >
                    <div className={`text-xs mb-1.5 font-medium ${
                      message.role === 'user' ? 'text-cyan-400' : 'text-violet-400'
                    }`}>
                      {message.role === 'user' ? 'You' : 'VaultHealth AI'}
                    </div>
                    <div className="text-body-md text-white leading-relaxed">
                      {message.content || (
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
                      )}
                    </div>
                    {message.isStreaming && message.content && (
                      <motion.span
                        className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 align-text-bottom"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      />
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Error message */}
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-4 bg-coral-500/10 border border-coral-500/20 rounded-xl text-center"
                >
                  <p className="text-coral-400 text-sm">{error}</p>
                  {serverStatus === 'offline' && (
                    <p className="text-zinc-500 text-xs mt-2">
                      Server appears to be offline. Check your connection.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-white/5 bg-black/50 backdrop-blur-sm p-4">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              onSend={sendMessage}
              disabled={isLoading}
              serverStatus={serverStatus}
            />
            <p className="text-xs text-zinc-600 mt-2 text-center">
              Powered by Claude AI. Your data stays local. Not medical advice.
            </p>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <OverlayPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Settings"
      >
        <SettingsPanel onClose={() => setSettingsOpen(false)} />
      </OverlayPanel>

      {/* Import Panel */}
      <OverlayPanel
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Data"
      >
        <ImportPanel onImportComplete={handleImportComplete} />
      </OverlayPanel>
    </div>
  );
}
