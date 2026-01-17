/**
 * Netlify Function: Chat Health Check
 * ====================================
 * Simple health check endpoint for the chat service.
 */

import type { Handler } from '@netlify/functions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  return {
    statusCode: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'ok',
      service: 'vaulthealth-chat',
      timestamp: new Date().toISOString(),
      hasApiKey,
    }),
  };
};
