import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Video } from '../types';
import { videoDb } from '../services/database';
import { startDownload, getJobStatus } from '../services/downloader';

const router = Router();

// ─── GET /api/videos ──────────────────────────────────────────────────────
// List all videos with pagination
router.get('/', (req: Request, res: Response) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(120, parseInt(req.query.pageSize as string) || 60);
    const offset   = (page - 1) * pageSize;
    const category = req.query.category as string | undefined;
    const sort     = (req.query.sort as string) || 'date'; // date | name | size | duration

    let videos = category
      ? videoDb.findByCategory(category, pageSize, offset)
      : videoDb.findAll(pageSize, offset);

    // Client-side sorting (already limited by pageSize so it's fast)
    switch (sort) {
      case 'name':
        videos = videos.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'size':
        videos = videos.sort((a, b) => b.fileSize - a.fileSize);
        break;
      case 'duration':
        videos = videos.sort((a, b) => b.duration - a.duration);
        break;
      // 'date' is the default DB order
    }

    const total = category
      ? videoDb.countByCategory(category)
      : videoDb.count();

    res.json({
      videos,
      total,
      page,
      pageSize,
      hasMore: offset + videos.length < total,
    });
  } catch (err) {
    console.error('[/api/videos]', err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// ─── GET /api/videos/search ───────────────────────────────────────────────
router.get('/search', (req: Request, res: Response) => {
  const q = (req.query.q as string || '').trim();
  if (!q) {
    return res.json({ videos: [], total: 0 });
  }
  try {
    const videos = videoDb.search(q);
    res.json({ videos, total: videos.length });
  } catch (err) {
    console.error('[/api/videos/search]', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ─── GET /api/videos/categories ──────────────────────────────────────────
router.get('/categories', (_req: Request, res: Response) => {
  try {
    res.json(videoDb.getCategories());
  } catch (err) {
    console.error('[/api/videos/categories]', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ─── GET /api/videos/history ──────────────────────────────────────────────
router.get('/history', (req: Request, res: Response) => {
  const limit = Math.min(50, parseInt(req.query.limit as string) || 12);
  try {
    res.json(videoDb.getRecentlyWatched(limit));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ─── GET /api/videos/favorites ───────────────────────────────────────────
router.get('/favorites', (_req: Request, res: Response) => {
  try {
    res.json(videoDb.getFavorites());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// ─── POST /api/videos/download ───────────────────────────────────────────
router.post('/download', (req: Request, res: Response) => {
  const { url } = req.body as { url: string };
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url must be a valid non-empty string' });
  }
  try {
    const jobId = startDownload(url);
    res.json({ jobId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to start download job' });
  }
});

// ─── GET /api/videos/download/jobs/:jobId ────────────────────────────────
router.get('/download/jobs/:jobId', (req: Request, res: Response) => {
  const job = getJobStatus(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Download job not found' });
  }
  res.json(job);
});

// ─── POST /api/videos/external ───────────────────────────────────────────
router.post('/external', (req: Request, res: Response) => {
  const { url, title, category } = req.body as { url: string; title?: string; category?: string };
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url must be a valid non-empty string' });
  }

  try {
    const finalTitle = (title && title.trim()) || 'External Stream';
    const finalCategory = (category && category.trim()) || 'External Streams';
    const videoId = uuidv4();

    const video: Video = {
      id: videoId,
      title: finalTitle,
      filename: finalTitle,
      path: url.trim(),
      relativePath: url.trim(),
      category: finalCategory,
      subcategory: 'Web',
      duration: 0,
      fileSize: 0,
      resolution: 'HD',
      thumbnail: undefined,
      addedAt: new Date().toISOString(),
      isFavorite: false,
      tags: [finalCategory.toLowerCase(), 'external'],
      watchProgress: 0,
    };

    videoDb.upsert(video);
    res.json({ videoId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save external video link' });
  }
});

// ─── GET /api/videos/:id ──────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
  const video = videoDb.findById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  res.json(video);
});

// ─── POST /api/videos/:id/favorite ───────────────────────────────────────
router.post('/:id/favorite', (req: Request, res: Response) => {
  const ok = videoDb.toggleFavorite(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Video not found' });
  const video = videoDb.findById(req.params.id);
  res.json({ isFavorite: video?.isFavorite });
});

// ─── POST /api/videos/:id/progress ───────────────────────────────────────
router.post('/:id/progress', (req: Request, res: Response) => {
  const { timestamp } = req.body as { timestamp: number };
  if (typeof timestamp !== 'number') {
    return res.status(400).json({ error: 'timestamp must be a number' });
  }
  videoDb.upsertProgress(req.params.id, timestamp);
  res.json({ ok: true });
});

// ─── GET /api/videos/:id/progress ────────────────────────────────────────
router.get('/:id/progress', (req: Request, res: Response) => {
  const timestamp = videoDb.getProgress(req.params.id);
  res.json({ timestamp });
});

// ─── DELETE /api/videos/:id/progress ──────────────────────────────────────
router.delete('/:id/progress', (req: Request, res: Response) => {
  try {
    videoDb.deleteProgress(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete watch history' });
  }
});

export default router;