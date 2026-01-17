/**
 * Chat Service
 * =============
 * Handles communication with the backend chat API.
 */

import type { ChatMessage, HealthContext, StreamChunk } from './types';

// Use relative URLs in production (Netlify), absolute for local dev
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : '');

/**
 * Send a chat request and stream the response
 */
export async function* streamChat(
  messages: ChatMessage[],
  healthContext: HealthContext
): AsyncGenerator<StreamChunk, void, unknown> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      healthContext,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // Keep incomplete message in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6)) as StreamChunk;
            yield data;

            if (data.done || data.error) {
              return;
            }
          } catch {
            // Ignore parse errors for malformed chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Send a chat request and get the full response (non-streaming)
 */
export async function sendChat(
  messages: ChatMessage[],
  healthContext: HealthContext
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      healthContext,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.response;
}

/**
 * Check if the backend server is available
 */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/health`, {
      method: 'GET',
    });
    const data = await response.json();
    return data.status === 'ok' && data.hasApiKey;
  } catch {
    return false;
  }
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
