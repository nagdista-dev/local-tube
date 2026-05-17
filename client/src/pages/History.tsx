import { useQuery, useQueryClient } from '@tanstack/react-query';
import { History as HistoryIcon, Clock, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import VideoCard from '../components/VideoCard';
import { SkeletonGrid } from '../components/SkeletonCard';

export default function HistoryPage() {
  const queryClient = useQueryClient();

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['history', 50],
    queryFn:  () => api.videos.history(50),
  });

  const handleDeleteHistory = async (id: string) => {
    try {
      await api.videos.deleteProgress(id);
      // Invalidate queries containing 'history' to instantly update shelves and grids
      queryClient.invalidateQueries({ queryKey: ['history'] });
    } catch {
      // Fail silently
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <HistoryIcon size={24} className="text-brand" />
        <h1 className="text-2xl font-bold">Watch History</h1>
        <span className="text-sm text-gray-500 ml-1">({videos.length})</span>
      </div>

      {isLoading && <SkeletonGrid count={12} />}

      {!isLoading && videos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-3">
          <Clock size={48} className="text-gray-700" />
          <p>No watch history yet. Start watching some videos!</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {videos.map(video => (
          <div key={video.id} className="relative group">
            <VideoCard video={video} />
            <button
              type="button"
              onClick={() => handleDeleteHistory(video.id)}
              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-brand text-gray-300 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md backdrop-blur-sm z-10 cursor-pointer border border-white/5"
              title="Remove from watch history"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}