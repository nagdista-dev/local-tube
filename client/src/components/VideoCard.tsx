import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Heart, Play, Clock, HardDrive, CheckCircle2, RotateCcw } from "lucide-react";
import { Video } from "../types";
import { formatDuration, formatFileSize, truncate, isArabic } from "../utils/format";
import { api } from "../utils/api";

interface VideoCardProps {
  video: Video;
  onFavoriteToggle?: (id: string, isFav: boolean) => void;
  onProgressChange?: () => void;
  showCourseControls?: boolean;
  layout?: "grid" | "list";
}

export default function VideoCard({
  video,
  onFavoriteToggle,
  onProgressChange,
  showCourseControls = false,
  layout = "grid",
}: VideoCardProps) {
  const [isFav, setIsFav] = useState(video.isFavorite);
  const [localProgress, setLocalProgress] = useState(video.watchProgress);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const arabic = isArabic(video.title);
  const isFinished = localProgress >= 0.98;
  const remainingSeconds = Math.max(video.duration * (1 - Math.min(localProgress, 1)), 0);

  useEffect(() => {
    setLocalProgress(video.watchProgress);
  }, [video.id, video.watchProgress]);

  const toggleFav = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const { isFavorite } = await api.videos.toggleFavorite(video.id);
        setIsFav(isFavorite);
        onFavoriteToggle?.(video.id, isFavorite);
      } catch {
        /* silent */
      }
    },
    [video.id, onFavoriteToggle],
  );

  const toggleFinished = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const nextFinished = !isFinished;
        await api.videos.markFinished(video.id, nextFinished);
        setLocalProgress(nextFinished ? 1 : 0);
        onProgressChange?.();
      } catch {
        /* silent */
      }
    },
    [isFinished, video.id, onProgressChange],
  );

  const thumbSrc = !imgError && video.thumbnail ? video.thumbnail : null;
  const progress =
    localProgress > 0.02 && localProgress < 0.98
      ? localProgress
      : null;

  if (layout === "list") {
    return (
      <Link
        to={`/watch/${video.id}`}
        className="group relative flex flex-row gap-4 p-3 rounded-xl overflow-hidden bg-surface-100/40
                   border border-transparent hover:border-surface-300/50
                   transition-all duration-200 hover:scale-[1.005] hover:shadow-lg
                   hover:shadow-black/20 animate-fade-in w-full"
      >
        {/* Thumbnail on left */}
        <div className="relative w-52 shrink-0 aspect-video bg-surface-200 rounded-lg overflow-hidden">
          {thumbSrc ? (
            <>
              {!imgLoaded && (
                <div className="absolute inset-0 bg-surface-200 animate-pulse" />
              )}
              <img
                src={thumbSrc}
                alt={video.title}
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                className={`w-full h-full object-cover transition-opacity duration-300
                  ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              />
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-200">
              <Play size={24} className="text-gray-600" />
              <span className="text-xs text-gray-600 px-2 text-center">
                {video.filename.split(".").pop()?.toUpperCase()}
              </span>
            </div>
          )}

          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play size={18} className="text-white translate-x-0.5" fill="white" />
            </div>
          </div>

          {/* Duration badge */}
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white text-xs font-mono">
            {formatDuration(video.duration)}
          </div>

          {/* Watch progress bar */}
          {progress && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}

          {/* Favorite button */}
          <button
            onClick={toggleFav}
            className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/60
                       opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart
              size={12}
              className={isFav ? "text-brand fill-brand" : "text-white"}
            />
          </button>
        </div>

        {/* Info on right */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
          <div>
            <h3
              className={`text-base font-semibold text-gray-100 leading-snug line-clamp-2 mb-1.5 ${
                arabic ? "font-arabic text-right" : ""
              }`}
              dir={arabic ? "rtl" : undefined}
            >
              {video.title}
            </h3>
            <p className="text-xs text-gray-400 mb-2">
              {video.subcategory
                ? `${video.category} › ${video.subcategory}`
                : video.category}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <Clock size={12} />
              {isFinished ? "Finished" : `${formatDuration(remainingSeconds)} left`}
            </span>
            <span className="flex items-center gap-1.5">
              <HardDrive size={12} />
              {formatFileSize(video.fileSize)}
            </span>
            {showCourseControls && (
              <button
                onClick={toggleFinished}
                className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                  isFinished
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-surface-300 text-gray-400 hover:text-white hover:border-brand/50"
                }`}
              >
                {isFinished ? <RotateCcw size={12} /> : <CheckCircle2 size={12} />}
                {isFinished ? "Mark Unfinished" : "Mark Finished"}
              </button>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/watch/${video.id}`}
      className="group relative flex flex-col rounded-xl overflow-hidden bg-surface-100
                 border border-transparent hover:border-surface-300
                 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl
                 hover:shadow-black/50 animate-fade-in"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-surface-200 overflow-hidden">
        {thumbSrc ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 bg-surface-200 animate-pulse" />
            )}
            <img
              src={thumbSrc}
              alt={video.title}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`w-full h-full object-cover transition-opacity duration-300
                ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-200">
            <Play size={28} className="text-gray-600" />
            <span className="text-xs text-gray-600 px-2 text-center">
              {video.filename.split(".").pop()?.toUpperCase()}
            </span>
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/50 dark:bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/20 dark:bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play
              size={22}
              className="text-white dark:text-white translate-x-0.5"
              fill="white"
            />
          </div>
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 dark:bg-black/80 text-white dark:text-white text-xs font-mono">
          {formatDuration(video.duration)}
        </div>

        {/* Watch progress bar */}
        {progress && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
            <div
              className="h-full bg-brand transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}

        {/* Favorite button */}
        <button
          onClick={toggleFav}
          className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/60 dark:bg-black/60
                     opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart
            size={14}
            className={isFav ? "text-brand fill-brand" : "text-white dark:text-white"}
          />
        </button>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <h3
          className={`text-sm font-medium text-gray-100 dark:text-gray-100 leading-tight line-clamp-2 mb-1 ${
            arabic ? "font-arabic text-right" : ""
          }`}
          dir={arabic ? "rtl" : undefined}
        >
          {truncate(video.title, 60)}
        </h3>
        <p className="text-xs text-gray-500 mb-1.5">
          {video.subcategory
            ? `${video.category} › ${video.subcategory}`
            : video.category}
        </p>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {isFinished ? "Finished" : formatDuration(video.duration)}
          </span>
          <span className="flex items-center gap-1">
            <HardDrive size={10} />
            {formatFileSize(video.fileSize)}
          </span>
          {showCourseControls && isFinished && (
            <span className="ml-auto text-emerald-300">
              <CheckCircle2 size={13} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
