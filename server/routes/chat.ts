/**
 * Chat API Routes
 * ================
 * Handles chat requests and streams responses from Claude.
 */

import { Router, Request, Response } from 'express';
import { streamChatResponse, getChatResponse, ChatMessage, HealthContext } from '../services/claude.js';

const router = Router();

interface ChatRequest {
  messages: ChatMessage[];
  healthContext: HealthContext;
  stream?: boolean;
}

/**
 * POST /api/chat
 * Stream or return a chat response
 */
router.post('/', async (req: Request<object, unknown, ChatRequest>, res: Response) => {
  try {
    const { messages, healthContext, stream = true } = req.body;

    // Validate request
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    if (!healthContext) {
      res.status(400).json({ error: 'Health context is required' });
      return;
    }

    if (stream) {
      // Set up Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      try {
        for await (const chunk of streamChatResponse(messages, healthContext)) {
          // Send each chunk as an SSE event
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        }
        // Signal completion
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch (streamError) {
        console.error('Stream error:', streamError);
        res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response
      const response = await getChatResponse(messages, healthContext);
      res.json({ response });
    }
  } catch (error) {
    console.error('Chat error:', error);

    // Check for specific Anthropic errors
    if (error instanceof Error) {
      if (error.message.includes('api_key')) {
        res.status(401).json({ error: 'Invalid API key configuration' });
        return;
      }
      if (error.message.includes('rate_limit')) {
        res.status(429).json({ error: 'Rate limit exceeded. Please try again in a moment.' });
        return;
      }
    }

    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

/**
 * GET /api/chat/health
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'vaulthealth-chat',
    timestamp: new Date().toISOString(),
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
  });
});

export default router;
