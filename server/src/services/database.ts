import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Video, Category } from '../types';

// ─── Setup ─────────────────────────────────────────────────────────────────

const CACHE_DIR = path.join(process.cwd(), '..', 'cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const DB_PATH = path.join(CACHE_DIR, 'library.db');
const db = new Database(DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -32000'); // 32MB cache
db.pragma('temp_store = memory');

// ─── Schema ────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    filename     TEXT NOT NULL,
    path         TEXT NOT NULL UNIQUE,
    relativePath TEXT NOT NULL,
    category     TEXT NOT NULL,
    subcategory  TEXT,
    duration     REAL    DEFAULT 0,
    fileSize     INTEGER DEFAULT 0,
    resolution   TEXT,
    thumbnail    TEXT,
    addedAt      TEXT    NOT NULL,
    isFavorite   INTEGER DEFAULT 0,
    tags         TEXT    DEFAULT '[]',
    lastScanned  TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS watch_history (
    videoId    TEXT PRIMARY KEY,
    timestamp  REAL NOT NULL DEFAULT 0,
    updatedAt  TEXT NOT NULL,
    FOREIGN KEY (videoId) REFERENCES videos(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_videos_category  ON videos(category);
  CREATE INDEX IF NOT EXISTS idx_videos_addedAt   ON videos(addedAt DESC);
  CREATE INDEX IF NOT EXISTS idx_videos_title     ON videos(title COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS idx_videos_favorite  ON videos(isFavorite) WHERE isFavorite = 1;
  CREATE INDEX IF NOT EXISTS idx_history_updated  ON watch_history(updatedAt DESC);
`);

// ─── Helpers ───────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): Video {
  const duration = (row.duration as number) || 0;
  const watchTimestamp = (row.watchTimestamp as number) || 0;
  return {
    id:            row.id as string,
    title:         row.title as string,
    filename:      row.filename as string,
    path:          row.path as string,
    relativePath:  row.relativePath as string,
    category:      row.category as string,
    subcategory:   (row.subcategory as string | undefined) || undefined,
    duration,
    fileSize:      (row.fileSize as number) || 0,
    resolution:    (row.resolution as string | undefined) || undefined,
    thumbnail:     (row.thumbnail as string | undefined) || undefined,
    addedAt:       row.addedAt as string,
    lastWatched:   (row.lastWatched as string | undefined) || undefined,
    watchProgress: duration > 0 ? Math.min(watchTimestamp / duration, 1) : 0,
    isFavorite:    Boolean(row.isFavorite),
    tags:          JSON.parse((row.tags as string) || '[]'),
  };
}

// ─── Statements (prepared once for perf) ──────────────────────────────────

const stmts = {
  upsert: db.prepare(`
    INSERT INTO videos
      (id, title, filename, path, relativePath, category, subcategory,
       duration, fileSize, resolution, thumbnail, addedAt, isFavorite, tags, lastScanned)
    VALUES
      (@id, @title, @filename, @path, @relativePath, @category, @subcategory,
       @duration, @fileSize, @resolution, @thumbnail, @addedAt, @isFavorite, @tags, @lastScanned)
    ON CONFLICT(path) DO UPDATE SET
      title       = excluded.title,
      duration    = CASE WHEN excluded.duration > 0 THEN excluded.duration ELSE duration END,
      fileSize    = excluded.fileSize,
      resolution  = COALESCE(excluded.resolution, resolution),
      thumbnail   = COALESCE(excluded.thumbnail, thumbnail),
      lastScanned = excluded.lastScanned
  `),

  selectAll: db.prepare(`
    SELECT v.*, wh.timestamp AS watchTimestamp, wh.updatedAt AS lastWatched
    FROM videos v
    LEFT JOIN watch_history wh ON v.id = wh.videoId
    ORDER BY v.addedAt DESC
    LIMIT @limit OFFSET @offset
  `),

  selectById: db.prepare(`
    SELECT v.*, wh.timestamp AS watchTimestamp, wh.updatedAt AS lastWatched
    FROM videos v
    LEFT JOIN watch_history wh ON v.id = wh.videoId
    WHERE v.id = ?
  `),

  selectByCategory: db.prepare(`
    SELECT v.*, wh.timestamp AS watchTimestamp, wh.updatedAt AS lastWatched
    FROM videos v
    LEFT JOIN watch_history wh ON v.id = wh.videoId
    WHERE v.category = ?
    ORDER BY v.addedAt DESC
    LIMIT @limit OFFSET @offset
  `),

  search: db.prepare(`
    SELECT v.*, wh.timestamp AS watchTimestamp, wh.updatedAt AS lastWatched
    FROM videos v
    LEFT JOIN watch_history wh ON v.id = wh.videoId
    WHERE v.title LIKE @q OR v.category LIKE @q OR v.subcategory LIKE @q
    ORDER BY v.title COLLATE NOCASE ASC
    LIMIT @limit
  `),

  categories: db.prepare(`
    SELECT category, COUNT(*) as count,
           GROUP_CONCAT(DISTINCT COALESCE(subcategory, '')) AS subs
    FROM videos
    GROUP BY category
    ORDER BY count DESC
  `),

  recentlyWatched: db.prepare(`
    SELECT v.*, wh.timestamp AS watchTimestamp, wh.updatedAt AS lastWatched
    FROM videos v
    INNER JOIN watch_history wh ON v.id = wh.videoId
    ORDER BY wh.updatedAt DESC
    LIMIT ?
  `),

  favorites: db.prepare(`
    SELECT v.*, wh.timestamp AS watchTimestamp, wh.updatedAt AS lastWatched
    FROM videos v
    LEFT JOIN watch_history wh ON v.id = wh.videoId
    WHERE v.isFavorite = 1
    ORDER BY v.title COLLATE NOCASE ASC
  `),

  count: db.prepare('SELECT COUNT(*) AS c FROM videos'),
  countByCategory: db.prepare('SELECT COUNT(*) AS c FROM videos WHERE category = ?'),

  existingPaths: db.prepare('SELECT path FROM videos'),
  deleteByPath:  db.prepare('DELETE FROM videos WHERE path = ?'),

  toggleFav:   db.prepare('UPDATE videos SET isFavorite = ((isFavorite | 1) - (isFavorite & 1)) WHERE id = ?'),
  getFav:      db.prepare('SELECT isFavorite FROM videos WHERE id = ?'),

  upsertProgress: db.prepare(`
    INSERT INTO watch_history (videoId, timestamp, updatedAt)
    VALUES (?, ?, ?)
    ON CONFLICT(videoId) DO UPDATE SET
      timestamp = excluded.timestamp,
      updatedAt = excluded.updatedAt
  `),
  getProgress: db.prepare('SELECT timestamp FROM watch_history WHERE videoId = ?'),
};

// ─── Public API ────────────────────────────────────────────────────────────

export const videoDb = {
  /** Upsert a video record (insert or update non-user fields) */
  upsert(video: Omit<Video, 'watchProgress' | 'lastWatched'>) {
    stmts.upsert.run({
      ...video,
      isFavorite:  video.isFavorite ? 1 : 0,
      tags:        JSON.stringify(video.tags || []),
      lastScanned: new Date().toISOString(),
    });
  },

  /** Bulk upsert inside a transaction – much faster for large scans */
  bulkUpsert(videos: Omit<Video, 'watchProgress' | 'lastWatched'>[]) {
    const insert = db.transaction((rows: typeof videos) => {
      const now = new Date().toISOString();
      for (const v of rows) {
        stmts.upsert.run({
          ...v,
          isFavorite:  v.isFavorite ? 1 : 0,
          tags:        JSON.stringify(v.tags || []),
          lastScanned: now,
        });
      }
    });
    insert(videos);
  },

  findAll(limit = 60, offset = 0): Video[] {
    return (stmts.selectAll.all({ limit, offset }) as Record<string, unknown>[]).map(mapRow);
  },

  findById(id: string): Video | null {
    const row = stmts.selectById.get(id) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  },

  findByCategory(category: string, limit = 60, offset = 0): Video[] {
    return (stmts.selectByCategory.all(category, { limit, offset }) as Record<string, unknown>[]).map(mapRow);
  },

  search(query: string, limit = 60): Video[] {
    return (stmts.search.all({ q: `%${query}%`, limit }) as Record<string, unknown>[]).map(mapRow);
  },

  getCategories(): Category[] {
    const rows = stmts.categories.all() as { category: string; count: number; subs: string }[];
    return rows.map(r => ({
      name: r.category,
      count: r.count,
      subcategories: r.subs
        ? r.subs.split(',').filter(s => s.length > 0)
        : [],
    }));
  },

  getRecentlyWatched(limit = 12): Video[] {
    return (stmts.recentlyWatched.all(limit) as Record<string, unknown>[]).map(mapRow);
  },

  getFavorites(): Video[] {
    return (stmts.favorites.all() as Record<string, unknown>[]).map(mapRow);
  },

  count(): number {
    return ((stmts.count.get() as Record<string, unknown>).c as number);
  },

  countByCategory(category: string): number {
    return ((stmts.countByCategory.get(category) as Record<string, unknown>).c as number);
  },

  getExistingPaths(): Set<string> {
    const rows = stmts.existingPaths.all() as { path: string }[];
    return new Set(rows.map(r => r.path));
  },

  deleteByPath(filePath: string) {
    stmts.deleteByPath.run(filePath);
  },

  toggleFavorite(id: string): boolean {
    const row = stmts.getFav.get(id) as { isFavorite: number } | undefined;
    if (!row) return false;
    stmts.toggleFav.run(id);
    return true;
  },

  upsertProgress(videoId: string, timestamp: number) {
    stmts.upsertProgress.run(videoId, timestamp, new Date().toISOString());
  },

  getProgress(videoId: string): number {
    const row = stmts.getProgress.get(videoId) as { timestamp: number } | undefined;
    return row?.timestamp ?? 0;
  },
};

export default db;