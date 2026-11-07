/* The Wardrobe tab: every item as a drawing, filters, an item sheet,
 * and the outfit board where a tap on a slot picks and a swipe across
 * it slides to the next thing of that kind. No AI anywhere: the person
 * composes. Everything saved goes through the store.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ITEMS, CATS, byId } from "./lib/catalogue.js";
import { store, useStore, uid, wornStats, wornToday } from "./lib/store.js";
import { Garment, Segmented, Chip, Button, Row, Sheet, Toast, Header } from "./ui.jsx";

/* The board's slots and which categories fill each. */
export const SLOTS = [
  { id: "head", label: "Hat", cats: ["hats"] },
  { id: "layer", label: "Jacket", cats: ["jackets"] },
  { id: "mid", label: "Sweater", cats: ["sweaters"] },
  { id: "top", label: "Top", cats: ["shirts", "polos", "tees"] },
  { id: "bottom", label: "Trousers", cats: ["trousers"] },
  { id: "bag", label: "Bag", cats: ["bags"] },
  { id: "shoes", label: "Shoes", cats: ["shoes"] },
  { id: "extra", label: "Extra", cats: ["accessories", "socks"] },
  { id: "extra2", label: "Extra", cats: ["accessories", "socks"] },
];
const slotFor = item => SLOTS.find(s => s.cats.includes(item.cat));
const itemsFor = slot => ITEMS.filter(i => slot.cats.includes(i.cat));
const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const niceDay = iso => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" }); };

export default function Wardrobe({ onSettings }) {
  const data = useStore();
  const [view, setView] = useState("clothes");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);          // item id in the sheet
  const [board, setBoard] = useState(null);      // { id, name, slots } while the builder is open
  const [toast, setToast] = useState("");
  const toastT = useRef();
  const say = useCallback(msg => { setToast(msg); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 2200); }, []);

  const counts = useMemo(() => { const c = {}; for (const i of ITEMS) c[i.cat] = (c[i.cat] || 0) + 1; return c; }, []);
  const list = useMemo(() => {
    const toks = norm(q).split(/\s+/).filter(Boolean);
    return ITEMS.filter(i => (cat === "all" || i.cat === cat) && toks.every(t => norm([i.name, i.brand, i.sub, ...(i.colours || []), i.notes].join(" ")).includes(t)));
  }, [cat, q]);
  const total = ITEMS.reduce((a, i) => a + (i.qty || 1), 0);

  const openBoardWith = item => {
    const slot = slotFor(item);
    setSel(null);
    setBoard(b => ({ id: b?.id || null, name: b?.name || "", slots: { ...(b?.slots || {}), [slot.id]: item.id } }));
  };

  return (
    <div className="rise">
      <Header title="Wardrobe" meta={`${total} items · ${CATS.length} kinds`} onSettings={onSettings}>
        <Segmented className="mt-4" value={view} onChange={setView} options={[{ value: "clothes", label: "Clothes" }, { value: "outfits", label: `Outfits${data.outfits.length ? ` · ${data.outfits.length}` : ""}` }]} />
      </Header>

      {view === "clothes" && (
        <section className="pt-3">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-1">
            <Chip on={cat === "all"} onClick={() => setCat("all")}>All</Chip>
            {CATS.map(c => <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)} count={counts[c.id]}>{c.label}</Chip>)}
          </div>
          <div className="px-4 pt-2">
            <label className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="text-muted"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input id="wardrobe-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted" />
              {q && <button onClick={() => setQ("")} aria-label="Clear" className="text-muted">✕</button>}
            </label>
          </div>
          {list.length ? (
            <div className="grid grid-cols-3 gap-2.5 px-4 pt-3 sm:grid-cols-4">
              {list.map(i => <ItemTile key={i.id} item={i} worn={wornToday(data.wears, i.id)} onClick={() => setSel(i.id)} />)}
            </div>
          ) : <p className="px-4 pt-6 text-[14px] text-muted">Nothing by that name</p>}
        </section>
      )}

      {view === "outfits" && (
        <section className="px-4 pt-4">
          <Button onClick={() => setBoard({ id: null, name: "", slots: {} })} className="w-full">New outfit</Button>
          {data.outfits.length ? (
            <div className="mt-4 grid gap-2.5">
              {data.outfits.map(o => <OutfitCard key={o.id} outfit={o} onOpen={() => setBoard({ id: o.id, name: o.name, slots: { ...o.slots } })} />)}
            </div>
          ) : <p className="pt-6 text-[14px] text-muted">No outfits yet. Tap New outfit, then tap a slot to choose and swipe across it to slide through the rest.</p>}
        </section>
      )}

      <ItemSheet id={sel} data={data} onClose={() => setSel(null)} onOutfit={openBoardWith} say={say} />
      <Board board={board} setBoard={setBoard} data={data} say={say} />
      <Toast msg={toast} />
    </div>
  );
}

function ItemTile({ item, worn, onClick }) {
  return (
    <button onClick={onClick} className="relative grid min-w-0 gap-1 rounded-xl border border-line bg-surface p-2 text-left" data-item={item.id}>
      <div className="aspect-square w-full"><Garment item={item} size="100%" /></div>
      <div className="min-w-0">
        <div className="line-clamp-2 text-[12.5px] font-semibold leading-tight">{item.name}{item.qty > 1 && <span className="font-normal text-muted"> ×{item.qty}</span>}</div>
        {item.brand && <div className="truncate text-[11.5px] text-muted">{item.brand}</div>}
      </div>
      {worn && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-accent" aria-label="Worn today" />}
    </button>
  );
}

function ItemSheet({ id, data, onClose, onOutfit, say }) {
  const item = id ? byId[id] : null;
  if (!item) return <Sheet open={false} onClose={onClose} title="" />;
  const { n, last } = wornStats(data.wears, item.id);
  const today = wornToday(data.wears, item.id);
  const cat = CATS.find(c => c.id === item.cat);
  return (
    <Sheet open onClose={onClose} title={item.name} eyebrow={[cat?.label, item.brand].filter(Boolean).join(" · ")}>
      <div className="mx-auto w-[220px]"><Garment item={item} size={220} /></div>
      <div className="mt-2">
        <Row label="Type" value={item.sub} />
        {item.size && <Row label="Size" value={item.size} />}
        {item.fit && <Row label="Fit" value={item.fit} />}
        <Row label="Colours" value={(item.colours || []).join(", ")} />
        {item.qty > 1 && <Row label="How many" value={item.qty} />}
        {item.notes && <Row label="Notes" value={item.notes} />}
        <Row label="Worn" value={n ? `${n} ${n === 1 ? "time" : "times"}` : "Not yet"} sub={last ? `Last ${niceDay(last)}` : undefined} />
        {item.ask && <Row label="To confirm" value={<span className="text-[#A8701A]">{item.ask}</span>} />}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button tone="quiet" onClick={() => { if (today) { store.unwearToday(item.id); say("Taken off today"); } else { store.wear([item.id]); say("Wearing today"); } }}>{today ? "Not wearing today" : "Wearing today"}</Button>
        <Button onClick={() => onOutfit(item)}>Put in an outfit</Button>
      </div>
    </Sheet>
  );
}

function OutfitCard({ outfit, onOpen }) {
  const items = SLOTS.map(s => outfit.slots[s.id]).filter(Boolean).map(id => byId[id]).filter(Boolean);
  const worn = outfit.wornOn?.length ? `Worn ${outfit.wornOn.length} ${outfit.wornOn.length === 1 ? "time" : "times"}` : "";
  return (
    <button onClick={onOpen} className="grid gap-2 rounded-xl border border-line bg-surface p-3 text-left" data-outfit={outfit.id}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="truncate text-[15px] font-semibold">{outfit.name || "Untitled outfit"}</div>
        <div className="shrink-0 text-[12.5px] text-muted">{items.length} {items.length === 1 ? "item" : "items"}{worn ? ` · ${worn}` : ""}</div>
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">{items.map(i => <div key={i.id} className="h-16 w-16 shrink-0 rounded-lg bg-wash"><Garment item={i} size={64} /></div>)}</div>
    </button>
  );
}

/* The outfit board. */
function Board({ board, setBoard, data, say }) {
  const [picker, setPicker] = useState(null); // slot id
  const close = useCallback(() => { setBoard(null); setPicker(null); }, [setBoard]);
  useEffect(() => { if (!board) setPicker(null); }, [board]);
  if (!board) return <Sheet open={false} onClose={close} title="" />;
  const filled = SLOTS.filter(s => board.slots[s.id]).map(s => byId[board.slots[s.id]]).filter(Boolean);
  const existing = board.id ? data.outfits.find(o => o.id === board.id) : null;

  const set = (slotId, itemId) => setBoard(b => ({ ...b, slots: { ...b.slots, [slotId]: itemId || undefined } }));
  const slide = (slot, dir) => {
    const list = itemsFor(slot); if (!list.length) return;
    const cur = list.findIndex(i => i.id === board.slots[slot.id]);
    const next = cur < 0 ? (dir > 0 ? 0 : list.length - 1) : (cur + dir + list.length) % list.length;
    set(slot.id, list[next].id);
  };
  const save = () => {
    if (!filled.length) { say("Nothing on the board yet"); return; }
    const id = board.id || uid();
    store.saveOutfit({ id, name: board.name.trim(), slots: Object.fromEntries(Object.entries(board.slots).filter(([, v]) => v)), wornOn: existing?.wornOn || [] });
    setBoard(b => ({ ...b, id }));
    say("Saved");
  };
  const wear = () => {
    if (!filled.length) { say("Nothing on the board yet"); return; }
    const id = board.id || uid();
    const day = new Date().toISOString().slice(0, 10);
    const wornOn = Array.from(new Set([...(existing?.wornOn || []), day]));
    store.saveOutfit({ id, name: board.name.trim(), slots: Object.fromEntries(Object.entries(board.slots).filter(([, v]) => v)), wornOn });
    store.wear(filled.map(i => i.id), id);
    setBoard(b => ({ ...b, id }));
    say("Wearing today");
  };
  const remove = () => { if (board.id) store.removeOutfit(board.id); close(); say("Removed"); };

  return (
    <Sheet open onClose={close} title={existing ? (existing.name || "Outfit") : "New outfit"} eyebrow="Outfit" tall>
      <input id="outfit-name" value={board.name} onChange={e => setBoard(b => ({ ...b, name: e.target.value }))} placeholder="Name it (Saturday, school, match day)" className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[16px] outline-none placeholder:text-muted" />
      <p className="mt-2 text-[12.5px] text-muted">Tap a slot to choose. Swipe across a slot to slide to the next one of its kind. Tap the × to take it off.</p>
      <div className="mt-3 grid grid-cols-3 gap-2" data-board>
        {SLOTS.map(s => <SlotTile key={s.id} slot={s} item={board.slots[s.id] ? byId[board.slots[s.id]] : null} onPick={() => setPicker(s.id)} onSlide={d => slide(s, d)} onClear={() => set(s.id, null)} />)}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button tone="quiet" onClick={wear}>Wear today</Button>
        <Button onClick={save}>{existing ? "Save changes" : "Save outfit"}</Button>
      </div>
      {existing && <button onClick={remove} className="mt-3 h-11 w-full rounded-xl text-[14px] font-semibold text-danger">Remove this outfit</button>}

      <Sheet open={!!picker} onClose={() => setPicker(null)} title={picker ? SLOTS.find(s => s.id === picker).label : ""} eyebrow="Choose">
        {picker && <Picker slot={SLOTS.find(s => s.id === picker)} current={board.slots[picker]} onPick={id => { set(picker, id); setPicker(null); }} />}
      </Sheet>
    </Sheet>
  );
}

function SlotTile({ slot, item, onPick, onSlide, onClear }) {
  const start = useRef(null);
  const moved = useRef(false);
  const onDown = e => { start.current = { x: e.clientX, y: e.clientY }; moved.current = false; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onMove = e => { if (!start.current) return; if (Math.abs(e.clientX - start.current.x) > 8) moved.current = true; };
  const onUp = e => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x, dy = e.clientY - start.current.y; start.current = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { onSlide(dx < 0 ? 1 : -1); return; }
    if (!moved.current) onPick();
  };
  return (
    <div className="relative">
      <div role="button" tabIndex={0} aria-label={item ? `${slot.label}: ${item.name}` : `${slot.label}: empty`} data-slot={slot.id} data-item={item?.id || ""}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { start.current = null; }} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } if (e.key === "ArrowRight") onSlide(1); if (e.key === "ArrowLeft") onSlide(-1); }}
        className={`grid aspect-square w-full select-none place-items-center rounded-xl border ${item ? "border-line bg-surface" : "border-dashed border-line bg-paper"}`} style={{ touchAction: "pan-y" }}>
        {item ? <Garment item={item} size="100%" /> : <span className="text-[12.5px] font-semibold text-muted">{slot.label}</span>}
      </div>
      {item && <button onClick={onClear} aria-label={`Take off ${item.name}`} className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border border-line bg-surface text-[11px] text-muted shadow-sm">✕</button>}
      {item && <div className="pointer-events-none absolute inset-x-1 bottom-1 truncate rounded-md bg-surface/90 px-1 text-center text-[10.5px] font-medium text-muted">{item.name}</div>}
    </div>
  );
}

function Picker({ slot, current, onPick }) {
  const list = itemsFor(slot);
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      <button onClick={() => onPick(null)} className={`grid aspect-square place-items-center rounded-xl border border-dashed text-[13px] font-semibold text-muted ${!current ? "border-ink" : "border-line"}`}>None</button>
      {list.map(i => (
        <button key={i.id} onClick={() => onPick(i.id)} data-pick={i.id} className={`grid min-w-0 gap-1 rounded-xl border p-1.5 text-left ${current === i.id ? "border-ink" : "border-line"} bg-surface`}>
          <div className="aspect-square w-full"><Garment item={i} size="100%" /></div>
          <div className="line-clamp-2 text-[11.5px] font-medium leading-tight">{i.name}</div>
        </button>
      ))}
    </div>
  );
}
