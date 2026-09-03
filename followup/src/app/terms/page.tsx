import Link from "next/link";
import { Compass } from "lucide-react";

export const metadata = {
  title: "Terms of Service — FollowUp",
};

export default function TermsPage() {
  return (
    <div>
      <header className="border-b border-line">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Compass className="h-5 w-5" style={{ color: "var(--rust)" }} />
            <span className="font-display text-lg">FollowUp</span>
          </Link>
          <Link href="/" className="text-sm text-ink-soft">
            Back home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-display text-3xl">Terms of Service</h1>
        <p className="text-sm text-ink-soft mt-2">Last updated: September 2, 2026</p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-ink-soft">
          <section>
            <h2 className="font-display text-lg text-ink">1. Agreement</h2>
            <p className="mt-2">
              By creating an account or using FollowUp (&quot;the Service&quot;), you agree to these terms. If
              you&apos;re using FollowUp on behalf of a company, you&apos;re confirming you have the authority
              to bind that company to these terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">2. What FollowUp does</h2>
            <p className="mt-2">
              FollowUp connects to your Gmail account (with your permission) to identify sales conversations,
              score them using AI, and draft follow-up messages. Messages are only sent with your approval,
              unless you explicitly opt a specific lead into automated sending — see our{" "}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>{" "}
              for details on how that works and what data is involved.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">3. Your account</h2>
            <p className="mt-2">
              You&apos;re responsible for keeping your account credentials secure and for all activity under
              your account. You must provide accurate information and keep it up to date.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">4. Acceptable use</h2>
            <p className="mt-2">You agree not to use FollowUp to:</p>
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li>Send spam, unsolicited bulk email, or content that violates anti-spam law (e.g. CAN-SPAM).</li>
              <li>Send content that&apos;s illegal, harassing, fraudulent, or infringes someone else&apos;s rights.</li>
              <li>Attempt to gain unauthorized access to FollowUp&apos;s systems or another user&apos;s account.</li>
              <li>Reverse-engineer or resell the Service without our written permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">5. AI-generated content</h2>
            <p className="mt-2">
              FollowUp uses AI to score leads and draft messages. AI output can be wrong or inappropriate —
              you&apos;re responsible for reviewing and approving anything sent under your name (or for the
              consequences of turning on automated sending for a lead, if you choose to).
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">6. Billing</h2>
            <p className="mt-2">
              Paid plans are billed on a recurring basis through Stripe. You can cancel at any time from
              Settings; your subscription remains active until the end of the current billing period. Fees
              are non-refundable except where required by law.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">7. Termination</h2>
            <p className="mt-2">
              You can stop using FollowUp and delete your account at any time. We may suspend or terminate
              your access if you violate these terms, and will make reasonable efforts to notify you first
              except where immediate action is needed (e.g. abuse or security risk).
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">8. Disclaimer &amp; limitation of liability</h2>
            <p className="mt-2">
              FollowUp is provided &quot;as is&quot; without warranties of any kind. We&apos;re not liable for
              indirect, incidental, or consequential damages, including lost revenue or lost deals, arising
              from your use of the Service, to the maximum extent permitted by law.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">9. Changes</h2>
            <p className="mt-2">
              We may update these terms from time to time. Material changes will be communicated by email or
              an in-app notice before they take effect.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">10. Contact</h2>
            <p className="mt-2">
              Questions about these terms:{" "}
              <a href="mailto:work.sahilca@gmail.com" className="underline">
                work.sahilca@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-line py-8 text-center text-xs text-ink-soft">
        <Link href="/" className="underline">
          FollowUp
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
      </footer>
    </div>
  );
}
