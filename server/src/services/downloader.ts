import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { Video } from '../types';
import { videoDb } from './database';
import { probeVideo, enqueueThumbnail } from './thumbnail';
import { deriveCategories, titleFromFilename, generateTags } from './scanner';

export interface DownloadJob {
  id: string;
  url: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  percent: number;
  speed: string;
  eta: string;
  title: string;
  error?: string;
  videoId?: string;
  filePath?: string;
}

const VIDEOS_DIR = process.env.VIDEOS_DIR || path.join(process.env.HOME || '', 'Videos');
const DOWNLOADS_DIR = path.join(VIDEOS_DIR, 'Downloads');

// Ensure Downloads folder exists inside videos root
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// In-memory download jobs map
const jobs = new Map<string, DownloadJob>();

/** Start downloading a video in the background and return its job ID */
export function startDownload(url: string): string {
  const jobId = uuidv4();
  const job: DownloadJob = {
    id: jobId,
    url,
    status: 'pending',
    percent: 0,
    speed: 'N/A',
    eta: 'N/A',
    title: 'Extracting video metadata...',
  };

  jobs.set(jobId, job);

  // Spawn yt-dlp background process
  const outputTemplate = path.join(DOWNLOADS_DIR, '%(title)s.%(ext)s');
  console.log(`[Downloader] Starting download for: ${url} (Job: ${jobId})`);
  
  const child = spawn('yt-dlp', [
    '-o', outputTemplate,
    '--no-playlist',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    '--no-check-certificates',
    url
  ]);

  let stderrOutput = '';

  child.stdout.on('data', (data) => {
    const output = data.toString();
    const lines = output.split('\n');

    for (const line of lines) {
      // 1. Capture absolute path to target file
      const destMatch = line.match(/\[download\]\s+Destination:\s+(.+)/i);
      const alreadyMatch = line.match(/\[download\]\s+(.+?)\s+has already been downloaded/i);
      const mergerMatch = line.match(/\[(?:Merger|ffmpeg)\]\s+Merging\s+formats\s+into\s+"?(.+?)"?$/i);

      const filePath = destMatch?.[1] || alreadyMatch?.[1] || mergerMatch?.[1];
      if (filePath) {
        job.filePath = filePath.trim();
        const filename = path.basename(filePath.trim());
        job.title = titleFromFilename(filename);
        job.status = 'downloading';
      }

      // 2. Parse download progress: percentage, speed, and ETA
      const progressMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+(?:~\s*)?([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/i);
      if (progressMatch) {
        job.percent = parseFloat(progressMatch[1]);
        job.speed = progressMatch[3];
        job.eta = progressMatch[4];
        job.status = 'downloading';
      }
    }
  });

  child.stderr.on('data', (data) => {
    stderrOutput += data.toString();
  });

  child.on('close', async (code) => {
    if (code !== 0) {
      job.status = 'failed';
      job.error = stderrOutput.trim() || `yt-dlp process exited with code ${code}`;
      console.error(`[Downloader] Job ${jobId} failed: ${job.error}`);
      return;
    }

    try {
      if (!job.filePath) {
        job.status = 'failed';
        job.error = 'Could not determine the downloaded file destination path.';
        return;
      }

      const absPath = path.resolve(job.filePath);
      if (!fs.existsSync(absPath)) {
        job.status = 'failed';
        job.error = `Downloaded file not found on disk at: ${absPath}`;
        return;
      }

      console.log(`[Downloader] Job ${jobId} finished downloading. Cataloging file: ${absPath}`);

      // Probe metadata and create Video record
      const { duration, resolution } = await probeVideo(absPath);
      const stat = fs.statSync(absPath);
      const relativePath = path.relative(VIDEOS_DIR, absPath);
      const { category, subcategory } = deriveCategories(relativePath);
      const filename = path.basename(absPath);
      const title = titleFromFilename(filename);
      const tags = generateTags(title, category);

      const video: Video = {
        id: uuidv4(),
        title,
        filename,
        path: absPath,
        relativePath,
        category,
        subcategory,
        duration,
        fileSize: stat.size,
        resolution,
        thumbnail: undefined,
        addedAt: stat.birthtime.toISOString(),
        isFavorite: false,
        tags,
        watchProgress: 0,
      };

      // Save directly to the sqlite database
      videoDb.upsert(video);

      // Enqueue thumbnail generation in background (non-blocking)
      enqueueThumbnail(video.path, video.id, video.duration).then(thumbUrl => {
        if (thumbUrl) {
          import('./database').then(({ default: db }) => {
            db.prepare('UPDATE videos SET thumbnail = ? WHERE id = ?').run(thumbUrl, video.id);
          }).catch(() => {});
        }
      });

      // Update job to completed
      job.videoId = video.id;
      job.percent = 100;
      job.status = 'completed';
      console.log(`[Downloader] Job ${jobId} completed successfully! Assigned video ID: ${video.id}`);

    } catch (err: any) {
      job.status = 'failed';
      job.error = err.message || 'Error occurred while cataloging downloaded file.';
      console.error(`[Downloader] Job ${jobId} post-processing error:`, err);
    }
  });

  return jobId;
}

/** Get status of an active or completed download job */
export function getJobStatus(jobId: string): DownloadJob | null {
  return jobs.get(jobId) || null;
}
