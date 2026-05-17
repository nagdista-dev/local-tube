import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

const THUMBNAILS_DIR = path.join(process.cwd(), '..', 'thumbnails');
fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

// Simple async queue to avoid spawning thousands of ffmpeg processes at once
interface QueueItem {
  videoPath: string;
  videoId: string;
  duration: number;
  resolve: (thumbPath: string | null) => void;
}

const queue: QueueItem[] = [];
let running = 0;
const MAX_CONCURRENT = 3;

function processQueue() {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    const item = queue.shift()!;
    running++;
    generateThumbnailDirect(item.videoPath, item.videoId, item.duration)
      .then(item.resolve)
      .catch(() => item.resolve(null))
      .finally(() => {
        running--;
        processQueue();
      });
  }
}

/** Enqueue a thumbnail generation job */
export function enqueueThumbnail(
  videoPath: string,
  videoId: string,
  duration: number
): Promise<string | null> {
  return new Promise(resolve => {
    queue.push({ videoPath, videoId, duration, resolve });
    processQueue();
  });
}

/** Generate thumbnail immediately (not queued) */
function generateThumbnailDirect(
  videoPath: string,
  videoId: string,
  duration: number
): Promise<string | null> {
  const thumbFilename = `${videoId}.jpg`;
  const thumbPath = path.join(THUMBNAILS_DIR, thumbFilename);

  // Skip if already exists
  if (fs.existsSync(thumbPath)) {
    return Promise.resolve(`/thumbnails/${thumbFilename}`);
  }

  // Capture frame at 10% of duration, or 5s minimum, 30s maximum
  const seekTime = Math.max(5, Math.min(30, duration * 0.1));

  return new Promise(resolve => {
    ffmpeg(videoPath)
      .seekInput(seekTime)
      .frames(1)
      .size('640x360')
      .output(thumbPath)
      .on('end', () => resolve(`/thumbnails/${thumbFilename}`))
      .on('error', err => {
        console.warn(`[Thumbnail] Failed for ${path.basename(videoPath)}: ${err.message}`);
        // Try fallback at timestamp 0
        generateFallbackThumbnail(videoPath, thumbPath)
          .then(resolve)
          .catch(() => resolve(null));
      })
      .run();
  });
}

function generateFallbackThumbnail(videoPath: string, thumbPath: string): Promise<string | null> {
  const thumbFilename = path.basename(thumbPath);
  return new Promise(resolve => {
    ffmpeg(videoPath)
      .frames(1)
      .size('640x360')
      .output(thumbPath)
      .on('end', () => resolve(`/thumbnails/${thumbFilename}`))
      .on('error', () => resolve(null))
      .run();
  });
}

/** Extract video metadata using ffprobe */
export function probeVideo(filePath: string): Promise<{
  duration: number;
  resolution: string | undefined;
}> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err || !data) {
        resolve({ duration: 0, resolution: undefined });
        return;
      }

      const duration = data.format?.duration ?? 0;
      const videoStream = data.streams?.find(s => s.codec_type === 'video');
      const resolution = videoStream?.width && videoStream?.height
        ? `${videoStream.width}x${videoStream.height}`
        : undefined;

      resolve({ duration, resolution });
    });
  });
}

export { THUMBNAILS_DIR };