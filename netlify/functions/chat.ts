/**
 * Netlify Function: Chat API
 * ==========================
 * Serverless endpoint for Claude-powered health chat.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface HealthContext {
  summary: {
    totalNights: number;
    dateRange: { start: string; end: string };
    avgSleepHours: number;
    avgQuality: number;
    avgHRV: number | null;
    avgRestingHR: number | null;
  };
  recentNights: Array<{
    date: string;
    sleepHours: number;
    deepPercent: number;
    remPercent: number;
    efficiency: number | null;
    restingHR: number | null;
    hrv: number | null;
  }>;
  recentWorkouts: Array<{
    date: string;
    type: string;
    durationMinutes: number;
    calories: number | null;
    avgHR: number | null;
  }>;
  insights: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  trends: {
    sleepTrending: 'improving' | 'declining' | 'stable';
    qualityTrending: 'improving' | 'declining' | 'stable';
  };
}

interface ChatRequest {
  messages: ChatMessage[];
  healthContext: HealthContext;
  stream?: boolean;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function buildSystemPrompt(context: HealthContext): string {
  const contextJson = JSON.stringify(context, null, 2);

  return `You are a personal health data analyst for VaultHealth - a sleep and fitness tracking application. Your role is to help users understand their health data and provide actionable insights.

## CRITICAL RULES - YOU MUST FOLLOW THESE:

1. **ONLY reference data provided in the context below** - Never make up statistics or data points
2. **NEVER hallucinate** - If you don't have data for something, say "I don't have data for that"
3. **Always cite your sources** - Reference specific dates, time ranges, or data points (e.g., "Based on your last 7 nights...", "Your Jan 15 session shows...")
4. **Be specific with numbers** - Use exact values from the data, not approximations
5. **Include disclaimer** - End substantive health advice with a brief note that this is informational, not medical advice

## YOUR CAPABILITIES:
- Analyze sleep patterns (duration, quality, stages, efficiency)
- Correlate workouts with sleep quality
- Identify trends and anomalies
- Provide evidence-based recommendations
- Answer questions about specific nights or time periods

## RESPONSE STYLE:
- Be conversational but precise
- Use bullet points for multiple data points
- Highlight key insights with context
- Be encouraging but honest about areas for improvement

## USER'S HEALTH DATA CONTEXT:
\`\`\`json
${contextJson}
\`\`\`

Remember: The user trusts you with their personal health data. Be accurate, helpful, and grounded in the data provided.`;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'API key not configured' }),
    };
  }

  try {
    const body: ChatRequest = JSON.parse(event.body || '{}');
    const { messages, healthContext, stream = false } = body;

    if (!messages || !healthContext) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing messages or healthContext' }),
      };
    }

    const anthropic = new Anthropic({ apiKey });
    const systemPrompt = buildSystemPrompt(healthContext);

    // For streaming, we'll use non-streaming in standard functions
    // (Netlify Edge Functions would be needed for true streaming)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textBlock = response.content.find(block => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    // Return SSE format for compatibility with existing frontend
    if (stream) {
      const sseData = [
        `data: ${JSON.stringify({ text: responseText })}\n\n`,
        `data: ${JSON.stringify({ done: true })}\n\n`,
      ].join('');

      return {
        statusCode: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: sseData,
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ response: responseText }),
    };
  } catch (error) {
    console.error('Chat function error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
    };
  }
};
