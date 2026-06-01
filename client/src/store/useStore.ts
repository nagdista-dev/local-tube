import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FilterState, SortOption } from "../types";
import type { Locale } from "../i18n";

interface AppStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (v: boolean) => void;

  // Filters
  filters: FilterState;
  setSearch: (q: string) => void;
  setCategory: (c: string) => void;
  setSort: (s: SortOption) => void;
  resetFilters: () => void;

  // Scan notification
  showScanBanner: boolean;
  setShowScanBanner: (v: boolean) => void;

  // Theme
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  toggleTheme: () => void;

  // Layout view (grid or list)
  viewLayout: "grid" | "list";
  setViewLayout: (v: "grid" | "list") => void;
}

const DEFAULT_FILTERS: FilterState = {
  sort: "date",
  category: "",
  search: "",
};

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      locale: "en",
      setLocale: (locale) => set({ locale }),

      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (v) => set({ sidebarOpen: v }),

      filters: DEFAULT_FILTERS,
      setSearch: (search) =>
        set((s) => ({ filters: { ...s.filters, search } })),
      setCategory: (category) =>
        set((s) => ({ filters: { ...s.filters, category } })),
      setSort: (sort) => set((s) => ({ filters: { ...s.filters, sort } })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),

      showScanBanner: false,
      setShowScanBanner: (v) => set({ showScanBanner: v }),

      theme: "dark",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

      viewLayout: "grid",
      setViewLayout: (viewLayout) => set({ viewLayout }),
    }),
    {
      name: "localtube-store",
      partialize: (s) => ({
        locale: s.locale,
        sidebarOpen: s.sidebarOpen,
        filters: s.filters,
        theme: s.theme,
        viewLayout: s.viewLayout,
      }),
    },
  ),
);
