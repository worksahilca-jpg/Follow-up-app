import Link from "next/link";
import { Sparkles, Zap, Mail, Clock, TrendingUp, Users, Check } from "lucide-react";

export default function LandingPage() {
  return (
    <div>
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" style={{ color: "var(--rust)" }} />
            <span className="font-display text-lg">FollowUp</span>
          </div>
          <nav className="hidden sm:flex items-center gap-8 text-sm text-ink-soft">
            <a href="#how-it-works">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <Link
            href="/signin"
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl leading-[1.1]">
            Never lose a lead because you forgot to follow up.
          </h1>
          <p className="mt-5 text-lg text-ink-soft leading-relaxed max-w-md">
            FollowUp is the AI teammate that reads your sales conversations and tells
            you exactly who to contact today, why, and what to say — before that
            &quot;let me think about it&quot; turns into a lost sale.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/signin"
              className="rounded-lg px-5 py-3 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--rust)" }}
            >
              Get started
            </Link>
            <a href="#how-it-works" className="rounded-lg border border-line px-5 py-3 text-sm font-medium">
              See how it works
            </a>
          </div>
          <p className="mt-4 text-xs text-ink-soft">No credit card required to sign up.</p>
        </div>

        {/* Live-looking follow-up card mockup */}
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <p className="text-xs text-ink-soft mb-3">Today&apos;s follow-ups</p>
          <div className="rounded-xl border border-line p-4">
            <div className="flex items-start gap-3">
              <div
                className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                style={{ backgroundColor: "var(--rust-soft)", color: "var(--rust)" }}
              >
                92
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-display text-base">Sarah Johnson</p>
                  <span className="text-sm font-medium" style={{ color: "var(--gold)" }}>$3,500</span>
                </div>
                <p className="text-xs text-ink-soft">ABC Marketing</p>
                <p className="text-xs mt-2 text-ink-soft leading-relaxed">
                  Asked about pricing, opened your proposal twice, no reply in 5 days.
                </p>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}>
                    Send email
                  </span>
                  <span className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium">Snooze</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-line p-4 opacity-60">
            <div className="flex items-center gap-3">
              <div
                className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
              >
                68
              </div>
              <div>
                <p className="font-display text-base">Mike Patel</p>
                <p className="text-xs text-ink-soft">Requested a proposal 3 days ago</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-line">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl">The gap between having leads and knowing who needs you</h2>
          <p className="mt-4 text-ink-soft leading-relaxed">
            CRMs store leads, deals, and notes. Email tools help you write messages.
            Automation tools send sequences. But none of them answer the one question
            that actually loses you money:
          </p>
          <p className="mt-4 font-display text-xl italic">
            &quot;Which lead am I about to lose because I haven&apos;t followed up?&quot;
          </p>
          <p className="mt-4 text-ink-soft leading-relaxed">
            FollowUp sits on top of your existing inbox and turns messy conversations
            into a short, prioritized list of who to contact today — without asking you
            to maintain another system.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-16 border-t border-line">
        <h2 className="font-display text-3xl">How it works</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Step
            icon={<Mail className="h-4 w-4" />}
            title="Connect your inbox"
            body="FollowUp reads your sales conversations in Gmail — nothing else."
          />
          <Step
            icon={<TrendingUp className="h-4 w-4" />}
            title="It scores every lead"
            body="Buying intent, response gaps, and deal value become a single follow-up score."
          />
          <Step
            icon={<Clock className="h-4 w-4" />}
            title="You get a daily list"
            body="A short, ranked list of who needs you today, and why — not a full CRM to dig through."
          />
          <Step
            icon={<Sparkles className="h-4 w-4" />}
            title="It drafts the message"
            body="Edit, regenerate, or send — or turn on automation once you trust it."
          />
        </div>
      </section>

      {/* Team + analytics */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-line grid md:grid-cols-2 gap-10">
        <div>
          <Users className="h-5 w-5" style={{ color: "var(--slate)" }} />
          <h3 className="font-display text-2xl mt-3">Works for a team, not just you</h3>
          <p className="mt-2 text-ink-soft leading-relaxed">
            See who on your team has overdue follow-ups, how much revenue each person
            is sitting on, and which deals are at risk — without a single status meeting.
          </p>
        </div>
        <div>
          <TrendingUp className="h-5 w-5" style={{ color: "var(--gold)" }} />
          <h3 className="font-display text-2xl mt-3">A pipeline you can actually see</h3>
          <p className="mt-2 text-ink-soft leading-relaxed">
            Total pipeline value, weighted by how likely each deal is to close, plus a
            weekly report on what&apos;s working and what&apos;s slipping.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-16 border-t border-line">
        <h2 className="font-display text-3xl">Pricing</h2>
        <p className="mt-2 text-ink-soft">One plan. Everything included. Cancel any time.</p>
        <div className="mt-8 max-w-sm">
          <PriceCard
            name="FollowUp"
            price="$29"
            tagline="For freelancers, consultants, and small teams"
            features={[
              "Unlimited leads and conversations",
              "AI scoring & drafted follow-ups",
              "Manual entry + CSV import",
              "Analytics & weekly reports",
              "Automation (opt-in per lead)",
            ]}
            highlight
          />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-6xl mx-auto px-6 py-16 border-t border-line">
        <h2 className="font-display text-3xl">Questions</h2>
        <div className="mt-8 max-w-2xl divide-y divide-line">
          <Faq
            q="Will FollowUp send emails without my permission?"
            a="No. Every AI-drafted message needs your approval unless you explicitly turn on automation for a specific lead."
          />
          <Faq
            q="Is this another CRM I have to fill out?"
            a="No — FollowUp reads your existing Gmail conversations. There's nothing to manually log."
          />
          <Faq
            q="What if I don't connect Gmail right away?"
            a="You can sign in and look around right away — the dashboard just stays empty until you connect Gmail and sync."
          />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-line text-center">
        <h2 className="font-display text-3xl max-w-lg mx-auto">
          Your next lost sale is sitting in your inbox right now.
        </h2>
        <Link
          href="/signin"
          className="inline-block mt-6 rounded-lg px-6 py-3 text-sm font-medium text-white"
          style={{ backgroundColor: "var(--rust)" }}
        >
          Get started
        </Link>
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-ink-soft">
        FollowUp — built to make sure no lead gets forgotten.
      </footer>
    </div>
  );
}

function Step({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--rust-soft)", color: "var(--rust)" }}>
        {icon}
      </div>
      <h4 className="font-medium mt-3">{title}</h4>
      <p className="text-sm text-ink-soft mt-1 leading-relaxed">{body}</p>
    </div>
  );
}

function PriceCard({
  name,
  price,
  tagline,
  features,
  highlight,
}: {
  name: string;
  price: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ border: highlight ? "2px solid var(--rust)" : "1px solid var(--line)", backgroundColor: "var(--card)" }}
    >
      <p className="text-sm font-semibold">{name}</p>
      <p className="font-display text-3xl mt-1">
        {price}
        <span className="text-sm text-ink-soft font-body">/mo</span>
      </p>
      <p className="text-xs text-ink-soft mt-1">{tagline}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5" style={{ color: "var(--sage)" }} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="py-4">
      <p className="font-medium">{q}</p>
      <p className="text-sm text-ink-soft mt-1 leading-relaxed">{a}</p>
    </div>
  );
}
