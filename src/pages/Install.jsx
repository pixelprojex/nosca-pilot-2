import React, { useEffect } from "react";
import { X } from "lucide-react";
import { ThemeCtx, NEUTRAL, BRAND, tr, display, Mark, Button, InstallGuide, haptic, EDGE, SOFT_LIP, LIST_CSS } from "../Nosca";
import { registerSw } from "../lib/push";

/* ADD TO HOME SCREEN — https://<site>/install
 *
 * The page the business card's second QR code opens, and the one
 * place the guide stands on its own: no account, no tab bar, the
 * app's paper and type. The guide itself (InstallGuide, in Nosca) is
 * the same one Settings › Add to Home Screen and the arrival screen
 * show. Open Nosca at the foot goes to the app, which is a sign-up for
 * a new person and the app for one who is signed in. The worker is
 * registered here too: Chrome's install criteria want one, and the
 * app registers it only once somebody is signed in. */
export default function InstallPage() {
  useEffect(() => { registerSw(); }, []);
  const open = () => { haptic(10); window.location.assign("/"); };
  return (
    <ThemeCtx.Provider value={NEUTRAL}>
      {/* the wash and the edge the app's root sets, so the guide's rows
          sit on the wash here as they do inside the app */}
      <div className="flex flex-col" style={{ minHeight: "100dvh", background: NEUTRAL.page, "--surface": NEUTRAL.surface, "--wash": NEUTRAL.wash, "--edge": EDGE(NEUTRAL), "--lip": SOFT_LIP(NEUTRAL) }}>
        <style>{LIST_CSS}</style>
        <div className="shrink-0" style={{ height: "env(safe-area-inset-top, 0px)" }} />
        <div className="shrink-0 relative flex items-center justify-center gap-2 pt-4" style={{ minHeight: 44, animation: "fadeUp 620ms cubic-bezier(.22,1,.36,1) both" }}>
          <Mark size={15} color={NEUTRAL.faint} />
          <span data-tour="wordmark" style={{ fontFamily: display, fontSize: 9, letterSpacing: "0.34em", color: NEUTRAL.faint }}>{BRAND}</span>
          {/* the way out to the app — sign-up, or the app for a member */}
          <button onClick={open} aria-label={tr("Close")} data-tour="install-close" className="absolute flex items-center justify-center active:opacity-60"
                  style={{ right: 12, top: 4, width: 44, height: 44 }}>
            <X size={20} color={NEUTRAL.ink} strokeWidth={2} />
          </button>
        </div>
        <div className="flex-1 px-6 pt-8" style={{ animation: "fadeUp 520ms cubic-bezier(.22,1,.36,1) both" }}>
          <h1 style={{ fontFamily: display, fontSize: 28, lineHeight: 1.06, letterSpacing: "-0.03em", color: NEUTRAL.ink, marginBottom: 24 }}>
            {tr("Add to Home Screen")}
          </h1>
          <InstallGuide />
        </div>
        <div className="px-6 shrink-0 pt-8" style={{ paddingBottom: "max(28px, env(safe-area-inset-bottom, 28px))" }}>
          <Button tone="ink" onClick={open} tour="install-open">{tr("Open Nosca")}</Button>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
