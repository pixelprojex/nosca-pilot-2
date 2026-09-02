import React from "react";

export const Screen = ({ title, meta, children }) => (
  <div className="min-h-screen bg-page px-6 pb-28 pt-8 max-w-md mx-auto">
    <h1 className="font-display text-[32px] font-light text-ink leading-none">{title}</h1>
    {meta && <p className="mt-2 text-sm text-faint">{meta}</p>}
    <div className="mt-7">{children}</div>
  </div>
);

export const Card = ({ children, className = "" }) => (
  <div className={`bg-surface rounded-surface shadow-[0_1px_2px_rgba(26,24,21,0.06),0_1px_10px_rgba(26,24,21,0.05)] ${className}`}>
    {children}
  </div>
);

export const Field = ({ label, ...props }) => (
  <label className="block mb-4">
    <span className="block mb-1.5 text-[9px] uppercase tracking-[0.14em] text-faint">{label}</span>
    <input
      {...props}
      className="w-full rounded-control bg-wash px-4 py-3 text-[15px] text-ink outline-none focus:ring-2 focus:ring-ink/20"
    />
  </label>
);

export const Button = ({ children, variant = "primary", className = "", ...props }) => {
  const base = "w-full rounded-control py-3.5 text-[15px] font-medium transition active:opacity-70 disabled:opacity-40";
  const styles =
    variant === "primary"
      ? "bg-ink text-white"
      : variant === "danger"
      ? "bg-danger text-white"
      : "bg-wash text-ink";
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Row = ({ label, value, tone, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 py-4 text-left border-b border-hair last:border-none"
  >
    <span className="flex-1 min-w-0">
      <span className="block text-[8.5px] uppercase tracking-[0.14em] text-faint">{label}</span>
      <span className="block mt-1 text-[16px] truncate" style={{ color: tone || "#1A1815" }}>
        {value}
      </span>
    </span>
  </button>
);

export const Empty = ({ children }) => (
  <p className="py-10 text-center text-[14px] text-faint">{children}</p>
);

export const Toast = ({ message }) =>
  !message ? null : (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-ink text-white text-[13px] px-4 py-2.5 rounded-full shadow-lg z-50">
      {message}
    </div>
  );
