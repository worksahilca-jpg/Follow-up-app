import Link from "next/link";
import {
  Sparkles,
  Compass,
  Mail,
  Clock,
  TrendingUp,
  Users,
  Check,
  ArrowRight,
  Home,
  Briefcase,
  Building2,
  Eye,
  PenLine,
  BellOff,
} from "lucide-react";
import FadeIn from "@/components/motion/FadeIn";
import FaqAccordion from "@/components/FaqAccordion";

export default function LandingPage() {
  return (
    <div>
      {/* Sticky + translucent rather than a plain solid bar — the header
          stays legible over whatever scrolls under it without needing a
          scroll listener to toggle a class. */}
      <header
        className="sticky top-0 z-50 border-b border-line backdrop-blur-md"
        style={{ backgroundColor: "color-mix(in srgb, var(--paper) 82%, transparent)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5" style={{ color: "var(--rust)" }} />
            <span className="font-display text-lg">FollowUp</span>
          </div>
          <nav className="hidden sm:flex items-center gap-8 text-sm text-ink-soft">
            <a href="#how-it-works" className="hover:text-ink transition-colors">How it works</a>
            <a href="#who-its-for" className="hover:text-ink transition-colors">Who it&apos;s for</a>
            <a href="#pricing" className="hover:text-ink transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-ink transition-colors">FAQ</a>
          </nav>
          <Link
            href="/signin"
            className="rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-12 items-center">
        <FadeIn>
          {/* Neutral bordered chip, not a violet badge — violet stays on
              buttons/links/focus states only, nowhere decorative. */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-soft">
            <Sparkles className="h-3 w-3" /> AI-native, not AI-bolted-on
          </span>
          <h1 className="font-display text-5xl sm:text-6xl leading-[1.05] mt-5" style={{ letterSpacing: "-0.02em" }}>
            Never lose a lead because you forgot to follow up.
          </h1>
          <p className="mt-6 text-lg text-ink-soft leading-relaxed max-w-md">
            FollowUp is the AI teammate that reads your sales conversations and tells
            you exactly who to contact today, why, and what to say — before that
            &quot;let me think about it&quot; turns into a lost sale.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            {/* The one element on the page allowed a little more weight than
                "restrained" — this is the entire point of the hero, so it
                earns a glow and some heft that nothing else on the page gets. */}
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold transition-transform hover:scale-[1.05]"
              style={{
                backgroundColor: "var(--rust)",
                color: "var(--on-accent)",
                boxShadow: "0 12px 28px -10px color-mix(in srgb, var(--rust) 55%, transparent)",
              }}
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how-it-works" className="rounded-full border border-line px-5 py-3 text-sm font-medium transition-colors hover:bg-card">
              See how it works
            </a>
          </div>
          {/* Credibility line — a cited stat rather than a fabricated customer
              count or logo wall, which the app doesn't have yet and shouldn't
              pretend to. Plain text, no color-coding — that's reserved for
              lead-urgency status pills only. */}
          <p className="mt-5 text-xs text-ink-soft">
            Leads contacted within 5 minutes convert up to 21&times; more than those contacted after 30.
          </p>
          <p className="mt-1.5 text-xs text-ink-soft">No credit card required to sign up.</p>
        </FadeIn>

        {/* Live-looking follow-up card mockup, framed like a real screenshot
            in a browser window rather than a bare panel. The window-chrome
            dots are neutral, not colored traffic lights — color on this
            page is reserved for the lead-urgency status pills below. */}
        <FadeIn delay={0.15}>
          <div
            className="rounded-2xl border border-line bg-card overflow-hidden"
            style={{ boxShadow: "0 24px 60px -24px rgba(0,0,0,0.18)" }}
          >
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-line">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--line)" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--line)" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--line)" }} />
            </div>
            <div className="p-5">
            <p className="text-xs text-ink-soft mb-3">Today&apos;s follow-ups</p>
            <div className="rounded-xl border border-line p-4">
              <div className="flex items-start gap-3">
                <div
                  className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                  style={{ backgroundColor: "var(--coral-soft)", color: "var(--coral)" }}
                >
                  92
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-base">Sarah Johnson</p>
                    <span className="text-sm font-semibold shrink-0">$3,500</span>
                  </div>
                  {/* Color-coded status pill — the one place on this page
                      color carries meaning (lead urgency), matching the
                      score badge above it. Nowhere else on the page uses
                      this coral/slate/sage system. */}
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-ink-soft">ABC Marketing</p>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-on-accent"
                      style={{ backgroundColor: "var(--coral)" }}
                    >
                      Hot lead
                    </span>
                  </div>
                  <p className="text-xs mt-2 text-ink-soft leading-relaxed">
                    Asked about pricing, opened your proposal twice, no reply in 5 days.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}>
                      Send email
                    </span>
                    <span className="rounded-full border border-line px-3 py-1.5 text-xs font-medium">Snooze</span>
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
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base">Mike Patel</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-ink-soft">Requested a proposal 3 days ago</p>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-on-accent shrink-0"
                      style={{ backgroundColor: "var(--slate)" }}
                    >
                      Warm
                    </span>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Problem — bg-card breaks the section apart from the hero without
          a hard rule line, same idea used through the rest of the page. */}
      <section className="bg-card">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <FadeIn className="max-w-2xl">
            <h2 className="font-display text-3xl sm:text-4xl" style={{ textWrap: "balance" }}>
              The gap between having leads and knowing who needs you
            </h2>
            <p className="mt-5 text-ink-soft leading-relaxed">
              CRMs store leads, deals, and notes. Email tools help you write messages.
              Automation tools send sequences. But none of them answer the one question
              that actually loses you money:
            </p>
            <p className="mt-5 font-display text-xl sm:text-2xl italic" style={{ textWrap: "balance" }}>
              &quot;Which lead am I about to lose because I haven&apos;t followed up?&quot;
            </p>
            <p className="mt-5 text-ink-soft leading-relaxed">
              FollowUp sits on top of your existing inbox and turns messy conversations
              into a short, prioritized list of who to contact today — without asking you
              to maintain another system.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20">
        <FadeIn>
          <h2 className="font-display text-3xl sm:text-4xl">How it works</h2>
        </FadeIn>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: <Mail className="h-4 w-4" />,
              title: "Connect your inbox",
              body: "FollowUp reads your sales conversations in Gmail — nothing else.",
            },
            {
              icon: <TrendingUp className="h-4 w-4" />,
              title: "It scores every lead",
              body: "Buying intent, response gaps, and deal value become a single follow-up score.",
            },
            {
              icon: <Clock className="h-4 w-4" />,
              title: "You get a daily list",
              body: "A short, ranked list of who needs you today, and why — not a full CRM to dig through.",
            },
            {
              icon: <Sparkles className="h-4 w-4" />,
              title: "It drafts the message",
              body: "Edit, regenerate, or send — or turn on automation once you trust it.",
            },
          ].map((step, i) => (
            <FadeIn key={step.title} delay={i * 0.1}>
              <Step icon={step.icon} title={step.title} body={step.body} />
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Use cases — makes the "wide range of visitors" framing concrete
          instead of leaving everyone to project themselves onto vague
          copy. Three real personas, same card language as How it works. */}
      <section id="who-its-for" className="max-w-6xl mx-auto px-6 py-20">
        <FadeIn className="max-w-2xl">
          <h2 className="font-display text-3xl sm:text-4xl">Who it&apos;s for</h2>
          <p className="mt-3 text-ink-soft">
            If leads reach you before they reach a CRM, this is built for you.
          </p>
        </FadeIn>
        <div className="mt-10 grid sm:grid-cols-3 gap-5">
          {[
            {
              icon: <Home className="h-4 w-4" />,
              title: "The realtor",
              body: "Five open houses on Saturday. By Monday, three of those leads have already gone quiet in your inbox — FollowUp tells you which one to call first.",
            },
            {
              icon: <Briefcase className="h-4 w-4" />,
              title: "The freelance consultant",
              body: "One inbox, a dozen open conversations, and no time to triage them by hand. FollowUp turns “I’ll get to it” into a short list you actually get to.",
            },
            {
              icon: <Building2 className="h-4 w-4" />,
              title: "The 4-person agency",
              body: "You're doing client work and new business at the same time. FollowUp watches the pipeline in the background so nothing slips between calls.",
            },
          ].map((item, i) => (
            <FadeIn key={item.title} delay={i * 0.1}>
              <Step icon={item.icon} title={item.title} body={item.body} />
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Differentiation — "not another CRM reminder", made specific
          instead of asserted. Same restrained icon-chip language as the
          other list sections, single accent, no color-coding. */}
      <section className="bg-card">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <FadeIn className="max-w-2xl">
            <h2 className="font-display text-3xl sm:text-4xl">Why not just set a CRM reminder?</h2>
            <p className="mt-3 text-ink-soft">
              A reminder tells you it&apos;s time. It doesn&apos;t tell you why, or what to say.
            </p>
          </FadeIn>
          <div className="mt-10 grid sm:grid-cols-3 gap-5">
            {[
              {
                icon: <Eye className="h-4 w-4" />,
                title: "Scores you can see through",
                body: "Every urgency score comes with the reason behind it — the exact conversation detail that raised or lowered it. Never a black-box number.",
              },
              {
                icon: <PenLine className="h-4 w-4" />,
                title: "Drafts that sound like you",
                body: "Follow-ups are drafted from how you actually write to that lead, not generic AI boilerplate you have to rewrite before sending.",
              },
              {
                icon: <BellOff className="h-4 w-4" />,
                title: "No nagging about handled leads",
                body: "Closed the deal on a call? Mark it handled and FollowUp stops reminding you — it never assumes the inbox is the whole story.",
              },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 0.1}>
                <Step icon={item.icon} title={item.title} body={item.body} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Team + analytics — plain background rather than bg-card here,
          since it now sits directly after the (also bg-card) Differentiation
          section; keeps the alternating rhythm instead of merging into one
          flat block. */}
      <section>
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-10">
            <FadeIn>
              <Users className="h-5 w-5 text-ink-soft" />
              <h3 className="font-display text-2xl mt-3">Works for a team, not just you</h3>
              <p className="mt-2 text-ink-soft leading-relaxed">
                See who on your team has overdue follow-ups, how much revenue each person
                is sitting on, and which deals are at risk — without a single status meeting.
              </p>
            </FadeIn>
            <FadeIn delay={0.1}>
              <TrendingUp className="h-5 w-5 text-ink-soft" />
              <h3 className="font-display text-2xl mt-3">A pipeline you can actually see</h3>
              <p className="mt-2 text-ink-soft leading-relaxed">
                Total pipeline value, weighted by how likely each deal is to close, plus a
                weekly report on what&apos;s working and what&apos;s slipping.
              </p>
            </FadeIn>
          </div>

          {/* Mini "board" mockup — rows of leads with a color-coded status
              chip per row, the specific thing that makes a Monday.com board
              readable from across the room. Same status-color language as
              the hero card above, just at board scale. */}
          <FadeIn delay={0.15}>
            <div className="rounded-2xl border border-line bg-card p-5" style={{ boxShadow: "0 20px 50px -28px rgba(0,0,0,0.35)" }}>
              <p className="text-xs text-ink-soft mb-3">Team pipeline</p>
              <div className="space-y-2">
                {[
                  { name: "Sarah Johnson", owner: "You", status: "On track", color: "var(--sage)" },
                  { name: "Mike Patel", owner: "You", status: "At risk", color: "var(--slate)" },
                  { name: "Devon Ruiz", owner: "Alex", status: "Stuck", color: "var(--coral)" },
                  { name: "Priya Shah", owner: "Alex", status: "On track", color: "var(--sage)" },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5"
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                    <span className="text-sm font-medium flex-1 min-w-0 truncate">{row.name}</span>
                    <span className="text-xs text-ink-soft hidden sm:inline">{row.owner}</span>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-on-accent shrink-0"
                      style={{ backgroundColor: row.color }}
                    >
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20">
        <FadeIn>
          <h2 className="font-display text-3xl sm:text-4xl">Pricing</h2>
          <p className="mt-2 text-ink-soft">One plan. Everything included. Cancel any time.</p>
          <div className="mt-10 max-w-sm">
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
        </FadeIn>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-card">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <FadeIn>
            <h2 className="font-display text-3xl sm:text-4xl">Questions</h2>
          </FadeIn>
          <FadeIn delay={0.1} className="mt-8 max-w-2xl">
            <FaqAccordion
              items={[
                {
                  q: "Will FollowUp send emails without my permission?",
                  a: "No. Every AI-drafted message needs your approval unless you explicitly turn on automation for a specific lead.",
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
          </FadeIn>
        </div>
      </section>

      {/* Closing CTA — plain page background, not a bold color band. The
          violet stays confined to the button itself, the page's final
          word coming from restraint rather than a splash of color. Plain
          (not bg-card) since FAQ right above it is already bg-card. */}
      <section>
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <FadeIn>
            <h2 className="font-display text-3xl sm:text-4xl max-w-lg mx-auto" style={{ textWrap: "balance" }}>
              Your next lost sale is sitting in your inbox right now.
            </h2>
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 mt-7 rounded-full px-6 py-3.5 text-base font-semibold transition-transform hover:scale-[1.05]"
              style={{
                backgroundColor: "var(--rust)",
                color: "var(--on-accent)",
                boxShadow: "0 12px 28px -10px color-mix(in srgb, var(--rust) 55%, transparent)",
              }}
            >
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </FadeIn>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-ink-soft">
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

// Bordered card, neutral icon chip — color-coding is reserved for the
// lead-urgency status pills, so this reads as black/white/gray like the
// rest of the page rather than reaching for the accent as decoration.
function Step({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="h-9 w-9 rounded-lg flex items-center justify-center border border-line text-ink-soft">
        {icon}
      </div>
      <h4 className="font-medium mt-3">{title}</h4>
      <p className="text-sm text-ink-soft mt-1 leading-relaxed">{body}</p>
    </div>
  );
}

// Same neutral card treatment as everything else on the page — no violet
// border or glow to mark this as "the" plan; with one plan on offer that
// distinction has no work to do anyway.
function PriceCard({
  name,
  price,
  tagline,
  features,
}: {
  name: string;
  price: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-6">
      <p className="text-sm font-semibold">{name}</p>
      <p className="font-display text-3xl mt-1">
        {price}
        <span className="text-sm text-ink-soft font-body">/mo</span>
      </p>
      <p className="text-xs text-ink-soft mt-1">{tagline}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-ink-soft" />
            {f}
          </li>
        ))}
      </ul>
      <Link
        href="/signin"
        className="mt-6 flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02]"
        style={{
          backgroundColor: "var(--rust)",
          color: "var(--on-accent)",
          boxShadow: "0 10px 22px -10px color-mix(in srgb, var(--rust) 50%, transparent)",
        }}
      >
        Get started <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
