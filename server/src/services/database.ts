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

  CREATE TABLE IF NOT EXISTS courses (
    category  TEXT PRIMARY KEY,
    markedAt  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS course_study_plans (
    category      TEXT PRIMARY KEY,
    dailyMinutes  INTEGER NOT NULL DEFAULT 60,
    studyDays     TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    taskChecks    TEXT NOT NULL DEFAULT '{}',
    updatedAt     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pomodoro_settings (
    id TEXT PRIMARY KEY,
    workTime INTEGER NOT NULL DEFAULT 25,
    shortBreakTime INTEGER NOT NULL DEFAULT 5,
    longBreakTime INTEGER NOT NULL DEFAULT 15,
    cyclesBeforeLongBreak INTEGER NOT NULL DEFAULT 4,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pomodoro_tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    completedCycles INTEGER NOT NULL DEFAULT 0,
    isCompleted INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
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

const SORT_ORDERS: Record<string, string> = {
  date: 'v.addedAt DESC, v.title COLLATE NOCASE ASC',
  'date-asc': 'v.addedAt ASC, v.title COLLATE NOCASE ASC',
  name: 'v.title COLLATE NOCASE ASC, v.id ASC',
  'name-desc': 'v.title COLLATE NOCASE DESC, v.id ASC',
  duration: 'v.duration DESC, v.title COLLATE NOCASE ASC',
  'duration-asc': 'v.duration ASC, v.title COLLATE NOCASE ASC',
  size: 'v.fileSize DESC, v.title COLLATE NOCASE ASC',
  'size-asc': 'v.fileSize ASC, v.title COLLATE NOCASE ASC',
  progress:
    'CASE WHEN v.duration > 0 THEN COALESCE(wh.timestamp, 0) / v.duration ELSE 0 END DESC, v.title COLLATE NOCASE ASC',
  'progress-asc':
    'CASE WHEN v.duration > 0 THEN COALESCE(wh.timestamp, 0) / v.duration ELSE 0 END ASC, v.title COLLATE NOCASE ASC',
};

function orderByForSort(sort: string): string {
  return SORT_ORDERS[sort] ?? SORT_ORDERS.date;
}

function selectVideosQuery(whereClause = '', sort = 'date'): string {
  const orderBy = orderByForSort(sort);
  const where = whereClause ? `WHERE ${whereClause}` : '';
  return `
    SELECT v.*, wh.timestamp AS watchTimestamp, wh.updatedAt AS lastWatched
    FROM videos v
    LEFT JOIN watch_history wh ON v.id = wh.videoId
    ${where}
    ORDER BY ${orderBy}
    LIMIT @limit OFFSET @offset
  `;
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
    WHERE v.title LIKE @q OR v.category LIKE @q OR v.subcategory LIKE @q OR v.tags LIKE @q
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

  getStudyPlan: db.prepare(
    'SELECT category, dailyMinutes, studyDays, taskChecks, updatedAt FROM course_study_plans WHERE category = ?',
  ),
  upsertStudyPlan: db.prepare(`
    INSERT INTO course_study_plans (category, dailyMinutes, studyDays, taskChecks, updatedAt)
    VALUES (@category, @dailyMinutes, @studyDays, @taskChecks, @updatedAt)
    ON CONFLICT(category) DO UPDATE SET
      dailyMinutes = excluded.dailyMinutes,
      studyDays    = excluded.studyDays,
      taskChecks   = excluded.taskChecks,
      updatedAt    = excluded.updatedAt
  `),
  deleteStudyPlan: db.prepare('DELETE FROM course_study_plans WHERE category = ?'),

  getPomodoroSettings: db.prepare('SELECT workTime, shortBreakTime, longBreakTime, cyclesBeforeLongBreak FROM pomodoro_settings WHERE id = ?'),
  upsertPomodoroSettings: db.prepare(`
    INSERT INTO pomodoro_settings (id, workTime, shortBreakTime, longBreakTime, cyclesBeforeLongBreak, updatedAt)
    VALUES ('default', @workTime, @shortBreakTime, @longBreakTime, @cyclesBeforeLongBreak, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      workTime = excluded.workTime,
      shortBreakTime = excluded.shortBreakTime,
      longBreakTime = excluded.longBreakTime,
      cyclesBeforeLongBreak = excluded.cyclesBeforeLongBreak,
      updatedAt = excluded.updatedAt
  `),

  getPomodoroTasks: db.prepare('SELECT id, name, completedCycles, isCompleted, createdAt FROM pomodoro_tasks ORDER BY createdAt DESC'),
  addPomodoroTask: db.prepare('INSERT INTO pomodoro_tasks (id, name, completedCycles, isCompleted, createdAt) VALUES (?, ?, ?, ?, ?)'),
  updatePomodoroTask: db.prepare('UPDATE pomodoro_tasks SET name = ?, completedCycles = ?, isCompleted = ? WHERE id = ?'),
  deletePomodoroTask: db.prepare('DELETE FROM pomodoro_tasks WHERE id = ?'),
  clearPomodoroTasks: db.prepare('DELETE FROM pomodoro_tasks WHERE isCompleted = 1'),
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
    const sql = selectVideosQuery('', sort);
    return (db.prepare(sql).all({ limit, offset }) as Record<string, unknown>[]).map(mapRow);
  },

  findById(id: string): Video | null {
    const row = stmts.selectById.get(id) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  },

  findByCategory(category: string, limit = 60, offset = 0, sort = 'date'): Video[] {
    const sql = selectVideosQuery(folderPathMatchesExpression('v'), sort);
    return (db.prepare(sql).all({ folderPath: category, limit, offset }) as Record<string, unknown>[]).map(mapRow);
  },

  search(query: string, limit = 60): Video[] {
    return (stmts.search.all({ q: `%${query}%`, limit }) as Record<string, unknown>[]).map(mapRow);
  },

  getCategories(): Category[] {
    const courseRows = stmts.courseRows.all() as { category: string }[];
    const coursePaths = new Set(courseRows.map(row => row.category));
    const nodes = new Map<string, Category>();
    const roots: Category[] = [];

    const ensureNode = (folderPath: string): Category => {
      const existing = nodes.get(folderPath);
      if (existing) return existing;

      const parts = folderPath.split('/').filter(Boolean);
      const name = parts.at(-1) || folderPath || 'Uncategorized';
      const node = createCategoryNode(name, folderPath, coursePaths.has(folderPath));
      nodes.set(folderPath, node);

      if (folderPath === 'Uncategorized' || parts.length <= 1) {
        roots.push(node);
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
      const folderParts = folderPartsForVideo(row.relativePath);
      const duration = row.duration || 0;
      const watched = duration > 0 ? Math.min(row.watchTimestamp || 0, duration) : 0;
      const complete = duration > 0 && (row.watchTimestamp || 0) >= duration * 0.98 ? 1 : 0;

      for (let i = 0; i < folderParts.length; i++) {
        const folderPath = folderParts.slice(0, i + 1).join('/');
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

    roots.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    roots.forEach(finalize);
    return roots;
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
      stmts.deleteStudyPlan.run(normalized);
    }
    return true;
  },

  getStudyPlan(category: string) {
    const normalized = category.trim();
    const row = stmts.getStudyPlan.get(normalized) as
      | {
          category: string;
          dailyMinutes: number;
          studyDays: string;
          taskChecks: string;
          updatedAt: string;
        }
      | undefined;

    if (!row) {
      return {
        category: normalized,
        dailyMinutes: 60,
        studyDays: [1, 2, 3, 4, 5],
        taskChecks: {} as Record<string, Record<string, boolean>>,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      category: row.category,
      dailyMinutes: row.dailyMinutes,
      studyDays: JSON.parse(row.studyDays || '[1,2,3,4,5]') as number[],
      taskChecks: JSON.parse(row.taskChecks || '{}') as Record<
        string,
        Record<string, boolean>
      >,
      updatedAt: row.updatedAt,
    };
  },

  saveStudyPlan(plan: {
    category: string;
    dailyMinutes: number;
    studyDays: number[];
    taskChecks: Record<string, Record<string, boolean>>;
  }) {
    const normalized = plan.category.trim();
    const dailyMinutes = Math.max(0, Math.round(plan.dailyMinutes));
    const studyDays = Array.isArray(plan.studyDays) ? plan.studyDays : [1, 2, 3, 4, 5];
    const updatedAt = new Date().toISOString();

    stmts.upsertStudyPlan.run({
      category: normalized,
      dailyMinutes,
      studyDays: JSON.stringify(studyDays),
      taskChecks: JSON.stringify(plan.taskChecks || {}),
      updatedAt,
    });

    return {
      category: normalized,
      dailyMinutes,
      studyDays,
      taskChecks: plan.taskChecks || {},
      updatedAt,
    };
  },

  isCourse(category: string): boolean {
    return Boolean(stmts.isCourse.get(category));
  },

  updateTitle(id: string, title: string): boolean {
    const trimmed = title.trim();
    if (!trimmed) return false;
    const result = db
      .prepare('UPDATE videos SET title = ? WHERE id = ?')
      .run(trimmed, id);
    return result.changes > 0;
  },

  getPomodoroSettings() {
    const row = stmts.getPomodoroSettings.get('default') as {
      workTime: number;
      shortBreakTime: number;
      longBreakTime: number;
      cyclesBeforeLongBreak: number;
    } | undefined;

    return row || {
      workTime: 25,
      shortBreakTime: 5,
      longBreakTime: 15,
      cyclesBeforeLongBreak: 4,
    };
  },

  savePomodoroSettings(settings: {
    workTime: number;
    shortBreakTime: number;
    longBreakTime: number;
    cyclesBeforeLongBreak: number;
  }) {
    stmts.upsertPomodoroSettings.run({
      ...settings,
      updatedAt: new Date().toISOString(),
    });
    return settings;
  },

  getPomodoroTasks() {
    return stmts.getPomodoroTasks.all() as {
      id: string;
      name: string;
      completedCycles: number;
      isCompleted: number;
      createdAt: string;
    }[];
  },

  addPomodoroTask(task: { id: string; name: string; completedCycles?: number; isCompleted?: number }) {
    stmts.addPomodoroTask.run(
      task.id,
      task.name,
      task.completedCycles || 0,
      task.isCompleted || 0,
      new Date().toISOString()
    );
    return task;
  },

  updatePomodoroTask(id: string, updates: { name: string; completedCycles: number; isCompleted: number }) {
    stmts.updatePomodoroTask.run(updates.name, updates.completedCycles, updates.isCompleted, id);
    return { id, ...updates };
  },

  deletePomodoroTask(id: string) {
    stmts.deletePomodoroTask.run(id);
  },

  clearCompletedPomodoroTasks() {
    stmts.clearPomodoroTasks.run();
  },

  clearAll() {
    db.exec(`
      DELETE FROM watch_history;
      DELETE FROM course_study_plans;
      DELETE FROM videos;
      DELETE FROM courses;
      DELETE FROM pomodoro_tasks;
    `);
  },
};

export default db;
