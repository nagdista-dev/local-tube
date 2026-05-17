import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Heart, Play, Pause, Volume2, VolumeX,
  Maximize, Minimize, Settings, SkipForward, ChevronLeft,
  Timer
} from 'lucide-react';
import { api, streamUrl } from '../utils/api';
import { formatDuration, formatFileSize } from '../utils/format';

// ─── Progress bar component ───────────────────────────────────────────────

function ProgressBar({
  current, duration, buffered, onSeek,
}: {
  current: number; duration: number; buffered: number;
  onSeek: (t: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleSeek = useCallback((clientX: number) => {
    if (!barRef.current || duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  }, [duration, onSeek]);

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

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleSeek]);

  const played = duration > 0 ? (current / duration) * 100 : 0;
  const buff   = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={barRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={`group relative rounded-full cursor-pointer transition-all duration-150 ${
        isDragging ? 'h-3' : 'h-1.5 hover:h-3'
      } bg-white/20`}
    >
      <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full" style={{ width: `${buff}%` }} />
      <div className="absolute inset-y-0 left-0 bg-brand rounded-full" style={{ width: `${played}%` }}>
        <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full transition-transform shadow-lg ${
          isDragging ? 'scale-100' : 'scale-0 group-hover:scale-100'
        }`} />
      </div>
    </div>
  );
}

// ─── Player page ──────────────────────────────────────────────────────────

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SAVE_INTERVAL_MS = 5000;

const SLEEP_OPTIONS = [
  { label: 'Off', value: null },
  { label: '5 min', value: 300 },
  { label: '15 min', value: 900 },
  { label: '30 min', value: 1800 },
  { label: '45 min', value: 2700 },
  { label: '1 hour', value: 3600 },
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

export default function Player() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: video, isLoading } = useQuery({
    queryKey: ['video', id],
    queryFn:  () => api.videos.get(id!),
    enabled:  !!id,
  });

  const videoRef     = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const sleepMenuRef = useRef<HTMLDivElement>(null);
  const saveTimer    = useRef<ReturnType<typeof setInterval>>();
  const hideTimer    = useRef<ReturnType<typeof setTimeout>>();
  const latestTimeRef = useRef<number>(0);

  const [playing,    setPlaying]    = useState(false);
  const [muted,      setMuted]      = useState(false);
  const [volume,     setVolume]     = useState(1);
  const [current,    setCurrent]    = useState(0);
  const [duration,   setDuration]   = useState(0);
  const [buffered,   setBuffered]   = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showCtrl,   setShowCtrl]   = useState(true);
  const [speed,      setSpeed]      = useState(1);
  const [showSpeed,  setShowSpeed]  = useState(false);
  const [isFav,      setIsFav]      = useState(false);
  const [resumed,    setResumed]    = useState(false);

  // Sleep timer states
  const [sleepTimeLeft, setSleepTimeLeft] = useState<number | null>(null);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');

  // ── Reset states on video navigation ─────────────────────────────────────
  useEffect(() => {
    setResumed(false);
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setBuffered(0);
    setShowSpeed(false);
    setIsFav(false);
    latestTimeRef.current = 0;
    setSleepTimeLeft(null);
    setShowSleepMenu(false);
    setCustomMinutes('');
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
      setSleepTimeLeft(prev => {
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
    const startAt = video.watchProgress > 0.02 && video.watchProgress < 0.98
      ? video.watchProgress * video.duration
      : 0;
    if (startAt > 5) {
      videoEl.currentTime = startAt;
    }
    setIsFav(video.isFavorite);
    setResumed(true);
  }, [video, resumed]);

  // ── Auto-save progress ───────────────────────────────────────────────────
  useEffect(() => {
    saveTimer.current = setInterval(() => {
      const videoEl = videoRef.current;
      if (!videoEl || !id || videoEl.paused) return;
      api.videos.saveProgress(id, videoEl.currentTime).catch(() => {});
    }, SAVE_INTERVAL_MS);
    return () => clearInterval(saveTimer.current);
  }, [id]);

  // Save on unmount / navigation too
  useEffect(() => {
    return () => {
      const lastTime = latestTimeRef.current;
      if (id && lastTime > 2) {
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
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setShowSpeed(false);
      }
    };
    document.addEventListener('click', clickHandler, { capture: true });
    return () => document.removeEventListener('click', clickHandler, { capture: true });
  }, [showSpeed]);

  // ── Sleep Timer Click-Outside Dismissal ───────────────────────────────
  useEffect(() => {
    if (!showSleepMenu) return;
    const clickHandler = (e: MouseEvent) => {
      if (sleepMenuRef.current && !sleepMenuRef.current.contains(e.target as Node)) {
        setShowSleepMenu(false);
      }
    };
    document.addEventListener('click', clickHandler, { capture: true });
    return () => document.removeEventListener('click', clickHandler, { capture: true });
  }, [showSleepMenu]);

  // ── Stable Toggle Functions ──────────────────────────────────────────────
  const togglePlay = useCallback(() => {
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
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const videoEl = videoRef.current;
      if (!videoEl) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          videoEl.paused ? videoEl.play() : videoEl.pause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          videoEl.currentTime = Math.min(videoEl.duration, videoEl.currentTime + 10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          videoEl.currentTime = Math.max(0, videoEl.currentTime - 10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          videoEl.volume = Math.min(1, videoEl.volume + 0.1);
          videoEl.muted = false;
          break;
        case 'ArrowDown':
          e.preventDefault();
          videoEl.volume = Math.max(0, videoEl.volume - 0.1);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          videoEl.muted = !videoEl.muted;
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleFullscreen]);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFav = async () => {
    if (!id) return;
    const { isFavorite } = await api.videos.toggleFavorite(id);
    setIsFav(isFavorite);
  };

  if (isLoading || !video) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
      >
        <ChevronLeft size={18} />
        Back
      </button>

      {/* Player */}
      <div
        ref={containerRef}
        onMouseMove={resetHideTimer}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        className={`relative bg-black overflow-hidden group transition-all duration-300 ${
          fullscreen ? 'w-full h-full rounded-none' : 'aspect-video rounded-xl'
        } ${showCtrl ? 'cursor-pointer' : 'cursor-none'}`}
      >
        <video
          ref={videoRef}
          src={streamUrl(video.id)}
          className="w-full h-full object-contain"
          onPlay={()  => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={() => {
            const videoEl = videoRef.current;
            if (!videoEl) return;
            setCurrent(videoEl.currentTime);
            latestTimeRef.current = videoEl.currentTime;
            if (videoEl.buffered.length) {
              setBuffered(videoEl.buffered.end(videoEl.buffered.length - 1));
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
          onEnded={() => {
            if (id) api.videos.saveProgress(id, 0).catch(() => {});
          }}
        />

        {/* Controls overlay */}
        <div
          className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-t
            from-black/90 via-transparent to-transparent
            transition-opacity duration-300 ${
              showCtrl ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
        >
          {/* Progress */}
          <div className="px-4 pb-2" onClick={e => e.stopPropagation()}>
            <ProgressBar
              current={current}
              duration={duration}
              buffered={buffered}
              onSeek={t => {
                const videoEl = videoRef.current;
                if (videoEl) videoEl.currentTime = t;
              }}
            />
          </div>

          {/* Buttons row */}
          <div className="flex items-center gap-3 px-4 pb-4" onClick={e => e.stopPropagation()}>
            <button onClick={togglePlay} className="hover:text-brand transition-colors">
              {playing
                ? <Pause size={22} fill="currentColor" />
                : <Play  size={22} fill="currentColor" />
              }
            </button>

            <button
              onClick={() => {
                const videoEl = videoRef.current;
                if (videoEl) videoEl.currentTime += 10;
              }}
              className="hover:text-brand transition-colors"
            >
              <SkipForward size={20} />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const videoEl = videoRef.current;
                  if (videoEl) videoEl.muted = !videoEl.muted;
                }}
                className="hover:text-brand"
              >
                {muted || volume === 0
                  ? <VolumeX size={20} />
                  : <Volume2 size={20} />
                }
              </button>
              <input
                type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                onChange={e => {
                  const videoEl = videoRef.current;
                  if (!videoEl) return;
                  videoEl.volume = Number(e.target.value);
                  videoEl.muted  = false;
                }}
                className="w-20 accent-brand"
              />
            </div>

            {/* Time */}
            <span className="text-sm text-gray-300 font-mono ml-1">
              {formatDuration(current)} / {formatDuration(duration)}
            </span>

            <div className="ml-auto flex items-center gap-3">
              {/* Sleep Timer */}
              <div className="relative" ref={sleepMenuRef}>
                <button
                  onClick={() => setShowSleepMenu(v => !v)}
                  className={`flex items-center gap-1 text-sm hover:text-brand transition-colors ${
                    sleepTimeLeft !== null ? 'text-brand font-medium' : 'text-gray-300'
                  }`}
                  title={sleepTimeLeft !== null ? `Sleep Timer: ${formatSleepTime(sleepTimeLeft)} left` : 'Set Sleep Timer'}
                >
                  <Timer size={16} />
                  {sleepTimeLeft !== null ? formatSleepTime(sleepTimeLeft) : 'Timer'}
                </button>
                {showSleepMenu && (
                  <div className="absolute bottom-8 right-0 bg-surface-200 rounded-lg overflow-hidden shadow-xl z-10 w-44 p-1 flex flex-col gap-0.5">
                    {SLEEP_OPTIONS.map(opt => (
                      <button
                        key={opt.label}
                        onClick={() => {
                          setSleepTimeLeft(opt.value);
                          setShowSleepMenu(false);
                        }}
                        className={`block w-full px-3 py-1.5 text-xs text-left rounded hover:bg-surface-300 transition-colors
                          ${(opt.value === null && sleepTimeLeft === null) || (opt.value !== null && sleepTimeLeft !== null && Math.abs(sleepTimeLeft - opt.value) < 2)
                            ? 'text-brand font-medium bg-brand/10'
                            : 'text-gray-300'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <div className="border-t border-surface-300/50 my-1" />
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        const mins = parseInt(customMinutes, 10);
                        if (!isNaN(mins) && mins > 0) {
                          setSleepTimeLeft(mins * 60);
                          setCustomMinutes('');
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
                        onChange={e => setCustomMinutes(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        className="w-full bg-surface-300 text-white placeholder-gray-500 rounded px-1.5 py-1 text-xs border border-transparent focus:border-brand focus:outline-none animate-none"
                      />
                      <button
                        type="submit"
                        className="bg-brand text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-brand/90 transition-colors"
                      >
                        Set
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Speed */}
              <div className="relative" ref={speedMenuRef}>
                <button
                  onClick={() => setShowSpeed(v => !v)}
                  className="flex items-center gap-1 text-sm hover:text-brand transition-colors"
                >
                  <Settings size={16} /> {speed}×
                </button>
                {showSpeed && (
                  <div className="absolute bottom-8 right-0 bg-surface-200 rounded-lg overflow-hidden shadow-xl z-10">
                    {SPEEDS.map(s => (
                      <button
                        key={s}
                        onClick={() => {
                          setSpeed(s);
                          const videoEl = videoRef.current;
                          if (videoEl) videoEl.playbackRate = s;
                          setShowSpeed(false);
                        }}
                        className={`block w-full px-4 py-2 text-sm text-left hover:bg-surface-300
                          ${speed === s ? 'text-brand font-medium' : 'text-gray-300'}`}
                      >
                        {s}×
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <button onClick={toggleFullscreen} className="hover:text-brand transition-colors">
                {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video info */}
      <div className="mt-6 flex gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white mb-2">{video.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
            <span className="px-2 py-0.5 bg-surface-200 rounded-md">{video.category}</span>
            {video.subcategory && (
              <span className="px-2 py-0.5 bg-surface-200 rounded-md">{video.subcategory}</span>
            )}
            <span>{formatDuration(video.duration)}</span>
            <span>{formatFileSize(video.fileSize)}</span>
            {video.resolution && <span>{video.resolution}</span>}
          </div>

          {/* Tags */}
          {video.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {video.tags.map(tag => (
                <span key={tag} className="px-2 py-1 bg-surface-100 text-gray-400 text-xs rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={toggleFav}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all h-fit
            ${isFav
              ? 'border-brand text-brand bg-brand/10'
              : 'border-surface-300 text-gray-400 hover:border-brand hover:text-brand'
            }`}
        >
          <Heart size={18} className={isFav ? 'fill-brand' : ''} />
          {isFav ? 'Favorited' : 'Favorite'}
        </button>
      </div>
    </div>
  );
}