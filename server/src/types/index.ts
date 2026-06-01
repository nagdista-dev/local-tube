// ─── Core Entities ─────────────────────────────────────────────────────────

export interface Video {
  id: string;
  title: string;
  filename: string;
  path: string;
  relativePath: string;
  category: string;
  subcategory?: string;
  duration: number;        // seconds
  fileSize: number;        // bytes
  resolution?: string;     // e.g. "1920x1080"
  thumbnail?: string;      // URL path to thumbnail
  addedAt: string;         // ISO date string
  lastWatched?: string;    // ISO date string
  watchProgress: number;   // 0–1 ratio
  isFavorite: boolean;
  tags: string[];
}

export interface Category {
  name: string;
  path: string;
  count: number;
  subcategories: Category[];
  isCourse?: boolean;
  totalDuration?: number;
  watchedDuration?: number;
  completedCount?: number;
  remainingDuration?: number;
}

export interface ScanStatus {
  status: 'idle' | 'scanning' | 'complete' | 'error';
  total: number;
  processed: number;
  message?: string;
  startedAt?: string;
}

export interface VideoListResponse {
  videos: Video[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ProgressUpdate {
  videoId: string;
  timestamp: number;   // seconds
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
