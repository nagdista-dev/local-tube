import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Menu, Search, RefreshCw, Heart, History, X, Film } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../utils/api';

export default function Navbar() {
  const navigate  = useNavigate();
  const toggleSidebar = useStore(s => s.toggleSidebar);
  const search    = useStore(s => s.filters.search);
  const setSearch = useStore(s => s.setSearch);

  const [localSearch, setLocalSearch] = useState(search);
  const [scanning, setScanning]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(localSearch), 300);
    return () => clearTimeout(t);
  }, [localSearch, setSearch]);

  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      await api.scan.start();
      // Poll until done
      const poll = setInterval(async () => {
        const status = await api.scan.status();
        if (status.status !== 'scanning') {
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
    setLocalSearch('');
    setSearch('');
    inputRef.current?.focus();
  };

  return (
    <header className="sticky top-0 z-40 h-14 flex items-center gap-3 px-4 bg-surface/95 backdrop-blur-sm border-b border-surface-200">
      {/* Hamburger */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg hover:bg-surface-200 transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 shrink-0 mr-4">
        <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
          <Film size={18} className="text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight text-white hidden sm:block">
          Local<span className="text-brand">Tube</span>
        </span>
      </Link>

      {/* Search */}
      <div className="relative flex-1 max-w-xl">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={localSearch}
          onChange={e => setLocalSearch(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && clearSearch()}
          placeholder="Search videos, categories…"
          className="w-full h-9 pl-9 pr-8 rounded-full bg-surface-200 border border-surface-300
                     text-sm placeholder:text-gray-500 focus:outline-none focus:ring-1
                     focus:ring-brand focus:border-brand transition-all"
        />
        {localSearch && (
          <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Nav actions */}
      <nav className="flex items-center gap-1 ml-auto">
        <Link
          to="/history"
          className="p-2 rounded-lg hover:bg-surface-200 transition-colors text-gray-400 hover:text-white"
          title="Watch History"
        >
          <History size={20} />
        </Link>
        <Link
          to="/favorites"
          className="p-2 rounded-lg hover:bg-surface-200 transition-colors text-gray-400 hover:text-white"
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
          <RefreshCw size={15} className={scanning ? 'animate-spin' : ''} />
          <span className="hidden sm:block">{scanning ? 'Scanning…' : 'Rescan'}</span>
        </button>
      </nav>
    </header>
  );
}