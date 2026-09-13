"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Clock, X } from "lucide-react";

/**
 * A2P 10DLC (US SMS carrier compliance) registration — the in-app
 * replacement for TwilioConfig.tsx's old "register in Twilio's own
 * console" banner. See src/lib/integrations/twilioA2p.ts for the Twilio
 * side (Trust Hub Secondary Customer Profile -> BrandRegistration ->
 * Usa2p Campaign) and research/integrations/2026-09-08-twilio-a2p-self-
 * serve-api-scoping.md for why this exists: an unregistered number can
 * look "Connected" in Settings while carriers quietly block its texts.
 *
 * Table-stakes credibility work, not a differentiator — the form below
 * asks for exactly what Twilio's Brand/Campaign submission requires, no
 * more (design-brain/components/forms.md: "a form is an interrogation the
 * user didn't ask for").
 */

type Registration = {
  status: "not_started" | "pending" | "approved" | "rejected";
  tier: string;
  brandStatus?: string | null;
  campaignStatus?: string | null;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  hasEin?: boolean;
  missingFields: string[];
} & Partial<FormState>;

type FormState = {
  legalBusinessName: string;
  ein: string;
  businessType: string;
  businessIndustry: string;
  websiteUrl: string;
  addressStreet: string;
  addressCity: string;
  addressRegion: string;
  addressPostalCode: string;
  supportEmail: string;
  supportPhone: string;
  authorizedRepName: string;
  authorizedRepEmail: string;
  authorizedRepPhone: string;
  authorizedRepJobTitle: string;
  campaignDescription: string;
  optInDescription: string;
  sampleMessage1: string;
  sampleMessage2: string;
};

const EMPTY_FORM: FormState = {
  legalBusinessName: "",
  ein: "",
  businessType: "",
  businessIndustry: "",
  websiteUrl: "",
  addressStreet: "",
  addressCity: "",
  addressRegion: "",
  addressPostalCode: "",
  supportEmail: "",
  supportPhone: "",
  authorizedRepName: "",
  authorizedRepEmail: "",
  authorizedRepPhone: "",
  authorizedRepJobTitle: "",
  campaignDescription: "",
  optInDescription: "",
  sampleMessage1: "",
  sampleMessage2: "",
};

const BUSINESS_TYPES = [
  { value: "sole_proprietor", label: "Sole proprietor" },
  { value: "partnership", label: "Partnership" },
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "non_profit", label: "Non-profit" },
];

const INDUSTRIES = [
  { value: "REAL_ESTATE", label: "Real estate" },
  { value: "CONSTRUCTION", label: "Construction / home services" },
  { value: "PROFESSIONAL", label: "Professional services" },
  { value: "HOSPITALITY", label: "Hospitality" },
  { value: "RETAIL", label: "Retail" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "NOT_FOR_PROFIT", label: "Non-profit" },
  { value: "OTHER", label: "Other" },
];

function StatusPill({ status }: { status: Registration["status"] }) {
  const map: Record<Registration["status"], { label: string; bg: string; fg: string }> = {
    not_started: { label: "Not registered", bg: "var(--slate-soft)", fg: "var(--slate)" },
    pending: { label: "Pending review", bg: "var(--gold-soft)", fg: "var(--gold)" },
    approved: { label: "Approved", bg: "var(--sage-soft)", fg: "var(--sage)" },
    rejected: { label: "Rejected", bg: "var(--coral-soft)", fg: "var(--coral)" },
  };
  const s = map[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      {help && <p className="text-[11px] text-ink-soft mb-1">{help}</p>}
      {children}
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-xs";

export default function A2pRegistration() {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [reg, setReg] = useState<Registration | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Reused both for the initial fetch (below) and to re-pull fresh state
  // after a save/submit/refresh — only the initial call should toggle the
  // full-component `loading` gate, so it doesn't blank the form on every
  // subsequent mutation.
  async function load() {
    try {
      const res = await fetch("/api/twilio/a2p");
      const data: { success: boolean; available?: boolean; registration?: Registration } = await res.json();
      if (data.success && data.registration) {
        setReg(data.registration);
        setAvailable(!!data.available);
        setForm((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.keys(EMPTY_FORM).map((k) => [k, (data.registration as Record<string, unknown>)[k] ?? ""])
          ),
        }));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const status = reg?.status ?? "not_started";
  const missing = reg?.missingFields ?? [];

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function saveDetails() {
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/twilio/a2p", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data: { success: boolean; message?: string; status?: string; missingFields?: string[] } = await res.json();
      if (!data.success) {
        setFormError(data.message ?? "Couldn't save — try again.");
      } else {
        setSaved(true);
        setReg((r) => (r ? { ...r, missingFields: data.missingFields ?? [], status: (data.status as Registration["status"]) ?? r.status } : r));
      }
    } catch {
      setFormError("Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/twilio/a2p/submit", { method: "POST" });
      const data: { success: boolean; message?: string } = await res.json();
      if (!data.success) setFormError(data.message ?? "Twilio rejected the submission.");
      await load();
    } catch {
      setFormError("Couldn't reach Twilio — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await fetch("/api/twilio/a2p/refresh", { method: "POST" });
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const description = useMemo(() => {
    switch (status) {
      case "approved":
        return "Your Brand and Campaign are approved — texts from this number carry full carrier throughput.";
      case "pending":
        return "Submitted — Twilio and the carriers are still vetting this. Brand review is usually minutes to hours; Campaign/carrier review (especially AT&T) can take a few weeks.";
      case "rejected":
        return reg?.rejectionReason
          ? `Twilio rejected this: ${reg.rejectionReason}`
          : "Twilio rejected this registration. Review the details below and resubmit.";
      default:
        return "US carriers (AT&T, T-Mobile, Verizon) block or heavily throttle automated texts from an unregistered number, so an unregistered Twilio number can look \"Connected\" above while its messages quietly never reach anyone. Register from here — no separate Twilio console needed.";
    }
  }, [status, reg?.rejectionReason]);

  if (loading) return null;

  return (
    <div className="mt-2 rounded-lg border border-line p-2.5" style={{ backgroundColor: status === "approved" ? "var(--sage-soft)" : status === "rejected" ? "var(--coral-soft)" : "var(--gold-soft)" }}>
      <div className="flex items-start gap-1.5">
        {status === "approved" ? (
          <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "var(--sage)" }} />
        ) : status === "pending" ? (
          <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "var(--gold)" }} />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: status === "rejected" ? "var(--coral)" : "var(--gold)" }} />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
            <strong className="font-medium">Register your number for A2P 10DLC.</strong>
            <StatusPill status={status} />
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--ink)" }}>
            {description}
          </p>
          {status === "pending" && (
            <p className="text-[11px] text-ink-soft mt-1">
              Brand: {reg?.brandStatus ?? "submitted"} · Campaign: {reg?.campaignStatus ?? "not yet started"}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft"
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
              {status === "not_started" ? "Fill out registration" : "Edit details"}
            </button>
            {status === "pending" && (
              <button onClick={refresh} disabled={refreshing} className="text-xs underline text-ink-soft disabled:opacity-60">
                {refreshing ? "Checking…" : "Check status"}
              </button>
            )}
          </div>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-line space-y-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              {!available && (
                <p className="text-[11px] text-ink-soft rounded-lg border border-line bg-paper p-2">
                  Submission isn&apos;t open yet — FollowUp&apos;s own Twilio partner approval is still pending.
                  Save your details now; submitting will unlock automatically once that lands.
                </p>
              )}

              <div className="space-y-2">
                <p className="text-xs font-medium">Business identity</p>
                <Field label="Legal business name">
                  <input className={inputClass} value={form.legalBusinessName} onChange={(e) => update("legalBusinessName", e.target.value)} placeholder="Acme Home Services LLC" />
                </Field>
                <Field label="EIN" help={reg?.hasEin ? "Saved — leave blank to keep it." : "Optional for the Starter tier if you're a sole proprietor without one."}>
                  <input className={inputClass} value={form.ein} onChange={(e) => update("ein", e.target.value)} placeholder="12-3456789" />
                </Field>
                <Field label="Business type">
                  <select className={inputClass} value={form.businessType} onChange={(e) => update("businessType", e.target.value)}>
                    <option value="">Select one</option>
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Industry">
                  <select className={inputClass} value={form.businessIndustry} onChange={(e) => update("businessIndustry", e.target.value)}>
                    <option value="">Select one</option>
                    {INDUSTRIES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Website" help="Optional">
                  <input className={inputClass} type="url" value={form.websiteUrl} onChange={(e) => update("websiteUrl", e.target.value)} placeholder="https://example.com" />
                </Field>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium">Business address</p>
                <Field label="Street">
                  <input className={inputClass} value={form.addressStreet} onChange={(e) => update("addressStreet", e.target.value)} placeholder="123 Main St" />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="City">
                    <input className={inputClass} value={form.addressCity} onChange={(e) => update("addressCity", e.target.value)} />
                  </Field>
                  <Field label="State">
                    <input className={inputClass} value={form.addressRegion} onChange={(e) => update("addressRegion", e.target.value)} placeholder="CT" />
                  </Field>
                  <Field label="ZIP">
                    <input className={inputClass} value={form.addressPostalCode} onChange={(e) => update("addressPostalCode", e.target.value)} placeholder="06103" />
                  </Field>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium">Support contact</p>
                <Field label="Support email">
                  <input className={inputClass} type="email" value={form.supportEmail} onChange={(e) => update("supportEmail", e.target.value)} placeholder="support@example.com" />
                </Field>
                <Field label="Support phone">
                  <input className={inputClass} type="tel" value={form.supportPhone} onChange={(e) => update("supportPhone", e.target.value)} placeholder="+18609358202" />
                </Field>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium">Authorized representative</p>
                <p className="text-[11px] text-ink-soft">Whoever can legally speak for this business to Twilio/the carriers — often the owner.</p>
                <Field label="Full name">
                  <input className={inputClass} value={form.authorizedRepName} onChange={(e) => update("authorizedRepName", e.target.value)} placeholder="Jamie Rivera" />
                </Field>
                <Field label="Job title">
                  <input className={inputClass} value={form.authorizedRepJobTitle} onChange={(e) => update("authorizedRepJobTitle", e.target.value)} placeholder="Owner" />
                </Field>
                <Field label="Email">
                  <input className={inputClass} type="email" value={form.authorizedRepEmail} onChange={(e) => update("authorizedRepEmail", e.target.value)} />
                </Field>
                <Field label="Phone">
                  <input className={inputClass} type="tel" value={form.authorizedRepPhone} onChange={(e) => update("authorizedRepPhone", e.target.value)} placeholder="+18609358202" />
                </Field>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium">Consent &amp; messaging</p>
                <Field label="How do leads opt in to being texted?" help="Exactly what a lead does to consent — Twilio and carriers require this in plain language.">
                  <textarea className={inputClass} rows={2} value={form.optInDescription} onChange={(e) => update("optInDescription", e.target.value)} placeholder="Leads submit a web form with a checkbox agreeing to receive texts about their inquiry." />
                </Field>
                <Field label="Campaign description" help="What these texts are for, in a sentence or two.">
                  <textarea className={inputClass} rows={2} value={form.campaignDescription} onChange={(e) => update("campaignDescription", e.target.value)} placeholder="Follow-up texts to leads who requested a quote, and replies to their questions." />
                </Field>
                <Field label="Sample message">
                  <input className={inputClass} value={form.sampleMessage1} onChange={(e) => update("sampleMessage1", e.target.value)} placeholder="Hi Jordan, thanks for reaching out — when's a good time for a quick call?" />
                </Field>
                <Field label="Second sample message" help="Optional">
                  <input className={inputClass} value={form.sampleMessage2} onChange={(e) => update("sampleMessage2", e.target.value)} />
                </Field>
              </div>

              {missing.length > 0 && (
                <p className="text-[11px]" style={{ color: "var(--gold)" }}>
                  Still needed before you can submit: {missing.join(", ")}.
                </p>
              )}
              {formError && (
                <p className="text-xs flex items-start gap-1.5" style={{ color: "var(--coral)" }}>
                  <X className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {formError}
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={saveDetails}
                  disabled={saving}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: "var(--ink)" }}
                >
                  {saving ? "Saving…" : saved ? "Saved" : "Save details"}
                </button>
                {(status === "not_started" || status === "rejected") && (
                  <button
                    onClick={submit}
                    disabled={submitting || missing.length > 0 || !available}
                    title={!available ? "Not available yet — FollowUp's own Twilio approval is pending." : missing.length > 0 ? "Fill in the missing fields first." : undefined}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                    style={{ backgroundColor: "var(--sage)", color: "white" }}
                  >
                    {submitting ? "Submitting…" : "Submit for review"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
