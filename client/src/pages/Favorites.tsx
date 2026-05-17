import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { api } from '../utils/api';
import VideoCard from '../components/VideoCard';
import { SkeletonGrid } from '../components/SkeletonCard';

export default function FavoritesPage() {
  const { data: videos = [], isLoading, refetch } = useQuery({
    queryKey: ['favorites'],
    queryFn:  api.videos.favorites,
  });

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Heart size={24} className="text-brand fill-brand" />
        <h1 className="text-2xl font-bold">Favorites</h1>
        <span className="text-sm text-gray-500 ml-1">({videos.length})</span>
      </div>

      {isLoading && <SkeletonGrid count={12} />}

      {!isLoading && videos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-3">
          <Heart size={48} className="text-gray-700" />
          <p>No favorites yet. Click the ♥ on any video to save it here.</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {videos.map(video => (
          <VideoCard
            key={video.id}
            video={video}
            onFavoriteToggle={() => refetch()}
          />
        ))}
      </div>
    </div>
  );
}