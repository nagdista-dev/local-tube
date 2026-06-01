import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Trash2, Clock } from "lucide-react";
import { api } from "../utils/api";
import VideoCard from "../components/VideoCard";
import { SkeletonGrid } from "../components/SkeletonCard";

export default function ContinueWatchingPage() {
  const queryClient = useQueryClient();

  const { data: allHistory = [], isLoading } = useQuery({
    queryKey: ["history", 50],
    queryFn: () => api.videos.history(50),
  });

  // Only include videos that are genuinely in progress
  const videos = allHistory.filter(
    (v) => v.watchProgress > 0.02 && v.watchProgress < 0.98
  );

  const handleRemove = async (id: string) => {
    try {
      await api.videos.deleteProgress(id);
      queryClient.invalidateQueries({ queryKey: ["history"] });
    } catch {
      // fail silently
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Play size={24} className="text-brand" />
        <h1 className="text-2xl font-bold">Continue Watching</h1>
        {!isLoading && (
          <span className="text-sm text-gray-500 ml-1">({videos.length})</span>
        )}
      </div>

      {isLoading && <SkeletonGrid count={12} />}

      {!isLoading && videos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-4">
          <Clock size={48} className="text-gray-700" />
          <div className="text-center">
            <p className="text-lg text-gray-400">Nothing in progress</p>
            <p className="text-sm mt-1 text-gray-600">
              Videos you've started but haven't finished will appear here.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {videos.map((video) => (
          <div key={video.id} className="relative group">
            <VideoCard video={video} />
            <button
              type="button"
              onClick={() => handleRemove(video.id)}
              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-brand text-gray-300 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md backdrop-blur-sm z-10 cursor-pointer border border-white/5"
              title="Remove from Continue Watching"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
