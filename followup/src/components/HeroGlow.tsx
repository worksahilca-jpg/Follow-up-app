/**
 * Purely decorative ambient gradient glow, positioned behind hero content.
 * Pure CSS (see .animate-float-slow in globals.css) — no client JS needed.
 */
export default function HeroGlow() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        className="absolute -top-24 right-[-10%] h-[420px] w-[420px] rounded-full animate-float-slow"
        style={{
          background: "radial-gradient(circle, var(--rust) 0%, transparent 70%)",
          opacity: 0.18,
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute top-40 left-[-15%] h-[360px] w-[360px] rounded-full animate-float-slow"
        style={{
          background: "radial-gradient(circle, var(--slate) 0%, transparent 70%)",
          opacity: 0.12,
          filter: "blur(60px)",
          animationDelay: "-6s",
        }}
      />
    </div>
  );
}
