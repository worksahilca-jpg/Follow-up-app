/**
 * Three blurred, drifting color fields (see the .aurora-blob keyframes in
 * globals.css) — a living wash behind a section instead of a flat color
 * or a static gradient. Pure CSS animation, so this needs no "use client"
 * and costs nothing beyond three absolutely-positioned divs; the parent
 * section just needs `relative` and `overflow-hidden`.
 *
 * Independent decorative hues (blue/coral/blue — the same three
 * SignInScene.tsx uses) rather than the app's own --rust/--gold/--sage:
 * --rust is now the primary accent and --gold/--sage are the lead-urgency
 * status colors, so reusing either here would either wash out the accent
 * or make this look like it's encoding a status meaning it isn't.
 */
export default function AuroraBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className ?? ""}`}>
      <div
        className="aurora-blob aurora-blob-a"
        style={{ top: "-15%", left: "-10%", width: "50%", height: "60%", backgroundColor: "#2954e0" }}
      />
      <div
        className="aurora-blob aurora-blob-b"
        style={{ top: "10%", right: "-15%", width: "45%", height: "55%", backgroundColor: "#4a6fa5" }}
      />
      <div
        className="aurora-blob aurora-blob-c"
        style={{ bottom: "-20%", left: "20%", width: "40%", height: "50%", backgroundColor: "#d1553f" }}
      />
    </div>
  );
}
