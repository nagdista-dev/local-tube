import { Router, Request, Response } from 'express';
import { videoDb } from '../services/database';

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

export default router;