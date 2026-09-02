import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { Screen, Row } from "../components/UI";
import { useNavigate } from "react-router-dom";

export default function CoachHome() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState({ players: 0, lessons: 0 });

  useEffect(() => {
    (async () => {
      const { count: players } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("coach_id", profile.id);
      const { count: lessons } = await supabase.from("lessons").select("id", { count: "exact", head: true }).eq("coach_id", profile.id);
      setStats({ players: players || 0, lessons: lessons || 0 });
    })();
  }, []);

  return (
    <Screen title={`Hi, ${profile.name.split(" ")[0]}`}>
      <div className="bg-ink text-white rounded-surface px-6 py-6 mb-7">
        <span className="block text-[9px] uppercase tracking-[0.14em] text-white/60 mb-2">This pilot</span>
        <span className="block text-[15px]">
          {stats.players} of 20 players · {stats.lessons} lesson{stats.lessons === 1 ? "" : "s"} logged
        </span>
      </div>
      <div className="border-t border-hair">
        <Row label="Do" value="Log a lesson" onClick={() => nav("/log")} />
        <Row label="Do" value="Take attendance" onClick={() => nav("/attendance")} />
        <Row label="Do" value="Set a drill or tip" onClick={() => nav("/drills")} />
        <Row label="See" value="Your roster" onClick={() => nav("/roster")} />
      </div>
    </Screen>
  );
}
