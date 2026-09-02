import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { Screen, Card, Button, Empty } from "../components/UI";
import { Check } from "lucide-react";

function CoachDrills({ profile }) {
  const [tab, setTab] = useState("drills"); // 'drills' | 'tips'
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState("");
  const [text, setText] = useState("");
  const [body, setBody] = useState("");
  const [items, setItems] = useState([]);

  const load = async () => {
    const { data: p } = await supabase.from("profiles").select("id, name").eq("coach_id", profile.id).order("name");
    setPlayers(p || []);
    if (!playerId && p?.[0]) setPlayerId(p[0].id);
    const { data } = await supabase.from(tab).select("*").eq("coach_id", profile.id).order("created_at", { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, [tab]);

  const add = async () => {
    if (!text.trim() || !playerId) return;
    const payload = tab === "drills"
      ? { coach_id: profile.id, player_id: playerId, title: text.trim() }
      : { coach_id: profile.id, player_id: playerId, title: text.trim(), body: body.trim() || null };
    await supabase.from(tab).insert(payload);
    setText(""); setBody(""); load();
  };

  const nameOf = (id) => players.find((p) => p.id === id)?.name || "—";

  return (
    <Screen title="Drills & tips">
      <div className="flex gap-1 p-1 bg-wash rounded-full mb-6 w-fit">
        {["drills", "tips"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-full text-[13px] font-medium capitalize ${tab === t ? "bg-white shadow-sm text-ink" : "text-faint"}`}>
            {t}
          </button>
        ))}
      </div>

      <Card className="p-5 mb-6">
        <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}
                className="w-full rounded-control bg-wash px-4 py-3 text-[15px] outline-none mb-3">
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input value={text} onChange={(e) => setText(e.target.value)}
               placeholder={tab === "drills" ? "e.g. 20 putts, eyes closed" : "e.g. Trust the shallow"}
               className="w-full rounded-control bg-wash px-4 py-3 text-[15px] outline-none mb-3" />
        {tab === "tips" && (
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="A sentence or two"
                    className="w-full rounded-control bg-wash px-4 py-3 text-[15px] outline-none mb-3 resize-none" />
        )}
        <Button onClick={add}>{tab === "drills" ? "Set drill" : "Set tip"}</Button>
      </Card>

      {items.length === 0 ? <Empty>Nothing set yet.</Empty> : (
        <Card className="px-5">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 py-3.5 border-b border-hair last:border-none">
              {tab === "drills" && (
                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${it.done ? "bg-steady" : "border border-hair"}`}>
                  {it.done && <Check size={11} className="text-white" />}
                </span>
              )}
              <span className="flex-1 min-w-0">
                <span className={`block text-[15px] truncate ${it.done ? "text-faint line-through" : "text-ink"}`}>{it.title}</span>
                <span className="block text-[11px] text-faint">{nameOf(it.player_id)}</span>
              </span>
            </div>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function PlayerDrills({ profile }) {
  const [tab, setTab] = useState("drills");
  const [items, setItems] = useState([]);

  const load = async () => {
    const { data } = await supabase.from(tab).select("*").eq("player_id", profile.id).order("created_at", { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, [tab]);

  const toggle = async (item) => {
    setItems((v) => v.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)));
    await supabase.from("drills").update({ done: !item.done }).eq("id", item.id);
  };

  return (
    <Screen title="Drills & tips">
      <div className="flex gap-1 p-1 bg-wash rounded-full mb-6 w-fit">
        {["drills", "tips"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-full text-[13px] font-medium capitalize ${tab === t ? "bg-white shadow-sm text-ink" : "text-faint"}`}>
            {t}
          </button>
        ))}
      </div>
      {items.length === 0 ? <Empty>Nothing set yet.</Empty> : (
        <Card className="px-5">
          {items.map((it) => (
            <button key={it.id} onClick={() => tab === "drills" && toggle(it)}
                    className="w-full flex items-center gap-3 py-3.5 text-left border-b border-hair last:border-none">
              {tab === "drills" && (
                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${it.done ? "bg-steady" : "border border-hair"}`}>
                  {it.done && <Check size={11} className="text-white" />}
                </span>
              )}
              <span className="flex-1 min-w-0">
                <span className={`block text-[15px] truncate ${it.done ? "text-faint line-through" : "text-ink"}`}>{it.title}</span>
                {it.body && <span className="block mt-0.5 text-[13px] text-sub">{it.body}</span>}
              </span>
            </button>
          ))}
        </Card>
      )}
    </Screen>
  );
}

export default function Drills() {
  const { profile } = useAuth();
  return profile.role === "coach" ? <CoachDrills profile={profile} /> : <PlayerDrills profile={profile} />;
}
