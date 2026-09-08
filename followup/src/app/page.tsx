import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ArrowRight, Check } from "lucide-react";
import styles from "./landing.module.css";
import LandingNav from "@/components/landing/LandingNav";
import FadeHeadline from "@/components/landing/FadeHeadline";
import HeroMockup from "@/components/landing/HeroMockup";
import Reveal from "@/components/landing/Reveal";

// Loaded here rather than the root layout so it stays scoped to this one
// page's own class tree (applied via plusJakarta.variable below on the
// landing wrapper) — the authenticated app keeps Inter/Space Grotesk from
// layout.tsx untouched.
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

export default function LandingPage() {
  return (
    <div className={`${styles.root} ${plusJakarta.variable}`} style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
      <LandingNav />
      <div className={styles.gridTexture} />

      {/* ---------- Hero ---------- */}
      <section className="relative max-w-6xl mx-auto px-6 pt-40 pb-28 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <FadeHeadline line1="Nobody meant" line2="to go quiet." />
          <p className="mt-7 text-[17px] leading-relaxed max-w-md" style={{ color: "var(--ink-soft)" }}>
            FollowUp reads every sales conversation — email, text, social DMs — and tells you exactly
            who&apos;s gone quiet, why it matters today, and drafts the reply in your own voice.
          </p>
          <div className="mt-8 flex items-center gap-4 flex-wrap">
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-bold transition-transform hover:scale-[1.03]"
              style={{ background: "var(--amber)", color: "#241a08", boxShadow: "0 16px 32px -14px rgba(232,162,58,0.65)" }}
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
              $29/mo · Google sign-in · cancel anytime
            </span>
          </div>
        </div>

        <div className="relative flex justify-center lg:justify-end pt-8 lg:pt-0">
          <HeroMockup />
        </div>
      </section>

      {/* ---------- 01 What it notices ---------- */}
      <section id="notices" className="max-w-6xl mx-auto px-6 py-24">
        <Reveal>
          <p className="text-[12px] font-bold tracking-[0.12em]" style={{ color: "var(--amber)" }}>
            01 — WHAT IT NOTICES
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold max-w-xl" style={{ letterSpacing: "-0.03em" }}>
            It reads the whole thread. Not just the last message.
          </h2>
        </Reveal>

        <div className="mt-14 grid md:grid-cols-3" style={{ borderTop: "1px solid rgba(24,20,15,0.1)" }}>
          <Notice
            dot="var(--amber)"
            label="Act today"
            quote="A proposal went out and nobody replied."
            body="The thread went cold right after the number showed up — the exact moment it needs a nudge, not a form letter."
            tag="✦ Draft ready"
          />
          <Notice
            dot="var(--coral)"
            label="This one's on you"
            quote="You promised a revised quote on Thursday."
            body="It's Tuesday. The lead didn't go quiet — you did, and FollowUp is the only thing keeping score."
          />
          <Notice
            dot="rgba(24,20,15,0.35)"
            label="Watch this week"
            quote="They said “let me check with my partner.”"
            body="Not urgent yet. FollowUp keeps it visible instead of letting it slide off the bottom of an inbox."
          />
        </div>
      </section>

      {/* ---------- 02 How it works ---------- */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-24">
        <Reveal>
          <p className="text-[12px] font-bold tracking-[0.12em]" style={{ color: "var(--amber)" }}>
            02 — HOW IT WORKS
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold max-w-xl" style={{ letterSpacing: "-0.03em" }}>
            Three steps, then it runs on its own.
          </h2>
        </Reveal>

        <div className="mt-14 grid md:grid-cols-3 gap-10">
          <StepBlock
            n="01"
            title="Connect your inbox"
            body="Start with Gmail — text and social DMs come along as you add them. Nothing about your setup has to change first."
          />
          <StepBlock
            n="02"
            title="FollowUp learns your conversations"
            body="It reads full threads, not just the newest message, and drafts every reply in your own voice — not a template."
          />
          <StepBlock
            n="03"
            title="Each morning, a short list"
            body="Who needs you today, why in one line, and a draft ready to send, edit, or snooze."
          />
        </div>
      </section>

      {/* ---------- 03 A real draft ---------- */}
      <section id="draft" className="max-w-6xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16 items-start">
        <Reveal>
          <p className="text-[12px] font-bold tracking-[0.12em]" style={{ color: "var(--amber)" }}>
            03 — A REAL DRAFT
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold max-w-md" style={{ letterSpacing: "-0.03em" }}>
            Not &ldquo;just following up&rdquo; — an actual reason to write today.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed max-w-sm" style={{ color: "var(--ink-soft)" }}>
            Every draft comes with the one line that explains why it&apos;s worth sending now — a
            deadline the lead mentioned, a promise you made, a detail that gives you something real to
            point at instead of a generic nudge. You approve it, edit it, or send it as-is.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", boxShadow: "0 30px 60px -30px rgba(24,20,15,0.3)" }}>
            <div className="p-6">
              <p className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
                To: Priya Nair, Nair Interiors
              </p>
              <p className="text-[13px] font-bold mt-1">Subject: Re: Brand video for the spring launch</p>
              <div className="mt-4 text-[13.5px] leading-relaxed space-y-3" style={{ color: "var(--ink)" }}>
                <p>Hi Priya,</p>
                <p>
                  Wanted to check in on the proposal I sent last Tuesday. If the{" "}
                  <span style={{ background: "var(--amber-soft)", color: "#96631c", padding: "0 3px", borderRadius: 3 }}>
                    spring launch
                  </span>{" "}
                  is still the target, we&apos;d need to lock a shoot date by the 20th to hit it comfortably.
                </p>
                <p>Happy to adjust scope if the budget moved. Would a quick call Thursday work?</p>
                <p>Sahil</p>
              </div>
            </div>
            <div className="mx-6 mb-6 rounded-xl px-4 py-3.5" style={{ background: "var(--amber-soft)" }}>
              <p className="text-[11px] font-bold tracking-wide" style={{ color: "var(--amber)" }}>
                WHY TODAY
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "#5c4116" }}>
                Proposal sent 6 days ago — and she opened it twice. She mentioned a spring launch in
                her first email, which gives you a real deadline to point at instead of &ldquo;just
                following up.&rdquo;
              </p>
            </div>
            <div className="flex items-center gap-2 px-6 pb-6">
              <button
                className="rounded-full px-4 py-2 text-[12.5px] font-semibold"
                style={{ background: "var(--ink)", color: "#f3f0ea" }}
              >
                Send now
              </button>
              <button
                className="rounded-full px-4 py-2 text-[12.5px] font-semibold"
                style={{ border: "1px solid rgba(24,20,15,0.15)", color: "var(--ink-soft)" }}
              >
                Edit
              </button>
              <button
                className="rounded-full px-4 py-2 text-[12.5px] font-semibold"
                style={{ color: "var(--ink-soft)" }}
              >
                Snooze a week
              </button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- 04 Pricing ---------- */}
      <section className="max-w-6xl mx-auto px-6 py-28 grid lg:grid-cols-2 gap-16 items-center">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ letterSpacing: "-0.03em" }}>
            One plan. One inbox.
          </h2>
          <p className={styles.priceGiant} style={{ marginTop: 18 }}>
            $29<span style={{ fontSize: "0.32em", color: "var(--ink-soft)", fontWeight: 600 }}>/mo</span>
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <ul className="space-y-4">
            {[
              "Unlimited threads and drafts",
              "Daily brief, delivered before your first coffee",
              "Email, text, and social DMs — not just Gmail",
              "Drafts written in your own voice — not a template",
              "Cancel anytime — no contract",
            ].map((f) => (
              <li key={f} className="flex items-center gap-3 text-[15px]">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full shrink-0"
                  style={{ background: "var(--amber-soft)" }}
                >
                  <Check className="h-3 w-3" style={{ color: "var(--amber)" }} />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/signin"
            className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-bold transition-transform hover:scale-[1.03]"
            style={{ background: "var(--amber)", color: "#241a08", boxShadow: "0 16px 32px -14px rgba(232,162,58,0.65)" }}
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderTop: "1px solid rgba(24,20,15,0.1)" }}>
        <p className="text-[12.5px]" style={{ color: "var(--ink-soft)" }}>
          FollowUp
        </p>
        <div className="flex items-center gap-5 text-[12.5px]" style={{ color: "var(--ink-soft)" }}>
          <Link href="/privacy" className="hover:opacity-70 transition-opacity">
            Privacy
          </Link>
          <Link href="/terms" className="hover:opacity-70 transition-opacity">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Notice({
  dot,
  label,
  quote,
  body,
  tag,
}: {
  dot: string;
  label: string;
  quote: string;
  body: string;
  tag?: string;
}) {
  return (
    <div className="py-8 md:px-8 md:first:pl-0 md:last:pr-0" style={{ borderLeft: "1px solid rgba(24,20,15,0.1)" }}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${styles.pulseDot}`} style={{ background: dot }} />
        <span className="text-[12.5px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>
          {label}
        </span>
      </div>
      <p className="mt-4 text-[16px] font-bold leading-snug" style={{ letterSpacing: "-0.01em" }}>
        {quote}
      </p>
      <p className="mt-2.5 text-[13.5px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        {body}
      </p>
      {tag && (
        <p className="mt-3 text-[12.5px] font-semibold" style={{ color: "var(--amber)" }}>
          {tag}
        </p>
      )}
    </div>
  );
}

function StepBlock({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="relative">
      <span className={styles.stepNumber} style={{ position: "absolute", top: -30, left: -6 }}>
        {n}
      </span>
      <div className="relative pt-9">
        <h4 className="text-[16px] font-bold">{title}</h4>
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          {body}
        </p>
      </div>
    </div>
  );
}
