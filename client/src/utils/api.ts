import { Video, Category, VideoListResponse, ScanStatus, DownloadJob, LibraryLocation, DirectoryListing, YouTubeMetadata, CourseStudyPlan } from '../types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Videos ────────────────────────────────────────────────────────────────

export const api = {
  videos: {
    list(params: {
      page?: number;
      pageSize?: number;
      category?: string;
      sort?: string;
    } = {}): Promise<VideoListResponse> {
      const qs = new URLSearchParams();
      if (params.page)     qs.set('page',     String(params.page));
      if (params.pageSize) qs.set('pageSize',  String(params.pageSize));
      if (params.category) qs.set('category',  params.category);
      if (params.sort)     qs.set('sort',      params.sort);
      return request(`${BASE}/videos?${qs}`);
    },

    get(id: string): Promise<Video> {
      return request(`${BASE}/videos/${id}`);
    },

    search(q: string): Promise<{ videos: Video[]; total: number }> {
      return request(`${BASE}/videos/search?q=${encodeURIComponent(q)}`);
    },

    categories(): Promise<Category[]> {
      return request(`${BASE}/videos/categories`);
    },

    setCourse(folderPath: string, isCourse: boolean): Promise<{ folderPath: string; isCourse: boolean }> {
      return request(`${BASE}/videos/categories/course`, {
        method: 'POST',
        body: JSON.stringify({ folderPath, isCourse }),
      });
    },

    getStudyPlan(categoryPath: string): Promise<CourseStudyPlan> {
      return request(`${BASE}/videos/categories/${encodeURIComponent(categoryPath)}/study-plan`);
    },

    saveStudyPlan(categoryPath: string, plan: Omit<CourseStudyPlan, 'category' | 'updatedAt'>): Promise<CourseStudyPlan> {
      return request(`${BASE}/videos/categories/${encodeURIComponent(categoryPath)}/study-plan`, {
        method: 'PUT',
        body: JSON.stringify(plan),
      });
    },

    history(limit = 12): Promise<Video[]> {
      return request(`${BASE}/videos/history?limit=${limit}`);
    },

    favorites(): Promise<Video[]> {
      return request(`${BASE}/videos/favorites`);
    },

    youtube(videoId: string): Promise<YouTubeMetadata> {
      return request(`${BASE}/videos/youtube/${encodeURIComponent(videoId)}`);
    },

    toggleFavorite(id: string): Promise<{ isFavorite: boolean }> {
      return request(`${BASE}/videos/${id}/favorite`, { method: 'POST' });
    },

    saveProgress(id: string, timestamp: number): Promise<{ ok: boolean }> {
      return request(`${BASE}/videos/${id}/progress`, {
        method: 'POST',
        body: JSON.stringify({ timestamp }),
      });
    },

    getProgress(id: string): Promise<{ timestamp: number }> {
      return request(`${BASE}/videos/${id}/progress`);
    },

    deleteProgress(id: string): Promise<{ ok: boolean }> {
      return request(`${BASE}/videos/${id}/progress`, {
        method: 'DELETE',
      });
    },

    markFinished(id: string, finished: boolean): Promise<{ ok: boolean; finished: boolean }> {
      return request(`${BASE}/videos/${id}/finished`, {
        method: 'POST',
        body: JSON.stringify({ finished }),
      });
    },

    updateTitle(id: string, title: string): Promise<Video> {
      return request(`${BASE}/videos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      });
    },

    addExternal(url: string, title?: string, category?: string): Promise<{ videoId: string }> {
      return request(`${BASE}/videos/external`, {
        method: 'POST',
        body: JSON.stringify({ url, title, category }),
      });
    },
  },

  scan: {
    start(): Promise<{ message: string; status: ScanStatus }> {
      return request(`${BASE}/scan`, { method: 'POST' });
    },
    status(): Promise<ScanStatus> {
      return request(`${BASE}/scan/status`);
    },
    location(): Promise<LibraryLocation> {
      return request(`${BASE}/scan/location`);
    },
    directories(path?: string): Promise<DirectoryListing> {
      const qs = new URLSearchParams();
      if (path) qs.set('path', path);
      return request(`${BASE}/scan/directories?${qs}`);
    },
    saveLocation(videosDir: string): Promise<LibraryLocation> {
      return request(`${BASE}/scan/location`, {
        method: 'POST',
        body: JSON.stringify({ videosDir }),
      });
    },
    clearCache(): Promise<{ ok: boolean; message: string }> {
      return request(`${BASE}/scan/clear-cache`, { method: 'POST' });
    },
  },

  download: {
    start(url: string): Promise<{ jobId: string }> {
      return request(`${BASE}/videos/download`, {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
    },
    status(jobId: string): Promise<DownloadJob> {
      return request(`${BASE}/videos/download/jobs/${jobId}`);
    },
  },

  settings: {
    getPomodoro(): Promise<{
      workTime: number;
      shortBreakTime: number;
      longBreakTime: number;
      cyclesBeforeLongBreak: number;
    }> {
      return request(`${BASE}/settings/pomodoro`);
    },
    savePomodoro(settings: {
      workTime: number;
      shortBreakTime: number;
      longBreakTime: number;
      cyclesBeforeLongBreak: number;
    }): Promise<{
      workTime: number;
      shortBreakTime: number;
      longBreakTime: number;
      cyclesBeforeLongBreak: number;
    }> {
      return request(`${BASE}/settings/pomodoro`, {
        method: 'POST',
        body: JSON.stringify(settings),
      });
    },
    getPomodoroTasks(): Promise<{ id: string; name: string; completedCycles: number; isCompleted: number; createdAt: string }[]> {
      return request(`${BASE}/settings/pomodoro/tasks`);
    },
    addPomodoroTask(task: { name: string }): Promise<any> {
      return request(`${BASE}/settings/pomodoro/tasks`, {
        method: 'POST',
        body: JSON.stringify(task),
      });
    },
    updatePomodoroTask(id: string, updates: { name: string; completedCycles: number; isCompleted: number }): Promise<any> {
      return request(`${BASE}/settings/pomodoro/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    deletePomodoroTask(id: string): Promise<any> {
      return request(`${BASE}/settings/pomodoro/tasks/${id}`, { method: 'DELETE' });
    },
    clearPomodoroTasks(): Promise<any> {
      return request(`${BASE}/settings/pomodoro/tasks/clear`, { method: 'POST' });
    },
  },
};

export function streamUrl(id: string): string {
  return `${BASE}/stream/${id}`;
}
