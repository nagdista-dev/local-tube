import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import videosRouter from './routes/videos';
import streamRouter from './routes/stream';
import scanRouter   from './routes/scan';
import settingsRouter from './routes/settings';
import { scanLibrary } from './services/scanner';
import { getLibraryLocation } from './services/libraryConfig';

// ─── Config ────────────────────────────────────────────────────────────────

const PORT        = parseInt(process.env.PORT || '3001', 10);
const THUMBNAILS  = path.join(__dirname, '../../thumbnails');
const AUTO_SCAN   = process.env.AUTO_SCAN !== 'false'; // default true

// Ensure required directories exist
[THUMBNAILS, path.join(__dirname, '../../cache')].forEach(d =>
  fs.mkdirSync(d, { recursive: true })
);

// ─── App ───────────────────────────────────────────────────────────────────

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

app.use(express.json({ limit: '1mb' }));

// Serve generated thumbnails
app.use('/thumbnails', express.static(THUMBNAILS, {
  maxAge: '7d',
  etag: true,
}));

// ─── Routes ────────────────────────────────────────────────────────────────

app.use('/api/videos', videosRouter);
app.use('/api/stream', streamRouter);
app.use('/api/scan',   scanRouter);
app.use('/api/settings', settingsRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    status:     'ok',
    videosDir:  getLibraryLocation(),
    timestamp:  new Date().toISOString(),
  });
});

// 404 handler for unknown API routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('🎬 ─────────────────────────────────────');
  console.log(`   LocalTube Server v1.0`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Videos: ${getLibraryLocation()}`);
  console.log('─────────────────────────────────────────');
  console.log('');

  if (AUTO_SCAN) {
    console.log('[Auto-Scan] Initiating library scan...');
    scanLibrary(getLibraryLocation()).catch(err =>
      console.error('[Auto-Scan] Failed:', err.message)
    );
  }
});

export default app;
