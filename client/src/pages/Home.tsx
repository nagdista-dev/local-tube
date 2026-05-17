import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronLeft, Download, Link2, Loader2, AlertTriangle, Clipboard, Play } from 'lucide-react';
import { api } from '../utils/api';
import { useStore } from '../store/useStore';
import VideoCard from '../components/VideoCard';
import VideoGrid from '../components/VideoGrid';
import { SkeletonGrid } from '../components/SkeletonCard';
import { Video, DownloadJob } from '../types';

// ─── Horizontal scroll row ────────────────────────────────────────────────

function VideoRow({ title, videos, viewAllTo }: {
  title: string;
  videos: Video[];
  viewAllTo?: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    rowRef.current?.scrollBy({ left: dir === 'right' ? 600 : -600, behavior: 'smooth' });
  };

  if (videos.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <div className="flex items-center gap-2">
          {viewAllTo && (
            <Link to={viewAllTo} className="text-xs text-gray-400 hover:text-brand transition-colors">
              View all
            </Link>
          )}
          <button onClick={() => scroll('left')}  className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-white transition-colors"><ChevronLeft  size={16} /></button>
          <button onClick={() => scroll('right')} className="p-1.5 rounded-lg hover:bg-surface-200 text-gray-400 hover:text-white transition-colors"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div
        ref={rowRef}
        className="flex gap-4 overflow-x-auto pb-2 scroll-smooth [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]"
      >
        {videos.map(v => (
          <div key={v.id} className="shrink-0 w-52">
            <VideoCard video={v} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Home page ─────────────────────────────────────────────────────────────

export default function Home() {
  const search   = useStore(s => s.filters.search);
  const category = useStore(s => s.filters.category);
  const sort     = useStore(s => s.filters.sort);
  const navigate = useNavigate();

  const { data: history   = [] } = useQuery({ queryKey: ['history'],   queryFn: () => api.videos.history(14) });
  const { data: favorites = [] } = useQuery({ queryKey: ['favorites'], queryFn: api.videos.favorites });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: api.videos.categories, staleTime: 5 * 60_000 });

  // If search or category active, show filtered grid
  if (search || category) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-6">
          {search ? `Results for "${search}"` : category}
        </h1>
        <VideoGrid search={search} category={category} sort={sort} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">


      {/* Continue Watching */}
      {history.some(v => v.watchProgress > 0.02 && v.watchProgress < 0.98) && (
        <>
          <VideoRow
            title="Continue Watching"
            viewAllTo="/history"
            videos={history.filter(v => v.watchProgress > 0.02 && v.watchProgress < 0.98)}
          />
          {/* Division line after Continue Watching row */}
          <div className="border-t border-surface-200/30 my-8 shadow-[0_1px_0_rgba(255,255,255,0.02)]" />
        </>
      )}

      {/* Recently Added */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recently Added</h2>
        </div>
        <VideoGrid sort="date" />
      </section>
    </div>
  );
}