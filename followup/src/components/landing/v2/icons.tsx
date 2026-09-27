/**
 * The handful of line icons the landing page uses, drawn as on the canvas
 * (1.8–2.2px strokes, round caps). Inline so the page makes no icon
 * request, and decorative: every one sits beside a word that says the same
 * thing, so each is aria-hidden.
 */
type IconProps = { size?: number; className?: string };

const base = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export function CheckIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.2} className={className} {...base}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ArrowIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2} className={className} {...base}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export function PlayIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

export function PlusIcon({ open }: { open: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" strokeWidth={1.8} {...base} style={{ flexShrink: 0 }}>
      <path d="M5 12h14" />
      {!open && <path d="M12 5v14" />}
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" strokeWidth={2} {...base} style={{ color: "#736e68" }}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

const CHANNEL_PATHS: Record<string, React.ReactNode> = {
  Gmail: (
    <>
      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
      <rect x="2" y="4" width="20" height="16" rx="2" />
    </>
  ),
  Outlook: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  Instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  Messenger: <path d="M12 3C7 3 3 6.7 3 11.3c0 2.6 1.3 4.9 3.3 6.4V21l3-1.7c.8.2 1.7.3 2.7.3 5 0 9-3.7 9-8.3S17 3 12 3z" />,
  WhatsApp: <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />,
  "Your website": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
    </>
  ),
};

export function ChannelIcon({ name }: { name: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" strokeWidth={1.8} {...base}>
      {CHANNEL_PATHS[name]}
    </svg>
  );
}
