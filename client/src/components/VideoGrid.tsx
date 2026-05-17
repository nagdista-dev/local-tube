import { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import VideoCard from './VideoCard';
import { SkeletonGrid } from './SkeletonCard';
import { Video } from '../types';
import { Inbox } from 'lucide-react';

interface VideoGridProps {
  category?: string;
  sort?:     string;
  search?:   string;
}

export default function VideoGrid({ category, sort, search }: VideoGridProps) {
  const PAGE_SIZE = 60;
  const loaderRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey:     ['videos', { category, sort, search }],
    queryFn:      ({ pageParam = 1 }) => {
      if (search) {
        return api.videos.search(search).then(r => ({
          videos: r.videos,
          total:  r.total,
          page:   1,
          pageSize: r.videos.length,
          hasMore: false,
        }));
      }
      return api.videos.list({ page: pageParam, pageSize: PAGE_SIZE, category, sort });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
  });

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allVideos: Video[] = data?.pages.flatMap(p => p.videos) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  if (isLoading) return <SkeletonGrid count={24} />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-3">
        <p className="text-lg">Failed to load videos</p>
        <p className="text-sm">Make sure the server is running</p>
      </div>
    );
  }

  if (allVideos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-4">
        <Inbox size={48} className="text-gray-700" />
        <div className="text-center">
          <p className="text-lg text-gray-400">No videos found</p>
          <p className="text-sm mt-1">
            {search
              ? `No results for "${search}"`
              : 'Scan your library to get started'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {total > 0 && (
        <p className="text-xs text-gray-500 mb-4">
          {total.toLocaleString()} video{total !== 1 ? 's' : ''}
          {category ? ` in ${category}` : ''}
          {search ? ` matching "${search}"` : ''}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {allVideos.map(video => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>

      {/* Infinite scroll trigger */}
      <div ref={loaderRef} className="mt-8">
        {isFetchingNextPage && <SkeletonGrid count={12} />}
      </div>
    </div>
  );
}