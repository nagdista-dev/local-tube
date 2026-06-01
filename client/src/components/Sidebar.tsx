import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  Heart,
  History,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Tv2,
  CheckCircle2,
} from "lucide-react";
import { api } from "../utils/api";
import { useStore } from "../store/useStore";
import { Category } from "../types";
import { isArabic } from "../utils/format";

const NAV_LINKS = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/history", icon: History, label: "Watch History" },
  { to: "/favorites", icon: Heart, label: "Favorites" },
];

function CategoryTree({
  category,
  activeCategory,
  expandedFolders,
  onToggleExpand,
  onSelectCategory,
  level = 0,
}: {
  category: Category;
  activeCategory: string;
  expandedFolders: Set<string>;
  onToggleExpand: (name: string) => void;
  onSelectCategory: (name: string) => void;
  level?: number;
}) {
  const isExpanded = expandedFolders.has(category.path);
  const hasSubcategories = category.subcategories?.length > 0;
  const isActive = activeCategory === category.path;

  return (
    <div>
      <button
        onClick={() => {
          if (hasSubcategories) {
            onToggleExpand(category.path);
          }
          onSelectCategory(category.path);
        }}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
          ${
            isActive
              ? "bg-surface-200 text-white font-medium"
              : "text-gray-400 hover:bg-surface-100 hover:text-white"
          }`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        {hasSubcategories &&
          (isExpanded ? (
            <ChevronDown size={16} className="shrink-0" />
          ) : (
            <ChevronRight size={16} className="shrink-0" />
          ))}
        {!hasSubcategories && <div className="w-4" />}

        <FolderOpen size={14} className="shrink-0" />
        <span
          className={`flex-1 text-left truncate ${
            isArabic(category.name) ? "font-arabic text-right" : ""
          }`}
          dir={isArabic(category.name) ? "rtl" : undefined}
        >
          {category.name}
        </span>
        {category.isCourse && <CheckCircle2 size={13} className="text-emerald-300" />}
        <span className="text-xs text-gray-600">{category.count}</span>
      </button>

      {/* Subcategories */}
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

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: api.videos.categories,
    staleTime: 5 * 60_000,
  });

  const handleCategory = (name: string) => {
    setCategory(activeCategory === name ? "" : name);
    if (location.pathname !== "/") {
      navigate("/");
    }
  };

  const handleToggleExpand = (name: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedFolders(newExpanded);
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
    <aside className="w-56 shrink-0 flex flex-col py-4 border-r border-surface-200 bg-surface/80 overflow-y-auto">
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
        <div className="flex items-center gap-2 px-3 mb-2">
          <Tv2 size={14} className="text-gray-500" />
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Library
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => handleCategory("")}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
              ${
                !activeCategory
                  ? "bg-surface-200 text-white font-medium"
                  : "text-gray-400 hover:bg-surface-100 hover:text-white"
              }`}
          >
            <FolderOpen size={16} />
            All Videos
          </button>

          {categories.map((cat) => (
            <CategoryTree
              key={cat.path}
              category={cat}
              activeCategory={activeCategory}
              expandedFolders={expandedFolders}
              onToggleExpand={handleToggleExpand}
              onSelectCategory={handleCategory}
              level={0}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
