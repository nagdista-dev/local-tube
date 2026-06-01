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
} from "lucide-react";
import { api } from "../utils/api";
import { useStore } from "../store/useStore";
import { Category } from "../types";
import { isArabic } from "../utils/format";

const NAV_LINKS = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/continue-watching", icon: Play, label: "Continue Watching" },
  { to: "/history", icon: History, label: "Watch History" },
  { to: "/favorites", icon: Heart, label: "Favorites" },
];

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
}: {
  category: Category;
  activeCategory: string;
  expandedFolders: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelectCategory: (path: string) => void;
  forceExpanded?: boolean;
  level?: number;
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
              title={isExpanded ? "Close folder" : "Open folder"}
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
            title={hasSubcategories ? (isExpanded ? "Close folder" : "Open folder") : category.name}
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
          className="flex-1 flex items-center gap-2 py-2 pr-3 pl-1 text-left min-w-0 cursor-pointer"
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
          <span className="text-xs text-gray-600 font-normal shrink-0 ml-1">
            {category.count}
          </span>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
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
      <aside className="w-14 shrink-0 flex flex-col gap-1 py-4 px-2 border-r border-surface-200 bg-surface/80">
        {NAV_LINKS.map(({ to, icon: Icon, label }) => (
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
            title={label}
          >
            <Icon size={20} />
          </Link>
        ))}
        <div className="mt-2 border-t border-surface-200 pt-2 flex flex-col gap-1">
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
      className={`shrink-0 flex flex-col py-4 border-r border-surface-200 bg-surface/80 overflow-y-auto relative ${
        isResizing ? "select-none" : ""
      }`}
      style={{ width: `${width}px` }}
    >
      {/* Main nav */}
      <nav className="px-3 flex flex-col gap-0.5">
        {NAV_LINKS.map(({ to, icon: Icon, label }) => (
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
            {label}
          </Link>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-3 my-3 border-t border-surface-200" />

      {/* Categories */}
      <div className="px-3">
        <div className="flex items-center justify-between gap-2 px-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Tv2 size={14} className="text-gray-500 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 truncate">
              Library
            </span>
          </div>
          <button
            onClick={collapseAllFolders}
            className="text-[11px] font-medium text-gray-500 hover:text-white transition-colors shrink-0"
            title="Collapse all folders"
          >
            Collapse all
          </button>
        </div>

        <div className="relative mb-2">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"
          />
          <input
            value={folderSearch}
            onChange={(e) => setFolderSearch(e.target.value)}
            placeholder="Search folders"
            className="w-full h-8 rounded-lg bg-surface-100 border border-surface-200 pl-8 pr-8 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/40"
          />
          {folderSearch && (
            <button
              onClick={() => setFolderSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
              title="Clear folder search"
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
            />
          ))}
          {isFilteringFolders && filteredCategories.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">
              No matching folders.
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
        className={`absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand/60 group active:bg-brand transition-all z-50
          ${isResizing ? "bg-brand/80 w-2" : "bg-transparent"}
        `}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-gray-600 rounded opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </aside>
  );
}
