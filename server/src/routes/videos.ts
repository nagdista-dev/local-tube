import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { Video } from "../types";
import { videoDb } from "../services/database";
import { startDownload, getJobStatus } from "../services/downloader";

const router = Router();

function parseIsoDuration(value?: string): number {
  if (!value) return 0;
  const match = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return (
    parseInt(days, 10) * 86400 +
    parseInt(hours, 10) * 3600 +
    parseInt(minutes, 10) * 60 +
    parseInt(seconds, 10)
  );
}

// ─── GET /api/videos ──────────────────────────────────────────────────────
// List all videos with pagination
router.get("/", (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(
      120,
      parseInt(req.query.pageSize as string) || 60,
    );
    const offset = (page - 1) * pageSize;
    const category = req.query.category as string | undefined;
    const sort = (req.query.sort as string) || "date";

    const videos = category
      ? videoDb.findByCategory(category, pageSize, offset, sort)
      : videoDb.findAll(pageSize, offset, sort);

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
    console.error("[/api/videos]", err);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

// ─── GET /api/videos/search ───────────────────────────────────────────────
router.get("/search", (req: Request, res: Response) => {
  const q = ((req.query.q as string) || "").trim();
  if (!q) {
    return res.json({ videos: [], total: 0 });
  }
  try {
    const videos = videoDb.search(q);
    res.json({ videos, total: videos.length });
  } catch (err) {
    console.error("[/api/videos/search]", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// ─── GET /api/videos/categories ──────────────────────────────────────────
router.get("/categories", (_req: Request, res: Response) => {
  try {
    res.json(videoDb.getCategories());
  } catch (err) {
    console.error("[/api/videos/categories]", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// ─── POST /api/videos/categories/course ──────────────────────────────────
router.post("/categories/course", (req: Request, res: Response) => {
  const { folderPath, isCourse } = req.body as {
    folderPath?: string;
    isCourse?: boolean;
  };

  if (typeof folderPath !== "string" || !folderPath.trim()) {
    return res.status(400).json({ error: "folderPath is required" });
  }

  if (typeof isCourse !== "boolean") {
    return res.status(400).json({ error: "isCourse must be a boolean" });
  }

  const ok = videoDb.setCourse(folderPath, isCourse);
  if (!ok) return res.status(400).json({ error: "Invalid folder path" });

  res.json({ folderPath, isCourse });
});

// ─── POST /api/videos/categories/:category/course ────────────────────────
router.post("/categories/:category/course", (req: Request, res: Response) => {
  const category = decodeURIComponent(req.params.category);
  const { isCourse } = req.body as { isCourse?: boolean };

  if (typeof isCourse !== "boolean") {
    return res.status(400).json({ error: "isCourse must be a boolean" });
  }

  const ok = videoDb.setCourse(category, isCourse);
  if (!ok) return res.status(400).json({ error: "Invalid category" });

  res.json({ category, isCourse });
});

// ─── GET /api/videos/categories/:category/study-plan ───────────────────
router.get("/categories/:category/study-plan", (req: Request, res: Response) => {
  try {
    const category = decodeURIComponent(req.params.category);
    if (!videoDb.isCourse(category)) {
      return res.status(400).json({ error: "Folder is not marked as a course" });
    }
    res.json(videoDb.getStudyPlan(category));
  } catch (err) {
    console.error("[/api/videos/categories/study-plan GET]", err);
    res.status(500).json({ error: "Failed to load study plan" });
  }
});

// ─── PUT /api/videos/categories/:category/study-plan ────────────────────
router.put("/categories/:category/study-plan", (req: Request, res: Response) => {
  try {
    const category = decodeURIComponent(req.params.category);
    if (!videoDb.isCourse(category)) {
      return res.status(400).json({ error: "Folder is not marked as a course" });
    }

    const { dailyMinutes, studyDays, taskChecks } = req.body as {
      dailyMinutes?: number;
      studyDays?: number[];
      taskChecks?: Record<string, Record<string, boolean>>;
    };

    if (typeof dailyMinutes !== "number" || dailyMinutes < 0) {
      return res.status(400).json({ error: "dailyMinutes must be a non-negative number" });
    }
    if (!Array.isArray(studyDays)) {
      return res.status(400).json({ error: "studyDays must be an array" });
    }

    const plan = videoDb.saveStudyPlan({
      category,
      dailyMinutes,
      studyDays,
      taskChecks: taskChecks || {},
    });
    res.json(plan);
  } catch (err) {
    console.error("[/api/videos/categories/study-plan PUT]", err);
    res.status(500).json({ error: "Failed to save study plan" });
  }
});

// ─── GET /api/videos/history ──────────────────────────────────────────────
router.get("/history", (req: Request, res: Response) => {
  const limit = Math.min(50, parseInt(req.query.limit as string) || 12);
  try {
    res.json(videoDb.getRecentlyWatched(limit));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// ─── GET /api/videos/favorites ───────────────────────────────────────────
router.get("/favorites", (_req: Request, res: Response) => {
  try {
    res.json(videoDb.getFavorites());
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

// ─── GET /api/videos/youtube/:videoId ────────────────────────────────────
router.get("/youtube/:videoId", async (req: Request, res: Response) => {
  const videoId = req.params.videoId;
  const key = process.env.YOUTUBE_API_KEY;

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: "Invalid YouTube video ID" });
  }

  if (!key) {
    return res.json({
      videoId,
      title: "",
      description: "",
      durationSeconds: 0,
      channelTitle: "",
      publishedAt: "",
      comments: [],
      unavailableReason: "Set YOUTUBE_API_KEY on the server to load YouTube details and comments.",
    });
  }

  try {
    const videoParams = new URLSearchParams({
      part: "snippet,contentDetails",
      id: videoId,
      key,
    });
    const commentsParams = new URLSearchParams({
      part: "snippet",
      videoId,
      maxResults: "30",
      order: "relevance",
      textFormat: "plainText",
      key,
    });

    const [videoResponse, commentsResponse] = await Promise.all([
      fetch(`https://www.googleapis.com/youtube/v3/videos?${videoParams}`),
      fetch(`https://www.googleapis.com/youtube/v3/commentThreads?${commentsParams}`),
    ]);

    const videoData = await videoResponse.json() as any;
    if (!videoResponse.ok) {
      return res.status(videoResponse.status).json({
        error: videoData?.error?.message || "Failed to load YouTube video details",
      });
    }

    const item = videoData.items?.[0];
    if (!item) {
      return res.status(404).json({ error: "YouTube video not found" });
    }

    let comments: {
      id: string;
      author: string;
      text: string;
      likeCount: number;
      publishedAt: string;
    }[] = [];
    let commentsUnavailableReason = "";

    if (commentsResponse.ok) {
      const commentsData = await commentsResponse.json() as any;
      comments = (commentsData.items || []).map((thread: any) => {
        const comment = thread.snippet?.topLevelComment?.snippet || {};
        return {
          id: thread.id,
          author: comment.authorDisplayName || "YouTube user",
          text: comment.textOriginal || comment.textDisplay || "",
          likeCount: comment.likeCount || 0,
          publishedAt: comment.publishedAt || "",
        };
      });
    } else {
      const commentsData = await commentsResponse.json().catch(() => ({})) as any;
      commentsUnavailableReason =
        commentsData?.error?.message || "Comments are unavailable for this YouTube video.";
    }

    res.json({
      videoId,
      title: item.snippet?.title || "",
      description: item.snippet?.description || "",
      durationSeconds: parseIsoDuration(item.contentDetails?.duration),
      channelTitle: item.snippet?.channelTitle || "",
      publishedAt: item.snippet?.publishedAt || "",
      comments,
      commentsUnavailableReason,
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message || "Failed to contact YouTube" });
  }
});

// ─── POST /api/videos/download ───────────────────────────────────────────
router.post("/download", (req: Request, res: Response) => {
  const { url } = req.body as { url: string };
  if (!url || typeof url !== "string") {
    return res
      .status(400)
      .json({ error: "url must be a valid non-empty string" });
  }
  try {
    const jobId = startDownload(url);
    res.json({ jobId });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: err.message || "Failed to start download job" });
  }
});

// ─── GET /api/videos/download/jobs/:jobId ────────────────────────────────
router.get("/download/jobs/:jobId", (req: Request, res: Response) => {
  const job = getJobStatus(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Download job not found" });
  }
  res.json(job);
});

// ─── POST /api/videos/external ───────────────────────────────────────────
router.post("/external", (req: Request, res: Response) => {
  const { url, title, category } = req.body as {
    url: string;
    title?: string;
    category?: string;
  };
  if (!url || typeof url !== "string") {
    return res
      .status(400)
      .json({ error: "url must be a valid non-empty string" });
  }

  try {
    const finalTitle = (title && title.trim()) || "External Stream";
    const finalCategory = (category && category.trim()) || "External Streams";
    const videoId = uuidv4();

    const video: Video = {
      id: videoId,
      title: finalTitle,
      filename: finalTitle,
      path: url.trim(),
      relativePath: url.trim(),
      category: finalCategory,
      subcategory: "Web",
      duration: 0,
      fileSize: 0,
      resolution: "HD",
      thumbnail: undefined,
      addedAt: new Date().toISOString(),
      isFavorite: false,
      tags: [finalCategory.toLowerCase(), "external"],
      watchProgress: 0,
    };

    videoDb.upsert(video);
    res.json({ videoId });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: err.message || "Failed to save external video link" });
  }
});

// ─── PATCH /api/videos/:id ───────────────────────────────────────────────
router.patch("/:id", (req: Request, res: Response) => {
  const { title } = req.body as { title?: string };
  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "title is required" });
  }
  const ok = videoDb.updateTitle(req.params.id, title);
  if (!ok) return res.status(404).json({ error: "Video not found" });
  const video = videoDb.findById(req.params.id);
  res.json(video);
});

// ─── GET /api/videos/:id ──────────────────────────────────────────────────
// IMPORTANT: This catch-all route MUST be last among non-parameterized routes
router.get("/:id", (req: Request, res: Response) => {
  const video = videoDb.findById(req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });
  res.json(video);
});

// ─── POST /api/videos/:id/favorite ───────────────────────────────────────
router.post("/:id/favorite", (req: Request, res: Response) => {
  const ok = videoDb.toggleFavorite(req.params.id);
  if (!ok) return res.status(404).json({ error: "Video not found" });
  const video = videoDb.findById(req.params.id);
  res.json({ isFavorite: video?.isFavorite });
});

// ─── POST /api/videos/:id/finished ───────────────────────────────────────
router.post("/:id/finished", (req: Request, res: Response) => {
  const { finished } = req.body as { finished?: boolean };
  if (typeof finished !== "boolean") {
    return res.status(400).json({ error: "finished must be a boolean" });
  }

  const video = videoDb.findById(req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });

  if (finished) {
    videoDb.upsertProgress(req.params.id, video.duration || 0);
  } else {
    videoDb.deleteProgress(req.params.id);
  }

  res.json({ ok: true, finished });
});

// ─── POST /api/videos/:id/progress ───────────────────────────────────────
router.post("/:id/progress", (req: Request, res: Response) => {
  const { timestamp } = req.body as { timestamp: number };
  if (typeof timestamp !== "number") {
    return res.status(400).json({ error: "timestamp must be a number" });
  }
  videoDb.upsertProgress(req.params.id, timestamp);
  res.json({ ok: true });
});

// ─── GET /api/videos/:id/progress ────────────────────────────────────────
router.get("/:id/progress", (req: Request, res: Response) => {
  const timestamp = videoDb.getProgress(req.params.id);
  res.json({ timestamp });
});

// ─── DELETE /api/videos/:id/progress ──────────────────────────────────────
router.delete("/:id/progress", (req: Request, res: Response) => {
  try {
    videoDb.deleteProgress(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete watch history" });
  }
});

export default router;
