import { useEffect, useRef } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import VideoCard from './VideoCard';
import { SkeletonGrid } from './SkeletonCard';
import { Category, SortOption, Video } from '../types';
import { Inbox, Grid, List, BookOpen, CheckCircle2, ArrowUpDown } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDuration } from '../utils/format';

interface VideoGridProps {
  category?: string;
  sort?:     string;
  search?:   string;
}

function findCategoryByPath(categories: Category[], folderPath: string): Category | undefined {
  for (const category of categories) {
    if (category.path === folderPath) return category;
    const child = findCategoryByPath(category.subcategories || [], folderPath);
    if (child) return child;
  }
  return undefined;
}

const COURSE_SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'A to Z (filename)' },
  { value: 'name-desc', label: 'Z to A (filename)' },
  { value: 'date', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'duration', label: 'Longest first' },
  { value: 'duration-asc', label: 'Shortest first' },
  { value: 'progress-asc', label: 'Unfinished first' },
  { value: 'progress', label: 'Most progress' },
];

export default function VideoGrid({ category, sort, search }: VideoGridProps) {
  const viewLayout = useStore(s => s.viewLayout);
  const setViewLayout = useStore(s => s.setViewLayout);
  const setSort = useStore(s => s.setSort);
  const queryClient = useQueryClient();
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

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: api.videos.categories,
    staleTime: 5 * 60_000,
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
  const activeCategory = category ? findCategoryByPath(categories, category) : undefined;
  const courseProgress =
    activeCategory?.totalDuration && activeCategory.totalDuration > 0
      ? Math.min((activeCategory.watchedDuration || 0) / activeCategory.totalDuration, 1)
      : 0;
  const displayLayout = activeCategory?.isCourse ? "list" : viewLayout;

  const refreshProgress = () => {
    queryClient.invalidateQueries({ queryKey: ['videos'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['history'] });
  };

  const toggleCourse = async () => {
    if (!category) return;
    await api.videos.setCourse(category, !activeCategory?.isCourse);
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  };

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
      <div className="flex items-center justify-between mb-4 gap-4">
        {total > 0 ? (
          <p className="text-xs text-gray-500">
            {total.toLocaleString()} video{total !== 1 ? 's' : ''}
            {activeCategory ? ` in ${activeCategory.name}` : category ? ` in ${category}` : ''}
            {search ? ` matching "${search}"` : ''}
          </p>
        ) : (
          <div />
        )}

        {/* Layout Mode Switcher */}
        <div className="flex items-center gap-2">
          {category && activeCategory && (
            <button
              onClick={toggleCourse}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeCategory?.isCourse
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-surface-300 text-gray-400 hover:text-white hover:border-brand/50"
              }`}
            >
              {activeCategory?.isCourse ? <CheckCircle2 size={14} /> : <BookOpen size={14} />}
              {activeCategory?.isCourse ? "Course Folder" : "Mark Folder As Course"}
            </button>
          )}
          {activeCategory?.isCourse && (
            <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-surface-300 bg-surface-100/60 text-xs text-gray-300">
              <ArrowUpDown size={14} className="text-emerald-300" />
              <span className="hidden sm:inline">Sort</span>
              <select
                value={(sort || 'name') as SortOption}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="bg-transparent text-gray-100 focus:outline-none"
              >
                {COURSE_SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value} className="bg-surface-100 text-gray-100">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex items-center gap-1 bg-surface-100/60 backdrop-blur-md rounded-lg p-0.5 border border-surface-200/40">
          <button
            onClick={() => setViewLayout("grid")}
            disabled={activeCategory?.isCourse}
            className={`p-1.5 rounded-md transition-all ${
              displayLayout === "grid"
                ? "bg-surface-300 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
            title="Grid view"
          >
            <Grid size={14} />
          </button>
          <button
            onClick={() => setViewLayout("list")}
            className={`p-1.5 rounded-md transition-all ${
              displayLayout === "list"
                ? "bg-surface-300 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
            title="List view"
          >
            <List size={14} />
          </button>
          </div>
        </div>
      </div>

      {activeCategory?.isCourse && (
        <div className="mb-5 rounded-2xl border border-surface-200/70 bg-surface-100/50 p-5 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold uppercase tracking-widest mb-2">
                <CheckCircle2 size={15} />
                Course
              </div>
              <h2 className="text-xl font-bold text-white">{activeCategory.name}</h2>
              <p className="text-sm text-gray-400 mt-1">
                {activeCategory.completedCount || 0} of {activeCategory.count} videos finished
                {activeCategory.remainingDuration ? ` · ${formatDuration(activeCategory.remainingDuration)} left` : " · Complete"}
              </p>
            </div>
            <div className="min-w-[220px]">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                <span>{Math.round(courseProgress * 100)}% complete</span>
                <span>{formatDuration(activeCategory.watchedDuration || 0)} watched</span>
              </div>
              <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${courseProgress * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {displayLayout === "list" ? (
        <div className="flex flex-col gap-3 w-full">
          {allVideos.map(video => (
            <VideoCard
              key={video.id}
              video={video}
              layout="list"
              showCourseControls={Boolean(activeCategory?.isCourse)}
              onProgressChange={refreshProgress}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {allVideos.map(video => (
            <VideoCard
              key={video.id}
              video={video}
              showCourseControls={Boolean(activeCategory?.isCourse)}
              onProgressChange={refreshProgress}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      <div ref={loaderRef} className="mt-8">
        {isFetchingNextPage && <SkeletonGrid count={12} />}
      </div>
    </div>
  );
}
