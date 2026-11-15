import React, { useEffect } from "react";
import { ThemeCtx, NEUTRAL, BRAND, tr, ui, display, Mark, Button, InstallGuide, haptic } from "../Nosca";
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
      <div className="flex flex-col" style={{ minHeight: "100dvh", background: NEUTRAL.page }}>
        <div className="shrink-0" style={{ height: "env(safe-area-inset-top, 0px)" }} />
        <div className="shrink-0 flex items-center justify-center gap-2 pt-4" style={{ animation: "fadeUp 620ms cubic-bezier(.22,1,.36,1) both" }}>
          <Mark size={15} color={NEUTRAL.faint} />
          <span data-tour="wordmark" style={{ fontFamily: display, fontSize: 9, letterSpacing: "0.34em", color: NEUTRAL.faint }}>{BRAND}</span>
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
