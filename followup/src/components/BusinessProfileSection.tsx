"use client";

import { useEffect, useState } from "react";
import { Building2, Check } from "lucide-react";
import { INDUSTRIES } from "@/lib/industries";

/**
 * The business's own name and trade — the one thing Settings never let
 * anyone change.
 *
 * `/api/onboarding` has always accepted a partial update "at any time,
 * not just during first-run" (its own comment says so). Nothing ever
 * called it that way, because no screen existed: name and industry were
 * asked once in the onboarding wizard and then unreachable forever.
 *
 * The cost was not theoretical. On 2026-09-20 four real people received
 * "Thank you for contacting My Business" — auth.ts's placeholder, on the
 * founder's own workspace, with no screen on which to correct it. When
 * he was told to "set it in Settings" he replied that there was no such
 * option, and he was right.
 *
 * Two fields, no more. Team size is collected at onboarding and drives
 * nothing today; adding it here would be a third control that changes
 * nothing, which is S-12 (decoration that doesn't improve usability).
 * It can be added the day it means something.
 *
 * Shape follows the other Settings panels exactly — `box p-5`, the
 * square icon tile in --slate-soft, title, one line of why it matters.
 * Nothing new is invented here; the pattern is the approved one.
 */
export default function BusinessProfileSection() {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [namePlaceholder, setNamePlaceholder] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data: { success: boolean; name?: string; industry?: string | null; namePlaceholder?: boolean; isAdmin?: boolean }) => {
        if (!data.success) return;
        setName(data.name ?? "");
        setIndustry(data.industry ?? "");
        setNamePlaceholder(Boolean(data.namePlaceholder));
        setIsAdmin(Boolean(data.isAdmin));
      })
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    if (!name.trim()) {
      setError("Give your business a name.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `industry: ""` clears it server-side (`body.industry || null`),
        // which is the honest behaviour for someone who picks the blank
        // option back — not a silent refusal to change anything.
        body: JSON.stringify({ name: name.trim(), industry }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't save — try again.");
      setSaved(true);
      setNamePlaceholder(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="box p-5">
      <div className="flex items-start gap-3">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
        >
          <Building2 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Your business</p>
          <p className="text-xs text-ink-soft mt-1">
            The name customers see when FollowUp writes to them, and the trade it judges your leads against.
          </p>

          {/* --slate, not --coral: nothing is broken and nothing has been
              lost. It is a fact the owner cannot otherwise discover — the
              name only appears in mail they never receive. */}
          {namePlaceholder && (
            <p className="mt-3 rounded-lg p-3 text-xs leading-relaxed" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
              Your business doesn&apos;t have a name yet, so FollowUp leaves it out of messages rather than using a
              stand-in. Add it and it goes in the greeting and the subject line.
            </p>
          )}

          <div className="mt-3 space-y-3">
            <div>
              <label htmlFor="business-name" className="text-xs font-medium block mb-1.5">
                Business name
              </label>
              <input
                id="business-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                disabled={!isAdmin}
                maxLength={120}
                placeholder="e.g. MJ Homes"
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="business-industry" className="text-xs font-medium block mb-1.5">
                What kind of business?
              </label>
              <select
                id="business-industry"
                value={industry}
                onChange={(e) => {
                  setIndustry(e.target.value);
                  setSaved(false);
                }}
                disabled={!isAdmin}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm disabled:opacity-60"
              >
                <option value="">Not set</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
              {/* Says what the setting DOES, which is the only reason to
                  spend a line on it. Without this it reads as filing
                  paperwork; with it, it reads as something worth doing. */}
              <p className="mt-1.5 text-xs text-ink-soft leading-relaxed">
                FollowUp uses this to tell a real customer from a supplier or a sales pitch. With it blank, it has to
                guess.
              </p>
            </div>
          </div>

          {isAdmin ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-60"
                style={{ backgroundColor: "var(--ink)" }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {saved && (
                <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--sage)" }}>
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-soft">Only an admin can change these.</p>
          )}

          {error && (
            <p className="mt-2 text-xs" style={{ color: "var(--coral)" }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
