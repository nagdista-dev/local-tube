import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { useTranslation } from "../i18n";

/** Shared page gutter — keep Home, folders, and Watch aligned. */
export const PAGE_GUTTER =
  "w-full max-w-screen-2xl mx-auto px-2 sm:px-3 py-3";

export default function Layout() {
  const { dir } = useTranslation();

  return (
    <div
      dir={dir}
      className={`h-screen flex flex-col overflow-hidden bg-surface text-white transition-colors duration-200`}
    >
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main
          className={`flex-1 overflow-y-auto min-w-0 transition-all duration-200`}
        >
          <div className={PAGE_GUTTER}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
