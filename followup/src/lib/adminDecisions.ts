import type { TesterHealthReport } from "@/lib/testerHealth";
import type { ProductUsage } from "@/lib/admin-usage";
import { NOT_CUSTOMER_CHANNELS, type NotCustomerStats } from "@/lib/notCustomerStats";

/**
 * /admin → Decide (founder, 2026-10-18: "organise the admin page so that I
 * can make decisions"). Each line is one decision: what happened, why it
 * matters, and the one thing to do, with a link to the place that does it.
 * Built only from numbers /admin already reads; no customer's words.
 */

export type Decision = {
  key: string;
  title: string;
  why: string;
  action: { label: string; href: string };
};

export type DecisionFacts = {
  health: Pick<TesterHealthReport, "testers">;
  usage: Pick<ProductUsage, "thisWeek" | "waitingNow">;
  notCustomer: Pick<NotCustomerStats, "days" | "table">;
};

const CHANNEL: Record<string, string> = { email: "email", instagram: "Instagram", messenger: "Messenger" };

/** Where owners keep saying "Selling them something" or "Spam": the channel lets the wrong people in. Three or more is a pattern. */
export const LETTING_THROUGH_MIN = 3;

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function buildDecisions({ health, usage, notCustomer }: DecisionFacts): Decision[] {
  const out: Decision[] = [];
  const testers = health.testers;

  if (testers.length === 0) {
    out.push({
      key: "no-testers",
      title: "No testers yet",
      why: "Add someone's Google email and they can sign in on their next try.",
      action: { label: "Add a tester", href: "/admin/testers#add" },
    });
  } else {
    const stuck = testers.filter((t) => t.next && t.checks.connected.state === "no");
    if (stuck.length > 0) {
      const first = stuck[0];
      out.push({
        key: "stuck",
        title: `${plural(stuck.length, "tester is", "testers are")} not set up`,
        why: `${first.name}: ${first.checks.connected.text}.${stuck.length > 1 ? ` And ${plural(stuck.length - 1, "other", "others")}.` : ""} Help them connect.`,
        action: { label: "See testers", href: "/admin/testers" },
      });
    }
  }

  const week = usage.thisWeek;
  if (week.repliesWritten > 0 && week.sentByOwner === 0) {
    out.push({
      key: "no-send",
      title: "No owner pressed Send this week",
      why: `${plural(usage.waitingNow, "reply is", "replies are")} waiting for an OK. Ask a tester what stops them.`,
      action: { label: "See testers", href: "/admin/testers" },
    });
  }

  let worst: { channel: string; count: number } | null = null;
  for (const c of NOT_CUSTOMER_CHANNELS) {
    const count = notCustomer.table.selling[c] + notCustomer.table.spam[c];
    if (count >= LETTING_THROUGH_MIN && (!worst || count > worst.count)) worst = { channel: c, count };
  }
  if (worst) {
    out.push({
      key: "letting-through",
      title: `${plural(worst.count, "seller or spammer", "sellers and spammers")} got through on ${CHANNEL[worst.channel]}`,
      why: `Owners marked them "not a customer" in the last ${notCustomer.days} days. FollowUp should have set them aside.`,
      action: { label: "See why", href: "/admin/usage#not-a-customer" },
    });
  }

  return out;
}
