import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { videoDb } from './database';
import { probeVideo, enqueueThumbnail } from './thumbnail';
import { Video, ScanStatus } from '../types';

const SUPPORTED_EXTENSIONS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.flv']);

// ─── Scan State ────────────────────────────────────────────────────────────

let scanStatus: ScanStatus = {
  status: 'idle',
  total: 0,
  processed: 0,
};

export function getScanStatus(): ScanStatus {
  return { ...scanStatus };
}

// ─── Utility ───────────────────────────────────────────────────────────────

/** Walk directory recursively, yield absolute file paths */
function* walkDir(dir: string): Generator<string> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        yield fullPath;
      }
    }
  }
}

/** Derive category + subcategory from path relative to Videos root */
export function deriveCategories(
  relativePath: string
): { category: string; subcategory?: string } {
  const parts = relativePath.split(path.sep).filter(Boolean);
  // parts[0] = category, parts[1] = subcategory (if exists), last = filename
  if (parts.length >= 3) {
    return { category: parts[0], subcategory: parts[1] };
  }
  if (parts.length === 2) {
    return { category: parts[0] };
  }
  return { category: 'Uncategorized' };
}

/** Generate a clean title from filename */
export function titleFromFilename(filename: string): string {
  const noExt = path.basename(filename, path.extname(filename));
  return noExt
    .replace(/[_\-\.]+/g, ' ')            // replace separators with space
    .replace(/\s+/g, ' ')                 // collapse whitespace
    .replace(/\b\w/g, c => c.toUpperCase()) // title case
    .trim();
}

/** Generate simple AI-like tags from filename parts */
export function generateTags(title: string, category: string): string[] {
  const words = [...title.toLowerCase().split(/\s+/), category.toLowerCase()];
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'to', 'for', 'with']);
  return [...new Set(words.filter(w => w.length > 3 && !stopWords.has(w)))].slice(0, 8);
}

// ─── Main Scan ─────────────────────────────────────────────────────────────

export async function scanLibrary(videosDir: string): Promise<ScanStatus> {
  if (scanStatus.status === 'scanning') {
    return scanStatus; // Prevent concurrent scans
  }

  scanStatus = {
    status: 'scanning',
    total: 0,
    processed: 0,
    startedAt: new Date().toISOString(),
  };

  console.log(`[Scanner] Starting scan of: ${videosDir}`);

  try {
    if (!fs.existsSync(videosDir)) {
      throw new Error(`Videos directory not found: ${videosDir}`);
    }

    // Collect all video file paths first
    const allFiles = [...walkDir(videosDir)];
    scanStatus.total = allFiles.length;
    console.log(`[Scanner] Found ${allFiles.length} video files`);

    // Get paths already in DB so we can skip unchanged files
    const existingPaths = videoDb.getExistingPaths();

    // Determine new files vs removed files
    const newFiles = allFiles.filter(f => !existingPaths.has(f));
    const currentPathSet = new Set(allFiles);

    // Remove DB entries for files no longer on disk
    for (const oldPath of existingPaths) {
      if (!currentPathSet.has(oldPath)) {
        console.log(`[Scanner] Removing deleted file: ${path.basename(oldPath)}`);
        videoDb.deleteByPath(oldPath);
      }
    }

    console.log(`[Scanner] ${newFiles.length} new files to process`);

    // Process new files in batches
    const BATCH_SIZE = 20;
    for (let i = 0; i < newFiles.length; i += BATCH_SIZE) {
      const batch = newFiles.slice(i, i + BATCH_SIZE);
      const videoRecords: Omit<Video, 'watchProgress' | 'lastWatched'>[] = [];

      await Promise.all(
        batch.map(async filePath => {
          try {
            const stat = fs.statSync(filePath);
            const relativePath = path.relative(videosDir, filePath);
            const { category, subcategory } = deriveCategories(relativePath);
            const filename = path.basename(filePath);
            const title = titleFromFilename(filename);
            const tags = generateTags(title, category);

            const { duration, resolution } = await probeVideo(filePath);

            const video: Omit<Video, 'watchProgress' | 'lastWatched'> = {
              id:           uuidv4(),
              title,
              filename,
              path:         filePath,
              relativePath,
              category,
              subcategory,
              duration,
              fileSize:     stat.size,
              resolution,
              thumbnail:    undefined, // generated async below
              addedAt:      stat.birthtime.toISOString(),
              isFavorite:   false,
              tags,
            };

            videoRecords.push(video);
            scanStatus.processed++;
          } catch (err) {
            console.warn(`[Scanner] Error processing ${filePath}:`, err);
            scanStatus.processed++;
          }
        })
      );

      // Bulk insert this batch
      videoDb.bulkUpsert(videoRecords);

      // Enqueue thumbnail generation (non-blocking)
      for (const v of videoRecords) {
        enqueueThumbnail(v.path, v.id, v.duration).then(thumbUrl => {
          if (thumbUrl) {
            // Update thumbnail in DB once generated
            import('./database').then(({ default: db }) => {
              db.prepare('UPDATE videos SET thumbnail = ? WHERE id = ?').run(thumbUrl, v.id);
            }).catch(() => {});
          }
        });
      }
    }

    // Update total to include existing files
    scanStatus.total = allFiles.length;
    scanStatus.processed = allFiles.length;
    scanStatus.status = 'complete';
    scanStatus.message = `Scan complete. ${allFiles.length} videos in library.`;
    console.log(`[Scanner] ${scanStatus.message}`);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    scanStatus.status = 'error';
    scanStatus.message = message;
    console.error('[Scanner] Error:', message);
  }

  return { ...scanStatus };
}