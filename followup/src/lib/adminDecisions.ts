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

/** One kind of business with lessons waiting for the founder's OK on Train (A-319), and its newest test. */
export type WaitingLessons = {
  trade: string;
  waiting: number;
  hasTest: boolean;
  test: { status: string; current: boolean; passedWithout: number; passedWith: number; cases: number; worse: number; blocked?: number } | null;
};

export type DecisionFacts = {
  health: Pick<TesterHealthReport, "testers">;
  usage: Pick<ProductUsage, "thisWeek" | "waitingNow">;
  notCustomer: Pick<NotCustomerStats, "days" | "table">;
  lessons?: WaitingLessons[];
};

const CHANNEL: Record<string, string> = { email: "email", instagram: "Instagram", messenger: "Messenger" };

/** Where owners keep saying "Selling them something" or "Spam": the channel lets the wrong people in. Three or more is a pattern. */
export const LETTING_THROUGH_MIN = 3;

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function buildDecisions({ health, usage, notCustomer, lessons = [] }: DecisionFacts): Decision[] {
  const out: Decision[] = [];
  const testers = health.testers;

  // A-319: what the founder taught reaches no business until they put it to work, so it must not be forgotten.
  for (const l of lessons) {
    if (l.waiting === 0) continue;
    const t = l.test;
    const them = l.waiting === 1 ? "it" : "them";
    const why = !l.hasTest
      ? `There's no reply test for this kind yet. Your OK puts ${them} to work.`
      : t && t.current && t.status === "done"
        ? `Tested: ${t.passedWith} of ${t.cases} pass with ${them}, ${t.passedWithout} of ${t.cases} without. ${
              (t.blocked ?? 0) > 0
                ? `A reply broke one of FollowUp's own checks, so ${l.waiting === 1 ? "it can't" : "they can't"} go in use as ${l.waiting === 1 ? "it is" : "they are"}.`
                : t.worse > 0
                  ? `Worse on ${t.worse}.`
                  : "Nothing got worse."
            }`
        : `Not tested yet. Test ${them} on Train before ${l.waiting === 1 ? "it goes" : "they go"} in use.`;
    out.push({
      key: `lessons-${l.trade}`,
      title: `${plural(l.waiting, "change", "changes")} to ${l.trade} replies ${l.waiting === 1 ? "waits" : "wait"} for your OK`,
      why,
      action: { label: "Look and decide", href: `/admin/train?tab=talk&kind=${encodeURIComponent(l.trade)}` },
    });
  }

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
