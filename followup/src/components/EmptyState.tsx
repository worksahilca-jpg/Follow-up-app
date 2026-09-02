import type { LucideIcon } from "lucide-react";

/**
 * A glowing icon badge instead of plain "no leads yet" text — used
 * wherever a page/section has nothing to show yet (dashboard, leads,
 * pipeline). Pure CSS glow (reuses .animate-float-slow), no client JS.
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
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full animate-float-slow"
          style={{ background: "radial-gradient(circle, var(--rust) 0%, transparent 70%)", opacity: 0.3, filter: "blur(20px)" }}
          aria-hidden="true"
        />
        <div
          className="relative h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: "var(--rust-soft)", color: "var(--rust)" }}
        >
          <Icon className="h-7 w-7" />
        </div>
      </div>
      <h3 className="font-display text-lg mt-5">{title}</h3>
      <p className="text-sm text-ink-soft mt-2 max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
