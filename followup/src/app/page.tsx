import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
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
  Sparkles,
} from "lucide-react";
import styles from "./landing.module.css";
import LandingNav from "@/components/landing/LandingNav";
import HeroMockup from "@/components/landing/HeroMockup";
import Reveal from "@/components/landing/Reveal";
import LandingFaq from "@/components/landing/LandingFaq";
import CountUp from "@/components/motion/CountUp";

// Loaded here rather than the root layout so it stays scoped to this one
// page's own class tree (applied via plusJakarta.variable below on the
// landing wrapper) — the authenticated app keeps Inter/Space Grotesk from
// layout.tsx untouched.
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

// Same content this page has always had — restyled into the new warm
// editorial palette/typography/3D-mockup treatment, not rewritten. Only
// the visual system changed; see the PR description for the couple of
// deliberate content edits kept from the earlier pass (real /signin CTA,
// no fabricated stats) — everything else below is the same copy that was
// already live.
export default function LandingPage() {
  return (
    <div className={`${styles.root} ${plusJakarta.variable}`} style={{ fontFamily: "var(--font-plus-jakarta), sans-serif" }}>
      <LandingNav />
      <div className={styles.gridTexture} />

      {/* ---------- Hero ---------- */}
      <section className="relative max-w-6xl mx-auto px-6 pt-40 pb-24 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <Reveal>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ border: "1px solid rgba(24,20,15,0.15)", color: "var(--ink-soft)" }}
            >
              <Sparkles className="h-3 w-3" style={{ color: "var(--amber)" }} /> AI-native, not AI-bolted-on
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1
              className="mt-5"
              style={{
                fontWeight: 800,
                fontSize: "clamp(34px, 4.2vw, 52px)",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                color: "var(--ink)",
              }}
            >
              Every tool answers the lead. FollowUp catches the one that{" "}
              <span className={styles.shimmer}>went quiet</span>.
            </h1>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-6 text-[16px] leading-relaxed max-w-md" style={{ color: "var(--ink-soft)" }}>
              FollowUp reads every conversation, not just the new ones — and notices the lead who
              already heard from you once, then went silent, before &ldquo;let me think about
              it&rdquo; turns into a lost sale.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-bold transition-transform hover:scale-[1.03]"
                style={{ background: "var(--amber)", color: "#241a08", boxShadow: "0 16px 32px -14px rgba(232,162,58,0.65)" }}
              >
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how-it-works"
                className="rounded-full px-5 py-3 text-[14px] font-semibold transition-opacity hover:opacity-70"
                style={{ border: "1px solid rgba(24,20,15,0.15)", color: "var(--ink)" }}
              >
                See how it works
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.26}>
            <div className="mt-9 flex items-center gap-4">
              <p style={{ fontWeight: 800, fontSize: 34, letterSpacing: "-0.02em", color: "var(--ink)" }} className="shrink-0">
                <CountUp to={21} suffix="×" />
              </p>
              <p className="text-xs leading-relaxed max-w-[15rem]" style={{ color: "var(--ink-soft)" }}>
                higher conversion when a lead is contacted within 5 minutes instead of after 30 —
                no credit card required to see it for yourself.
              </p>
            </div>
          </Reveal>
        </div>

        <div className="relative flex justify-center lg:justify-end pt-8 lg:pt-0">
          <HeroMockup />
        </div>
      </section>

      {/* ---------- Reads what you already use ---------- */}
      <section className="max-w-6xl mx-auto px-6 pb-16 text-center">
        <p className="text-xs font-bold uppercase" style={{ letterSpacing: "0.14em", color: "var(--ink-soft)" }}>
          Reads what you already use
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {["Gmail", "Outlook", "Twilio", "Instagram", "Stripe"].map((name) => (
            <span
              key={name}
              className="text-sm font-bold rounded-lg px-4 py-2"
              style={{ background: "var(--surface)", border: "1px solid rgba(24,20,15,0.1)", color: "var(--ink)" }}
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* ---------- The gap (problem) ---------- */}
      <section style={{ background: "var(--surface)" }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <Reveal className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ letterSpacing: "-0.02em" }}>
              The gap between having leads and knowing who needs you
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              CRMs store leads, deals, and notes. Email tools help you write messages. Automation
              tools send sequences. But none of them answer the one question that actually loses
              you money:
            </p>
            <p
              className="mt-6 pl-5 text-2xl sm:text-3xl font-extrabold leading-snug"
              style={{ borderLeft: "3px solid var(--amber)", color: "var(--ink)" }}
            >
              &ldquo;Which lead am I about to lose because I haven&apos;t followed up?&rdquo;
            </p>
            <p className="mt-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              FollowUp sits on top of your existing inbox and turns messy conversations into a
              short, prioritized list of who to contact today — without asking you to maintain
              another system.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------- Positioning ---------- */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Reveal className="max-w-2xl">
          <span className="text-xs font-bold uppercase" style={{ color: "var(--amber)", letterSpacing: "0.14em" }}>
            Why FollowUp exists
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold" style={{ letterSpacing: "-0.02em" }}>
            You don&apos;t have a lead-generation problem. You have a lead-conversion problem.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            Most tools stop the moment a name and an email land in your inbox. The deal is
            actually lost or won in the weeks after that — the follow-up nobody sent, the
            question that sat unanswered for four days, the lead that quietly went cold while you
            were busy closing someone else.
          </p>
        </Reveal>

        <Reveal delay={0.1} className={`mt-10 grid sm:grid-cols-2 ${styles.compareGrid}`}>
          <div className="p-6 sm:p-7">
            <p className="text-xs font-bold uppercase" style={{ letterSpacing: "0.1em", color: "var(--ink-soft)" }}>
              Lead generation tools
            </p>
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
            style={{ borderTop: "1px solid rgba(24,20,15,0.1)", borderLeft: "3px solid var(--amber)" }}
          >
            <p className="text-xs font-bold uppercase" style={{ letterSpacing: "0.1em", color: "var(--amber)" }}>
              FollowUp
            </p>
            <ul className="mt-4 space-y-3 text-sm" style={{ color: "var(--ink)" }}>
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--amber)" }} /> Reads what
                happens after the lead exists
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--amber)" }} /> Flags exactly
                who&apos;s about to go cold, and why
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--amber)" }} /> Drafts the
                message that keeps the conversation alive
              </li>
            </ul>
          </div>
        </Reveal>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ letterSpacing: "-0.02em" }}>
            How it works
          </h2>
        </Reveal>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: <Mail className="h-4 w-4" />, title: "Connect your inbox", body: "FollowUp reads your sales conversations in Gmail — nothing else." },
            { icon: <TrendingUp className="h-4 w-4" />, title: "It scores every lead", body: "Buying intent, response gaps, and deal value become a single follow-up score." },
            { icon: <Clock className="h-4 w-4" />, title: "You get a daily list", body: "A short, ranked list of who needs you today, and why — not a full CRM to dig through." },
            { icon: <Sparkles className="h-4 w-4" />, title: "It drafts the message", body: "Edit, regenerate, or send — or turn on automation once you trust it." },
          ].map((item, i) => (
            <Reveal key={item.title} delay={i * 0.08}>
              <IconCard icon={item.icon} title={item.title} body={item.body} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Who it's for ---------- */}
      <section id="who-its-for" className="max-w-6xl mx-auto px-6 py-20">
        <Reveal className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ letterSpacing: "-0.02em" }}>
            Who it&apos;s for
          </h2>
          <p className="mt-3 text-[15px]" style={{ color: "var(--ink-soft)" }}>
            If leads reach you before they reach a CRM, this is built for you.
          </p>
        </Reveal>
        <div className="mt-10 grid sm:grid-cols-3 gap-5">
          {[
            { icon: <Home className="h-4 w-4" />, title: "The realtor", body: "Five open houses on Saturday. By Monday, three of those leads have already gone quiet in your inbox — FollowUp tells you which one to call first." },
            { icon: <Briefcase className="h-4 w-4" />, title: "The freelance consultant", body: "One inbox, a dozen open conversations, and no time to triage them by hand. FollowUp turns “I’ll get to it” into a short list you actually get to." },
            { icon: <Building2 className="h-4 w-4" />, title: "The 4-person agency", body: "You're doing client work and new business at the same time. FollowUp watches the pipeline in the background so nothing slips between calls." },
          ].map((item, i) => (
            <Reveal key={item.title} delay={i * 0.08}>
              <IconCard icon={item.icon} title={item.title} body={item.body} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Why not just a CRM reminder ---------- */}
      <section style={{ background: "var(--surface)" }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <Reveal className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ letterSpacing: "-0.02em" }}>
              Why not just set a CRM reminder?
            </h2>
            <p className="mt-3 text-[15px]" style={{ color: "var(--ink-soft)" }}>
              A reminder tells you it&apos;s time. It doesn&apos;t tell you why, or what to say.
            </p>
          </Reveal>
          <div className="mt-10 grid sm:grid-cols-3 gap-5">
            {[
              { icon: <Eye className="h-4 w-4" />, title: "Scores you can see through", body: "Every urgency score comes with the reason behind it — the exact conversation detail that raised or lowered it. Never a black-box number." },
              { icon: <PenLine className="h-4 w-4" />, title: "Drafts that sound like you", body: "Follow-ups are drafted from how you actually write to that lead, not generic AI boilerplate you have to rewrite before sending." },
              { icon: <BellOff className="h-4 w-4" />, title: "No nagging about handled leads", body: "Closed the deal on a call? Mark it handled and FollowUp stops reminding you — it never assumes the inbox is the whole story." },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.08}>
                <IconCard icon={item.icon} title={item.title} body={item.body} surface />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Team + analytics ---------- */}
      <section>
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-10">
            <Reveal>
              <Users className="h-5 w-5" style={{ color: "var(--ink-soft)" }} />
              <h3 className="text-2xl font-extrabold mt-3" style={{ letterSpacing: "-0.02em" }}>
                Works for a team, not just you
              </h3>
              <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                See who on your team has overdue follow-ups, how much revenue each person is
                sitting on, and which deals are at risk — without a single status meeting.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <TrendingUp className="h-5 w-5" style={{ color: "var(--ink-soft)" }} />
              <h3 className="text-2xl font-extrabold mt-3" style={{ letterSpacing: "-0.02em" }}>
                A pipeline you can actually see
              </h3>
              <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                Total pipeline value, weighted by how likely each deal is to close, plus a weekly
                report on what&apos;s working and what&apos;s slipping.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <div
              className="rounded-2xl p-5"
              style={{ background: "var(--surface)", boxShadow: "0 30px 60px -32px rgba(24,20,15,0.35)" }}
            >
              <p className="text-xs font-semibold mb-3" style={{ color: "var(--ink-soft)" }}>
                Team pipeline
              </p>
              <div className="space-y-2">
                {[
                  { name: "Sarah Johnson", owner: "You", status: "On track", color: "#16a34a" },
                  { name: "Mike Patel", owner: "You", status: "At risk", color: "#8a8371" },
                  { name: "Devon Ruiz", owner: "Alex", status: "Stuck", color: "var(--coral)" },
                  { name: "Priya Shah", owner: "Alex", status: "On track", color: "#16a34a" },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                    style={{ border: "1px solid rgba(24,20,15,0.08)" }}
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
          </Reveal>
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-24">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ letterSpacing: "-0.02em" }}>
            Pricing
          </h2>
          <p className="mt-2 text-[15px]" style={{ color: "var(--ink-soft)" }}>
            One plan. Everything included. Cancel any time.
          </p>
          <div className="mt-10 max-w-sm">
            <div
              className="rounded-2xl p-6"
              style={{ background: "var(--surface)", boxShadow: "0 30px 60px -32px rgba(24,20,15,0.35)" }}
            >
              <p className="text-sm font-bold">FollowUp</p>
              <p className={styles.priceGiant} style={{ fontSize: 44, marginTop: 4 }}>
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
                  "Automation (opt-in per lead)",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--amber)" }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signin"
                className="mt-6 flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold transition-transform hover:scale-[1.02]"
                style={{ background: "var(--amber)", color: "#241a08", boxShadow: "0 14px 28px -12px rgba(232,162,58,0.6)" }}
              >
                Get started <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" style={{ background: "var(--surface)" }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ letterSpacing: "-0.02em" }}>
              Questions
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="mt-8 max-w-2xl">
            <LandingFaq
              items={[
                {
                  q: "Will FollowUp send emails without my permission?",
                  a: "No. Every AI-drafted message needs your approval unless you explicitly turn on automation for a specific lead — and even then, automation stops the instant that lead replies to you.",
                },
                {
                  q: "Is this another CRM I have to fill out?",
                  a: "No — FollowUp reads your existing Gmail conversations. There's nothing to manually log.",
                },
                {
                  q: "What if I don't connect Gmail right away?",
                  a: "You can sign in and look around right away — the dashboard just stays empty until you connect Gmail and sync.",
                },
              ]}
            />
          </Reveal>
        </div>
      </section>

      {/* ---------- Closing CTA ---------- */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <Reveal>
            <h2
              className="max-w-xl mx-auto text-3xl sm:text-5xl font-extrabold"
              style={{ letterSpacing: "-0.02em", textWrap: "balance" }}
            >
              Your next lost sale is sitting in your inbox right now.
            </h2>
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 mt-7 rounded-full px-6 py-3.5 text-[15px] font-bold transition-transform hover:scale-[1.05]"
              style={{ background: "var(--amber)", color: "#241a08", boxShadow: "0 16px 32px -14px rgba(232,162,58,0.65)" }}
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="py-8 text-center text-xs" style={{ color: "var(--ink-soft)" }}>
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

// Bordered card, neutral icon chip — matches the original Step
// component's language (icon chip + title + body), restyled with the new
// tokens. `surface` swaps the card fill for the alternating section
// background it sits on (bg-card equivalent) so it stays legible against
// either page background.
function IconCard({
  icon,
  title,
  body,
  surface,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  surface?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-5 transition-transform hover:-translate-y-0.5"
      style={{
        background: surface ? "var(--cream)" : "var(--surface)",
        border: "1px solid rgba(24,20,15,0.08)",
      }}
    >
      <div
        className="h-9 w-9 rounded-lg flex items-center justify-center"
        style={{ border: "1px solid rgba(24,20,15,0.12)", color: "var(--ink-soft)" }}
      >
        {icon}
      </div>
      <h4 className="font-bold mt-3 text-[15px]">{title}</h4>
      <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        {body}
      </p>
    </div>
  );
}
