import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { videoDb } from '../services/database';

const router = Router();

/**
 * GET /api/stream/:id
 *
 * Streams a video file with proper HTTP 206 range support.
 * This allows the HTML5 <video> element to seek to any position.
 */
router.get('/:id', (req: Request, res: Response) => {
  const video = videoDb.findById(req.params.id);
  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const filePath = video.path;

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video file not found on disk' });
  }

  const stat     = fs.statSync(filePath);
  const fileSize = stat.size;
  const mimeType = mime.lookup(filePath) || 'video/mp4';
  const range    = req.headers.range;

  if (!range) {
    // No range header – send entire file (small files or first load)
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type':   mimeType,
      'Accept-Ranges':  'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Parse Range header: "bytes=start-end"
  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end   = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
    return;
  }

  const chunkSize = end - start + 1;

  res.writeHead(206, {
    'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges':  'bytes',
    'Content-Length': chunkSize,
    'Content-Type':   mimeType,
  });

  const stream = fs.createReadStream(filePath, { start, end });
  stream.on('error', err => {
    console.error('[Stream] Read error:', err.message);
    if (!res.headersSent) res.status(500).end();
  });
  stream.pipe(res);
});

export default router;