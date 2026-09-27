import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { requireActiveBilling, billingLockedMessage } from "@/lib/billing";
import { getLeads } from "@/lib/leads-data";
import { getBusinessAutomationRules } from "@/lib/automationStatus";
import { pickExampleLead, writeRuleExample } from "@/lib/ruleExample";

/**
 * POST /api/automation/rule-example — "See an example" on a follow-up rule
 * in Settings (design brain A-044). What the rule would write for a real
 * recent customer. One model call; nothing is stored, held or sent.
 * `skip` lists who was already shown, for "Try another customer".
 */
const schema = z.object({
  rule: z.enum(["instant_ack", "unanswered", "silence", "dead_lead_reactivation"]),
  skip: z.array(z.string().max(64)).max(20).optional(),
});

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (await tooManyRecentActions(ctx.businessId, "rules.example", { windowMinutes: 10, max: 20 })) {
    return NextResponse.json({ success: false, message: "That's a lot of examples. Try again in a few minutes." }, { status: 429 });
  }
  if (!(await requireActiveBilling(ctx.businessId))) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;

  const lead = pickExampleLead(await getLeads(), parsed.data.rule, parsed.data.skip ?? []);
  if (!lead) {
    return NextResponse.json({ success: true, example: null, message: "No customer fits this one yet. It will once someone does." });
  }
  try {
    const rules = await getBusinessAutomationRules(ctx.businessId);
    const ex = await writeRuleExample(ctx.businessId, lead, parsed.data.rule, { silenceTriggerDays: rules.silenceTriggerDays, deadLeadDays: rules.deadLeadDays });
    return NextResponse.json({ success: true, example: { leadId: lead.id, leadName: lead.name, what: ex.what, text: ex.text } });
  } catch {
    return NextResponse.json({ success: false, message: "Couldn't write an example just now. Try again in a minute." }, { status: 502 });
  }
}
