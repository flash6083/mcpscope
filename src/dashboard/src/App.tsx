import { useEffect, useState } from "react";
import { Sessions } from "./pages/Sessions.js";
import { Timeline } from "./pages/Timeline.js";
import { Tools } from "./pages/Tools.js";

export function App() {
  const [page, setPage] = useState(() => window.location.hash.slice(1) || "timeline");

  useEffect(() => {
    const onHashChange = () => setPage(window.location.hash.slice(1) || "timeline");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const activePage = page === "sessions" || page === "tools" ? page : "timeline";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-4 py-3">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold">mcpscope</h1>
          <nav className="flex gap-4 text-sm">
            <a className={activePage === "timeline" ? "font-semibold" : ""} href="#timeline">
              Timeline
            </a>
            <a className={activePage === "sessions" ? "font-semibold" : ""} href="#sessions">
              Sessions
            </a>
            <a className={activePage === "tools" ? "font-semibold" : ""} href="#tools">
              Tools
            </a>
          </nav>
        </div>
      </header>
      <main>
        {activePage === "sessions" ? (
          <Sessions />
        ) : activePage === "tools" ? (
          <Tools />
        ) : (
          <Timeline />
        )}
      </main>
    </div>
  );
}
