import { Router, Request, Response } from 'express';
import { scanLibrary, getScanStatus } from '../services/scanner';
import { getLibraryLocation, listLibraryDirectories, setLibraryLocation } from '../services/libraryConfig';
import { videoDb } from '../services/database';

const router = Router();

/**
 * POST /api/scan
 * Trigger an async library scan. Returns immediately with scan ID.
 */
router.post('/', (_req: Request, res: Response) => {
  const videosDir = getLibraryLocation();
  if (!videosDir) {
    return res.status(500).json({ error: 'Video library location is not set' });
  }

  const status = getScanStatus();
  if (status.status === 'scanning') {
    return res.json({ message: 'Scan already in progress', status });
  }

  // Start scan asynchronously
  scanLibrary(videosDir).catch(err => {
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

/**
 * GET /api/scan/location
 * Return the saved video library location.
 */
router.get('/location', (_req: Request, res: Response) => {
  res.json({ videosDir: getLibraryLocation() });
});

/**
 * GET /api/scan/directories
 * List directories on the server so the UI can select a library folder by click.
 */
router.get('/directories', (req: Request, res: Response) => {
  const targetPath = typeof req.query.path === 'string' ? req.query.path : undefined;

  try {
    res.json(listLibraryDirectories(targetPath));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to list directories';
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/scan/location
 * Save the video library location used by future scans.
 */
router.post('/location', (req: Request, res: Response) => {
  const videosDir = typeof req.body?.videosDir === 'string' ? req.body.videosDir : '';

  if (!videosDir.trim()) {
    return res.status(400).json({ error: 'videosDir is required' });
  }

  try {
    res.json({ videosDir: setLibraryLocation(videosDir) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid library location';
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/scan/clear-cache
 * Wipe all videos and watch history from the database.
 */
router.post('/clear-cache', (_req: Request, res: Response) => {
  try {
    videoDb.clearAll();
    res.json({ ok: true, message: 'Cache cleared. Rescan to rebuild the library.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to clear cache';
    res.status(500).json({ error: message });
  }
});

export default router;
