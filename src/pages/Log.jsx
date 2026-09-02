import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { Screen, Field, Button, Toast } from "../components/UI";

export default function Log() {
  const { profile } = useAuth();
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [focus, setFocus] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    supabase.from("profiles").select("id, name").eq("coach_id", profile.id).order("name")
      .then(({ data }) => { setPlayers(data || []); if (data?.[0]) setPlayerId(data[0].id); });
  }, []);

  const submit = async () => {
    if (!focus.trim()) return;
    setBusy(true);
    const { data: lesson, error } = await supabase.from("lessons").insert({
      coach_id: profile.id,
      player_id: isGroup ? null : playerId || null,
      group_name: isGroup ? groupName : null,
      kind: isGroup ? "group" : "private",
      focus: focus.trim(),
      notes: notes.trim() || null,
    }).select().single();

    if (error) { setToast(error.message); setBusy(false); return; }

    for (const file of files) {
      const path = `${profile.id}/${lesson.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, file);
      if (!upErr) {
        await supabase.from("lesson_media").insert({
          lesson_id: lesson.id,
          kind: file.type.startsWith("video") ? "video" : "photo",
          storage_path: path,
        });
      }
    }

    setToast("Lesson logged"); setFocus(""); setNotes(""); setFiles([]);
    setTimeout(() => setToast(""), 1600);
    setBusy(false);
  };

  return (
    <Screen title="Log a lesson">
      <div className="flex gap-1 p-1 bg-wash rounded-full mb-6 w-fit">
        {[["private", false], ["group", true]].map(([label, val]) => (
          <button key={label} onClick={() => setIsGroup(val)}
                  className={`px-4 py-1.5 rounded-full text-[13px] font-medium capitalize ${isGroup === val ? "bg-white shadow-sm text-ink" : "text-faint"}`}>
            {label}
          </button>
        ))}
      </div>

      {isGroup ? (
        <Field label="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Summer clinic" />
      ) : (
        <label className="block mb-4">
          <span className="block mb-1.5 text-[9px] uppercase tracking-[0.14em] text-faint">Player</span>
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)}
                  className="w-full rounded-control bg-wash px-4 py-3 text-[15px] text-ink outline-none">
            {players.length === 0 && <option>Add a player first</option>}
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}

      <Field label="Focus" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Short game" />

      <label className="block mb-4">
        <span className="block mb-1.5 text-[9px] uppercase tracking-[0.14em] text-faint">Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                  className="w-full rounded-control bg-wash px-4 py-3 text-[15px] text-ink outline-none resize-none" />
      </label>

      <label className="block mb-6">
        <span className="block mb-1.5 text-[9px] uppercase tracking-[0.14em] text-faint">Video or photo</span>
        <input type="file" accept="video/*,image/*" multiple
               onChange={(e) => setFiles(Array.from(e.target.files || []))}
               className="w-full text-[13px] text-faint" />
        {files.length > 0 && <span className="block mt-1.5 text-[12px] text-steady">{files.length} file(s) ready</span>}
      </label>

      <Button disabled={busy || !focus.trim()} onClick={submit}>{busy ? "Saving…" : "Log lesson"}</Button>
      <Toast message={toast} />
    </Screen>
  );
}
