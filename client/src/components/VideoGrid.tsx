import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import VideoCard from './VideoCard';
import { SkeletonGrid } from './SkeletonCard';
import { Category, SortOption, Video } from '../types';
import {
  Inbox,
  Grid,
  List,
  BookOpen,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ListVideo,
  Target,
  BarChart3,
  Clock,
  CalendarCheck,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDuration } from '../utils/format';
import CourseStudyPlanner from './CourseStudyPlanner';

/* ─── Course‑page tab types ─────────────────────────────────────── */
type CourseTab = 'videos' | 'studyPlan' | 'progress';

function CourseTabs({
  activeTab,
  onTabChange,
  videoCount,
  t,
}: {
  activeTab: CourseTab;
  onTabChange: (tab: CourseTab) => void;
  videoCount: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const tabs: { id: CourseTab; label: string; icon: typeof ListVideo; badge?: string }[] = [
    { id: 'videos',    label: t('videoGrid.tabVideos'),    icon: ListVideo, badge: String(videoCount) },
    { id: 'studyPlan', label: t('videoGrid.tabStudyPlan'), icon: Target },
    { id: 'progress',  label: t('videoGrid.tabProgress'),  icon: BarChart3 },
  ];

  return (
    <div
      className="flex gap-1 px-1 pt-1 pb-0 mb-3 border-b border-surface-200/50 overflow-x-auto"
      role="tablist"
    >
      {tabs.map(({ id, label, icon: Icon, badge }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              active
                ? 'border-brand text-white'
                : 'border-transparent text-gray-500 hover:text-gray-200'
            }`}
          >
            <Icon size={15} />
            {label}
            {badge && (
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                active
                  ? 'bg-brand/20 text-brand'
                  : 'bg-surface-200/60 text-gray-500'
              }`}>
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CourseProgressPanel({
  activeCategory,
  courseProgress,
  allVideos,
  t,
}: {
  activeCategory: Category;
  courseProgress: number;
  allVideos: { duration: number; watchProgress: number }[];
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const totalDuration = allVideos.reduce((s, v) => s + v.duration, 0);
  const watchedDuration = allVideos.reduce(
    (s, v) => s + Math.max(v.duration * Math.min(v.watchProgress, 1), 0),
    0,
  );
  const completedCount = allVideos.filter(v => v.watchProgress >= 0.98).length;
  const remainingDuration = Math.max(totalDuration - watchedDuration, 0);
  const progressPercent = Math.round(courseProgress * 100);

  return (
    <div className="rounded-2xl border border-surface-200/50 bg-surface-50/30 overflow-hidden shadow-sm mb-4 animate-fade-in">
      {/* Hero progress section */}
      <div className="relative p-6 bg-gradient-to-br from-brand/10 via-surface-100/50 to-surface-50/30 border-b border-surface-200/50">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand/20 text-brand">
            <BarChart3 size={15} />
          </span>
          <span className="text-[11px] font-bold text-brand uppercase tracking-widest">
            {t('videoGrid.tabProgress')}
          </span>
        </div>
        <h3 className="text-2xl font-black text-white tracking-tight mb-1">{activeCategory.name}</h3>
        <p className="text-sm text-gray-400 max-w-2xl leading-relaxed mb-5">
          {t('videoGrid.progressSubtitle')}
        </p>

        <div className="max-w-2xl">
          <div className="flex justify-between items-end mb-1.5">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">{t('videoGrid.overallProgress')}</span>
            <span className="text-sm font-bold text-white">{progressPercent}%</span>
          </div>
          <div className="h-2.5 w-full bg-surface-300/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-all duration-500 ease-out relative"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute inset-0 bg-white/20 w-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        <div className="rounded-xl bg-surface-200/40 p-4 border border-surface-200/50 shadow-sm hover:bg-surface-200/60 transition-colors">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <div className="p-1.5 rounded-lg bg-surface-300/30"><ListVideo size={16} className="text-brand" /></div>
            <span className="text-[10px] font-bold uppercase tracking-wider">{t('videoGrid.totalVideos')}</span>
          </div>
          <p className="text-lg font-black text-white leading-none tracking-tight mb-1.5">{allVideos.length}</p>
          <p className="text-[11px] font-medium text-gray-500 leading-snug">{t('videoGrid.totalDuration', { duration: formatDuration(totalDuration) })}</p>
        </div>

        <div className="rounded-xl bg-surface-200/40 p-4 border border-surface-200/50 shadow-sm hover:bg-surface-200/60 transition-colors">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <div className="p-1.5 rounded-lg bg-surface-300/30"><CheckCircle2 size={16} className="text-emerald-400" /></div>
            <span className="text-[10px] font-bold uppercase tracking-wider">{t('videoGrid.completed')}</span>
          </div>
          <p className="text-lg font-black text-white leading-none tracking-tight mb-1.5">{completedCount} / {allVideos.length}</p>
          <p className="text-[11px] font-medium text-gray-500 leading-snug">{t('videoGrid.percentDone', { percent: progressPercent })}</p>
        </div>

        <div className="rounded-xl bg-surface-200/40 p-4 border border-surface-200/50 shadow-sm hover:bg-surface-200/60 transition-colors">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <div className="p-1.5 rounded-lg bg-surface-300/30"><Clock size={16} className="text-sky-400" /></div>
            <span className="text-[10px] font-bold uppercase tracking-wider">{t('videoGrid.remaining')}</span>
          </div>
          <p className="text-lg font-black text-white leading-none tracking-tight mb-1.5">{formatDuration(remainingDuration)}</p>
          <p className="text-[11px] font-medium text-gray-500 leading-snug">{t('videoGrid.videosLeft', { count: allVideos.length - completedCount })}</p>
        </div>

        <div className="rounded-xl bg-surface-200/40 p-4 border border-surface-200/50 shadow-sm hover:bg-surface-200/60 transition-colors">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <div className="p-1.5 rounded-lg bg-surface-300/30"><CalendarCheck size={16} className="text-amber-400" /></div>
            <span className="text-[10px] font-bold uppercase tracking-wider">{t('videoGrid.watched')}</span>
          </div>
          <p className="text-lg font-black text-white leading-none tracking-tight mb-1.5">{formatDuration(watchedDuration)}</p>
          <p className="text-[11px] font-medium text-gray-500 leading-snug">{t('videoGrid.ofTotal', { duration: formatDuration(totalDuration) })}</p>
        </div>
      </div>
    </div>
  );
}
import { useTranslation } from '../i18n';

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

// Sort field + direction pairs shown in toolbar
const SORT_FIELDS: { field: string; labelKey: string }[] = [
  { field: 'date',     labelKey: 'videoGrid.sortDate'     },
  { field: 'name',     labelKey: 'videoGrid.sortName'     },
  { field: 'duration', labelKey: 'videoGrid.sortDuration' },
  { field: 'size',     labelKey: 'videoGrid.sortSize'     },
  { field: 'progress', labelKey: 'videoGrid.sortProgress' },
];

// Map field + direction to a SortOption value
function toSortOption(field: string, dir: 'asc' | 'desc'): SortOption {
  const map: Record<string, { asc: SortOption; desc: SortOption }> = {
    date:     { desc: 'date',         asc: 'date-asc'      },
    name:     { asc:  'name',         desc: 'name-desc'    },
    duration: { desc: 'duration',     asc: 'duration-asc'  },
    size:     { desc: 'size',         asc: 'size-asc'      },
    progress: { desc: 'progress',     asc: 'progress-asc'  },
  };
  return map[field]?.[dir] ?? 'date';
}

// Reverse-map a SortOption back to {field, dir}
function fromSortOption(sort: string): { field: string; dir: 'asc' | 'desc' } {
  const map: Record<string, { field: string; dir: 'asc' | 'desc' }> = {
    'date':          { field: 'date',     dir: 'desc' },
    'date-asc':      { field: 'date',     dir: 'asc'  },
    'name':          { field: 'name',     dir: 'asc'  },
    'name-desc':     { field: 'name',     dir: 'desc' },
    'duration':      { field: 'duration', dir: 'desc' },
    'duration-asc':  { field: 'duration', dir: 'asc'  },
    'size':          { field: 'size',     dir: 'desc' },
    'size-asc':      { field: 'size',     dir: 'asc'  },
    'progress':      { field: 'progress', dir: 'desc' },
    'progress-asc':  { field: 'progress', dir: 'asc'  },
  };
  return map[sort] ?? { field: 'date', dir: 'desc' };
}

export default function VideoGrid({ category, sort, search }: VideoGridProps) {
  const [courseTab, setCourseTab] = useState<CourseTab>('videos');
  const { t } = useTranslation();
  const viewLayout   = useStore(s => s.viewLayout);
  const setViewLayout = useStore(s => s.setViewLayout);
  const setSort      = useStore(s => s.setSort);
  const queryClient  = useQueryClient();
  const PAGE_SIZE    = 60;
  const loaderRef    = useRef<HTMLDivElement>(null);

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
          videos:   r.videos,
          total:    r.total,
          page:     1,
          pageSize: r.videos.length,
          hasMore:  false,
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
    queryFn:  api.videos.categories,
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
  const displayLayout = activeCategory?.isCourse ? 'list' : viewLayout;

  // Parse current sort field + direction
  const { field: sortField, dir: sortDir } = fromSortOption(sort ?? 'date');

  const defaultSortDir = (field: string): 'asc' | 'desc' =>
    field === 'name' ? 'asc' : 'desc';

  const handleSortField = (field: string) => {
    if (field === sortField) {
      setSort(toSortOption(field, sortDir === 'desc' ? 'asc' : 'desc'));
    } else {
      setSort(toSortOption(field, defaultSortDir(field)));
    }
  };

  const toggleSortDir = () => {
    setSort(toSortOption(sortField, sortDir === 'desc' ? 'asc' : 'desc'));
  };

  const refreshProgress = () => {
    queryClient.invalidateQueries({ queryKey: ['videos'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['history'] });
    if (category) {
      queryClient.invalidateQueries({ queryKey: ['course-videos', category] });
      queryClient.invalidateQueries({ queryKey: ['course-study-plan', category] });
    }
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
        <p className="text-lg">{t("videoGrid.loadError")}</p>
        <p className="text-sm">{t("videoGrid.serverHint")}</p>
      </div>
    );
  }

  if (allVideos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-4">
        <Inbox size={48} className="text-gray-700" />
        <div className="text-center">
          <p className="text-lg text-gray-400">{t("videoGrid.noVideos")}</p>
          <p className="text-sm mt-1">
            {search
              ? t("videoGrid.noResults", { search })
              : t("videoGrid.scanHint")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between mb-2 gap-2">

        {/* Left: video count */}
        {total > 0 ? (
          <p className="text-xs text-gray-500 shrink-0">
            {search
              ? t("videoGrid.countMatching", { count: total.toLocaleString(), search })
              : activeCategory || category
                ? t("videoGrid.countInFolder", {
                    count: total.toLocaleString(),
                    name: activeCategory?.name ?? category ?? "",
                  })
                : `${total.toLocaleString()}`}
          </p>
        ) : (
          <div />
        )}

        {/* Right: controls */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* Mark as Course button (only when a folder is selected) */}
          {category && activeCategory && (
            <button
              onClick={toggleCourse}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeCategory?.isCourse
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-surface-300 text-gray-400 hover:text-white hover:border-brand/50'
              }`}
            >
              {activeCategory?.isCourse ? <CheckCircle2 size={13} /> : <BookOpen size={13} />}
              {activeCategory?.isCourse ? t("videoGrid.course") : t("videoGrid.markAsCourse")}
            </button>
          )}

          {/* ── Sort toolbar ── always visible, not gated behind isCourse ── */}
          {!search && (
            <div className="flex items-center gap-1 bg-surface-100/60 backdrop-blur-md rounded-lg px-1.5 py-1 border border-surface-200/40">
              <ArrowUpDown size={12} className="text-gray-500 mr-0.5 shrink-0" />

              {/* Sort field buttons */}
              {SORT_FIELDS.map(({ field, labelKey }) => (
                <button
                  key={field}
                  onClick={() => handleSortField(field)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                    sortField === field
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-surface-300/50'
                  }`}
                  title={t("videoGrid.sortBy", { label: t(labelKey) })}
                >
                  {t(labelKey)}
                </button>
              ))}

              {/* Direction toggle */}
              <button
                onClick={toggleSortDir}
                className="p-1 rounded hover:bg-surface-300/50 text-gray-400 hover:text-white transition-all"
                title={sortDir === 'desc' ? t("videoGrid.sortDesc") : t("videoGrid.sortAsc")}
              >
                {sortDir === 'desc'
                  ? <ArrowDown size={13} className="text-brand" />
                  : <ArrowUp   size={13} className="text-brand" />
                }
              </button>
            </div>
          )}

          {/* Grid / List toggle */}
          <div className="flex items-center gap-1 bg-surface-100/60 backdrop-blur-md rounded-lg p-0.5 border border-surface-200/40">
            <button
              onClick={() => setViewLayout('grid')}
              disabled={activeCategory?.isCourse}
              className={`p-1.5 rounded-md transition-all ${
                displayLayout === 'grid'
                  ? 'bg-surface-300 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              title={t("videoGrid.gridView")}
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setViewLayout('list')}
              className={`p-1.5 rounded-md transition-all ${
                displayLayout === 'list'
                  ? 'bg-surface-300 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              title={t("videoGrid.listView")}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Course tabbed layout ────────────────────────────────────── */}
      {activeCategory?.isCourse && category ? (
        <>
          <CourseTabs
            activeTab={courseTab}
            onTabChange={setCourseTab}
            videoCount={allVideos.length}
            t={t}
          />

          {courseTab === 'videos' && (
            displayLayout === 'list' ? (
              <div className="flex flex-col gap-2 w-full animate-fade-in">
                {allVideos.map(video => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    layout="list"
                    showCourseControls
                    onProgressChange={refreshProgress}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 animate-fade-in">
                {allVideos.map(video => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    showCourseControls
                    onProgressChange={refreshProgress}
                  />
                ))}
              </div>
            )
          )}

          {courseTab === 'studyPlan' && (
            <div className="animate-fade-in">
              <CourseStudyPlanner
                categoryPath={category}
                courseTitle={activeCategory.name}
              />
            </div>
          )}

          {courseTab === 'progress' && (
            <div className="animate-fade-in">
              <CourseProgressPanel
                activeCategory={activeCategory}
                courseProgress={courseProgress}
                allVideos={allVideos}
                t={t}
              />
            </div>
          )}
        </>
      ) : (
        /* ── Non-course video list ─────────────────────────────────── */
        displayLayout === 'list' ? (
          <div className="flex flex-col gap-2 w-full">
            {allVideos.map(video => (
              <VideoCard
                key={video.id}
                video={video}
                layout="list"
                onProgressChange={refreshProgress}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
            {allVideos.map(video => (
              <VideoCard
                key={video.id}
                video={video}
                onProgressChange={refreshProgress}
              />
            ))}
          </div>
        )
      )}

      {/* Infinite scroll trigger */}
      <div ref={loaderRef} className="mt-4">
        {isFetchingNextPage && <SkeletonGrid count={12} />}
      </div>
    </div>
  );
}
