import { Video, Category, VideoListResponse, ScanStatus } from '../types';

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

    history(limit = 12): Promise<Video[]> {
      return request(`${BASE}/videos/history?limit=${limit}`);
    },

    favorites(): Promise<Video[]> {
      return request(`${BASE}/videos/favorites`);
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
  },

  scan: {
    start(): Promise<{ message: string; status: ScanStatus }> {
      return request(`${BASE}/scan`, { method: 'POST' });
    },
    status(): Promise<ScanStatus> {
      return request(`${BASE}/scan/status`);
    },
  },
};

export function streamUrl(id: string): string {
  return `${BASE}/stream/${id}`;
}