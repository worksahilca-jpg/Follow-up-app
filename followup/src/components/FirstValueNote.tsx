import { Check } from "lucide-react";

// The owner's first value, said once, on the day it happens (design brain
// A-047). Calm on purpose: no confetti, no points, no streak.
export default function FirstValueNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 box p-4 sm:p-5 flex items-start gap-3.5 max-w-3xl" role="status">
      <span
        className="h-9 w-9 shrink-0 rounded-full border border-line flex items-center justify-center"
        aria-hidden
      >
        <Check className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-ink-soft mt-1">{body}</p>
      </div>
    </div>
  );
}
