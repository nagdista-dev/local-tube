import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  SkipForward,
  ChevronLeft,
  Timer,
  ChevronsRight,
  RectangleHorizontal,
  PictureInPicture2,
  CheckCircle2,
  BookOpen,
  ListVideo,
  Circle,
  MessageCircle,
  FileText,
  Youtube,
} from "lucide-react";
import { api, streamUrl } from "../utils/api";
import { formatDuration, formatFileSize, isArabic } from "../utils/format";
import { Category, Video, VideoListResponse, YouTubeMetadata } from "../types";

type ViewMode = "normal" | "theater" | "mini";
type PlayerTab = "details" | "videos" | "comments" | "description";

// ─── Progress bar component ───────────────────────────────────────────────

function ProgressBar({
  current,
  duration,
  buffered,
  onSeek,
}: {
  current: number;
  duration: number;
  buffered: number;
  onSeek: (t: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleSeek = useCallback(
    (clientX: number) => {
      if (!barRef.current || duration <= 0) return;
      const rect = barRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      onSeek(ratio * duration);
    },
    [duration, onSeek],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleSeek(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleSeek(e.touches[0].clientX);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleSeek(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length > 0) {
        handleSeek(moveEvent.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, handleSeek]);

  const played = duration > 0 ? (current / duration) * 100 : 0;
  const buff = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={barRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={`group relative rounded-full cursor-pointer transition-all duration-150 ${
        isDragging ? "h-3" : "h-1.5 hover:h-3"
      } bg-white/20`}
    >
      <div
        className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
        style={{ width: `${buff}%` }}
      />
      <div
        className="absolute inset-y-0 left-0 bg-brand rounded-full"
        style={{ width: `${played}%` }}
      >
        <div
          className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full transition-transform shadow-lg ${
            isDragging ? "scale-100" : "scale-0 group-hover:scale-100"
          }`}
        />
      </div>
    </div>
  );
}

// ─── Player page ──────────────────────────────────────────────────────────

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SAVE_INTERVAL_MS = 5000;

const SLEEP_OPTIONS = [
  { label: "Off", value: null },
  { label: "5 min", value: 300 },
  { label: "15 min", value: 900 },
  { label: "30 min", value: 1800 },
  { label: "45 min", value: 2700 },
  { label: "1 hour", value: 3600 },
];

function formatSleepTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}

function getYouTubeId(url: string) {
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function videoBelongsToFolder(video: Video, folderPath: string): boolean {
  const relativePath = normalizeRelativePath(video.relativePath);
  return (
    relativePath === folderPath ||
    relativePath.startsWith(`${folderPath}/`) ||
    (folderPath === "Uncategorized" && !relativePath.includes("/"))
  );
}

function findCourseForVideo(
  categories: Category[],
  video: Video,
): Category | undefined {
  const matches: Category[] = [];
  const visit = (category: Category) => {
    if (category.isCourse && videoBelongsToFolder(video, category.path)) {
      matches.push(category);
    }
    category.subcategories.forEach(visit);
  };

  categories.forEach(visit);
  return matches.sort((a, b) => b.path.length - a.path.length)[0];
}

function CoursePlayerSidebar({
  currentVideoId,
  videos,
  courseTitle,
  courseProgress,
  completedCount,
  remainingDuration,
  onSelect,
  onToggleWatched,
  embedded = false,
}: {
  currentVideoId: string;
  videos: Video[];
  courseTitle: string;
  courseProgress: number;
  completedCount: number;
  remainingDuration: number;
  onSelect: (id: string) => void;
  onToggleWatched?: (video: Video) => void;
  embedded?: boolean;
}) {
  return (
    <aside
      className={
        embedded
          ? "overflow-hidden"
          : "rounded-[1.75rem] border border-surface-200/70 bg-surface-100/80 shadow-2xl shadow-black/20 backdrop-blur-xl overflow-hidden"
      }
    >
      <div
        className={`${embedded ? "p-5" : "p-5 border-b border-surface-200/70 bg-gradient-to-br from-surface-50 via-surface-100 to-surface-200"}`}
      >
        <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-widest mb-2">
          <BookOpen size={15} />
          Course Playlist
        </div>
        <h2 className="text-lg font-bold text-white leading-tight">
          {courseTitle}
        </h2>
        <p className="text-xs text-gray-400 mt-2">
          {completedCount} of {videos.length} lessons finished
          {remainingDuration > 0
            ? ` · ${formatDuration(remainingDuration)} left`
            : " · Complete"}
        </p>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>{Math.round(courseProgress * 100)}% complete</span>
            <span>
              {formatDuration(
                videos.reduce(
                  (sum, v) =>
                    sum +
                    Math.max(v.duration * Math.min(v.watchProgress, 1), 0),
                  0,
                ),
              )}{" "}
              watched
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${courseProgress * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div
        className={`${embedded ? "max-h-[56vh]" : "max-h-[52vh] lg:max-h-[calc(100vh-19rem)]"} overflow-y-auto p-2`}
      >
        {videos.map((lesson, index) => {
          const active = lesson.id === currentVideoId;
          const finished = lesson.watchProgress >= 0.98;
          const progress = Math.max(0, Math.min(lesson.watchProgress, 1));

          return (
            <div
              key={lesson.id}
              className={`w-full rounded-2xl p-3 transition-all mb-1.5 border ${
                active
                  ? "bg-brand/15 text-white border-brand/30 shadow-lg shadow-black/20"
                  : "bg-surface-200/70 text-gray-200 border-transparent hover:bg-surface-200 hover:border-surface-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    finished
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-white/15 text-white"
                        : "bg-surface-300 text-gray-300"
                  }`}
                >
                  {finished ? <CheckCircle2 size={15} /> : index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold leading-snug line-clamp-2 ${active ? "text-white" : "text-white"}`}
                  >
                    {lesson.title}
                  </p>
                  <div
                    className={`mt-1 flex items-center gap-2 text-[11px] ${active ? "text-white/65" : "text-gray-400"}`}
                  >
                    {finished ? (
                      <CheckCircle2 size={12} />
                    ) : (
                      <Circle size={12} />
                    )}
                    <span>
                      {finished ? "Finished" : formatDuration(lesson.duration)}
                    </span>
                  </div>
                  {!finished && progress > 0.02 && (
                    <div
                      className={`mt-2 h-1 rounded-full overflow-hidden ${active ? "bg-white/20" : "bg-surface-300"}`}
                    >
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function VideoDetailsPanel({
  video,
  id,
  isFav,
  currentFinished,
  activeCourse,
  youtubeId,
  youtubeMetadata,
  onToggleFavorite,
  onMarkRead,
}: {
  video: Video;
  id?: string;
  isFav: boolean;
  currentFinished: boolean;
  activeCourse?: Category;
  youtubeId?: string | null;
  youtubeMetadata?: YouTubeMetadata;
  onToggleFavorite: () => void;
  onMarkRead: () => void;
}) {
  const displayTitle = youtubeMetadata?.title || video.title;
  const displayDuration = youtubeMetadata?.durationSeconds || video.duration;

  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1
            className={`text-xl sm:text-2xl font-bold text-white mb-3 leading-snug break-words ${
              isArabic(displayTitle) ? "font-arabic text-right" : ""
            }`}
            dir={isArabic(displayTitle) ? "rtl" : undefined}
          >
            {displayTitle}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
            {youtubeId && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 text-red-300 border border-red-500/20 rounded-lg text-xs font-medium">
                <Youtube size={13} />
                YouTube
              </span>
            )}
            <span className="px-2.5 py-1 bg-surface-200 text-white rounded-lg text-xs font-medium">
              {video.category}
            </span>
            {video.subcategory && (
              <span className="px-2.5 py-1 bg-surface-200 text-white rounded-lg text-xs font-medium">
                {video.subcategory}
              </span>
            )}
            {displayDuration > 0 && (
              <span className="text-gray-400 text-xs">
                {formatDuration(displayDuration)}
              </span>
            )}
            {video.fileSize > 0 && (
              <span className="text-gray-400 text-xs">
                {formatFileSize(video.fileSize)}
              </span>
            )}
            {video.resolution && (
              <span className="text-gray-400 text-xs">{video.resolution}</span>
            )}
            {youtubeMetadata?.channelTitle && (
              <span className="text-gray-400 text-xs">
                {youtubeMetadata.channelTitle}
              </span>
            )}
          </div>
          {youtubeMetadata?.unavailableReason && (
            <p className="mt-3 max-w-2xl text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
              {youtubeMetadata.unavailableReason}
            </p>
          )}
          {video.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {video.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-surface-200 text-gray-300 text-xs rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {id !== "external" && (
            <button
              onClick={onToggleFavorite}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                isFav
                  ? "border-brand text-brand bg-brand/10"
                  : "border-surface-300 text-gray-300 hover:border-brand hover:text-brand"
              }`}
            >
              <Heart size={18} className={isFav ? "fill-brand" : ""} />
              {isFav ? "Favorited" : "Favorite"}
            </button>
          )}

          {id !== "external" && activeCourse && (
            <button
              onClick={onMarkRead}
              disabled={currentFinished}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                currentFinished
                  ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10 cursor-default"
                  : "border-surface-300 text-gray-300 hover:border-emerald-400 hover:text-emerald-300"
              }`}
            >
              <CheckCircle2 size={18} />
              {currentFinished ? "Read" : "Mark as Read"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function YouTubeCommentsPanel({
  metadata,
  isLoading,
  error,
}: {
  metadata?: YouTubeMetadata;
  isLoading: boolean;
  error: boolean;
}) {
  if (isLoading) {
    return <div className="p-4 text-sm text-gray-400">Loading comments...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-300">
        Unable to load YouTube comments.
      </div>
    );
  }

  if (metadata?.unavailableReason || metadata?.commentsUnavailableReason) {
    return (
      <div className="p-4 text-sm text-amber-300">
        {metadata.unavailableReason || metadata.commentsUnavailableReason}
      </div>
    );
  }

  if (!metadata?.comments.length) {
    return (
      <div className="p-4 text-sm text-gray-400">
        No comments found for this video.
      </div>
    );
  }

  return (
    <div className="max-h-[52vh] overflow-y-auto p-3 sm:p-4">
      <div className="flex flex-col gap-3">
        {metadata.comments.map((comment) => (
          <article
            key={comment.id}
            className="rounded-2xl border border-surface-200/70 bg-surface-200/50 p-4"
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-sm font-semibold text-white truncate">
                {comment.author}
              </p>
              {comment.likeCount > 0 && (
                <span className="text-[11px] text-gray-500 shrink-0">
                  {comment.likeCount} likes
                </span>
              )}
            </div>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
              {comment.text}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function YouTubeDescriptionPanel({
  metadata,
  isLoading,
  error,
}: {
  metadata?: YouTubeMetadata;
  isLoading: boolean;
  error: boolean;
}) {
  if (isLoading) {
    return (
      <div className="p-4 text-sm text-gray-400">Loading description...</div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-300">
        Unable to load YouTube description.
      </div>
    );
  }

  if (metadata?.unavailableReason) {
    return (
      <div className="p-4 text-sm text-amber-300">
        {metadata.unavailableReason}
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-white mb-2 break-words">
        {metadata?.title || "YouTube Description"}
      </h2>
      <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-4">
        {metadata?.channelTitle && <span>{metadata.channelTitle}</span>}
        {metadata?.durationSeconds ? (
          <span>{formatDuration(metadata.durationSeconds)}</span>
        ) : null}
        {metadata?.publishedAt && (
          <span>{new Date(metadata.publishedAt).toLocaleDateString()}</span>
        )}
      </div>
      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
        {metadata?.description || "No description available."}
      </p>
    </div>
  );
}

export default function Player() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const externalUrl = searchParams.get("url");

  const {
    data: dbVideo,
    isLoading: dbLoading,
    isError,
  } = useQuery({
    queryKey: ["video", id],
    queryFn: () => api.videos.get(id!),
    enabled: !!id && id !== "external",
  });

  const video =
    id === "external" && externalUrl
      ? {
          id: "external",
          title: "External Stream",
          filename: "External Stream",
          path: externalUrl,
          relativePath: externalUrl,
          category: "Quick Play",
          subcategory: "Web",
          duration: 0,
          fileSize: 0,
          resolution: "HD",
          addedAt: new Date().toISOString(),
          tags: [] as string[],
          isFavorite: false,
          watchProgress: 0,
        }
      : dbVideo;

  const isLoading = id === "external" ? false : dbLoading;

  const isExternal = video?.path?.startsWith("http");
  const youtubeId = isExternal && video?.path ? getYouTubeId(video.path) : null;

  const {
    data: youtubeMetadata,
    isLoading: youtubeLoading,
    isError: youtubeError,
  } = useQuery({
    queryKey: ["youtube", youtubeId],
    queryFn: () => api.videos.youtube(youtubeId!),
    enabled: !!youtubeId,
    staleTime: 30 * 60_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: api.videos.categories,
    staleTime: 5 * 60_000,
    enabled: !!video && id !== "external",
  });

  const activeCourse = video
    ? findCourseForVideo(categories, video)
    : undefined;

  const { data: courseList } = useQuery({
    queryKey: ["course-videos", activeCourse?.path],
    queryFn: () =>
      api.videos.list({
        category: activeCourse!.path,
        page: 1,
        pageSize: 120,
        sort: "name",
      }),
    enabled: !!activeCourse && !!video && id !== "external",
  });

  const courseVideos = courseList?.videos ?? [];
  const courseTotalDuration = courseVideos.reduce(
    (sum, lesson) => sum + lesson.duration,
    0,
  );
  const courseWatchedDuration = courseVideos.reduce(
    (sum, lesson) =>
      sum + Math.max(lesson.duration * Math.min(lesson.watchProgress, 1), 0),
    0,
  );
  const courseProgress =
    courseTotalDuration > 0
      ? Math.min(courseWatchedDuration / courseTotalDuration, 1)
      : 0;
  const completedLessons = courseVideos.filter(
    (lesson) => lesson.watchProgress >= 0.98,
  ).length;
  const courseRemainingDuration = Math.max(
    courseTotalDuration - courseWatchedDuration,
    0,
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const sleepMenuRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setInterval>>();
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const latestTimeRef = useRef<number>(0);
  const markedFinishedRef = useRef(false);
  const ytPlayerRef = useRef<any>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showCtrl, setShowCtrl] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [isMarkedFinished, setIsMarkedFinished] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [ytStart, setYtStart] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("normal");
  const [activeTab, setActiveTab] = useState<PlayerTab>("details");

  // Sleep timer states
  const [sleepTimeLeft, setSleepTimeLeft] = useState<number | null>(null);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");

  // ── Press and hold 2x speed-up states & refs ──────────────────────────────
  const [isSpeedingUp, setIsSpeedingUp] = useState(false);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef(false);
  const preSpeedRef = useRef<number>(1);
  const preventClickRef = useRef(false);

  // ── Reset states on video navigation ─────────────────────────────────────
  useEffect(() => {
    setResumed(false);
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setBuffered(0);
    setShowSpeed(false);
    setIsFav(false);
    setIsMarkedFinished(false);
    latestTimeRef.current = 0;
    setSleepTimeLeft(null);
    setShowSleepMenu(false);
    setCustomMinutes("");
    setActiveTab("details");
    setIsSpeedingUp(false);
    isHoldingRef.current = false;
    preventClickRef.current = false;
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  }, [id]);

  // ── Handle video not found or missing external URL ───────────────────────
  useEffect(() => {
    if (id === "external" && !externalUrl) {
      navigate("/");
    } else if (isError) {
      navigate("/");
    }
  }, [id, externalUrl, isError, navigate]);

  // ── YouTube API Script Loader ────────────────────────────────────────────
  useEffect(() => {
    if (!youtubeId) return;
    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, [youtubeId]);

  // ── YouTube Player Instantiation & Polling ───────────────────────────────
  useEffect(() => {
    if (!youtubeId) return;

    let player: any;
    let pollInterval: any;

    const initPlayer = () => {
      const el = document.getElementById("yt-player-element");
      if (!el) return;

      player = new (window as any).YT.Player("yt-player-element", {
        videoId: youtubeId,
        playerVars: {
          autoplay: 1,
          enablejsapi: 1,
          rel: 0,
          modestbranding: 1,
          start: ytStart !== null ? ytStart : undefined,
        },
        events: {
          onReady: () => {
            ytPlayerRef.current = player;
            pollInterval = setInterval(() => {
              if (player && typeof player.getCurrentTime === "function") {
                const time = player.getCurrentTime();
                setCurrent(time);
                latestTimeRef.current = time;

                const dur = player.getDuration();
                if (dur && dur > 0) {
                  setDuration(dur);
                }
              }
            }, 400);
          },
          onStateChange: (event: any) => {
            if (event.data === 1) {
              setPlaying(true);
            } else if (event.data === 2) {
              setPlaying(false);
            }
          },
        },
      });
    };

    if ((window as any).YT && (window as any).YT.Player) {
      initPlayer();
    } else {
      const checkYT = setInterval(() => {
        if ((window as any).YT && (window as any).YT.Player) {
          clearInterval(checkYT);
          initPlayer();
        }
      }, 100);
      return () => {
        clearInterval(checkYT);
        if (pollInterval) clearInterval(pollInterval);
        if (player && typeof player.destroy === "function") {
          player.destroy();
        }
        ytPlayerRef.current = null;
      };
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (player && typeof player.destroy === "function") {
        player.destroy();
      }
      ytPlayerRef.current = null;
    };
  }, [youtubeId, ytStart]);

  // Reset ytStart on video navigation
  useEffect(() => {
    setYtStart(null);
  }, [id]);

  // ── Sleep Timer countdown logic ──────────────────────────────────────────
  useEffect(() => {
    if (sleepTimeLeft === null) return;

    if (sleepTimeLeft <= 0) {
      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.pause();
      }
      setSleepTimeLeft(null);
      return;
    }

    const timer = setInterval(() => {
      setSleepTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          const videoEl = videoRef.current;
          if (videoEl) {
            videoEl.pause();
          }
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sleepTimeLeft]);

  // ── Resume position ──────────────────────────────────────────────────────
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!video || !videoEl || resumed) return;
    const startAt =
      video.watchProgress > 0.02 && video.watchProgress < 0.98
        ? video.watchProgress * video.duration
        : 0;
    if (startAt > 5) {
      videoEl.currentTime = startAt;
    }
    setIsFav(video.isFavorite);
    setIsMarkedFinished(video.watchProgress >= 0.98);
    setResumed(true);
  }, [video, resumed]);

  useEffect(() => {
    markedFinishedRef.current = isMarkedFinished;
  }, [isMarkedFinished]);

  // ── Auto-save progress ───────────────────────────────────────────────────
  useEffect(() => {
    if (id === "external") return;
    saveTimer.current = setInterval(() => {
      const videoEl = videoRef.current;
      if (!videoEl || !id || videoEl.paused || markedFinishedRef.current)
        return;
      api.videos.saveProgress(id, videoEl.currentTime).catch(() => {});
    }, SAVE_INTERVAL_MS);
    return () => clearInterval(saveTimer.current);
  }, [id]);

  // Save on unmount / navigation too
  useEffect(() => {
    if (id === "external") return;
    return () => {
      const lastTime = latestTimeRef.current;
      if (id && lastTime > 2 && !markedFinishedRef.current) {
        api.videos.saveProgress(id, lastTime).catch(() => {});
      }
    };
  }, [id]);

  // ── Controls auto-hide ───────────────────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setShowCtrl(true);
    clearTimeout(hideTimer.current);

    const videoEl = videoRef.current;
    if (videoEl && !videoEl.paused) {
      hideTimer.current = setTimeout(() => setShowCtrl(false), 3000);
    }
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, [resetHideTimer]);

  useEffect(() => {
    if (!playing) {
      setShowCtrl(true);
      clearTimeout(hideTimer.current);
    } else {
      resetHideTimer();
    }
  }, [playing, resetHideTimer]);

  // ── Playback Speed Click-Outside Dismissal ──────────────────────────────
  useEffect(() => {
    if (!showSpeed) return;
    const clickHandler = (e: MouseEvent) => {
      if (
        speedMenuRef.current &&
        !speedMenuRef.current.contains(e.target as Node)
      ) {
        setShowSpeed(false);
      }
    };
    document.addEventListener("click", clickHandler, { capture: true });
    return () =>
      document.removeEventListener("click", clickHandler, { capture: true });
  }, [showSpeed]);

  // ── Sleep Timer Click-Outside Dismissal ───────────────────────────────
  useEffect(() => {
    if (!showSleepMenu) return;
    const clickHandler = (e: MouseEvent) => {
      if (
        sleepMenuRef.current &&
        !sleepMenuRef.current.contains(e.target as Node)
      ) {
        setShowSleepMenu(false);
      }
    };
    document.addEventListener("click", clickHandler, { capture: true });
    return () =>
      document.removeEventListener("click", clickHandler, { capture: true });
  }, [showSleepMenu]);

  // ── Press and hold to speed up 2x ────────────────────────────────────────
  const handlePlayerMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only trigger for left-click

    const videoEl = videoRef.current;
    if (!videoEl || videoEl.paused) return; // Only speed up if playing

    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);

    isHoldingRef.current = false;
    preventClickRef.current = false;

    holdTimeoutRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      preSpeedRef.current = videoEl.playbackRate;
      videoEl.playbackRate = 2.0;
      setIsSpeedingUp(true);
    }, 300);
  }, []);

  const handlePlayerTouchStart = useCallback((e: React.TouchEvent) => {
    const videoEl = videoRef.current;
    if (!videoEl || videoEl.paused) return; // Only speed up if playing

    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);

    isHoldingRef.current = false;
    preventClickRef.current = false;

    holdTimeoutRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      preSpeedRef.current = videoEl.playbackRate;
      videoEl.playbackRate = 2.0;
      setIsSpeedingUp(true);
    }, 300);
  }, []);

  useEffect(() => {
    const handleGlobalRelease = () => {
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = null;
      }

      if (isHoldingRef.current) {
        const videoEl = videoRef.current;
        if (videoEl) {
          videoEl.playbackRate = preSpeedRef.current;
        }
        setIsSpeedingUp(false);
        preventClickRef.current = true;
        isHoldingRef.current = false;

        // Clear the preventClick flag after a minor delay
        setTimeout(() => {
          preventClickRef.current = false;
        }, 100);
      }
    };

    window.addEventListener("mouseup", handleGlobalRelease);
    window.addEventListener("touchend", handleGlobalRelease);

    return () => {
      window.removeEventListener("mouseup", handleGlobalRelease);
      window.removeEventListener("touchend", handleGlobalRelease);
    };
  }, []);

  // ── Stable Toggle Functions ──────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (preventClickRef.current) {
      preventClickRef.current = false;
      return;
    }
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.paused ? videoEl.play() : videoEl.pause();
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const videoEl = videoRef.current;
      if (!videoEl) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          videoEl.paused ? videoEl.play() : videoEl.pause();
          break;
        case "ArrowRight":
          e.preventDefault();
          videoEl.currentTime = Math.min(
            videoEl.duration,
            videoEl.currentTime + 10,
          );
          break;
        case "ArrowLeft":
          e.preventDefault();
          videoEl.currentTime = Math.max(0, videoEl.currentTime - 10);
          break;
        case "ArrowUp":
          e.preventDefault();
          videoEl.volume = Math.min(1, videoEl.volume + 0.1);
          videoEl.muted = false;
          break;
        case "ArrowDown":
          e.preventDefault();
          videoEl.volume = Math.max(0, videoEl.volume - 0.1);
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          videoEl.muted = !videoEl.muted;
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleFullscreen]);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFav = async () => {
    if (!id) return;
    const { isFavorite } = await api.videos.toggleFavorite(id);
    setIsFav(isFavorite);
  };

  const currentFinished =
    isMarkedFinished || (video?.watchProgress ?? 0) >= 0.98;

  const toggleFinishedState = async () => {
    if (!id || id === "external") return;
    const nextFinished = !currentFinished;
    try {
      await api.videos.markFinished(id, nextFinished);
      setIsMarkedFinished(nextFinished);
      queryClient.invalidateQueries({ queryKey: ["video", id] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({
        queryKey: ["course-videos", activeCourse?.path],
      });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    } catch {
      /* silent */
    }
  };

  const markCurrentVideoFinished = () => {
    if (!id || id === "external") return;
    if (currentFinished) return;
    const previousProgress = video?.watchProgress ?? 0;
    setIsMarkedFinished(true);
    api.videos
      .markFinished(id, true)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["video", id] });
        queryClient.invalidateQueries({ queryKey: ["categories"] });
        queryClient.invalidateQueries({
          queryKey: ["course-videos", activeCourse?.path],
        });
        queryClient.invalidateQueries({ queryKey: ["videos"] });
      })
      .catch(() => {});
  };

  // Toggle watched state for lessons in a course playlist
  const toggleLessonWatched = async (lesson: Video) => {
    if (!lesson || !lesson.id) return;
    try {
      const nextFinished = !(lesson.watchProgress >= 0.98);
      await api.videos.markFinished(lesson.id, nextFinished);
      queryClient.invalidateQueries({
        queryKey: ["course-videos", activeCourse?.path],
      });
      queryClient.invalidateQueries({ queryKey: ["video", lesson.id] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    } catch {
      /* silent */
    }
  };

  if (isLoading || !video) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-2">
        <div className="relative bg-surface-100/80 backdrop-blur-lg border border-surface-200/60 rounded-3xl p-4  w-full text-center shadow-2xl shadow-black/20 flex flex-col items-center gap-6 animate-pulse">
          <div className="relative w-16 h-16 flex items-center justify-center">
            {/* Spinning glowing brand ring */}
            <div className="absolute inset-0 rounded-full border-4 border-brand/20 border-t-brand animate-spin" />
            {/* Pulsing inner logo */}
            <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-lg">
              LT
            </div>
          </div>
          <div>
            <h2 className="text-md font-bold text-white mb-1">
              Initializing Player
            </h2>
            <p className="text-xs text-gray-400">Buffering media streams...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── View-mode helpers ──────────────────────────────────────────────────
  const wrapperCls =
    viewMode === "theater"
      ? "w-full animate-fade-in"
      : activeCourse
        ? " mx-auto animate-fade-in"
        : " mx-auto animate-fade-in";

  const playerVisible = viewMode !== "mini";
  const showCourseTab = Boolean(
    activeCourse && viewMode !== "theater" && courseVideos.length > 0,
  );
  const showYouTubeTabs = Boolean(youtubeId);
  const showTabs = showCourseTab || showYouTubeTabs;

  return (
    <div className={`${wrapperCls} animate-fade-in`}>
      <div className="rounded-2xl bg-surface-50/90 border border-surface-200/60 p-2 sm:p-3 shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between mb-2 px-1">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
            Back
          </button>
          {activeCourse && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-emerald-300 bg-surface-100/80 border border-surface-200/60 px-3 py-1.5 rounded-full shadow-sm">
              <ListVideo size={14} />
              Course Mode
            </div>
          )}
        </div>

        <div className="space-y-3">
          {playerVisible && (
            <div
              ref={containerRef}
              onMouseMove={resetHideTimer}
              onClick={youtubeId ? undefined : togglePlay}
              onDoubleClick={youtubeId ? undefined : toggleFullscreen}
              onMouseDown={youtubeId ? undefined : handlePlayerMouseDown}
              onTouchStart={youtubeId ? undefined : handlePlayerTouchStart}
              className={`video-player-container relative bg-slate-950 overflow-hidden group transition-all duration-300 select-none shadow-2xl shadow-black/40 ring-1 ring-surface-200/40 ${
                fullscreen ? "w-full h-full rounded-none" : "rounded-[1.75rem]"
              } aspect-video ${!youtubeId && showCtrl ? "cursor-pointer" : "cursor-none"}`}
            >
              {youtubeId ? (
                <div className="w-full h-full absolute inset-0 rounded-[1.75rem] overflow-hidden bg-black pointer-events-auto">
                  <div
                    key={youtubeId}
                    id="yt-player-element"
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <video
                  ref={videoRef}
                  src={isExternal ? video.path : streamUrl(video.id)}
                  className="w-full h-full object-contain"
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={() => {
                    const videoEl = videoRef.current;
                    if (!videoEl) return;
                    setCurrent(videoEl.currentTime);
                    latestTimeRef.current = videoEl.currentTime;
                    if (videoEl.buffered.length) {
                      setBuffered(
                        videoEl.buffered.end(videoEl.buffered.length - 1),
                      );
                    }
                  }}
                  onLoadedMetadata={() => {
                    const videoEl = videoRef.current;
                    if (videoEl) {
                      setDuration(videoEl.duration);
                      videoEl.playbackRate = speed;
                    }
                  }}
                  onVolumeChange={() => {
                    const videoEl = videoRef.current;
                    if (videoEl) {
                      setVolume(videoEl.volume);
                      setMuted(videoEl.muted);
                    }
                  }}
                  onEnded={markCurrentVideoFinished}
                />
              )}

              {!youtubeId && isSpeedingUp && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-fade-in">
                  <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-white text-sm font-semibold shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                    <span>2× Speed</span>
                    <ChevronsRight
                      size={16}
                      className="animate-pulse text-brand"
                    />
                  </div>
                </div>
              )}

              <div
                className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-transparent to-transparent transition-opacity duration-300 ${
                  !youtubeId && showCtrl
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                <div
                  className="px-4 pb-2"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <ProgressBar
                    current={current}
                    duration={duration}
                    buffered={buffered}
                    onSeek={(t) => {
                      const videoEl = videoRef.current;
                      if (videoEl) videoEl.currentTime = t;
                    }}
                  />
                </div>

                <div
                  className="flex items-center gap-3 px-4 pb-4"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={togglePlay}
                    className="hover:text-brand transition-colors text-white"
                  >
                    {playing ? (
                      <Pause size={22} fill="currentColor" />
                    ) : (
                      <Play size={22} fill="currentColor" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      const v = videoRef.current;
                      if (v) v.currentTime += 10;
                    }}
                    className="hover:text-brand transition-colors text-white"
                  >
                    <SkipForward size={20} />
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const v = videoRef.current;
                        if (v) v.muted = !v.muted;
                      }}
                      className="hover:text-brand text-white"
                    >
                      {muted || volume === 0 ? (
                        <VolumeX size={20} />
                      ) : (
                        <Volume2 size={20} />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={muted ? 0 : volume}
                      onChange={(e) => {
                        const v = videoRef.current;
                        if (!v) return;
                        v.volume = Number(e.target.value);
                        v.muted = false;
                      }}
                      className="w-20 accent-brand"
                    />
                  </div>

                  <span className="text-sm text-gray-300 font-mono ml-1">
                    {formatDuration(current)} / {formatDuration(duration)}
                  </span>

                  <div className="ml-auto flex items-center gap-3">
                    <div className="relative" ref={sleepMenuRef}>
                      <button
                        onClick={() => setShowSleepMenu((v) => !v)}
                        className={`flex items-center gap-1 text-sm hover:text-brand transition-colors ${
                          sleepTimeLeft !== null
                            ? "text-brand font-medium"
                            : "text-gray-300"
                        }`}
                        title={
                          sleepTimeLeft !== null
                            ? `Sleep: ${formatSleepTime(sleepTimeLeft)} left`
                            : "Set Sleep Timer"
                        }
                      >
                        <Timer size={16} />
                        {sleepTimeLeft !== null
                          ? formatSleepTime(sleepTimeLeft)
                          : "Timer"}
                      </button>
                      {showSleepMenu && (
                        <div className="absolute bottom-8 right-0 bg-surface-200 rounded-lg overflow-hidden shadow-xl z-10 w-44 p-1 flex flex-col gap-0.5">
                          {SLEEP_OPTIONS.map((opt) => (
                            <button
                              key={opt.label}
                              onClick={() => {
                                setSleepTimeLeft(opt.value);
                                setShowSleepMenu(false);
                              }}
                              className={`block w-full px-3 py-1.5 text-xs text-left rounded hover:bg-surface-300 transition-colors ${
                                (opt.value === null &&
                                  sleepTimeLeft === null) ||
                                (opt.value !== null &&
                                  sleepTimeLeft !== null &&
                                  Math.abs(sleepTimeLeft - opt.value) < 2)
                                  ? "text-brand font-medium bg-brand/10"
                                  : "text-gray-300"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                          <div className="border-t border-surface-300/50 my-1" />
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const mins = parseInt(customMinutes, 10);
                              if (!isNaN(mins) && mins > 0) {
                                setSleepTimeLeft(mins * 60);
                                setCustomMinutes("");
                                setShowSleepMenu(false);
                              }
                            }}
                            className="flex items-center gap-1 px-2 py-1"
                          >
                            <input
                              type="number"
                              min="1"
                              placeholder="Custom min"
                              value={customMinutes}
                              onChange={(e) => setCustomMinutes(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-surface-300 text-white placeholder-gray-500 rounded px-1.5 py-1 text-xs border border-transparent focus:border-brand focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="bg-brand text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-brand/90"
                            >
                              Set
                            </button>
                          </form>
                        </div>
                      )}
                    </div>

                    <div className="relative" ref={speedMenuRef}>
                      <button
                        onClick={() => setShowSpeed((v) => !v)}
                        className="flex items-center gap-1 text-sm hover:text-brand transition-colors text-white"
                      >
                        <Settings size={16} /> {speed}×
                      </button>
                      {showSpeed && (
                        <div className="absolute bottom-8 right-0 bg-surface-200 rounded-lg overflow-hidden shadow-xl z-10">
                          {SPEEDS.map((s) => (
                            <button
                              key={s}
                              onClick={() => {
                                setSpeed(s);
                                const v = videoRef.current;
                                if (v) v.playbackRate = s;
                                setShowSpeed(false);
                              }}
                              className={`block w-full px-4 py-2 text-sm text-left hover:bg-surface-300 ${
                                speed === s
                                  ? "text-brand font-medium"
                                  : "text-gray-300"
                              }`}
                            >
                              {s}×
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setViewMode("mini")}
                      className="hover:text-brand transition-colors text-gray-300"
                      title="Miniplayer"
                    >
                      <PictureInPicture2 size={20} />
                    </button>

                    <button
                      onClick={() =>
                        setViewMode(
                          viewMode === "theater" ? "normal" : "theater",
                        )
                      }
                      className={`hover:text-brand transition-colors ${viewMode === "theater" ? "text-brand" : "text-gray-300"}`}
                      title="Theater mode"
                    >
                      <RectangleHorizontal size={20} />
                    </button>

                    <button
                      onClick={toggleFullscreen}
                      className="hover:text-brand transition-colors text-white"
                    >
                      {fullscreen ? (
                        <Minimize size={20} />
                      ) : (
                        <Maximize size={20} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeCourse &&
            viewMode !== "theater" &&
            courseVideos.length > 0 && (
              <CoursePlayerSidebar
                currentVideoId={video.id}
                videos={courseVideos}
                courseTitle={activeCourse.name}
                courseProgress={courseProgress}
                completedCount={completedLessons}
                remainingDuration={courseRemainingDuration}
                onSelect={(lessonId) => navigate(`/watch/${lessonId}`)}
              />
            )}

          <div className="bg-surface-100/80 backdrop-blur-md border border-surface-200/60 rounded-3xl p-6 shadow-lg shadow-black/20">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1
                  className={`text-2xl font-bold text-white mb-3 leading-snug ${
                    isArabic(video.title) ? "font-arabic text-right" : ""
                  }`}
                  dir={isArabic(video.title) ? "rtl" : undefined}
                >
                  {video.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                  <span className="px-2.5 py-1 bg-surface-200 text-white rounded-lg text-xs font-medium">
                    {video.category}
                  </span>
                  {video.subcategory && (
                    <span className="px-2.5 py-1 bg-surface-200 text-white rounded-lg text-xs font-medium">
                      {video.subcategory}
                    </span>
                  )}
                  {video.duration > 0 && (
                    <span className="text-gray-400 text-xs">
                      {formatDuration(video.duration)}
                    </span>
                  )}
                  {video.fileSize > 0 && (
                    <span className="text-gray-400 text-xs">
                      {formatFileSize(video.fileSize)}
                    </span>
                  )}
                  {video.resolution && (
                    <span className="text-gray-400 text-xs">
                      {video.resolution}
                    </span>
                  )}
                </div>
                {video.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {video.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-surface-200 text-gray-300 text-xs rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                {id !== "external" && (
                  <button
                    onClick={() => setActiveTab("videos")}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-t-xl text-sm font-semibold transition-colors ${
                      activeTab === "videos"
                        ? "bg-surface-200 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <ListVideo size={16} />
                    Remaining Videos
                  </button>
                )}

                {id !== "external" && activeCourse && (
                  <button
                    onClick={toggleFinishedState}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                      currentFinished
                        ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                        : "border-surface-300 text-gray-300 hover:border-emerald-400 hover:text-emerald-300"
                    }`}
                  >
                    {currentFinished ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <Circle size={18} />
                    )}
                    {currentFinished ? "Mark Unfinished" : "Mark Finished"}
                  </button>
                )}
              </div>

              {activeTab === "videos" && showCourseTab && activeCourse ? (
                <CoursePlayerSidebar
                  currentVideoId={video.id}
                  videos={courseVideos}
                  courseTitle={activeCourse.name}
                  courseProgress={courseProgress}
                  completedCount={completedLessons}
                  remainingDuration={courseRemainingDuration}
                  onSelect={(lessonId) => navigate(`/watch/${lessonId}`)}
                  onToggleWatched={toggleLessonWatched}
                  embedded
                />
              ) : activeTab === "comments" && showYouTubeTabs ? (
                <YouTubeCommentsPanel
                  metadata={youtubeMetadata}
                  isLoading={youtubeLoading}
                  error={youtubeError}
                />
              ) : activeTab === "description" && showYouTubeTabs ? (
                <YouTubeDescriptionPanel
                  metadata={youtubeMetadata}
                  isLoading={youtubeLoading}
                  error={youtubeError}
                />
              ) : (
                <VideoDetailsPanel
                  video={video}
                  id={id}
                  isFav={isFav}
                  currentFinished={currentFinished}
                  activeCourse={activeCourse}
                  youtubeId={youtubeId}
                  youtubeMetadata={youtubeMetadata}
                  onToggleFavorite={toggleFav}
                  onMarkRead={markCurrentVideoFinished}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Floating Miniplayer ────────────────────────────────────── */}
        {viewMode === "mini" && (
          <div
            className="fixed bottom-6 right-6 z-50 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-white/10 animate-fade-in"
            style={{ width: 384, aspectRatio: "16/9" }}
          >
            <div
              ref={containerRef}
              onMouseMove={resetHideTimer}
              onClick={youtubeId ? undefined : togglePlay}
              onMouseDown={youtubeId ? undefined : handlePlayerMouseDown}
              onTouchStart={youtubeId ? undefined : handlePlayerTouchStart}
              className="video-player-container relative w-full h-full bg-black select-none group cursor-pointer"
            >
              {youtubeId ? (
                <div className="w-full h-full absolute inset-0 pointer-events-auto">
                  <div
                    key={youtubeId}
                    id="yt-player-element"
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <video
                  ref={videoRef}
                  src={isExternal ? video.path : streamUrl(video.id)}
                  className="w-full h-full object-contain"
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={() => {
                    const videoEl = videoRef.current;
                    if (!videoEl) return;
                    setCurrent(videoEl.currentTime);
                    latestTimeRef.current = videoEl.currentTime;
                    if (videoEl.buffered.length)
                      setBuffered(
                        videoEl.buffered.end(videoEl.buffered.length - 1),
                      );
                  }}
                  onLoadedMetadata={() => {
                    const videoEl = videoRef.current;
                    if (videoEl) {
                      setDuration(videoEl.duration);
                      videoEl.playbackRate = speed;
                    }
                  }}
                  onVolumeChange={() => {
                    const videoEl = videoRef.current;
                    if (videoEl) {
                      setVolume(videoEl.volume);
                      setMuted(videoEl.muted);
                    }
                  }}
                  onEnded={markCurrentVideoFinished}
                />
              )}

              {/* Mini controls overlay */}
              <div
                className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-200 ${
                  showCtrl ? "opacity-100" : "opacity-0"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 pb-1.5">
                  <ProgressBar
                    current={current}
                    duration={duration}
                    buffered={buffered}
                    onSeek={(t) => {
                      const v = videoRef.current;
                      if (v) v.currentTime = t;
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 px-3 pb-2.5">
                  <button
                    onClick={togglePlay}
                    className="hover:text-brand transition-colors"
                  >
                    {playing ? (
                      <Pause size={16} fill="currentColor" />
                    ) : (
                      <Play size={16} fill="currentColor" />
                    )}
                  </button>
                  <span className="text-xs text-gray-300 font-mono flex-1">
                    {formatDuration(current)} / {formatDuration(duration)}
                  </span>
                  <button
                    onClick={() => setViewMode("normal")}
                    className="text-gray-400 hover:text-white transition-colors"
                    title="Exit Miniplayer"
                  >
                    <Maximize size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
