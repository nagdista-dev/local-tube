import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";


export default function Layout() {

  return (
    <div
      className={`h-screen flex flex-col overflow-hidden bg-surface text-white transition-colors duration-200`}
    >
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main
          className={`flex-1 overflow-y-auto min-w-0 transition-all duration-200`}
        >
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
