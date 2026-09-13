import Link from "next/link";
import {
  Mail,
  Clock,
  TrendingUp,
  Users,
  Check,
  X,
  ArrowRight,
  Home,
  Briefcase,
  Building2,
  Eye,
  PenLine,
  BellOff,
  Send,
} from "lucide-react";
import styles from "./landing-award.module.css";
import LandingNavAward from "@/components/landing/award/LandingNavAward";
import HeroMockupAward from "@/components/landing/award/HeroMockupAward";
import OrbitDiagramAward from "@/components/landing/award/OrbitDiagramAward";
import RevealAward from "@/components/landing/award/RevealAward";
import LandingFaqAward from "@/components/landing/award/LandingFaqAward";
import CountUp from "@/components/motion/CountUp";
import { bricolageGrotesque, publicSans, ibmPlexMono } from "@/lib/fonts";

// "Award Direction" — a CEO-approved, page-scoped visual system for the
// public landing page only (deep navy / professional blue / cloud white,
// Bricolage Grotesque + Public Sans + IBM Plex Mono). /signin and the
// authenticated app are untouched and keep the shared amber/Plus Jakarta
// Sans system. See design-brain/decisions/design-decisions.md, 2026-09-13.
//
// Copy is carried over from the CEO-approved copy-accuracy pass on
// `copy-fixes-conversion-thesis-audit` (real channel list including
// WhatsApp, the ASSISTED-by-default automation guarantee, sourced stats —
// 62%/63%/29-47hrs) rather than the design exploration's own draft copy.
// The exploration's placeholder testimonial is omitted entirely — FollowUp
// has no real customers yet and it was never real content to begin with.
export default function LandingPage() {
  return (
    <div
      className={`${styles.root} ${bricolageGrotesque.variable} ${publicSans.variable} ${ibmPlexMono.variable}`}
    >
      <LandingNavAward />

      {/* ---------- Hero ---------- */}
      <section className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <RevealAward>
            <span className={styles.badge}>Built for realtors, freelance consultants, and small teams</span>
          </RevealAward>
          <RevealAward delayMs={80}>
            <h1
              className="mt-5"
              style={{
                fontWeight: 800,
                fontSize: "clamp(34px, 4.2vw, 52px)",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: "var(--ink)",
              }}
            >
              {["Every", "tool", "answers", "the", "lead.", "FollowUp", "catches", "the", "one", "that"].map(
                (word, i) => (
                  <span key={word + i} className={styles.word}>
                    <span style={{ animationDelay: `${i * 0.035}s` }}>{word}&nbsp;</span>
                  </span>
                ),
              )}
              <span className={styles.word}>
                <span style={{ animationDelay: "0.4s" }} className={styles.accentText}>
                  went&nbsp;quiet.
                </span>
              </span>
            </h1>
          </RevealAward>
          <RevealAward delayMs={140}>
            <p className="mt-6 text-[16px] leading-relaxed max-w-md" style={{ color: "var(--ink-soft)" }}>
              FollowUp reads every conversation, not just the new ones — and notices the lead who
              already heard from you once, then went silent, before &ldquo;let me think about
              it&rdquo; turns into a lost sale.
            </p>
          </RevealAward>
          <RevealAward delayMs={200}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-bold transition-transform hover:scale-[1.03]"
                style={{ background: "var(--accent)", color: "var(--on-accent)", boxShadow: "0 16px 32px -14px rgba(23,52,138,0.5)" }}
              >
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how-it-works"
                className="rounded-full px-5 py-3 text-[14px] font-semibold transition-opacity hover:opacity-70"
                style={{ border: "1px solid var(--line-strong)", color: "var(--ink)" }}
              >
                See how it works
              </a>
            </div>
          </RevealAward>
          <RevealAward delayMs={260}>
            <div className="mt-9 flex items-center gap-4">
              <p
                className="shrink-0"
                style={{
                  fontFamily: "var(--font-bricolage), sans-serif",
                  fontWeight: 800,
                  fontSize: 34,
                  letterSpacing: "-0.02em",
                  color: "var(--ink)",
                }}
              >
                <CountUp to={21} suffix="×" />
              </p>
              <p className="text-xs leading-relaxed max-w-[15rem]" style={{ color: "var(--ink-soft)" }}>
                higher qualification rate when a lead is contacted within 5 minutes instead of
                after 30 — no credit card required to see it for yourself.
              </p>
            </div>
          </RevealAward>
          <RevealAward delayMs={320}>
            <div className="mt-9">
              <p className={styles.eyebrow}>Reads what you already use</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {["Gmail", "Outlook", "Twilio", "Instagram", "WhatsApp"].map((name) => (
                  <span
                    key={name}
                    className="text-[12.5px] font-bold rounded-lg px-3 py-1.5"
                    style={{ background: "var(--card)", border: "1px solid var(--line)", color: "var(--ink)" }}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </RevealAward>
        </div>

        <div className="relative flex justify-center lg:justify-end pt-8 lg:pt-0">
          <OrbitDiagramAward />
          <div className="relative" style={{ zIndex: 1 }}>
            <HeroMockupAward />
          </div>
        </div>
      </section>

      {/* ---------- The gap (problem) ---------- */}
      <section style={{ background: "var(--paper-2)" }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <RevealAward className="max-w-2xl">
            <span className={styles.eyebrow}>The gap</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold" style={{ letterSpacing: "-0.02em" }}>
              The gap between having leads and knowing who needs you
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              CRMs store leads, deals, and notes. Email tools help you write messages. Automation
              tools send sequences. But none of them answer the one question that actually loses
              you money:
            </p>
            <p
              className="mt-6 pl-5 text-2xl sm:text-3xl font-extrabold leading-snug"
              style={{ borderLeft: "3px solid var(--accent)", color: "var(--ink)", fontFamily: "var(--font-bricolage), sans-serif" }}
            >
              &ldquo;Which lead am I about to lose because I haven&apos;t followed up?&rdquo;
            </p>
            <p className="mt-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              FollowUp sits on top of your existing inbox and turns messy conversations into a
              short, prioritized list of who to contact today — without asking you to maintain
              another system.
            </p>
          </RevealAward>

          <div className="mt-14 grid gap-5 sm:grid-cols-3">
            {[
              { stat: "62%", copy: "of calls to small businesses go unanswered entirely" },
              { stat: "63%", copy: "of companies never respond to an inbound lead at all" },
              { stat: "29–47 hrs", copy: "average time to first response, while the first 5 minutes are what actually moves conversion" },
            ].map(({ stat, copy }, i) => (
              <RevealAward key={stat} delayMs={i * 90}>
                <div className={styles.card}>
                  <p style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 800, fontSize: 32, letterSpacing: "-0.01em", color: "var(--accent-deep)" }}>
                    {stat}
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                    {copy}
                  </p>
                </div>
              </RevealAward>
            ))}
          </div>
          <p className="mt-4 text-xs" style={{ color: "var(--ink-faint)" }}>
            Industry-wide lead-response benchmarks, not FollowUp&apos;s own results.
          </p>
        </div>
      </section>

      {/* ---------- Positioning ---------- */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <RevealAward className="max-w-2xl">
          <span className={styles.eyebrow}>Why FollowUp exists</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold" style={{ letterSpacing: "-0.02em" }}>
            You don&apos;t have a lead-generation problem. You have a lead-conversion problem.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            Most tools stop the moment a name and an email land in your inbox. The deal is
            actually lost or won in the weeks after that — the follow-up nobody sent, the
            question that sat unanswered for four days, the lead that quietly went cold while you
            were busy closing someone else.
          </p>
        </RevealAward>

        <RevealAward delayMs={80} className={`mt-10 grid sm:grid-cols-2 ${styles.compareGrid}`}>
          <div className="p-6 sm:p-7">
            <p className={styles.eyebrow}>Lead generation tools</p>
            <ul className="mt-4 space-y-3 text-sm" style={{ color: "var(--ink-soft)" }}>
              <li className="flex items-start gap-2.5">
                <X className="h-4 w-4 mt-0.5 shrink-0" /> Hands you a name and an email address
              </li>
              <li className="flex items-start gap-2.5">
                <X className="h-4 w-4 mt-0.5 shrink-0" /> Calls the job done the moment the lead exists
              </li>
              <li className="flex items-start gap-2.5">
                <X className="h-4 w-4 mt-0.5 shrink-0" /> Says nothing when that lead goes quiet for a week
              </li>
            </ul>
          </div>
          <div
            className="p-6 sm:p-7"
            style={{ borderTop: "1px solid var(--line)", borderLeft: "3px solid var(--accent)" }}
          >
            <p className="text-xs font-bold uppercase" style={{ letterSpacing: "0.1em", color: "var(--accent-deep)" }}>
              FollowUp
            </p>
            <ul className="mt-4 space-y-3 text-sm" style={{ color: "var(--ink)" }}>
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} /> Reads what
                happens after the lead exists
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} /> Flags exactly
                who&apos;s about to go cold, and why
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} /> Drafts the
                message that keeps the conversation alive
              </li>
            </ul>
          </div>
        </RevealAward>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20">
        <RevealAward>
          <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ letterSpacing: "-0.02em" }}>
            How it works
          </h2>
        </RevealAward>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: <Mail className="h-4 w-4" />, title: "Connect your inbox", body: "FollowUp reads your sales conversations — Gmail, Outlook, SMS, Instagram DMs, WhatsApp, and more — in one place." },
            { icon: <TrendingUp className="h-4 w-4" />, title: "It scores every lead", body: "Buying intent, response gaps, and deal value become a single follow-up score." },
            { icon: <Clock className="h-4 w-4" />, title: "You get a daily list", body: "A short, ranked list of who needs you today, and why — not a full CRM to dig through." },
            { icon: <Send className="h-4 w-4" />, title: "It drafts the message", body: "Edit, regenerate, or let low-risk replies send themselves automatically — you decide how much to hand off, per lead, any time." },
          ].map((item, i) => (
            <RevealAward key={item.title} delayMs={i * 80}>
              <IconCard icon={item.icon} title={item.title} body={item.body} />
            </RevealAward>
          ))}
        </div>
      </section>

      {/* ---------- Who it's for ---------- */}
      <section id="who-its-for" className="max-w-6xl mx-auto px-6 py-20">
        <RevealAward className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ letterSpacing: "-0.02em" }}>
            Who it&apos;s for
          </h2>
          <p className="mt-3 text-[15px]" style={{ color: "var(--ink-soft)" }}>
            If leads reach you before they reach a CRM, this is built for you.
          </p>
        </RevealAward>
        <div className="mt-10 grid sm:grid-cols-3 gap-5">
          {[
            { icon: <Home className="h-4 w-4" />, title: "The realtor", body: "Five open houses on Saturday. By Monday, three of those leads have already gone quiet in your inbox — FollowUp tells you which one to call first." },
            { icon: <Briefcase className="h-4 w-4" />, title: "The freelance consultant", body: "One inbox, a dozen open conversations, and no time to triage them by hand. FollowUp turns “I’ll get to it” into a short list you actually get to." },
            { icon: <Building2 className="h-4 w-4" />, title: "The 4-person agency", body: "You're doing client work and new business at the same time. FollowUp watches the pipeline in the background so nothing slips between calls." },
          ].map((item, i) => (
            <RevealAward key={item.title} delayMs={i * 80}>
              <IconCard icon={item.icon} title={item.title} body={item.body} />
            </RevealAward>
          ))}
        </div>
      </section>

      {/* ---------- Why not just a CRM reminder ---------- */}
      <section style={{ background: "var(--paper-2)" }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <RevealAward className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ letterSpacing: "-0.02em" }}>
              Why not just set a CRM reminder?
            </h2>
            <p className="mt-3 text-[15px]" style={{ color: "var(--ink-soft)" }}>
              A reminder tells you it&apos;s time. It doesn&apos;t tell you why, or what to say.
            </p>
          </RevealAward>
          <div className="mt-10 grid sm:grid-cols-3 gap-5">
            {[
              { icon: <Eye className="h-4 w-4" />, title: "Scores you can see through", body: "Every urgency score comes with the reason behind it — the exact conversation detail that raised or lowered it. Never a black-box number." },
              { icon: <PenLine className="h-4 w-4" />, title: "Drafts that sound like you", body: "Follow-ups are drafted from how you actually write to that lead, not generic AI boilerplate you have to rewrite before sending." },
              { icon: <BellOff className="h-4 w-4" />, title: "No nagging about handled leads", body: "Closed the deal on a call? Mark it handled and FollowUp stops reminding you — it never assumes the inbox is the whole story." },
            ].map((item, i) => (
              <RevealAward key={item.title} delayMs={i * 80}>
                <IconCard icon={item.icon} title={item.title} body={item.body} alt />
              </RevealAward>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Team + pipeline ---------- */}
      <section>
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-10">
            <RevealAward>
              <Users className="h-5 w-5" style={{ color: "var(--accent-deep)" }} />
              <h3 className="text-2xl font-extrabold mt-3" style={{ letterSpacing: "-0.02em" }}>
                Works for a team, not just you
              </h3>
              <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                See who on your team has overdue follow-ups, how much revenue each person is
                sitting on, and which deals are at risk — without a single status meeting.
              </p>
            </RevealAward>
            <RevealAward delayMs={90}>
              <TrendingUp className="h-5 w-5" style={{ color: "var(--accent-deep)" }} />
              <h3 className="text-2xl font-extrabold mt-3" style={{ letterSpacing: "-0.02em" }}>
                A pipeline you can actually see
              </h3>
              <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                Total pipeline value, weighted by how likely each deal is to close, plus a weekly
                report on what&apos;s working and what&apos;s slipping.
              </p>
            </RevealAward>
          </div>

          <RevealAward delayMs={140}>
            <div className={styles.card}>
              <p className="text-xs font-semibold mb-3" style={{ color: "var(--ink-soft)" }}>
                Team pipeline
              </p>
              <div className="space-y-2">
                {[
                  { name: "Sarah Johnson", owner: "You", status: "On track", color: "var(--success)" },
                  { name: "Mike Patel", owner: "You", status: "At risk", color: "var(--ink-faint)" },
                  { name: "Devon Ruiz", owner: "Alex", status: "Stuck", color: "var(--coral)" },
                  { name: "Priya Shah", owner: "Alex", status: "On track", color: "var(--success)" },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                    style={{ border: "1px solid var(--line)" }}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: row.color }} />
                    <span className="text-sm font-semibold flex-1 min-w-0 truncate">{row.name}</span>
                    <span className="text-xs hidden sm:inline" style={{ color: "var(--ink-soft)" }}>
                      {row.owner}
                    </span>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold shrink-0"
                      style={{ background: row.color, color: "#fff" }}
                    >
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </RevealAward>
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-24">
        <RevealAward>
          <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ letterSpacing: "-0.02em" }}>
            Pricing
          </h2>
          <p className="mt-2 text-[15px]" style={{ color: "var(--ink-soft)" }}>
            One plan. Everything included. 14-day free trial, no credit card required. Cancel any time.
          </p>
          <div className="mt-10 max-w-sm">
            <div className={styles.pricingCard}>
              <p className="text-sm font-bold">FollowUp</p>
              <p className={styles.priceGiant}>
                $29<span style={{ fontSize: "0.4em", color: "var(--ink-soft)", fontWeight: 600 }}>/mo</span>
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
                For freelancers, consultants, and small teams
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  "Unlimited leads and conversations",
                  "AI scoring & drafted follow-ups",
                  "Manual entry + CSV import",
                  "Analytics & weekly reports",
                  "Automated follow-up on by default, safely — full autonomy is opt-in per lead",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signin"
                className="mt-6 flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold transition-transform hover:scale-[1.02]"
                style={{ background: "var(--accent)", color: "var(--on-accent)" }}
              >
                Get started <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <p className="mt-3 text-center text-[11px]" style={{ color: "var(--ink-soft)" }}>
                Free for 14 days. No credit card required to start.
              </p>
            </div>
            <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--ink-faint)" }}>
              No seats, no per-message credits, no &ldquo;AI add-on&rdquo; — what costs $150–$500/mo
              elsewhere is included here.
            </p>
          </div>
        </RevealAward>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" style={{ background: "var(--paper-2)" }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <RevealAward>
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ letterSpacing: "-0.02em" }}>
              Questions
            </h2>
          </RevealAward>
          <RevealAward delayMs={80} className="mt-8 max-w-2xl">
            <LandingFaqAward
              items={[
                {
                  q: "Will FollowUp send emails without my permission?",
                  a: "By default, FollowUp only sends a low-risk, on-topic follow-up on its own — never anything about price, terms, or a sensitive reply, and never once the lead has already answered you. Anything riskier is held for your approval. You can set any lead to fully autonomous or fully manual at any time.",
                },
                {
                  q: "Is this another CRM I have to fill out?",
                  a: "No — FollowUp reads the conversations you're already having (Gmail, Outlook, SMS, Instagram, and more). There's nothing to manually log.",
                },
                {
                  q: "What if I don't connect Gmail right away?",
                  a: "You can sign in and look around right away — the dashboard just stays empty until you connect Gmail and sync.",
                },
              ]}
            />
          </RevealAward>
        </div>
      </section>

      {/* ---------- Closing CTA ---------- */}
      <div className={styles.closing}>
        <div className="max-w-6xl mx-auto px-6 py-28 text-center">
          <RevealAward>
            <span className={styles.eyebrow} style={{ color: "rgba(255,255,255,0.55)" }}>
              Last call
            </span>
            <h2
              className="mt-4 max-w-xl mx-auto text-3xl sm:text-5xl font-extrabold"
              style={{ letterSpacing: "-0.02em", color: "#fff" }}
            >
              Your next lost sale is sitting in your inbox right now.
            </h2>
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 mt-8 rounded-full px-6 py-3.5 text-[15px] font-bold transition-transform hover:scale-[1.05]"
              style={{ background: "#fff", color: "var(--accent-deep)" }}
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </RevealAward>
        </div>
      </div>

      <footer className="py-8 text-center text-xs" style={{ color: "var(--ink-faint)" }}>
        <p>FollowUp — built to make sure no lead gets forgotten.</p>
        <p className="mt-2">
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>
        </p>
      </footer>
    </div>
  );
}

// Bordered card, accent-tinted icon chip. `alt` swaps the card fill for
// the alternating section background it sits on so it stays legible
// against either page background.
function IconCard({
  icon,
  title,
  body,
  alt,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  alt?: boolean;
}) {
  return (
    <div className={`${styles.card} ${alt ? styles.cardAlt : ""}`}>
      <div className={styles.iconChip}>{icon}</div>
      <h4 className="font-bold mt-3 text-[15px]">{title}</h4>
      <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        {body}
      </p>
    </div>
  );
}
