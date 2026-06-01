import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  SkipBack,
  ChevronLeft,
  ChevronRight,
  Timer,
  Link2,
  Pencil,
  HelpCircle,
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
import { sortVideosByTitle } from "../utils/sort";
import { Category, Video, VideoListResponse, YouTubeMetadata } from "../types";
import KeyboardShortcutsHelp from "../components/KeyboardShortcutsHelp";
import { useTranslation } from "../i18n";

type ViewMode = "normal" | "theater" | "mini";
type PlayerTab = "details" | "course" | "comments" | "description";

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
  const { t } = useTranslation();
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
          {t("player.coursePlaylist")}
        </div>
        <h2 className="text-lg font-bold text-white leading-tight">
          {courseTitle}
        </h2>
        <p className="text-xs text-gray-400 mt-2">
          {t("player.lessonsFinished", {
            done: completedCount,
            total: videos.length,
          })}
          {remainingDuration > 0
            ? ` · ${t("player.left", { duration: formatDuration(remainingDuration) })}`
            : ` · ${t("player.complete")}`}
        </p>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>{t("player.percentWatched", { percent: Math.round(courseProgress * 100) })}</span>
            <span>
              {t("player.watched", {
                duration: formatDuration(
                  videos.reduce(
                    (sum, v) =>
                      sum +
                      Math.max(v.duration * Math.min(v.watchProgress, 1), 0),
                    0,
                  ),
                ),
              })}
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
        {videos.length === 0 ? (
          <p className="px-3 py-6 text-sm text-gray-400 text-center">
            {t("player.noOtherVideos")}
          </p>
        ) : (
          videos.map((lesson, index) => {
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
                  <button
                    type="button"
                    onClick={() => onSelect(lesson.id)}
                    className="flex items-start gap-3 min-w-0 flex-1 text-left"
                  >
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
                        className={`text-sm font-semibold leading-snug line-clamp-2 ${
                          active ? "text-white" : "text-gray-100"
                        }`}
                      >
                        {lesson.title}
                      </p>
                      <div
                        className={`mt-1 flex items-center gap-2 text-[11px] ${
                          active ? "text-white/65" : "text-gray-400"
                        }`}
                      >
                        {finished ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <Circle size={12} />
                        )}
                        <span>
                          {finished
                            ? t("videoCard.finished")
                            : formatDuration(lesson.duration)}
                        </span>
                      </div>
                      {!finished && progress > 0.02 && (
                        <div
                          className={`mt-2 h-1 rounded-full overflow-hidden ${
                            active ? "bg-white/20" : "bg-surface-300"
                          }`}
                        >
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{ width: `${progress * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </button>
                  {onToggleWatched && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatched(lesson);
                      }}
                      title={
                        finished
                          ? t("player.markUnwatchedTitle")
                          : t("player.markWatchedTitle")
                      }
                      className={`shrink-0 px-2.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-all ${
                        finished
                          ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                          : "border-surface-300 text-gray-300 hover:border-emerald-400 hover:text-emerald-200 hover:bg-surface-200"
                      }`}
                    >
                      {finished ? t("player.markUnwatched") : t("player.markWatched")}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

function VideoInfoHeader({
  video,
  youtubeId,
  youtubeMetadata,
  canEditTitle,
  onTitleSaved,
}: {
  video: Video;
  youtubeId?: string | null;
  youtubeMetadata?: YouTubeMetadata;
  canEditTitle?: boolean;
  onTitleSaved?: (title: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const displayTitle = youtubeMetadata?.title || video.title;
  const displayDuration = youtubeMetadata?.durationSeconds || video.duration;
  const arabic = isArabic(displayTitle);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayTitle);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(displayTitle);
    setEditing(false);
  }, [video.id, displayTitle]);

  const saveTitle = async () => {
    if (!onTitleSaved || !draft.trim()) return;
    setSaving(true);
    try {
      await onTitleSaved(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 min-w-0">
      {editing ? (
        <div className="flex flex-col sm:flex-row gap-2 mb-2.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 rounded-xl border border-surface-300 bg-surface-200 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveTitle();
              if (e.key === "Escape") {
                setDraft(displayTitle);
                setEditing(false);
              }
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void saveTitle()}
              disabled={saving || !draft.trim()}
              className="px-3 py-2 rounded-xl bg-brand text-white text-sm font-medium disabled:opacity-50"
            >
              {t("player.save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(displayTitle);
                setEditing(false);
              }}
              className="px-3 py-2 rounded-xl border border-surface-300 text-sm text-gray-300"
            >
              {t("nav.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 mb-2.5">
          <h1
            className={`flex-1 text-xl sm:text-2xl font-bold text-white leading-snug break-words ${
              arabic ? "font-arabic text-right" : ""
            }`}
            dir={arabic ? "rtl" : undefined}
          >
            {displayTitle}
          </h1>
          {canEditTitle && onTitleSaved && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-surface-200 transition-colors"
              title={t("player.renameTitle")}
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {youtubeId && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 text-red-300 border border-red-500/20 rounded-lg text-xs font-medium">
            <Youtube size={13} />
            {t("player.youtube")}
          </span>
        )}
        <span className="px-2.5 py-1 bg-surface-200/90 text-gray-100 rounded-lg text-xs font-medium">
          {video.category}
        </span>
        {video.subcategory && (
          <span className="px-2.5 py-1 bg-surface-200/90 text-gray-100 rounded-lg text-xs font-medium">
            {video.subcategory}
          </span>
        )}
        {displayDuration > 0 && (
          <span className="px-2 py-1 text-gray-400 text-xs tabular-nums">
            {formatDuration(displayDuration)}
          </span>
        )}

        {video.fileSize > 0 && (
          <span className="px-2 py-1 text-gray-400 text-xs">
            {formatFileSize(video.fileSize)}
          </span>
        )}
        {video.resolution && (
          <span className="px-2 py-1 text-gray-400 text-xs">{video.resolution}</span>
        )}
        {youtubeMetadata?.channelTitle && (
          <span className="px-2 py-1 text-gray-400 text-xs truncate max-w-[14rem]">
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
        <div className="flex flex-wrap gap-1.5 mt-3">
          {video.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-surface-200/80 text-gray-300 text-xs rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function VideoInfoActions({
  id,
  isFav,
  currentFinished,
  activeCourse,
  onToggleFavorite,
  onToggleFinished,
  onCopyLink,
  linkCopied,
  autoPlayNext,
  onToggleAutoPlayNext,
  showAutoPlay,
  onShowShortcuts,
  current,
  duration,
  speed,
}: {
  id?: string;
  isFav: boolean;
  currentFinished: boolean;
  activeCourse?: Category;
  onToggleFavorite: () => void;
  onToggleFinished: () => void;
  onCopyLink?: () => void;
  linkCopied?: boolean;
  autoPlayNext?: boolean;
  onToggleAutoPlayNext?: () => void;
  showAutoPlay?: boolean;
  onShowShortcuts?: () => void;
  current?: number;
  duration?: number;
  speed?: number;
}) {
  const { t, locale } = useTranslation();
  if (id === "external") return null;

  return (
    <div className="flex flex-wrap gap-2 shrink-0 sm:justify-end">
      {duration !== undefined && current !== undefined && speed !== undefined && duration > 0 && duration - current > 1 && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-200/40 border border-surface-300 text-sm font-medium text-white shadow-sm backdrop-blur-md" title={t("player.estimatedEnd")}>
          <Timer size={17} className="text-brand shrink-0" />
          <span className="tracking-wide tabular-nums">
            {new Date(Date.now() + ((duration - current) / speed) * 1000).toLocaleTimeString(locale === "ar" ? "ar-EG" : [], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
      {onShowShortcuts && (
        <button
          type="button"
          onClick={onShowShortcuts}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-surface-300 text-sm text-gray-300 hover:text-white hover:border-surface-200 transition-all"
          title={t("player.shortcutsTitle")}
        >
          <HelpCircle size={17} />
          <span className="hidden sm:inline">{t("player.shortcuts")}</span>
        </button>
      )}
      {onCopyLink && (
        <button
          type="button"
          onClick={onCopyLink}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-surface-300 text-sm text-gray-300 hover:text-white hover:border-surface-200 transition-all"
        >
          <Link2 size={17} />
          {linkCopied ? t("player.copied") : t("player.copyLink")}
        </button>
      )}
      {showAutoPlay && onToggleAutoPlayNext && (
        <button
          type="button"
          onClick={onToggleAutoPlayNext}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
            autoPlayNext
              ? "border-brand text-brand bg-brand/10"
              : "border-surface-300 text-gray-300 hover:border-brand hover:text-brand"
          }`}
        >
          <SkipForward size={17} />
          {t("player.autoplayNext")}
        </button>
      )}
      <button
        onClick={onToggleFavorite}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all ${
          isFav
            ? "border-brand text-brand bg-brand/10"
            : "border-surface-300 text-gray-300 hover:border-brand hover:text-brand"
        }`}
      >
        <Heart size={17} className={isFav ? "fill-brand" : ""} />
        {isFav ? t("player.favorited") : t("player.favorite")}
      </button>
      {activeCourse && (
        <button
          onClick={onToggleFinished}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all ${
            currentFinished
              ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
              : "border-surface-300 text-gray-300 hover:border-emerald-400 hover:text-emerald-300"
          }`}
        >
          {currentFinished ? (
            <CheckCircle2 size={17} />
          ) : (
            <Circle size={17} />
          )}
          {currentFinished ? t("videoCard.markUnfinished") : t("videoCard.markFinished")}
        </button>
      )}
    </div>
  );
}

function PlayerInfoTabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: { id: PlayerTab; label: string; icon: typeof MessageCircle }[];
  activeTab: PlayerTab;
  onTabChange: (tab: PlayerTab) => void;
}) {
  return (
    <div
      className="sticky top-0 z-20 flex gap-1 px-3 sm:px-4 pt-1 border-b border-surface-200/50 overflow-x-auto bg-surface-100/95 backdrop-blur-md"
      role="tablist"
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              active
                ? "border-brand text-white"
                : "border-transparent text-gray-500 hover:text-gray-200"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        );
      })}
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
  const { t } = useTranslation();
  if (isLoading) {
    return <div className="p-4 text-sm text-gray-400">{t("player.loadingComments")}</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-300">
        {t("player.commentsError")}
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
        {t("player.noComments")}
      </div>
    );
  }

  return (
    <div className="max-h-[52vh] overflow-y-auto p-3 sm:p-4">
      <div className="flex flex-col gap-2.5">
        {metadata.comments.map((comment) => (
          <article
            key={comment.id}
            className="rounded-xl border border-surface-200/60 bg-surface-200/40 p-3.5 sm:p-4"
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-sm font-semibold text-white truncate">
                {comment.author}
              </p>
              {comment.likeCount > 0 && (
                <span className="text-[11px] text-gray-500 shrink-0">
                  {t("player.likes", { count: comment.likeCount })}
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
  const { t, locale } = useTranslation();
  if (isLoading) {
    return (
      <div className="p-4 text-sm text-gray-400">{t("player.loadingDescription")}</div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-300">
        {t("player.descriptionError")}
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
    <div className="p-4 sm:p-5 max-h-[52vh] overflow-y-auto">
      {metadata?.publishedAt && (
        <p className="text-xs text-gray-500 mb-3">
          {t("player.published", {
            date: new Date(metadata.publishedAt).toLocaleDateString(
              locale === "ar" ? "ar" : undefined,
            ),
          })}
        </p>
      )}
      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
        {metadata?.description || t("player.noDescription")}
      </p>
    </div>
  );
}

export default function Player() {
  const { t } = useTranslation();
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
          title: t("player.externalStream"),
          filename: t("player.externalStream"),
          path: externalUrl,
          relativePath: externalUrl,
          category: t("player.quickPlay"),
          subcategory: t("player.web"),
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
  const [autoPlayNext, setAutoPlayNext] = useState(
    () => localStorage.getItem("autoPlayNext") !== "false",
  );
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    localStorage.setItem("autoPlayNext", String(autoPlayNext));
  }, [autoPlayNext]);

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

  const copyWatchLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* silent */
    }
  }, []);

  const saveVideoTitle = useCallback(
    async (title: string) => {
      if (!id || id === "external") return;
      const updated = await api.videos.updateTitle(id, title);
      queryClient.setQueryData(["video", id], updated);
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["course-videos", activeCourse?.path] });
    },
    [id, queryClient, activeCourse?.path],
  );

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

  const showCourseTabs = Boolean(
    activeCourse?.isCourse && id !== "external" && courseVideos.length > 0,
  );
  const showYouTubeTabs = Boolean(youtubeId);

  const sortedCourseVideos = useMemo(
    () => sortVideosByTitle(courseVideos),
    [courseVideos],
  );

  const otherCourseVideos = useMemo(
    () => sortedCourseVideos.filter((lesson) => lesson.id !== video?.id),
    [sortedCourseVideos, video?.id],
  );

  const courseNav = useMemo(() => {
    const idx = sortedCourseVideos.findIndex((v) => v.id === video?.id);
    return {
      prev: idx > 0 ? sortedCourseVideos[idx - 1] : null,
      next:
        idx >= 0 && idx < sortedCourseVideos.length - 1
          ? sortedCourseVideos[idx + 1]
          : null,
    };
  }, [sortedCourseVideos, video?.id]);

  const playNextLesson = useCallback(() => {
    if (!autoPlayNext || !showCourseTabs || !id) return;
    const idx = sortedCourseVideos.findIndex((v) => v.id === id);
    if (idx < 0) return;
    const rest = sortedCourseVideos.slice(idx + 1);
    const next =
      rest.find((v) => v.watchProgress < 0.98) ?? rest[0];
    if (next && next.id !== id) {
      navigate(`/watch/${next.id}`);
    }
  }, [autoPlayNext, showCourseTabs, id, sortedCourseVideos, navigate]);

  const handleVideoEnded = useCallback(() => {
    markCurrentVideoFinished();
    playNextLesson();
  }, [playNextLesson]);

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

      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }

      if (showCourseTabs && e.key === "n" && courseNav.next) {
        e.preventDefault();
        navigate(`/watch/${courseNav.next.id}`);
        return;
      }
      if (showCourseTabs && e.key === "p" && courseNav.prev) {
        e.preventDefault();
        navigate(`/watch/${courseNav.prev.id}`);
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
  }, [toggleFullscreen, showCourseTabs, courseNav, navigate]);

  const playerInfoTabs = useMemo(() => {
    const tabs: { id: PlayerTab; label: string; icon: typeof MessageCircle }[] =
      [];
    if (showCourseTabs) {
      tabs.push(
        { id: "details", label: t("player.tabDetails"), icon: FileText },
        { id: "course", label: t("player.tabCourse"), icon: ListVideo },
      );
    }
    if (showYouTubeTabs) {
      if (!showCourseTabs) {
        tabs.push({ id: "details", label: t("player.tabOverview"), icon: BookOpen });
      }
      tabs.push(
        { id: "comments", label: t("player.tabComments"), icon: MessageCircle },
        { id: "description", label: t("player.tabDescription"), icon: FileText },
      );
    }
    return tabs;
  }, [showCourseTabs, showYouTubeTabs, t]);

  const showTabBar = showCourseTabs || showYouTubeTabs;

  useEffect(() => {
    if (!showTabBar) return;
    if (!playerInfoTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("details");
    }
  }, [playerInfoTabs, activeTab, showTabBar]);

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
              {t("player.initializing")}
            </h2>
            <p className="text-xs text-gray-400">{t("player.buffering")}</p>
          </div>
        </div>
      </div>
    );
  }

  const playerVisible = viewMode !== "mini";

  return (
    <div className="w-full space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={18} />
          {t("player.back")}
        </button>
        {activeCourse && (
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-emerald-300 bg-surface-100/80 border border-surface-200/60 px-3 py-1.5 rounded-full">
            <ListVideo size={14} />
            {t("player.courseMode")}
          </div>
        )}
      </div>

      <div className="relative w-full overflow-hidden rounded-2xl border border-surface-200/60 shadow-lg shadow-black/25">
        {playerVisible && (
          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-b from-brand/25 via-brand/5 to-transparent opacity-70 blur-2xl"
              aria-hidden
            />
            <div
              ref={containerRef}
              onMouseMove={resetHideTimer}
              onClick={youtubeId ? undefined : togglePlay}
              onDoubleClick={youtubeId ? undefined : toggleFullscreen}
              onMouseDown={youtubeId ? undefined : handlePlayerMouseDown}
              onTouchStart={youtubeId ? undefined : handlePlayerTouchStart}
              className={`video-player-container relative w-full overflow-hidden bg-black group transition-all duration-300 select-none ${
                fullscreen
                  ? "h-full rounded-none aspect-auto shadow-none ring-0"
                  : "aspect-[16/9] shadow-[0_28px_90px_-24px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
              } ${!youtubeId && showCtrl ? "cursor-pointer" : youtubeId ? "" : "cursor-none"}`}
            >
              {youtubeId ? (
                <div className="absolute inset-0 overflow-hidden bg-black pointer-events-auto">
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
                  onEnded={handleVideoEnded}
                />
              )}

              {!youtubeId && !playing && showCtrl && (
                <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                  <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-brand/90 text-white shadow-[0_0_40px_rgba(229,9,20,0.55)] ring-4 ring-white/15 transition-transform duration-200 group-hover:scale-105">
                    <Play size={36} className="translate-x-0.5" fill="currentColor" />
                  </div>
                </div>
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
                className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/35 to-transparent transition-opacity duration-300 ${
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
                    title="Forward 10 seconds"
                  >
                    <SkipForward size={20} />
                  </button>

                  {showCourseTabs && courseNav.prev && (
                    <button
                      type="button"
                      onClick={() => navigate(`/watch/${courseNav.prev!.id}`)}
                      className="hover:text-brand transition-colors text-white"
                      title="Previous lesson (P)"
                    >
                      <SkipBack size={20} />
                    </button>
                  )}
                  {showCourseTabs && courseNav.next && (
                    <button
                      type="button"
                      onClick={() => navigate(`/watch/${courseNav.next!.id}`)}
                      className="hover:text-brand transition-colors text-white"
                      title="Next lesson (N)"
                    >
                      <ChevronRight size={22} />
                    </button>
                  )}

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
          </div>
        )}

        {showTabBar && (
          <PlayerInfoTabs
            tabs={playerInfoTabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}

        <div className="bg-surface-100/50">
        {(activeTab === "details" || !showTabBar) && (
          <div className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <VideoInfoHeader
                video={video}
                youtubeId={youtubeId}
                youtubeMetadata={youtubeMetadata}
                canEditTitle={!youtubeId && id !== "external"}
                onTitleSaved={saveVideoTitle}
              />
              <VideoInfoActions
                id={id}
                isFav={isFav}
                currentFinished={currentFinished}
                activeCourse={activeCourse}
                onToggleFavorite={toggleFav}
                onToggleFinished={toggleFinishedState}
                onCopyLink={copyWatchLink}
                linkCopied={linkCopied}
                showAutoPlay={showCourseTabs}
                autoPlayNext={autoPlayNext}
                onToggleAutoPlayNext={() => setAutoPlayNext((v) => !v)}
                onShowShortcuts={() => setShowShortcuts(true)}
                current={current}
                duration={duration}
                speed={speed}
              />
            </div>
          </div>
        )}

        {showCourseTabs && activeTab === "course" && activeCourse && (
          <div className={showTabBar ? "" : "border-t border-surface-200/40"}>
            <CoursePlayerSidebar
              currentVideoId={video.id}
              videos={otherCourseVideos}
              courseTitle={activeCourse.name}
              courseProgress={courseProgress}
              completedCount={completedLessons}
              remainingDuration={courseRemainingDuration}
              onSelect={(lessonId) => navigate(`/watch/${lessonId}`)}
              onToggleWatched={toggleLessonWatched}
              embedded
            />
          </div>
        )}

        {showYouTubeTabs && activeTab === "comments" && (
          <div className="border-t border-surface-200/40">
            <YouTubeCommentsPanel
              metadata={youtubeMetadata}
              isLoading={youtubeLoading}
              error={youtubeError}
            />
          </div>
        )}

        {showYouTubeTabs && activeTab === "description" && (
          <div className="border-t border-surface-200/40">
            <YouTubeDescriptionPanel
              metadata={youtubeMetadata}
              isLoading={youtubeLoading}
              error={youtubeError}
            />
          </div>
        )}
        </div>
      </div>

      <KeyboardShortcutsHelp
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

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
                  onEnded={handleVideoEnded}
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
  );
}
