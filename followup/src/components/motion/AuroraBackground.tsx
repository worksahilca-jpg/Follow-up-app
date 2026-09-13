/**
 * Three blurred, drifting color fields (see the .aurora-blob keyframes in
 * globals.css) — a living wash behind a section instead of a flat color
 * or a static gradient. Pure CSS animation, so this needs no "use client"
 * and costs nothing beyond three absolutely-positioned divs; the parent
 * section just needs `relative` and `overflow-hidden`.
 *
 * Three depths of the app's own accent blue — dark, mid, and a light tint
 * — not three unrelated decorative hues, and deliberately not reaching
 * into --coral/--gold/--sage (the lead-urgency status colors): reusing a
 * status hue purely for atmosphere would make this wash read as if it's
 * encoding a status meaning it isn't, which the standing rule reserves
 * those colors for. Updated 2026-09-13 for the navy/blue reskin
 * (D-010/A-002) — same structure as before, new palette.
 */
export default function AuroraBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className ?? ""}`}>
      <div
        className="aurora-blob aurora-blob-a"
        style={{ top: "-15%", left: "-10%", width: "50%", height: "60%", backgroundColor: "#2a5cdb" }}
      />
      <div
        className="aurora-blob aurora-blob-b"
        style={{ top: "10%", right: "-15%", width: "45%", height: "55%", backgroundColor: "#17348a" }}
      />
      <div
        className="aurora-blob aurora-blob-c"
        style={{ bottom: "-20%", left: "20%", width: "40%", height: "50%", backgroundColor: "#b4c6f2" }}
      />
    </div>
  );
}
