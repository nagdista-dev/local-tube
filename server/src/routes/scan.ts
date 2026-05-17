import { Router, Request, Response } from 'express';
import { scanLibrary, getScanStatus } from '../services/scanner';

const router = Router();
const VIDEOS_DIR = process.env.VIDEOS_DIR || '';

/**
 * POST /api/scan
 * Trigger an async library scan. Returns immediately with scan ID.
 */
router.post('/', (_req: Request, res: Response) => {
  if (!VIDEOS_DIR) {
    return res.status(500).json({ error: 'VIDEOS_DIR environment variable not set' });
  }

  const status = getScanStatus();
  if (status.status === 'scanning') {
    return res.json({ message: 'Scan already in progress', status });
  }

  // Start scan asynchronously
  scanLibrary(VIDEOS_DIR).catch(err => {
    console.error('[Scan route] Scan failed:', err);
  });

  res.json({ message: 'Scan started', status: getScanStatus() });
});

/**
 * GET /api/scan/status
 * Poll scan progress.
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json(getScanStatus());
});

export default router;