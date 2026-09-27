import { Check } from "lucide-react";
import { yourRules, type RulesState } from "@/lib/yourRules";

/**
 * Your rules (A-041, from the Mercury study): the rules FollowUp is
 * following right now, as sentences an owner can check. Built from the
 * same settings the controls below it save, so it can't drift from them.
 */
export default function YourRulesCard(props: RulesState) {
  return (
    <div className="mt-4 box p-5">
      <p className="font-medium text-sm">Your rules</p>
      <p className="text-xs text-ink-soft mt-1">What FollowUp follows for your business, right now.</p>
      <ul className="mt-3 space-y-2">
        {yourRules(props).map((rule) => (
          <li key={rule} className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
