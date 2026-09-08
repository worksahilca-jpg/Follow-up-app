/**
 * Three blurred, drifting color fields (see the .aurora-blob keyframes in
 * globals.css) — a living wash behind a section instead of a flat color
 * or a static gradient. Pure CSS animation, so this needs no "use client"
 * and costs nothing beyond three absolutely-positioned divs; the parent
 * section just needs `relative` and `overflow-hidden`.
 */
export default function AuroraBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className ?? ""}`}>
      <div
        className="aurora-blob aurora-blob-a"
        style={{ top: "-15%", left: "-10%", width: "50%", height: "60%", backgroundColor: "var(--rust)" }}
      />
      <div
        className="aurora-blob aurora-blob-b"
        style={{ top: "10%", right: "-15%", width: "45%", height: "55%", backgroundColor: "var(--gold)" }}
      />
      <div
        className="aurora-blob aurora-blob-c"
        style={{ bottom: "-20%", left: "20%", width: "40%", height: "50%", backgroundColor: "var(--sage)" }}
      />
    </div>
  );
}
