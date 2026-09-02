import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { Screen, Card, Empty } from "../components/UI";
import { ChevronDown, Play, Image as ImageIcon } from "lucide-react";

function LessonRow({ lesson, coachView }) {
  const [open, setOpen] = useState(false);
  const [media, setMedia] = useState(null);

  const toggle = async () => {
    setOpen((v) => !v);
    if (!media) {
      const { data } = await supabase.from("lesson_media").select("*").eq("lesson_id", lesson.id);
      const withUrls = await Promise.all(
        (data || []).map(async (m) => {
          const { data: signed } = await supabase.storage.from("media").createSignedUrl(m.storage_path, 3600);
          return { ...m, url: signed?.signedUrl };
        })
      );
      setMedia(withUrls);
    }
  };

  return (
    <div className="border-b border-hair last:border-none">
      <button onClick={toggle} className="w-full flex items-center gap-3 py-4 text-left">
        <span className="shrink-0 w-14 text-[9px] uppercase tracking-[0.1em] text-faint">
          {new Date(lesson.lesson_date).toLocaleDateString("en-IE", { day: "2-digit", month: "short" })}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[16px] text-ink truncate">{lesson.focus}</span>
          <span className="block mt-0.5 text-[12px] text-faint">
            {lesson.kind === "group" ? lesson.group_name : coachView ? lesson.player_name : "Private"}
          </span>
        </span>
        <ChevronDown size={14} className={`text-faint transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="pb-4 pl-[68px] pr-2">
          {lesson.notes && <p className="text-[14px] text-ink mb-3 leading-relaxed">{lesson.notes}</p>}
          {media === null ? (
            <p className="text-[12px] text-faint">Loading…</p>
          ) : media.length === 0 ? (
            <p className="text-[12px] text-faint">No video or photo on this one.</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {media.map((m) => (
                <a key={m.id} href={m.url} target="_blank" rel="noreferrer"
                   className="w-16 h-16 rounded-control bg-wash flex items-center justify-center">
                  {m.kind === "video" ? <Play size={16} className="text-sub" /> : <ImageIcon size={16} className="text-sub" />}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Lessons() {
  const { profile } = useAuth();
  const [lessons, setLessons] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("lessons").select("*").order("lesson_date", { ascending: false });
      if (profile.role === "coach" && data?.length) {
        const ids = [...new Set(data.map((l) => l.player_id).filter(Boolean))];
        const { data: names } = await supabase.from("profiles").select("id, name").in("id", ids.length ? ids : ["-"]);
        const map = Object.fromEntries((names || []).map((n) => [n.id, n.name]));
        setLessons(data.map((l) => ({ ...l, player_name: l.player_id ? map[l.player_id] : null })));
      } else {
        setLessons(data || []);
      }
    })();
  }, []);

  return (
    <Screen title="Lessons" meta={lessons ? `${lessons.length}` : ""}>
      {lessons === null ? (
        <Empty>Loading…</Empty>
      ) : lessons.length === 0 ? (
        <Empty>Nothing logged yet.</Empty>
      ) : (
        <Card className="px-5">
          {lessons.map((l) => <LessonRow key={l.id} lesson={l} coachView={profile.role === "coach"} />)}
        </Card>
      )}
    </Screen>
  );
}
