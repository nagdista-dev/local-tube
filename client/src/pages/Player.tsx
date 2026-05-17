import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Heart, Play, Pause, Volume2, VolumeX,
  Maximize, Minimize, Settings, SkipForward, ChevronLeft,
  Timer, ChevronsRight, Trash2, Bookmark
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

function getYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function Player() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const externalUrl = searchParams.get('url');

  const { data: dbVideo, isLoading: dbLoading } = useQuery({
    queryKey: ['video', id],
    queryFn:  () => api.videos.get(id!),
    enabled:  !!id && id !== 'external',
  });

  const video = id === 'external' && externalUrl ? {
    id: 'external',
    title: 'External Stream',
    filename: 'External Stream',
    path: externalUrl,
    relativePath: externalUrl,
    category: 'Quick Play',
    subcategory: 'Web',
    duration: 0,
    fileSize: 0,
    resolution: 'HD',
    tags: [] as string[],
    isFavorite: false,
    watchProgress: 0,
  } : dbVideo;

  const isLoading = id === 'external' ? false : dbLoading;

  const isExternal = video?.path?.startsWith('http');
  const youtubeId = (isExternal && video?.path) ? getYouTubeId(video.path) : null;

  const videoRef     = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const sleepMenuRef = useRef<HTMLDivElement>(null);
  const saveTimer    = useRef<ReturnType<typeof setInterval>>();
  const hideTimer    = useRef<ReturnType<typeof setTimeout>>();
  const latestTimeRef = useRef<number>(0);
  const ytPlayerRef   = useRef<any>(null);

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
  const [ytStart,    setYtStart]    = useState<number | null>(null);

  // Sleep timer states
  const [sleepTimeLeft, setSleepTimeLeft] = useState<number | null>(null);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');

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
    latestTimeRef.current = 0;
    setSleepTimeLeft(null);
    setShowSleepMenu(false);
    setCustomMinutes('');
    setIsSpeedingUp(false);
    isHoldingRef.current = false;
    preventClickRef.current = false;
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  }, [id]);

  // ── YouTube API Script Loader ────────────────────────────────────────────
  useEffect(() => {
    if (!youtubeId) return;
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, [youtubeId]);

  // ── YouTube Player Instantiation & Polling ───────────────────────────────
  useEffect(() => {
    if (!youtubeId) return;

    let player: any;
    let pollInterval: any;

    const initPlayer = () => {
      const el = document.getElementById('yt-player-element');
      if (!el) return;

      player = new (window as any).YT.Player('yt-player-element', {
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
              if (player && typeof player.getCurrentTime === 'function') {
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
        if (player && typeof player.destroy === 'function') {
          player.destroy();
        }
        ytPlayerRef.current = null;
      };
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (player && typeof player.destroy === 'function') {
        player.destroy();
      }
      ytPlayerRef.current = null;
    };
  }, [youtubeId, ytStart]);

  // ── Bookmark Notes States ────────────────────────────────────────────────

  interface VideoNote {
    id: string;
    timestamp: number;
    text: string;
    createdAt: string;
  }
  const [notes, setNotes] = useState<VideoNote[]>([]);
  const [noteText, setNoteText] = useState('');

  // Professional feedback states
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notesKey = video?.id === 'external'
    ? `localtube_notes_ext_${encodeURIComponent(video?.path || '')}`
    : `localtube_notes_${video?.id || 'default'}`;

  // Reset ytStart and feedback on video navigation
  useEffect(() => {
    setYtStart(null);
    setToast(null);
    setLastAddedId(null);
  }, [id]);

  // Load notes on mount/when video changes
  useEffect(() => {
    if (!video) return;
    const saved = localStorage.getItem(notesKey);
    if (saved) {
      try {
        setNotes(JSON.parse(saved));
      } catch {
        setNotes([]);
      }
    } else {
      setNotes([]);
    }
    setNoteText('');
  }, [video, notesKey]);

  const saveNotes = (updatedNotes: VideoNote[]) => {
    setNotes(updatedNotes);
    localStorage.setItem(notesKey, JSON.stringify(updatedNotes));
  };

  const handleAddNote = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!noteText.trim()) return;

    const currentTime = videoRef.current ? videoRef.current.currentTime : current;
    const newNote: VideoNote = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: currentTime,
      text: noteText.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated = [...notes, newNote].sort((a, b) => a.timestamp - b.timestamp);
    saveNotes(updated);

    // Trigger premium visual feedback overlays
    setLastAddedId(newNote.id);
    setToast(`Bookmark note saved at ${formatDuration(Math.floor(currentTime))}!`);

    setTimeout(() => {
      setLastAddedId(null);
    }, 2500);

    setTimeout(() => {
      setToast(null);
    }, 3000);

    setNoteText('');
  };

  const handleSeekToNote = (timestamp: number) => {
    if (youtubeId && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      ytPlayerRef.current.seekTo(timestamp, true);
    } else if (youtubeId) {
      setYtStart(Math.floor(timestamp));
    } else if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

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
    if (id === 'external') return;
    saveTimer.current = setInterval(() => {
      const videoEl = videoRef.current;
      if (!videoEl || !id || videoEl.paused) return;
      api.videos.saveProgress(id, videoEl.currentTime).catch(() => {});
    }, SAVE_INTERVAL_MS);
    return () => clearInterval(saveTimer.current);
  }, [id]);

  // Save on unmount / navigation too
  useEffect(() => {
    if (id === 'external') return;
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

    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('touchend', handleGlobalRelease);

    return () => {
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('touchend', handleGlobalRelease);
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
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="relative bg-surface-100/40 backdrop-blur-lg border border-surface-200/50 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-6 animate-pulse">
          <div className="relative w-16 h-16 flex items-center justify-center">
            {/* Spinning glowing brand ring */}
            <div className="absolute inset-0 rounded-full border-4 border-brand/20 border-t-brand animate-spin" />
            {/* Pulsing inner logo */}
            <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-lg">
              LT
            </div>
          </div>
          <div>
            <h2 className="text-md font-bold text-white mb-1">Initializing Player</h2>
            <p className="text-xs text-gray-400">Buffering media streams...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Video Player + Metadata Description Card */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors self-start"
          >
            <ChevronLeft size={18} />
            Back
          </button>

          {/* Player */}
          <div
            ref={containerRef}
            onMouseMove={resetHideTimer}
            onClick={youtubeId ? undefined : togglePlay}
            onDoubleClick={youtubeId ? undefined : toggleFullscreen}
            onMouseDown={youtubeId ? undefined : handlePlayerMouseDown}
            onTouchStart={youtubeId ? undefined : handlePlayerTouchStart}
            className={`relative bg-black overflow-hidden group transition-all duration-300 select-none ${
              fullscreen ? 'w-full h-full rounded-none' : 'aspect-video rounded-xl'
            } ${(!youtubeId && showCtrl) ? 'cursor-pointer' : 'cursor-none'}`}
          >
            {youtubeId ? (
              <div className="w-full h-full absolute inset-0 rounded-xl overflow-hidden bg-black pointer-events-auto">
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
            )}

            {/* Speed-up Indicator overlay */}
            {!youtubeId && isSpeedingUp && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-fade-in">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-white text-sm font-semibold shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                  <span>2× Speed</span>
                  <ChevronsRight size={16} className="animate-pulse text-brand" />
                </div>
              </div>
            )}

            {/* Controls overlay */}
            <div
              className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-t
                from-black/90 via-transparent to-transparent
                transition-opacity duration-300 ${
                  (!youtubeId && showCtrl) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
            >
              {/* Progress */}
              <div
                className="px-4 pb-2"
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
              >
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
              <div
                className="flex items-center gap-3 px-4 pb-4"
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
              >
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

          {/* Metadata Description Card (Directly Under Video) */}
          <div className="bg-surface-100/30 backdrop-blur-md border border-surface-200/50 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">{video.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                <span className="px-2 py-0.5 bg-surface-200 rounded-md">{video.category}</span>
                {video.subcategory && (
                  <span className="px-2 py-0.5 bg-surface-200 rounded-md">{video.subcategory}</span>
                )}
                {video.duration > 0 && <span>{formatDuration(video.duration)}</span>}
                {video.fileSize > 0 && <span>{formatFileSize(video.fileSize)}</span>}
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

            {id !== 'external' && (
              <div className="mt-6 flex justify-end">
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
            )}
          </div>
        </div>

        {/* Right Column: Sticky Video Notes & Bookmarks Sidebar */}
        <div className="lg:col-span-1 lg:h-[calc(100vh-100px)] lg:sticky lg:top-20 flex flex-col">
          <div className="bg-surface-100/30 backdrop-blur-md border border-surface-200/50 rounded-2xl p-5 shadow-lg flex flex-col h-full min-h-[450px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="p-1.5 bg-brand/10 text-brand rounded-lg">
                  ⏱️
                </span>
                Video Notes & Bookmarks
              </h2>
              {notes.length > 0 && (
                <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full font-bold">
                  {notes.length} {notes.length === 1 ? 'Note' : 'Notes'}
                </span>
              )}
            </div>

            {/* Add Note Form */}
            <form onSubmit={handleAddNote} className="mb-4 shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Type a note about this moment..."
                  className="flex-1 h-9 px-3 rounded-xl bg-surface-200 border border-surface-300
                             text-xs placeholder:text-gray-500 focus:outline-none focus:ring-1
                             focus:ring-brand focus:border-brand transition-all text-white"
                />
                <button
                  type="submit"
                  disabled={!noteText.trim()}
                  className="h-9 px-3.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold
                             transition-all flex items-center gap-1.5 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  <span>Add at {formatDuration(Math.floor(videoRef.current ? videoRef.current.currentTime : current))}</span>
                </button>
              </div>
            </form>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar min-h-0">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-500 flex flex-col items-center justify-center gap-2">
                  <Bookmark size={28} className="text-brand/40 animate-pulse mb-1" />
                  <p className="font-semibold text-white/90">No bookmarks yet</p>
                  <p className="opacity-70">Pause and bookmark important moments!</p>
                </div>
              ) : (
                notes.map(note => (
                  <div
                    key={note.id}
                    className={`group/note flex items-start gap-2.5 p-2.5 bg-surface-200/50 hover:bg-surface-200 border rounded-xl transition-all duration-300 ${
                      note.id === lastAddedId
                        ? 'border-brand bg-brand/5 shadow-[0_0_15px_rgba(239,68,68,0.25)] animate-pulse'
                        : 'border-white/5'
                    }`}
                  >
                    <button
                      onClick={() => handleSeekToNote(note.timestamp)}
                      className="px-2 py-1 bg-brand/10 hover:bg-brand/20 border border-brand/20 text-brand text-[10px] font-bold rounded-lg transition-all shrink-0 cursor-pointer flex items-center gap-1"
                      title="Jump to note time"
                    >
                      <span>⏱️</span>
                      {formatDuration(Math.floor(note.timestamp))}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-200 break-words leading-relaxed">{note.text}</p>
                      <span className="text-[9px] text-gray-500 mt-1 block">
                        {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => saveNotes(notes.filter(n => n.id !== note.id))}
                      className="opacity-0 group-hover/note:opacity-100 text-gray-500 hover:text-brand transition-all p-1 shrink-0"
                      title="Delete Note"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast Feedback Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div className="flex items-center gap-2.5 bg-brand border border-white/20 px-4 py-3 rounded-2xl text-white text-xs font-semibold shadow-2xl shadow-brand/20 backdrop-blur-md animate-bounce">
            <span>⏱️</span>
            <span>{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}