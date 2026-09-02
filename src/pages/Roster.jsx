import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { Screen, Card, Row, Empty, Toast } from "../components/UI";
import { Copy } from "lucide-react";

export default function Roster() {
  const { profile } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const load = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("coach_id", profile.id).order("created_at");
    setPlayers(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const copyCode = () => {
    navigator.clipboard?.writeText(profile.invite_code);
    setToast("Invite code copied");
    setTimeout(() => setToast(""), 1600);
  };

  const full = players.length >= 20;

  return (
    <Screen title="Roster" meta={`${players.length} of 20`}>
      <Card className="p-5 mb-6 flex items-center justify-between">
        <span>
          <span className="block text-[9px] uppercase tracking-[0.14em] text-faint mb-1">Invite code</span>
          <span className="font-display text-[24px] tracking-[0.08em] text-ink">{profile.invite_code}</span>
        </span>
        <button onClick={copyCode} className="w-10 h-10 rounded-full bg-wash flex items-center justify-center">
          <Copy size={15} />
        </button>
      </Card>

      {full && (
        <p className="text-[13px] text-caution mb-4">
          This pilot's 20-player limit is reached. Remove someone to add another.
        </p>
      )}

      {loading ? (
        <Empty>Loading…</Empty>
      ) : players.length === 0 ? (
        <Empty>Nobody yet — share the code above.</Empty>
      ) : (
        <Card className="px-5">
          {players.map((p) => (
            <Row key={p.id} label={new Date(p.created_at).toLocaleDateString("en-IE", { day: "2-digit", month: "short" })} value={p.name} />
          ))}
        </Card>
      )}

      <Toast message={toast} />
    </Screen>
  );
}
