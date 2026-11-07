/* The few shared controls. One tile, one row, one sheet, one segmented switch. */
import { useEffect, useMemo, useRef } from "react";
import { renderGarment } from "./lib/garments.js";

export function Garment({ item, size = 120, className = "" }) {
  const html = useMemo(() => renderGarment(item, { size }), [item, size]);
  return <div className={`garment ${className}`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Segmented({ value, onChange, options, className = "" }) {
  const i = Math.max(0, options.findIndex(o => o.value === value));
  return (
    <div className={`relative grid rounded-xl bg-wash p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${options.length},1fr)` }} role="tablist">
      <div aria-hidden className="absolute top-1 bottom-1 rounded-lg bg-surface shadow-sm transition-transform duration-200" style={{ left: 4, width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${i * 100}%)` }} />
      {options.map(o => (
        <button key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)} className={`relative z-10 h-9 rounded-lg text-[14px] font-semibold ${o.value === value ? "text-ink" : "text-muted"}`}>{o.label}</button>
      ))}
    </div>
  );
}

export function Chip({ on, onClick, children, count }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`h-9 shrink-0 rounded-full border px-3.5 text-[13.5px] font-semibold transition-colors ${on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-muted"}`}>
      {children}{count != null && <span className={`ml-1.5 ${on ? "opacity-70" : "opacity-60"}`}>{count}</span>}
    </button>
  );
}

export function Button({ tone = "primary", className = "", children, ...rest }) {
  const tones = {
    primary: "bg-accent text-on-accent",
    quiet: "border border-line bg-surface text-ink",
    danger: "border border-danger text-danger bg-surface",
  };
  return <button {...rest} className={`h-11 rounded-xl px-4 text-[15px] font-semibold disabled:opacity-40 ${tones[tone]} ${className}`}>{children}</button>;
}

export function Row({ label, value, sub }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <span className="text-[14px] text-muted">{label}</span>
      <span className="text-right text-[15px] font-medium">{value}{sub && <span className="block text-[12.5px] font-normal text-muted">{sub}</span>}</span>
    </div>
  );
}

/** One bottom sheet. Scrim closes it; Escape closes it; the body scrolls. */
export function Sheet({ open, onClose, title, eyebrow, children, tall = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`sheet-in absolute inset-x-0 bottom-0 mx-auto flex max-w-[640px] flex-col rounded-t-3xl bg-surface shadow-2xl ${tall ? "h-[92dvh]" : "max-h-[88dvh]"}`}>
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-line" />
        <div className="flex items-start justify-between gap-3 px-5 pt-3">
          <div className="min-w-0">
            {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[.1em] text-muted">{eyebrow}</div>}
            <h2 className="font-display text-[24px] font-semibold leading-tight tracking-tight">{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-wash text-[15px]">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-3">{children}</div>
      </div>
    </div>
  );
}

export function Toast({ msg }) {
  if (!msg) return null;
  return <div role="status" className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center" style={{ bottom: "calc(var(--bar-h) + 20px + env(safe-area-inset-bottom,0px))" }}><div className="rise rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-paper shadow-lg">{msg}</div></div>;
}

export function Header({ title, meta, onSettings, children }) {
  return (
    <header className="px-4 pt-[calc(14px+env(safe-area-inset-top,0px))]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-bold leading-none tracking-tight">{title}</h1>
          {meta && <div className="mt-1 text-[13px] text-muted">{meta}</div>}
        </div>
        <button onClick={onSettings} aria-label="Settings" className="grid h-10 w-10 place-items-center rounded-full bg-wash text-accent">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      </div>
      {children}
    </header>
  );
}
