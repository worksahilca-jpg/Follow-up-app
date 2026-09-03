"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";

const INDUSTRIES = [
  "Real estate",
  "Mortgage brokerage",
  "Home services (contractor, cleaning, etc.)",
  "Dental / medical clinic",
  "Legal",
  "Marketing agency",
  "Other",
];

export default function OnboardingForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [teamSize, setTeamSize] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give your business a name to continue.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, industry, teamSize }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't save — try again.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Zap className="h-6 w-6" style={{ color: "var(--rust)" }} />
          <span className="font-display text-2xl">FollowUp</span>
        </div>
        <p className="text-ink-soft text-center mt-2">A couple quick questions and you&apos;re set up.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Business name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
              placeholder="e.g. Riverside Realty"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">What kind of business?</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
            >
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">How many people on your team?</label>
            <input
              type="number"
              min={1}
              max={500}
              value={teamSize}
              onChange={(e) => setTeamSize(Number(e.target.value))}
              className="w-24 rounded-lg border border-line bg-card px-3 py-2 text-sm text-center"
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: "var(--coral)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          >
            {saving ? "Saving…" : "Continue to dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
