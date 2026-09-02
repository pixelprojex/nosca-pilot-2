import React from "react";
import { NavLink } from "react-router-dom";
import { Home, Users, ListChecks, CalendarCheck, Library } from "lucide-react";

const COACH_TABS = [
  { to: "/", icon: Home, label: "Today", end: true },
  { to: "/roster", icon: Users, label: "Roster" },
  { to: "/log", icon: Library, label: "Log" },
  { to: "/attendance", icon: CalendarCheck, label: "Attend" },
  { to: "/drills", icon: ListChecks, label: "Drills" },
];

const PLAYER_TABS = [
  { to: "/", icon: Home, label: "Home", end: true },
  { to: "/lessons", icon: Library, label: "Lessons" },
  { to: "/drills", icon: ListChecks, label: "Drills" },
  { to: "/attendance", icon: CalendarCheck, label: "Attend" },
];

export default function Shell({ role, onSignOut }) {
  const tabs = role === "coach" ? COACH_TABS : PLAYER_TABS;
  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-md">
      <div className="flex items-center justify-between bg-white/85 backdrop-blur-xl rounded-full border border-hair shadow-[0_10px_30px_rgba(26,24,21,0.12)] px-2 py-2">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1.5 rounded-full transition ${
                isActive ? "text-ink" : "text-faint"
              }`
            }
          >
            <t.icon size={18} strokeWidth={1.8} />
            <span className="text-[9.5px] font-medium">{t.label}</span>
          </NavLink>
        ))}
        <button onClick={onSignOut} className="px-2 text-[9.5px] text-faint">
          Sign out
        </button>
      </div>
    </nav>
  );
}
