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
  MoreVertical,
  CornerLeftUp,
  HardDrive,
  ChevronRight,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { useTheme } from "../hooks/useTheme";
import { api } from "../utils/api";
import type { DirectoryListing } from "../types";
import { useTranslation } from "../i18n";
import LanguageSwitcher from "./LanguageSwitcher";

const POPOVER =
  "absolute top-[calc(100%+8px)] end-0 z-50 min-w-[280px] max-w-[min(100vw-1.5rem,360px)] rounded-xl border border-white/[0.08] bg-surface-100/95 backdrop-blur-xl shadow-xl shadow-black/40 animate-fade-in text-start";

function NavIconButton({
  children,
  onClick,
  title,
  active,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
        active
          ? "bg-white/10 text-white"
          : "text-gray-400 hover:text-white hover:bg-white/5"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function NavDivider() {
  return <div className="hidden sm:block w-px h-5 bg-white/[0.08] mx-0.5 shrink-0" aria-hidden />;
}

export default function Navbar() {
  const { t } = useTranslation();
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
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const [showToolsMenu, setShowToolsMenu] = useState(false);

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
    const handleClickOutside = (e: MouseEvent) => {
      if (
        toolsMenuRef.current &&
        !toolsMenuRef.current.contains(e.target as Node)
      ) {
        setShowToolsMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeAllPopovers = () => {
    setShowUrlDropdown(false);
    setShowLocationDropdown(false);
    setShowClearConfirm(false);
    setShowToolsMenu(false);
  };

  useEffect(() => {
    api.scan.location()
      .then(({ videosDir }) => setVideosDir(videosDir))
      .catch(() => {
        setLocationError(t("nav.loadFolderError"));
      });
  }, [t]);

  const handlePlayStream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    if (!/^https?:\/\//i.test(url.trim())) {
      setError(t("nav.invalidUrl"));
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
      setLocationError(err instanceof Error ? err.message : t("nav.scanFolderError"));
    }
  }, [waitForScan, t]);

  const loadDirectories = useCallback(async (path?: string) => {
    setDirectoryLoading(true);
    setLocationError(null);

    try {
      setDirectoryListing(await api.scan.directories(path));
    } catch (err: unknown) {
      setLocationError(err instanceof Error ? err.message : t("nav.openFolderError"));
    } finally {
      setDirectoryLoading(false);
    }
  }, [t]);

  const handleSaveLocation = useCallback(async () => {
    const selectedPath = directoryListing?.currentPath || videosDir;

    if (!selectedPath.trim()) {
      setLocationError(t("nav.selectFolder"));
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
      setLocationError(err instanceof Error ? err.message : t("nav.saveFolderError"));
    }
  }, [directoryListing?.currentPath, videosDir, waitForScan, t]);

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
      setClearError(err instanceof Error ? err.message : t("nav.clearCacheError"));
    } finally {
      setClearing(false);
    }
  }, [queryClient, navigate, t]);


  const openFolderPicker = () => {
    closeAllPopovers();
    setShowLocationDropdown(true);
    loadDirectories(videosDir);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-surface/80 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/70 w-full">
      <div className="w-full px-3 sm:px-4">
        <div className="flex h-14 items-center justify-between gap-2 sm:gap-3">
          {/* Brand */}
          <div className="flex items-center gap-1 shrink-0">
            <NavIconButton onClick={toggleSidebar} title={t("nav.toggleSidebar")}>
              <Menu size={18} />
            </NavIconButton>
            <Link
              to="/"
              onClick={() => {
                setLocalSearch("");
                setSearch("");
                useStore.getState().setCategory("");
              }}
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/5 transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand shadow-lg shadow-brand/25">
                <Film size={17} className="text-white" />
              </div>
              <span className="hidden sm:block font-bold text-[15px] tracking-tight text-white">
                {t("nav.brandLocal")}
                <span className="text-brand">{t("nav.brandTube")}</span>
              </span>
            </Link>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-0 max-w-2xl" ref={dropdownRef}>
            <div className="relative group">
              <Search
                size={16}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-gray-400"
              />
              <input
                ref={inputRef}
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") clearSearch();
                  else if (
                    e.key === "Enter" &&
                    /^https?:\/\//i.test(localSearch.trim())
                  ) {
                    const targetUrl = localSearch.trim();
                    setLocalSearch("");
                    setSearch("");
                    navigate(`/watch/external?url=${encodeURIComponent(targetUrl)}`);
                  }
                }}
                placeholder={t("nav.searchPlaceholder")}
                className="w-full h-10 ps-9 pe-20 rounded-xl bg-white/[0.04] text-sm text-white placeholder:text-gray-500 ring-1 ring-white/[0.06] transition-shadow focus:outline-none focus:ring-2 focus:ring-brand/50 focus:bg-white/[0.06]"
              />
              <div className="absolute end-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {localSearch && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="h-7 w-7 rounded-md flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10"
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowUrlDropdown((v) => {
                      const next = !v;
                      if (next) {
                        setShowLocationDropdown(false);
                        setShowClearConfirm(false);
                        setShowToolsMenu(false);
                      }
                      return next;
                    });
                  }}
                  className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
                    showUrlDropdown
                      ? "bg-brand/20 text-brand"
                      : "text-gray-500 hover:text-brand hover:bg-brand/10"
                  }`}
                  title={t("nav.playStreamTitle")}
                >
                  <Link2 size={15} />
                </button>
              </div>
            </div>

            {localSearch.trim() && /^https?:\/\//i.test(localSearch.trim()) && (
              <div className="absolute inset-x-0 top-[calc(100%+6px)] z-50 rounded-xl border border-brand/25 bg-surface-100/95 p-2 shadow-xl backdrop-blur-xl animate-fade-in">
                <button
                  type="button"
                  onClick={() => {
                    const u = localSearch.trim();
                    setLocalSearch("");
                    setSearch("");
                    navigate(`/watch/external?url=${encodeURIComponent(u)}`);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg p-2.5 text-start hover:bg-brand/10 transition-colors"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
                    <Play size={14} className="fill-current" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-gray-200">
                      {t("nav.playUrlHint")}
                    </span>
                    <span className="block truncate text-[10px] font-mono text-brand/80 mt-0.5">
                      {localSearch.trim()}
                    </span>
                  </span>
                </button>
              </div>
            )}

            {showUrlDropdown && (
              <div className={`${POPOVER} inset-x-0 sm:inset-x-auto sm:w-[320px]`}>
                <p className="text-sm font-semibold text-white mb-1">
                  {t("nav.playStreamTitle")}
                </p>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  {t("nav.playStreamDesc")}
                </p>
                {error && (
                  <div className="mb-3 flex gap-2 rounded-lg border border-brand/20 bg-brand/10 p-2.5 text-xs text-brand">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                )}
                <form onSubmit={handlePlayStream} className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder={t("nav.pasteUrlPlaceholder")}
                      className="w-full h-9 rounded-lg bg-surface-200/80 ps-3 pe-16 text-sm text-white placeholder:text-gray-500 ring-1 ring-white/[0.06] focus:outline-none focus:ring-2 focus:ring-brand/40"
                    />
                    <button
                      type="button"
                      onClick={handlePaste}
                      className="absolute end-1 top-1/2 -translate-y-1/2 rounded-md bg-white/10 px-2 py-1 text-[10px] font-medium text-gray-300 hover:text-white"
                    >
                      {t("nav.paste")}
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={!url.trim()}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                  >
                    <Play size={12} className="fill-current" />
                    {t("nav.playStream")}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 lg:w-1/4 justify-end">

            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            <div className="md:hidden">
              <LanguageSwitcher compact />
            </div>

            <NavIconButton
              onClick={toggleTheme}
              title={theme === "dark" ? t("nav.themeLight") : t("nav.themeDark")}
              aria-label={t("nav.toggleTheme")}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </NavIconButton>

            <NavDivider />

            <div className="relative hidden md:block" ref={locationRef}>
              <button
                type="button"
                onClick={() => {
                  if (showLocationDropdown) {
                    setShowLocationDropdown(false);
                  } else {
                    openFolderPicker();
                  }
                }}
                title={
                  videosDir
                    ? t("nav.videoFolderTitle", { path: videosDir })
                    : t("nav.setVideoFolder")
                }
                className={`h-9 flex items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${
                  showLocationDropdown
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <FolderOpen size={16} />
                <span className="hidden lg:inline">{t("nav.folder")}</span>
              </button>
              {showLocationDropdown && (
                <div className={`${POPOVER} w-96 max-w-[min(100vw-1rem,420px)] p-4`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <FolderOpen size={14} />
                    </div>
                    <p className="text-sm font-bold text-white">{t("nav.videoFolder")}</p>
                  </div>
                  <p className="text-[11px] text-gray-400 mb-4 leading-relaxed pl-9">
                    {t("nav.videoFolderDesc")}
                  </p>
                  
                  {locationError && (
                    <div className="mb-4 flex gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <p className="leading-relaxed">{locationError}</p>
                    </div>
                  )}

                  <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 pl-1">
                      {t("nav.currentFolder")}
                    </p>
                    <div className="flex items-center gap-2 rounded-xl bg-surface-200/50 p-2.5 ring-1 ring-surface-300/30 overflow-hidden">
                      <HardDrive size={14} className="text-gray-400 shrink-0" />
                      <p className="text-xs text-gray-200 font-mono break-all line-clamp-2">
                        {directoryListing?.currentPath || videosDir || t("nav.loading")}
                      </p>
                    </div>
                  </div>

                  <div className="bg-surface-200/20 rounded-xl ring-1 ring-surface-300/20 overflow-hidden mb-4 flex flex-col">
                    <div className="bg-surface-200/40 px-3 py-2 border-b border-surface-300/30">
                      <p className="text-[10px] font-semibold uppercase text-gray-400">Select Directory</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                      {directoryListing?.parentPath && (
                        <button
                          type="button"
                          onClick={() => loadDirectories(directoryListing.parentPath || undefined)}
                          className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start text-xs font-medium text-gray-400 hover:bg-surface-300/40 hover:text-white transition-colors"
                        >
                          <CornerLeftUp size={14} className="text-gray-500" />
                          <span>.. (Go Up)</span>
                        </button>
                      )}
                      
                      {directoryLoading ? (
                        <div className="flex flex-col items-center justify-center py-6 gap-2 text-gray-500">
                          <RefreshCw size={16} className="animate-spin text-brand" />
                          <span className="text-[10px] font-medium uppercase tracking-wider">{t("nav.loadingFolders")}</span>
                        </div>
                      ) : directoryListing?.entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 gap-1 text-gray-500">
                          <FolderOpen size={20} className="text-surface-300" />
                          <span className="text-[11px] font-medium">{t("nav.noSubfolders")}</span>
                        </div>
                      ) : (
                        directoryListing?.entries.map((entry) => (
                          <button
                            key={entry.path}
                            type="button"
                            onClick={() => loadDirectories(entry.path)}
                            className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start text-xs font-medium text-gray-300 hover:bg-surface-300/40 hover:text-white transition-colors"
                          >
                            <FolderOpen size={14} className="text-brand opacity-80 group-hover:opacity-100 transition-opacity shrink-0" />
                            <span className="truncate flex-1">{entry.name}</span>
                            <ChevronRight size={12} className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveLocation}
                    disabled={locationSaving || scanning || !directoryListing?.currentPath}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand-hover shadow-lg shadow-brand/20 disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    <RefreshCw size={16} className={locationSaving || scanning ? "animate-spin" : ""} />
                    {locationSaving || scanning ? t("nav.savingScanning") : t("nav.saveFolderScan")}
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleScan}
              disabled={scanning}
              title={t("nav.rescanTitle")}
              className="hidden sm:flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-white shadow-lg shadow-brand/20 hover:bg-brand-hover disabled:opacity-60 transition-colors"
            >
              <RefreshCw size={15} className={scanning ? "animate-spin" : ""} />
              <span className="hidden lg:inline">
                {scanning ? t("nav.scanning") : t("nav.rescan")}
              </span>
            </button>

            <div className="relative" ref={toolsMenuRef}>
              <NavIconButton
                onClick={() => setShowToolsMenu((v) => !v)}
                title={t("nav.toolsMenu")}
                active={showToolsMenu}
              >
                <MoreVertical size={17} />
              </NavIconButton>

              {showToolsMenu && (
                <div className={`${POPOVER} w-56 p-1.5`}>
                  <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    {t("nav.libraryTools")}
                  </p>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white md:hidden"
                    onClick={openFolderPicker}
                  >
                    <FolderOpen size={16} className="text-brand" />
                    {t("nav.folder")}
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white sm:hidden"
                    onClick={() => {
                      setShowToolsMenu(false);
                      handleScan();
                    }}
                    disabled={scanning}
                  >
                    <RefreshCw size={16} className={scanning ? "animate-spin text-brand" : "text-brand"} />
                    {scanning ? t("nav.scanning") : t("nav.rescan")}
                  </button>
                  <Link
                    to="/history"
                    className="flex sm:hidden items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
                    onClick={() => setShowToolsMenu(false)}
                  >
                    <History size={16} />
                    {t("nav.watchHistory")}
                  </Link>
                  <Link
                    to="/favorites"
                    className="flex sm:hidden items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
                    onClick={() => setShowToolsMenu(false)}
                  >
                    <Heart size={16} />
                    {t("nav.favorites")}
                  </Link>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
                    onClick={() => {
                      setShowToolsMenu(false);
                      setShowUrlDropdown(true);
                    }}
                  >
                    <Link2 size={16} className="text-brand" />
                    {t("nav.playStreamTitle")}
                  </button>
                  <div className="my-1 h-px bg-white/[0.06]" />
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-red-400/90 hover:bg-red-500/10 hover:text-red-300"
                    onClick={() => {
                      setShowToolsMenu(false);
                      setShowClearConfirm(true);
                      setClearError(null);
                    }}
                  >
                    <Trash2 size={16} />
                    {t("nav.clearCache")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Clear cache confirm — fixed to viewport corner */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-20 sm:justify-end sm:pt-16 sm:pe-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            aria-label={t("nav.cancel")}
            onClick={() => {
              setShowClearConfirm(false);
              setClearError(null);
            }}
          />
          <div
            ref={clearCacheRef}
            className="relative w-full max-w-sm rounded-xl border border-red-500/20 bg-surface-100 p-5 shadow-2xl animate-fade-in"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={18} className="text-red-400" />
              <h3 className="text-sm font-semibold text-white">{t("nav.clearCacheHeading")}</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">{t("nav.clearCacheDesc")}</p>
            {clearError && (
              <p className="mb-3 text-xs text-red-300">{clearError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirm(false);
                  setClearError(null);
                }}
                className="flex-1 h-9 rounded-lg bg-white/5 text-sm font-medium text-gray-300 hover:bg-white/10"
              >
                {t("nav.cancel")}
              </button>
              <button
                type="button"
                onClick={handleClearCache}
                disabled={clearing}
                className="flex-1 h-9 rounded-lg bg-red-500 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {clearing && <RefreshCw size={14} className="animate-spin" />}
                {clearing ? t("nav.clearing") : t("nav.clearConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
