import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  Heart,
  History,
  Play,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Tv2,
  CheckCircle2,
  Search,
  X,
  Download,
  BookOpen,
  Github,
  Mail,
  Timer,
  Wrench,
} from "lucide-react";
import { api } from "../utils/api";
import { useStore } from "../store/useStore";
import { useTranslation } from "../i18n";
import { Category } from "../types";
import { isArabic } from "../utils/format";
import PrayerTimes from "./PrayerTimes";

const NAV_LINKS = [
  { to: "/", icon: Home, labelKey: "sidebar.home" },
  { to: "/continue-watching", icon: Play, labelKey: "sidebar.continueWatching" },
  { to: "/history", icon: History, labelKey: "sidebar.history" },
  { to: "/favorites", icon: Heart, labelKey: "sidebar.favorites" },
] as const;

const TOOLS_LINKS = [
  { to: "/guide", icon: BookOpen, labelKey: "sidebar.howToUse" },
] as const;

function categoryMatches(category: Category, query: string): boolean {
  const value = query.trim().toLowerCase();
  if (!value) return true;
  return (
    category.name.toLowerCase().includes(value) ||
    category.path.toLowerCase().includes(value)
  );
}

function filterCategories(categories: Category[], query: string): Category[] {
  const value = query.trim();
  if (!value) return categories;

  return categories.flatMap((category) => {
    const subcategories = filterCategories(category.subcategories || [], value);
    if (categoryMatches(category, value) || subcategories.length > 0) {
      return [{ ...category, subcategories }];
    }
    return [];
  });
}

function CategoryTree({
  category,
  activeCategory,
  expandedFolders,
  onToggleExpand,
  onSelectCategory,
  forceExpanded = false,
  level = 0,
  t,
}: {
  category: Category;
  activeCategory: string;
  expandedFolders: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelectCategory: (path: string) => void;
  forceExpanded?: boolean;
  level?: number;
  t: (key: string) => string;
}) {
  const isExpanded = forceExpanded || expandedFolders.has(category.path);
  const hasSubcategories = category.subcategories?.length > 0;
  const isActive = activeCategory === category.path;

  return (
    <div className="flex flex-col gap-0.5">
      {/* Folder Row */}
      <div
        className={`group w-full flex items-center rounded-lg text-sm transition-all duration-200 relative
          ${
            isActive
              ? "bg-surface-200 text-white font-medium shadow-sm"
              : "text-gray-400 hover:bg-surface-100/60 hover:text-white"
          }`}
        style={{ paddingLeft: `${8 + level * 12}px` }}
      >
        {/* Folder Expansion Click Area */}
        <div className="flex items-center shrink-0">
          {hasSubcategories ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(category.path);
              }}
              className="p-1 rounded hover:bg-surface-300 text-gray-500 hover:text-white transition-colors cursor-pointer"
              title={isExpanded ? t("sidebar.closeFolder") : t("sidebar.openFolder")}
            >
              {isExpanded ? (
                <ChevronDown size={13} className="shrink-0" />
              ) : (
                <ChevronRight size={13} className="shrink-0" />
              )}
            </button>
          ) : (
            <span className="w-[21px] shrink-0" />
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasSubcategories) {
                onToggleExpand(category.path);
              } else {
                onSelectCategory(category.path);
              }
            }}
            className="p-1 rounded hover:bg-surface-300 transition-colors cursor-pointer"
            title={
              hasSubcategories
                ? isExpanded
                  ? t("sidebar.closeFolder")
                  : t("sidebar.openFolder")
                : category.name
            }
          >
            {hasSubcategories && isExpanded ? (
              <FolderOpen
                size={15}
                className={`shrink-0 transition-colors ${
                  isActive ? "text-brand" : "text-gray-500 group-hover:text-gray-300"
                }`}
              />
            ) : (
              <Folder
                size={15}
                className={`shrink-0 transition-colors ${
                  isActive ? "text-brand" : "text-gray-500 group-hover:text-gray-300"
                }`}
              />
            )}
          </button>
        </div>

        {/* Selection Click Area */}
        <button
          onClick={() => {
            onSelectCategory(category.path);
            if (hasSubcategories) {
              onToggleExpand(category.path);
            }
          }}
          className="flex-1 flex items-center gap-2 py-2 pe-3 ps-1 text-start min-w-0 cursor-pointer"
        >
          <span
            className={`flex-1 truncate ${
              isArabic(category.name) ? "font-arabic text-right" : ""
            }`}
            dir={isArabic(category.name) ? "rtl" : undefined}
          >
            {category.name}
          </span>
          {category.isCourse && (
            <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
          )}
          
        </button>
      </div>

      {/* Subcategories (Recursion) */}
      {hasSubcategories && isExpanded && (
        <div className="flex flex-col gap-0.5">
          {category.subcategories.map((subCategory) => (
            <CategoryTree
              key={subCategory.path}
              category={subCategory}
              activeCategory={activeCategory}
              expandedFolders={expandedFolders}
              onToggleExpand={onToggleExpand}
              onSelectCategory={onSelectCategory}
              forceExpanded={forceExpanded}
              level={level + 1}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { t, locale } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isOpen = useStore((s) => s.sidebarOpen);
  const setCategory = useStore((s) => s.setCategory);
  const activeCategory = useStore((s) => s.filters.category);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [folderSearch, setFolderSearch] = useState("");

  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem("sidebar-width");
    return saved ? parseInt(saved, 10) : 240;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Clock state for Aside
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  const formattedTime = now.toLocaleTimeString(locale === "ar" ? "ar" : undefined, {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });

  const yearProgress = (() => {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    return ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100;
  })();


  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: api.videos.categories,
    staleTime: 5 * 60_000,
  });

  const filteredCategories = useMemo(
    () => filterCategories(categories, folderSearch),
    [categories, folderSearch],
  );

  const isFilteringFolders = folderSearch.trim().length > 0;

  useEffect(() => {
    if (categories.length === 0) return;

    setExpandedFolders((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const category of categories) {
        if (category.subcategories.length > 0 && !next.has(category.path)) {
          next.add(category.path);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [categories]);

  // Automatically expand parent folders of the active category
  useEffect(() => {
    if (activeCategory) {
      const parts = activeCategory.split("/");
      const pathsToExpand: string[] = [];
      for (let i = 0; i < parts.length - 1; i++) {
        const path = parts.slice(0, i + 1).join("/");
        pathsToExpand.push(path);
      }

      setExpandedFolders((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const p of pathsToExpand) {
          if (!next.has(p)) {
            next.add(p);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [activeCategory]);

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(e.clientX, 480));
      setWidth(newWidth);
      localStorage.setItem("sidebar-width", String(newWidth));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleCategory = (name: string) => {
    setCategory(name); // Simply set the selected folder path (no toggling off)
    if (location.pathname !== "/") {
      navigate("/");
    }
  };

  const handleToggleExpand = (name: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const collapseAllFolders = () => {
    setExpandedFolders(new Set());
  };

  if (!isOpen) {
    return (
      <aside className="w-14 shrink-0 flex flex-col h-full py-4 px-2 border-e border-surface-200 bg-surface/80">
        {/* Clock for collapsed Aside */}
        <div className="sticky top-0 flex items-center justify-center px-2 py-1 my-1 rounded-lg shadow-sm text-xs font-medium text-white bg-surface/80 whitespace-nowrap">
          {formattedTime}
        </div>
        {/* Month name */}
        <div className="text-xs text-center text-gray-300 mt-1">
          {now.toLocaleDateString(locale === "ar" ? "ar-EG" : undefined, { month: "long" })}
        </div>
        {/* Day squares up to today */}
        <div className="grid grid-cols-7 gap-1 mt-1 px-2">
          {Array.from({ length: now.getDate() }, (_, i) => i + 1).map((day) => (
            <div
              key={day}
              className={`w-6 h-6 flex items-center justify-center rounded text-xs ${day === now.getDate() ? "bg-brand text-white" : "bg-surface-200/30 text-gray-400"}`}
              title={`${day}`}
            >
              {day}
            </div>
          ))}
        </div>
        <div className="border-t border-surface-200 my-1" />
        {NAV_LINKS.map(({ to, icon: Icon, labelKey }) => (
          <Link
            key={to}
            to={to}
            onClick={() => {
              if (to === "/") {
                setCategory("");
              }
            }}
            className={`p-3 rounded-lg transition-colors flex items-center justify-center
              ${
                location.pathname === to
                  ? "bg-brand text-white"
                  : "text-gray-400 hover:bg-surface-200 hover:text-white"
              }`}
            title={t(labelKey)}
          >
            <Icon size={20} />
          </Link>
        ))}

        <div className="mx-2 my-1 border-t border-surface-200" />

        {TOOLS_LINKS.map(({ to, icon: Icon, labelKey }) => (
          <Link
            key={to}
            to={to}
            className={`p-3 rounded-lg transition-colors flex items-center justify-center
              ${
                location.pathname === to
                  ? "bg-brand text-white"
                  : "text-gray-400 hover:bg-surface-200 hover:text-white"
              }`}
            title={t(labelKey)}
          >
            <Icon size={20} />
          </Link>
        ))}
        <div className="mt-auto border-t border-surface-200 pt-2 flex flex-col gap-1">
          {categories.slice(0, 8).map((cat) => (
            <button
              key={cat.path}
              onClick={() => handleCategory(cat.path)}
              className={`p-3 rounded-lg transition-colors flex items-center justify-center
                ${
                  activeCategory === cat.path
                    ? "bg-surface-200 text-brand"
                    : "text-gray-400 hover:bg-surface-200 hover:text-white"
                }`}
              title={cat.name}
            >
              <FolderOpen size={18} />
            </button>
          ))}
        </div>

      </aside>
    );
  }

  return (
    <aside
      className={`shrink-0 flex flex-col h-full py-4 border-e border-surface-200 bg-surface/80 relative overflow-y-auto ${isResizing ? "select-none" : ""}`}
      style={{ width: `${width}px` }}
    >
{/* Mini calendar */}
<div className="grid grid-cols-7 gap-1 px-4 py-1">
  {Array.from({ length: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map((day) => (
    <div
      key={day}
      className={`w-5 h-5 flex items-center justify-center rounded text-xs ${day <= now.getDate() ? "bg-red-600 text-white" : "bg-surface-200/30 text-gray-400"}`}
      title={`${day}`}
    >
      {day}
    </div>
  ))}
</div>
<div className="border-t border-surface-200 my-1" />
{/* Clock box */}
<div className="px-4 py-2">
  <div className="text-2xl font-bold text-white">{formattedTime}</div>
  <div className="flex items-center justify-between gap-2 mt-0.5">
    <div className="text-xs text-gray-400">
      {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
    </div>
    <div 
      className="flex items-center gap-1.5"
      title={`${yearProgress.toFixed(1)}% of the year passed`}
    >
      <div className="w-12 h-1.5 bg-surface-200/50 rounded-full overflow-hidden flex">
        <div className="h-full bg-brand rounded-full transition-all duration-1000" style={{ width: `${yearProgress}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-gray-500">{yearProgress.toFixed(0)}%</span>
    </div>
  </div>
</div>

<PrayerTimes />

<div className="border-t border-surface-200 my-1" />
      {/* Main nav */}
      <nav className="flex flex-col gap-0.5 px-3">
        {NAV_LINKS.map(({ to, icon: Icon, labelKey }) => (
          <Link
            key={to}
            to={to}
            onClick={() => {
              if (to === "/") {
                setCategory("");
              }
            }}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${
                location.pathname === to
                  ? "bg-surface-200 text-white"
                  : "text-gray-400 hover:bg-surface-100 hover:text-white"
              }`}
          >
            <Icon size={18} />
            {t(labelKey)}
          </Link>
        ))}

        <div className="flex items-center gap-2 px-3 mt-4 mb-2">
          <Wrench size={14} className="text-gray-500 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 truncate">
            Tools Menu
          </span>
        </div>

        {TOOLS_LINKS.map(({ to, icon: Icon, labelKey }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${
                location.pathname === to
                  ? "bg-surface-200 text-white"
                  : "text-gray-400 hover:bg-surface-100 hover:text-white"
              }`}
          >
            <Icon size={18} />
            {t(labelKey)}
          </Link>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-3 my-3 border-t border-surface-200" />

      {/* Categories */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="flex items-center justify-between gap-2 px-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Tv2 size={14} className="text-gray-500 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 truncate">
              {t("sidebar.library")}
            </span>
          </div>
          <button
            onClick={collapseAllFolders}
            className="text-[11px] font-medium text-gray-500 hover:text-white transition-colors shrink-0"
            title={t("sidebar.collapseAllTitle")}
          >
            {t("sidebar.collapseAll")}
          </button>
        </div>

        <div className="relative mb-2">
          <Search
            size={13}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"
          />
          <input
            value={folderSearch}
            onChange={(e) => setFolderSearch(e.target.value)}
            placeholder={t("sidebar.searchFolders")}
            className="w-full h-8 rounded-lg bg-surface-100 border border-surface-200 ps-8 pe-8 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/40"
          />
          {folderSearch && (
            <button
              onClick={() => setFolderSearch("")}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
              title={t("sidebar.clearFolderSearch")}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          {filteredCategories.map((cat) => (
            <CategoryTree
              key={cat.path}
              category={cat}
              activeCategory={activeCategory}
              expandedFolders={expandedFolders}
              onToggleExpand={handleToggleExpand}
              onSelectCategory={handleCategory}
              forceExpanded={isFilteringFolders}
              level={0}
              t={t}
            />
          ))}
          {isFilteringFolders && filteredCategories.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">
              {t("sidebar.noMatchingFolders")}
            </div>
          )}
        </div>
      </div>

      {/* Resizer Handle */}
      <div
        onMouseDown={startResizing}
        onDoubleClick={() => {
          setWidth(240);
          localStorage.setItem("sidebar-width", "240");
        }}
        className={`absolute top-0 end-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand/60 group active:bg-brand transition-all z-50
          ${isResizing ? "bg-brand/80 w-2" : "bg-transparent"}
        `}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-gray-600 rounded opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </aside>
  );
}
