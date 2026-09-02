import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { Screen, Card, Button, Empty } from "../components/UI";
import { Check, X, Plus } from "lucide-react";

function CoachAttendance({ profile }) {
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [active, setActive] = useState(null); // session being marked
  const [marks, setMarks] = useState({});

  const load = async () => {
    const { data: p } = await supabase.from("profiles").select("id, name").eq("coach_id", profile.id).order("name");
    setPlayers(p || []);
    const { data: s } = await supabase.from("attendance_sessions").select("*").eq("coach_id", profile.id).order("created_at", { ascending: false });
    setSessions(s || []);
  };
  useEffect(() => { load(); }, []);

  const startSession = async () => {
    if (!label.trim()) return;
    const { data } = await supabase.from("attendance_sessions").insert({ coach_id: profile.id, label: label.trim() }).select().single();
    setLabel(""); setOpen(false);
    await load();
    setActive(data);
    setMarks({});
  };

  const mark = async (playerId, state) => {
    setMarks((m) => ({ ...m, [playerId]: state }));
    await supabase.from("attendance_marks").upsert({ session_id: active.id, player_id: playerId, state }, { onConflict: "session_id,player_id" });
  };

  if (active) {
    return (
      <Screen title={active.label} meta="Marking attendance">
        <button onClick={() => setActive(null)} className="text-[13px] text-faint mb-6">← All sessions</button>
        <Card className="px-5">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-3.5 border-b border-hair last:border-none">
              <span className="flex-1 text-[15px] text-ink">{p.name}</span>
              {[["in", Check, "text-steady"], ["out", X, "text-danger"]].map(([state, Icon, cls]) => (
                <button key={state} onClick={() => mark(p.id, state)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center ${marks[p.id] === state ? (state === "in" ? "bg-steady" : "bg-danger") : "bg-wash"}`}>
                  <Icon size={15} className={marks[p.id] === state ? "text-white" : cls} />
                </button>
              ))}
            </div>
          ))}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Attendance">
      {open ? (
        <Card className="p-5 mb-5">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Summer clinic"
                 className="w-full rounded-control bg-wash px-4 py-3 text-[15px] outline-none mb-3" autoFocus />
          <Button onClick={startSession}>Start register</Button>
        </Card>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-2 py-3.5 mb-6 rounded-control border border-hair text-[15px] text-ink">
          <Plus size={16} /> Take attendance
        </button>
      )}
      {sessions.length === 0 ? <Empty>No registers taken yet.</Empty> : (
        <Card className="px-5">
          {sessions.map((s) => (
            <button key={s.id} onClick={() => { setActive(s); setMarks({}); }} className="w-full flex items-center gap-3 py-4 text-left border-b border-hair last:border-none">
              <span className="shrink-0 w-14 text-[9px] uppercase tracking-[0.1em] text-faint">
                {new Date(s.session_date).toLocaleDateString("en-IE", { day: "2-digit", month: "short" })}
              </span>
              <span className="text-[15px] text-ink">{s.label}</span>
            </button>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function PlayerAttendance({ profile }) {
  const [pct, setPct] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("attendance_marks").select("state, attendance_sessions(label, session_date)")
        .eq("player_id", profile.id).order("id", { ascending: false });
      const list = data || [];
      setRows(list);
      if (list.length) setPct(Math.round((list.filter((r) => r.state === "in").length / list.length) * 100));
      else setPct(null);
    })();
  }, []);

  return (
    <Screen title="Attendance">
      <div className="flex flex-col items-center py-4 mb-4">
        <span className="font-display text-[44px] font-light text-ink">{pct == null ? "—" : `${pct}%`}</span>
        <span className="mt-1 text-[13px] text-faint">{rows.length} session{rows.length === 1 ? "" : "s"} recorded</span>
      </div>
      {rows.length === 0 ? <Empty>Nothing recorded yet.</Empty> : (
        <Card className="px-5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-3 py-3.5 border-b border-hair last:border-none">
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] text-ink truncate">{r.attendance_sessions?.label}</span>
                <span className="block text-[11px] text-faint">{new Date(r.attendance_sessions?.session_date).toLocaleDateString("en-IE", { day: "2-digit", month: "short" })}</span>
              </span>
              {r.state === "in" ? <Check size={15} className="text-steady" /> : <X size={14} className="text-danger" />}
            </div>
          ))}
        </Card>
      )}
    </Screen>
  );
}

export default function Attendance() {
  const { profile } = useAuth();
  return profile.role === "coach" ? <CoachAttendance profile={profile} /> : <PlayerAttendance profile={profile} />;
}
