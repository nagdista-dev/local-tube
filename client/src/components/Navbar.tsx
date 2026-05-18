import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
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
} from "lucide-react";
import { useStore } from "../store/useStore";
import { useTheme } from "../hooks/useTheme";
import { api } from "../utils/api";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const search = useStore((s) => s.filters.search);
  const setSearch = useStore((s) => s.setSearch);
  const { theme, toggleTheme } = useTheme();

  const [localSearch, setLocalSearch] = useState(search);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Play External URL States inside Navbar popover ────────────────────────
  const [showUrlDropdown, setShowUrlDropdown] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Debounce search and redirect to Home if searching on subpages
  useEffect(() => {
    // If it's a URL, do NOT update search filters in the store!
    if (/^https?:\/\//i.test(localSearch.trim())) {
      return;
    }
    const t = setTimeout(() => {
      setSearch(localSearch);
      if (localSearch.trim() && location.pathname !== "/") {
        navigate("/");
      }
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch, setSearch, navigate, location.pathname]);

  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      await api.scan.start();
      // Poll until done
      const poll = setInterval(async () => {
        const status = await api.scan.status();
        if (status.status !== "scanning") {
          clearInterval(poll);
          setScanning(false);
          window.location.reload();
        }
      }, 2000);
    } catch {
      setScanning(false);
    }
  }, []);

  const clearSearch = () => {
    setLocalSearch("");
    setSearch("");
    inputRef.current?.focus();
  };

  return (
    <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 bg-surface/95 dark:bg-surface/95 backdrop-blur-sm border-b border-surface-200 dark:border-surface-200 transition-colors duration-200">
      {/* Left Block: Menu and Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-200 transition-colors text-white dark:text-white"
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
          className="flex items-center gap-2 shrink-0 mr-4"
        >
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
            <Film size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white dark:text-white hidden sm:block">
            Local<span className="text-brand">Tube</span>
          </span>
        </Link>
      </div>

      {/* Center Block: Centered Search Bar & URL Play Popover */}
      <div
        className="flex-1 flex justify-center max-w-xl mx-auto px-4 relative"
        ref={dropdownRef}
      >
        <div className="relative w-full max-w-md flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-400 pointer-events-none"
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
              className="w-full h-9 pl-9 pr-8 rounded-full bg-surface-200 dark:bg-surface-200 border border-surface-300 dark:border-surface-300
                         text-sm placeholder:text-gray-500 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1
                         focus:ring-brand focus:border-brand transition-all text-white dark:text-white"
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
            className={`p-2 rounded-full border transition-all shrink-0 hover:bg-brand/10 hover:text-brand hover:border-brand/40
                        ${
                          showUrlDropdown
                            ? "bg-brand/10 text-brand border-brand/50 shadow-md shadow-brand/10"
                            : "bg-surface-200 dark:bg-surface-200 border-surface-300 dark:border-surface-300 text-gray-400 dark:text-gray-400"
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
      <nav className="flex items-center gap-1 shrink-0">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-200 transition-colors text-gray-400 dark:text-gray-400 hover:text-white dark:hover:text-white"
          title={
            theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"
          }
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <Link
          to="/history"
          className="p-2 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-200 transition-colors text-gray-400 dark:text-gray-400 hover:text-white dark:hover:text-white"
          title="Watch History"
        >
          <History size={20} />
        </Link>
        <Link
          to="/favorites"
          className="p-2 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-200 transition-colors text-gray-400 dark:text-gray-400 hover:text-white dark:hover:text-white"
          title="Favorites"
        >
          <Heart size={20} />
        </Link>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                     bg-brand hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed
                     transition-all"
          title="Rescan Library"
        >
          <RefreshCw size={15} className={scanning ? "animate-spin" : ""} />
          <span className="hidden sm:block">
            {scanning ? "Scanning…" : "Rescan"}
          </span>
        </button>
      </nav>
    </header>
  );
}
