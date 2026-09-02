import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { Screen, Row } from "../components/UI";
import { useNavigate } from "react-router-dom";
import { Lightbulb } from "lucide-react";

export default function PlayerHome() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [tip, setTip] = useState(null);
  const [counts, setCounts] = useState({ drills: 0, lessons: 0 });

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from("tips").select("*").eq("player_id", profile.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      setTip(t || null);
      const { count: drills } = await supabase.from("drills").select("id", { count: "exact", head: true }).eq("player_id", profile.id).eq("done", false);
      const { count: lessons } = await supabase.from("lessons").select("id", { count: "exact", head: true }).eq("player_id", profile.id);
      setCounts({ drills: drills || 0, lessons: lessons || 0 });
    })();
  }, []);

  return (
    <Screen title="">
      {tip && (
        <button onClick={() => nav("/drills")} className="w-full text-left bg-ink text-white rounded-surface px-6 py-7 mb-8">
          <span className="flex items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-white/60 mb-4">
            <Lightbulb size={12} /> Working on
          </span>
          <span className="block font-display text-[26px] font-light leading-tight">{tip.title}</span>
          {tip.body && <span className="block mt-3 text-[14px] text-white/70 leading-relaxed">{tip.body}</span>}
        </button>
      )}
      <div className="border-t border-hair">
        <Row label="To practise" value={counts.drills ? `${counts.drills} left` : "All done"} onClick={() => nav("/drills")} />
        <Row label="Lessons" value={`${counts.lessons} logged`} onClick={() => nav("/lessons")} />
        <Row label="Attendance" value="See your record" onClick={() => nav("/attendance")} />
      </div>
    </Screen>
  );
}
