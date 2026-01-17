/**
 * VaultHealth Backend Server
 * ==========================
 * Proxy server for Claude API chat functionality.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRouter from './routes/chat.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' })); // Limit request size

// Routes
app.use('/api/chat', chatRouter);

// Root health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'vaulthealth-server',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║     VaultHealth Server                     ║
╠════════════════════════════════════════════╣
║  Status:  Running                          ║
║  Port:    ${PORT}                             ║
║  API Key: ${process.env.ANTHROPIC_API_KEY ? 'Configured ✓' : 'Missing ✗'}                   ║
╚════════════════════════════════════════════╝
  `);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  Warning: ANTHROPIC_API_KEY not set. Chat will not work.');
    console.warn('   Create a .env file with: ANTHROPIC_API_KEY=your-key-here');
  }
});
