import { useState } from "react";
import Wardrobe from "./Wardrobe.jsx";
import { Sheet, Row, Header } from "./ui.jsx";

/* Five tabs, each a part of life. Wardrobe is built; the others say so
 * plainly until they are, rather than pretending. */
const TABS = [
  { id: "today", label: "Today", icon: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /> },
  { id: "room", label: "Room", icon: <path d="M3 20V9l9-6 9 6v11M9 20v-6h6v6" /> },
  { id: "wardrobe", label: "Wardrobe", icon: <path d="M12 4a2 2 0 1 0-2-2M12 4v3M12 7 3 14.5a1.5 1.5 0 0 0 .9 2.7h16.2a1.5 1.5 0 0 0 .9-2.7Z" /> },
  { id: "pack", label: "Pack", icon: <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M8 11v6M16 11v6" /> },
  { id: "school", label: "School", icon: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /> },
];

const COMING = {
  today: ["The day assembled from the other tabs: what is due, the humidity target, tonight's school check, today's outfit."],
  room: ["Humidity targets by month, the lighting and heating schedules, the fortnightly clean, Saturday's wash, and the map of where everything lives."],
  pack: ["The race-day bag and a list per trip, each with its ring."],
  school: ["The timetable, tomorrow's kit, the evening check."],
};

export default function App() {
  const [tab, setTab] = useState("wardrobe");
  const [settings, setSettings] = useState(false);
  const built = typeof __BUILD_TIME__ === "string" ? __BUILD_TIME__ : "";
  return (
    <div className="mx-auto flex min-h-full max-w-[640px] flex-col">
      <main className="flex-1" style={{ paddingBottom: "calc(var(--bar-h) + env(safe-area-inset-bottom,0px) + 16px)" }}>
        {tab === "wardrobe" ? <Wardrobe onSettings={() => setSettings(true)} /> : <Coming id={tab} label={TABS.find(t => t.id === tab).label} onSettings={() => setSettings(true)} />}
      </main>

      <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface" style={{ paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
        <div className="mx-auto grid max-w-[640px] grid-cols-5" style={{ height: "var(--bar-h)" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined} className={`grid place-items-center gap-0.5 text-[10px] font-semibold tracking-wide ${tab === t.id ? "text-accent" : "text-muted"}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{t.icon}</svg>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <Sheet open={settings} onClose={() => setSettings(false)} title="Settings">
        <Row label="Version" value={built ? new Date(built).toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" }) : "dev"} />
        <Row label="Data" value="On this phone" sub="Outfits and wears are kept in this browser until the database is connected." />
        <Row label="Drawings" value="115 items" sub="From the description of 7 Nov 2026." />
      </Sheet>
    </div>
  );
}

function Coming({ id, label, onSettings }) {
  return (
    <div className="rise">
      <Header title={label} onSettings={onSettings} />
      <div className="px-4 pt-6">
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Not built yet</div>
          <p className="mt-1 text-[15px] leading-snug text-ink">{COMING[id][0]}</p>
        </div>
      </div>
    </div>
  );
}
