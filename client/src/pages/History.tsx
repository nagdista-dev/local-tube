import { useQuery } from '@tanstack/react-query';
import { History, Clock } from 'lucide-react';
import { api } from '../utils/api';
import VideoCard from '../components/VideoCard';
import { SkeletonGrid } from '../components/SkeletonCard';

export default function HistoryPage() {
  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['history', 50],
    queryFn:  () => api.videos.history(50),
  });

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <History size={24} className="text-brand" />
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
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </div>
  );
}