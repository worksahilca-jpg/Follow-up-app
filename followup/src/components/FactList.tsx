import type { ReactNode } from "react";

/**
 * A reference table: label on the left, figure on the right, hairline rows.
 *
 * This is a deliberate, stated exception to the founder's measured preference
 * for putting each item in its own box (approved.md A-006).
 *
 * **Boxes are for things you act on. A list of numbers you glance at is a
 * table.** A box says "this is a separate object, deal with it"; spending that
 * signal on twelve secondary statistics says it about all of them at once,
 * which is the clutter S-06 rules out — and it flattens the hierarchy the
 * boxes exist to create, because the one figure that matters ends up looking
 * exactly like "Avg. deal value".
 *
 * So: the headline and the money figures get boxes. Everything the owner is
 * only checking gets this. If the founder disagrees, this component is the one
 * place to change it — but he should overrule it deliberately, not discover it.
 */
export type Fact = { label: string; value: ReactNode };

export function FactList({ facts, className = "" }: { facts: Fact[]; className?: string }) {
  return (
    <dl className={"grid gap-x-8 sm:grid-cols-2 " + className}>
      {facts.map((f) => (
        <div key={f.label} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
          <dt className="text-sm text-ink-soft">{f.label}</dt>
          <dd className="text-sm font-medium tabular-nums">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
