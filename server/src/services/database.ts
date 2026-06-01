import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Video, Category } from '../types';
import { getLibraryLocation } from './libraryConfig';

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

  CREATE TABLE IF NOT EXISTS courses (
    category  TEXT PRIMARY KEY,
    markedAt  TEXT NOT NULL
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

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function folderPartsForVideo(relativePath: string): string[] {
  const parts = normalizeRelativePath(relativePath).split('/').filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1) : ['Uncategorized'];
}

function folderPathMatchesExpression(alias = 'v'): string {
  return `(
    @folderPath = ''
    OR (@folderPath = 'Uncategorized' AND ${alias}.relativePath NOT LIKE '%/%' AND ${alias}.relativePath NOT LIKE '%\\%')
    OR ${alias}.relativePath LIKE @folderPath || '/%'
    OR ${alias}.relativePath LIKE @folderPath || '\\%'
  )`;
}

// ─── Dynamic sort helper ───────────────────────────────────────────────────

/** Returns a SQL ORDER BY clause for the given sort key */
function buildOrderBy(sort: string): string {
  switch (sort) {
    case 'name':          return 'v.filename ASC';
    case 'name-desc':     return 'v.filename DESC';
    case 'date':          return 'v.addedAt DESC';
    case 'date-asc':      return 'v.addedAt ASC';
    case 'duration':      return 'v.duration DESC';
    case 'duration-asc':  return 'v.duration ASC';
    case 'size':          return 'v.fileSize DESC';
    case 'size-asc':      return 'v.fileSize ASC';
    case 'progress':      return 'COALESCE(wh.timestamp, 0) DESC';
    case 'progress-asc':  return 'COALESCE(wh.timestamp, 0) ASC';
    default:              return 'v.addedAt DESC';
  }
}

function createCategoryNode(name: string, folderPath: string, isCourse: boolean): Category {
  return {
    name,
    path: folderPath,
    count: 0,
    subcategories: [],
    isCourse,
    totalDuration: 0,
    watchedDuration: 0,
    completedCount: 0,
    remainingDuration: 0,
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

  // selectAll and selectByCategory are now built dynamically per-sort (see findAll/findByCategory)
  // Static fallback (date-desc) kept for any internal use
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
    WHERE ${folderPathMatchesExpression('v')}
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

  categoryRows: db.prepare(`
    SELECT v.relativePath, v.duration, COALESCE(wh.timestamp, 0) AS watchTimestamp
    FROM videos v
    LEFT JOIN watch_history wh ON v.id = wh.videoId
  `),

  courseRows: db.prepare(`
    SELECT category FROM courses
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
  countByCategory: db.prepare(`
    SELECT COUNT(*) AS c
    FROM videos v
    WHERE ${folderPathMatchesExpression('v')}
  `),

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
  deleteProgress: db.prepare('DELETE FROM watch_history WHERE videoId = ?'),
  getProgress: db.prepare('SELECT timestamp FROM watch_history WHERE videoId = ?'),

  markCourse: db.prepare(`
    INSERT INTO courses (category, markedAt)
    VALUES (?, ?)
    ON CONFLICT(category) DO UPDATE SET markedAt = excluded.markedAt
  `),
  unmarkCourse: db.prepare('DELETE FROM courses WHERE category = ?'),
  isCourse: db.prepare('SELECT category FROM courses WHERE category = ?'),
  clearVideos: db.prepare('DELETE FROM videos'),
  clearHistory: db.prepare('DELETE FROM watch_history'),
  clearCourses: db.prepare('DELETE FROM courses'),
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

  findAll(limit = 60, offset = 0, sort = 'date'): Video[] {
    const orderBy = buildOrderBy(sort);
    const sql = `
      SELECT v.*, wh.timestamp AS watchTimestamp, wh.updatedAt AS lastWatched
      FROM videos v
      LEFT JOIN watch_history wh ON v.id = wh.videoId
      ORDER BY ${orderBy}
      LIMIT @limit OFFSET @offset
    `;
    return (db.prepare(sql).all({ limit, offset }) as Record<string, unknown>[]).map(mapRow);
  },

  findById(id: string): Video | null {
    const row = stmts.selectById.get(id) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  },

  findByCategory(category: string, limit = 60, offset = 0, sort = 'date'): Video[] {
    const orderBy = buildOrderBy(sort);
    const sql = `
      SELECT v.*, wh.timestamp AS watchTimestamp, wh.updatedAt AS lastWatched
      FROM videos v
      LEFT JOIN watch_history wh ON v.id = wh.videoId
      WHERE ${folderPathMatchesExpression('v')}
      ORDER BY ${orderBy}
      LIMIT @limit OFFSET @offset
    `;
    return (db.prepare(sql).all({ folderPath: category, limit, offset }) as Record<string, unknown>[]).map(mapRow);
  },

  search(query: string, limit = 60): Video[] {
    return (stmts.search.all({ q: `%${query}%`, limit }) as Record<string, unknown>[]).map(mapRow);
  },

  getCategories(): Category[] {
    const courseRows = stmts.courseRows.all() as { category: string }[];
    const coursePaths = new Set(courseRows.map(row => row.category));
    const nodes = new Map<string, Category>();

    // Use the library root folder's basename instead of the literal 'Uncategorized' label
    const libraryRootName = (() => {
      try {
        const loc = getLibraryLocation();
        return loc ? path.basename(loc) : 'Root';
      } catch { return 'Root'; }
    })();

    const root = createCategoryNode(libraryRootName, '', false);
    nodes.set('', root);

    const ensureNode = (folderPath: string): Category => {
      const existing = nodes.get(folderPath);
      if (existing) return existing;

      const parts = folderPath.split('/').filter(Boolean);
      // Use the real library folder name for the 'Uncategorized' bucket
      const rawName = parts.at(-1) || folderPath || libraryRootName;
      const name = (rawName === 'Uncategorized') ? libraryRootName : rawName;
      const node = createCategoryNode(name, folderPath, coursePaths.has(folderPath));
      nodes.set(folderPath, node);

      if (folderPath !== 'Uncategorized' && parts.length <= 1) {
        root.subcategories.push(node);
      } else {
        const parentPath = parts.slice(0, -1).join('/');
        ensureNode(parentPath).subcategories.push(node);
      }

      return node;
    };

    const rows = stmts.categoryRows.all() as {
      relativePath: string;
      duration: number;
      watchTimestamp: number;
    }[];

    for (const row of rows) {
      const rawFolderParts = folderPartsForVideo(row.relativePath);
      const folderParts = rawFolderParts.length === 1 && rawFolderParts[0] === 'Uncategorized'
        ? []
        : rawFolderParts;
      const duration = row.duration || 0;
      const watched = duration > 0 ? Math.min(row.watchTimestamp || 0, duration) : 0;
      const complete = duration > 0 && (row.watchTimestamp || 0) >= duration * 0.98 ? 1 : 0;

      for (let i = -1; i < folderParts.length; i++) {
        const folderPath = i === -1 ? '' : folderParts.slice(0, i + 1).join('/');
        const node = ensureNode(folderPath);
        node.count++;
        node.totalDuration = (node.totalDuration || 0) + duration;
        node.watchedDuration = (node.watchedDuration || 0) + watched;
        node.completedCount = (node.completedCount || 0) + complete;
      }
    }

    const finalize = (node: Category) => {
      node.remainingDuration = Math.max((node.totalDuration || 0) - (node.watchedDuration || 0), 0);
      node.subcategories.sort((a, b) => a.name.localeCompare(b.name));
      node.subcategories.forEach(finalize);
    };

    finalize(root);
    return root.count > 0 ? [root] : [];
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
    return ((stmts.countByCategory.get({ folderPath: category }) as Record<string, unknown>).c as number);
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

  deleteProgress(videoId: string) {
    stmts.deleteProgress.run(videoId);
  },

  getProgress(videoId: string): number {
    const row = stmts.getProgress.get(videoId) as { timestamp: number } | undefined;
    return row?.timestamp ?? 0;
  },

  setCourse(category: string, isCourse: boolean): boolean {
    const normalized = category.trim();
    if (!normalized) return false;
    if (isCourse) {
      stmts.markCourse.run(normalized, new Date().toISOString());
    } else {
      stmts.unmarkCourse.run(normalized);
    }
    return true;
  },

  isCourse(category: string): boolean {
    return Boolean(stmts.isCourse.get(category));
  },

  /** Wipe the entire library: videos, watch history, and course flags */
  clearAll() {
    const wipe = db.transaction(() => {
      stmts.clearHistory.run();
      stmts.clearCourses.run();
      stmts.clearVideos.run();
    });
    wipe();
  },
};

export default db;
