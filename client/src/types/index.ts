export interface Video {
  id: string;
  title: string;
  filename: string;
  path: string;
  relativePath: string;
  category: string;
  subcategory?: string;
  duration: number;
  fileSize: number;
  resolution?: string;
  thumbnail?: string;
  addedAt: string;
  lastWatched?: string;
  watchProgress: number; // 0–1
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

export interface CourseStudyPlan {
  category: string;
  dailyMinutes: number;
  studyDays: number[];
  taskChecks: Record<string, Record<string, boolean>>;
  updatedAt?: string;
}

export interface ScanStatus {
  status: 'idle' | 'scanning' | 'complete' | 'error';
  total: number;
  processed: number;
  message?: string;
  startedAt?: string;
}

export interface LibraryLocation {
  videosDir: string;
}

export interface DirectoryListing {
  currentPath: string;
  parentPath: string | null;
  entries: {
    name: string;
    path: string;
  }[];
}

export interface VideoListResponse {
  videos: Video[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface YouTubeComment {
  id: string;
  author: string;
  text: string;
  likeCount: number;
  publishedAt: string;
}

export interface YouTubeMetadata {
  videoId: string;
  title: string;
  description: string;
  durationSeconds: number;
  channelTitle: string;
  publishedAt: string;
  comments: YouTubeComment[];
  unavailableReason?: string;
  commentsUnavailableReason?: string;
}

export type SortOption =
  | 'date'
  | 'date-asc'
  | 'name'
  | 'name-desc'
  | 'size'
  | 'size-asc'
  | 'duration'
  | 'duration-asc'
  | 'progress'
  | 'progress-asc';

export interface FilterState {
  sort:     SortOption;
  category: string;
  search:   string;
}

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
}
