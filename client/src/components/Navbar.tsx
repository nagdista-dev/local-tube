import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Menu,
  Search,
  RefreshCw,
  Heart,
  History,
  X,
  Film,
  Link2,
  Play,
  AlertTriangle,
  Moon,
  Sun,
  FolderOpen,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { useTheme } from "../hooks/useTheme";
import { api } from "../utils/api";
import type { DirectoryListing } from "../types";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const search = useStore((s) => s.filters.search);
  const setSearch = useStore((s) => s.setSearch);
  const { theme, toggleTheme } = useTheme();

  const [localSearch, setLocalSearch] = useState(search);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);

  // ── Clear Cache States ─────────────────────────────────────────────────────
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const clearCacheRef = useRef<HTMLDivElement>(null);

  // ── Play External URL States inside Navbar popover ────────────────────────
  const [showUrlDropdown, setShowUrlDropdown] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [videosDir, setVideosDir] = useState("");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSaving, setLocationSaving] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryListing, setDirectoryListing] = useState<DirectoryListing | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowUrlDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        locationRef.current &&
        !locationRef.current.contains(e.target as Node)
      ) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        clearCacheRef.current &&
        !clearCacheRef.current.contains(e.target as Node)
      ) {
        setShowClearConfirm(false);
        setClearError(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    api.scan.location()
      .then(({ videosDir }) => setVideosDir(videosDir))
      .catch(() => {
        setLocationError("Unable to load the saved video folder.");
      });
  }, []);

  const handlePlayStream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    if (!/^https?:\/\//i.test(url.trim())) {
      setError("Please enter a valid HTTP/HTTPS video URL.");
      return;
    }

    setError(null);
    const targetUrl = url.trim();
    setUrl("");
    setShowUrlDropdown(false);
    navigate(`/watch/external?url=${encodeURIComponent(targetUrl)}`);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
      }
    } catch {
      // Permission denied
    }
  };

  // Debounce search and redirect to Home if searching on listing subpages
  useEffect(() => {
    // If it's a URL, do NOT update search filters in the store!
    if (/^https?:\/\//i.test(localSearch.trim())) {
      return;
    }
    const t = setTimeout(() => {
      setSearch(localSearch);
      // Only redirect from listing pages — never interrupt a /watch/ navigation
      const isListingPage = location.pathname === "/history" || location.pathname === "/favorites";
      if (localSearch.trim() && isListingPage) {
        navigate("/");
      }
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch, setSearch, navigate, location.pathname]);


  const waitForScan = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      const poll = window.setInterval(async () => {
        try {
          const status = await api.scan.status();
          if (status.status !== "scanning") {
            window.clearInterval(poll);
            if (status.status === "error") {
              reject(new Error(status.message || "Scan failed."));
              return;
            }
            resolve();
          }
        } catch (err) {
          window.clearInterval(poll);
          reject(err);
        }
      }, 2000);
    });
  }, []);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setLocationError(null);
    try {
      await api.scan.start();
      await waitForScan();
      window.location.reload();
    } catch (err: unknown) {
      setScanning(false);
      setLocationError(err instanceof Error ? err.message : "Unable to scan video folder.");
    }
  }, [waitForScan]);

  const loadDirectories = useCallback(async (path?: string) => {
    setDirectoryLoading(true);
    setLocationError(null);

    try {
      setDirectoryListing(await api.scan.directories(path));
    } catch (err: unknown) {
      setLocationError(err instanceof Error ? err.message : "Unable to open folder.");
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  const handleSaveLocation = useCallback(async () => {
    const selectedPath = directoryListing?.currentPath || videosDir;

    if (!selectedPath.trim()) {
      setLocationError("Select a folder.");
      return;
    }

    setLocationSaving(true);
    setScanning(true);
    setLocationError(null);

    try {
      const saved = await api.scan.saveLocation(selectedPath);
      setVideosDir(saved.videosDir);
      await api.scan.start();
      await waitForScan();
      window.location.reload();
    } catch (err: unknown) {
      setScanning(false);
      setLocationSaving(false);
      setLocationError(err instanceof Error ? err.message : "Unable to save video folder.");
    }
  }, [directoryListing?.currentPath, videosDir, waitForScan]);

  const clearSearch = () => {
    setLocalSearch("");
    setSearch("");
    inputRef.current?.focus();
  };

  const handleClearCache = useCallback(async () => {
    setClearing(true);
    setClearError(null);
    try {
      await api.scan.clearCache();
      // Reset all client-side caches
      queryClient.clear();
      useStore.getState().setCategory("");
      useStore.getState().setSearch("");
      setLocalSearch("");
      setShowClearConfirm(false);
      navigate("/");
      window.location.reload();
    } catch (err: unknown) {
      setClearError(err instanceof Error ? err.message : "Failed to clear cache.");
    } finally {
      setClearing(false);
    }
  }, [queryClient, navigate]);

  return (
    <header className="sticky top-0 z-40 min-h-16 flex items-center gap-4 px-4 sm:px-5 bg-surface/90 dark:bg-surface/90 backdrop-blur-xl border-b border-surface-200/70 dark:border-surface-200/70 shadow-sm shadow-black/10 transition-colors duration-200">
      {/* Left Block: Menu and Logo */}
      <div className="flex items-center gap-2 shrink-0 min-w-fit">
        <button
          onClick={toggleSidebar}
          className="w-10 h-10 rounded-xl hover:bg-surface-200/80 dark:hover:bg-surface-200/80 transition-colors text-gray-300 hover:text-white dark:text-gray-300 dark:hover:text-white flex items-center justify-center"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>

        <Link
          to="/"
          onClick={() => {
            setLocalSearch("");
            setSearch("");
            useStore.getState().setCategory("");
          }}
          className="flex items-center gap-2.5 shrink-0 rounded-xl px-1.5 py-1 hover:bg-surface-100/70 transition-colors"
        >
          <div className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center shadow-sm shadow-brand/20">
            <Film size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white dark:text-white hidden md:block">
            Local<span className="text-brand">Tube</span>
          </span>
        </Link>
      </div>

      {/* Center Block: Centered Search Bar & URL Play Popover */}
      <div
        className="flex-1 flex justify-center min-w-[180px] max-w-2xl mx-auto relative"
        ref={dropdownRef}
      >
        <div className="relative w-full max-w-xl flex items-center gap-2 rounded-2xl bg-surface-50/70 border border-surface-200/70 px-2 py-1.5 shadow-inner shadow-black/10">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-500 pointer-events-none"
            />
            <input
              ref={inputRef}
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  clearSearch();
                } else if (
                  e.key === "Enter" &&
                  /^https?:\/\//i.test(localSearch.trim())
                ) {
                  const targetUrl = localSearch.trim();
                  setLocalSearch("");
                  setSearch("");
                  navigate(
                    `/watch/external?url=${encodeURIComponent(targetUrl)}`,
                  );
                }
              }}
              placeholder="Search videos, categories…"
              className="w-full h-9 pl-10 pr-8 rounded-xl bg-transparent border border-transparent
                         text-sm placeholder:text-gray-500 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1
                         focus:ring-brand/70 focus:border-brand/60 transition-all text-white dark:text-white"
            />
            {localSearch && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-400 hover:text-white dark:hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Toggle URL Play Popover Button */}
          <button
            type="button"
            onClick={() => setShowUrlDropdown(!showUrlDropdown)}
            className={`w-9 h-9 rounded-xl border transition-all shrink-0 hover:bg-brand/10 hover:text-brand hover:border-brand/40 flex items-center justify-center
                        ${
                          showUrlDropdown
                            ? "bg-brand/10 text-brand border-brand/50 shadow-md shadow-brand/10"
                            : "bg-surface-100/80 dark:bg-surface-100/80 border-surface-200 dark:border-surface-200 text-gray-400 dark:text-gray-400"
                        }`}
            title="Play Stream from URL"
          >
            <Link2 size={16} />
          </button>
        </div>

        {/* Glow URL paste overlay suggestion */}
        {localSearch.trim() && /^https?:\/\//i.test(localSearch.trim()) && (
          <div className="absolute top-full left-4 right-4 mt-2 bg-surface-100/95 dark:bg-surface-100/95 backdrop-blur-xl border border-brand/30 dark:border-brand/30 rounded-xl p-3 shadow-2xl z-50 animate-fade-in max-w-md mx-auto">
            <button
              onClick={() => {
                const u = localSearch.trim();
                setLocalSearch("");
                setSearch("");
                navigate(`/watch/external?url=${encodeURIComponent(u)}`);
              }}
              className="w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-brand/10 dark:hover:bg-brand/10 transition-colors text-white dark:text-white text-xs font-semibold"
            >
              <div className="p-1.5 bg-brand text-white rounded-md shrink-0">
                <Play size={12} className="fill-current" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-gray-300 dark:text-gray-300">
                  Play URL instantly inside player
                </p>
                <p className="truncate text-[10px] text-brand/70 dark:text-brand/70 font-mono mt-0.5">
                  {localSearch.trim()}
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Inline URL Popover Dropdown */}
        {showUrlDropdown && (
          <div className="absolute top-full left-4 right-4 mt-2 bg-surface-100/95 dark:bg-surface-100/95 backdrop-blur-xl border border-surface-200/80 dark:border-surface-200/80 rounded-2xl p-5 shadow-2xl z-50 animate-fade-in max-w-sm mx-auto text-left">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1 bg-brand/10 text-brand rounded-md">
                <Link2 size={14} />
              </div>
              <h3 className="text-xs font-bold text-white dark:text-white uppercase tracking-wider">
                Play Stream from URL
              </h3>
            </div>

            <p className="text-[11px] text-gray-400 dark:text-gray-400 mb-3 leading-relaxed">
              Paste YouTube or stream links to play immediately inside the
              application.
            </p>

            {error && (
              <div className="mb-3 p-2 bg-brand/10 border border-brand/20 text-brand text-[10px] rounded-lg flex items-start gap-1">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                <p className="flex-1">{error}</p>
              </div>
            )}

            <form onSubmit={handlePlayStream} className="flex flex-col gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste URL..."
                  className="w-full h-8 pl-3 pr-14 rounded-lg bg-surface-200 dark:bg-surface-200 border border-surface-300 dark:border-surface-300
                             text-xs placeholder:text-gray-500 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1
                             focus:ring-brand focus:border-brand transition-all text-white dark:text-white"
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded
                             text-[10px] bg-surface-300 dark:bg-surface-300 hover:bg-surface-300/80 dark:hover:bg-surface-300/80 text-gray-300 dark:text-gray-300 transition-all border dark:border-white/5 border-white/5"
                >
                  Paste
                </button>
              </div>
              <button
                type="submit"
                disabled={!url.trim()}
                className="w-full h-8 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-semibold
                           transition-all flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play size={10} className="fill-current" />
                Play Stream
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Right Block: Actions */}
      <nav className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-1 rounded-2xl bg-surface-50/70 border border-surface-200/70 p-1">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl hover:bg-surface-200/80 dark:hover:bg-surface-200/80 transition-colors text-gray-400 dark:text-gray-400 hover:text-white dark:hover:text-white flex items-center justify-center"
            title={
              theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"
            }
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link
            to="/history"
            className="w-9 h-9 rounded-xl hover:bg-surface-200/80 dark:hover:bg-surface-200/80 transition-colors text-gray-400 dark:text-gray-400 hover:text-white dark:hover:text-white flex items-center justify-center"
            title="Watch History"
          >
            <History size={18} />
          </Link>
          <Link
            to="/favorites"
            className="w-9 h-9 rounded-xl hover:bg-surface-200/80 dark:hover:bg-surface-200/80 transition-colors text-gray-400 dark:text-gray-400 hover:text-white dark:hover:text-white flex items-center justify-center"
            title="Favorites"
          >
            <Heart size={18} />
          </Link>
        </div>

        <div className="flex items-center gap-1.5 rounded-2xl bg-surface-50/70 border border-surface-200/70 p-1">
        <div className="relative" ref={locationRef}>
          <button
            type="button"
            onClick={() => {
              setShowLocationDropdown((open) => {
                if (!open) {
                  loadDirectories(videosDir);
                }
                return !open;
              });
            }}
            className={`h-9 flex items-center gap-2 px-3 rounded-xl text-sm font-medium border transition-all
                       ${
                         showLocationDropdown
                           ? "bg-brand/10 text-brand border-brand/50"
                           : "bg-transparent border-transparent text-gray-300 hover:text-white hover:bg-surface-200/80 hover:border-surface-300"
                       }`}
            title={videosDir ? `Video Folder: ${videosDir}` : "Set Video Folder"}
          >
            <FolderOpen size={15} />
            <span className="hidden lg:block">Folder</span>
          </button>

          {showLocationDropdown && (
            <div className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-surface-100/95 dark:bg-surface-100/95 backdrop-blur-xl border border-surface-200/80 dark:border-surface-200/80 rounded-2xl p-5 shadow-2xl z-50 animate-fade-in text-left">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1 bg-brand/10 text-brand rounded-md">
                  <FolderOpen size={14} />
                </div>
                <h3 className="text-xs font-bold text-white dark:text-white uppercase tracking-wider">
                  Video Folder
                </h3>
              </div>

              <p className="text-[11px] text-gray-400 dark:text-gray-400 mb-3 leading-relaxed">
                Click through folders on this computer, then use the current
                folder as your video library.
              </p>

              {locationError && (
                <div className="mb-3 p-2 bg-brand/10 border border-brand/20 text-brand text-[10px] rounded-lg flex items-start gap-1">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <p className="flex-1">{locationError}</p>
                </div>
              )}

              <div className="mb-3 rounded-lg bg-surface-200 dark:bg-surface-200 border border-surface-300 dark:border-surface-300 p-2">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                  Current Folder
                </p>
                <p className="text-[11px] text-gray-200 font-mono break-all">
                  {directoryListing?.currentPath || videosDir || "Loading..."}
                </p>
              </div>

              <div className="max-h-56 overflow-y-auto rounded-lg border border-surface-300 dark:border-surface-300 bg-surface-200/70 dark:bg-surface-200/70 mb-3">
                {directoryListing?.parentPath && (
                  <button
                    type="button"
                    onClick={() => loadDirectories(directoryListing.parentPath || undefined)}
                    className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:text-white hover:bg-surface-300 dark:hover:bg-surface-300 transition-colors border-b border-surface-300/60"
                  >
                    .. Up
                  </button>
                )}

                {directoryLoading && (
                  <div className="px-3 py-3 text-xs text-gray-400 flex items-center gap-2">
                    <RefreshCw size={12} className="animate-spin" />
                    Loading folders...
                  </div>
                )}

                {!directoryLoading && directoryListing?.entries.length === 0 && (
                  <div className="px-3 py-3 text-xs text-gray-500">
                    No subfolders here.
                  </div>
                )}

                {!directoryLoading && directoryListing?.entries.map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    onClick={() => loadDirectories(entry.path)}
                    className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:text-white hover:bg-surface-300 dark:hover:bg-surface-300 transition-colors flex items-center gap-2 border-b border-surface-300/40 last:border-b-0"
                  >
                    <FolderOpen size={13} className="text-brand shrink-0" />
                    <span className="truncate">{entry.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleSaveLocation}
                  disabled={locationSaving || scanning || !directoryListing?.currentPath}
                  className="w-full h-8 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-semibold
                             transition-all flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw
                    size={10}
                    className={locationSaving || scanning ? "animate-spin" : ""}
                  />
                  {locationSaving || scanning ? "Saving and Scanning..." : "Save Folder and Scan"}
                </button>
              </div>
            </div>
          )}
        </div>
        {/* ── Clear Cache button ─────────────────────────────── */}
        <div className="relative" ref={clearCacheRef}>
          <button
            type="button"
            onClick={() => {
              setShowClearConfirm((v) => !v);
              setClearError(null);
            }}
            className={`h-9 flex items-center gap-2 px-3 rounded-xl text-sm font-medium border transition-all
              ${
                showClearConfirm
                  ? "bg-red-500/10 text-red-400 border-red-500/40"
                  : "bg-transparent border-transparent text-gray-300 hover:text-red-400 hover:bg-surface-200/80 hover:border-red-500/40"
              }`}
            title="Clear Library Cache"
          >
            <Trash2 size={15} />
            <span className="hidden lg:block">Clear Cache</span>
          </button>

          {showClearConfirm && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-surface-100/95 backdrop-blur-xl border border-red-500/20 rounded-2xl p-5 shadow-2xl z-50 animate-fade-in text-left">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1 bg-red-500/10 text-red-400 rounded-md">
                  <AlertCircle size={14} />
                </div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Clear Library Cache
                </h3>
              </div>

              <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">
                This will permanently delete all scanned videos, watch history,
                and course markers from the local database. Your actual video
                files will not be touched. You will need to rescan after.
              </p>

              {clearError && (
                <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] rounded-lg flex items-start gap-1">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <p className="flex-1">{clearError}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowClearConfirm(false);
                    setClearError(null);
                  }}
                  className="flex-1 h-8 rounded-lg bg-surface-300 hover:bg-surface-200 text-gray-300 text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClearCache}
                  disabled={clearing}
                  className="flex-1 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {clearing ? (
                    <RefreshCw size={11} className="animate-spin" />
                  ) : (
                    <Trash2 size={11} />
                  )}
                  {clearing ? "Clearing…" : "Yes, Clear All"}
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleScan}
          disabled={scanning}
          className="h-9 flex items-center gap-2 px-3 rounded-xl text-sm font-semibold
                     bg-brand hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed
                     transition-all shadow-sm shadow-brand/20"
          title="Rescan Library"
        >
          <RefreshCw size={15} className={scanning ? "animate-spin" : ""} />
          <span className="hidden sm:block">
            {scanning ? "Scanning…" : "Rescan"}
          </span>
        </button>
        </div>
      </nav>
    </header>
  );
}
