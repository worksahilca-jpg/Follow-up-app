import type { LucideIcon } from "lucide-react";

/**
 * A neutral icon badge instead of plain "no leads yet" text — used
 * wherever a page/section has nothing to show yet (dashboard, leads,
 * pipeline). No accent color and no decorative animation here — violet
 * is reserved for buttons/links/focus states, not empty-state chrome.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div
        className="h-16 w-16 rounded-2xl flex items-center justify-center border border-line"
        style={{ backgroundColor: "var(--card)", color: "var(--ink-soft)" }}
      >
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="font-display text-lg mt-5">{title}</h3>
      <p className="text-sm text-ink-soft mt-2 max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
