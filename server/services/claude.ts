/**
 * Claude API Service
 * ==================
 * Wraps the Anthropic SDK for streaming chat completions.
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface HealthContext {
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

/**
 * Build the system prompt with user's health context
 */
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

/**
 * Stream a chat response from Claude
 */
export async function* streamChatResponse(
  messages: ChatMessage[],
  healthContext: HealthContext
): AsyncGenerator<string, void, unknown> {
  const systemPrompt = buildSystemPrompt(healthContext);

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514', // Using Sonnet for faster responses; can upgrade to Opus
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

/**
 * Non-streaming version for simpler use cases
 */
export async function getChatResponse(
  messages: ChatMessage[],
  healthContext: HealthContext
): Promise<string> {
  const systemPrompt = buildSystemPrompt(healthContext);

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
  return textBlock?.type === 'text' ? textBlock.text : '';
}
