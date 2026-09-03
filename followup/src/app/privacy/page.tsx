import Link from "next/link";
import { Compass } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — FollowUp",
};

// Static legal page — no auth, no DB, no client JS. Required for Google
// OAuth verification (the consent screen links here), so the Google API
// Services User Data Policy / Limited Use disclosure below uses Google's
// own required wording, not paraphrased.
export default function PrivacyPage() {
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
        <h1 className="font-display text-3xl">Privacy Policy</h1>
        <p className="text-sm text-ink-soft mt-2">Last updated: September 2, 2026</p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-ink-soft">
          <section>
            <h2 className="font-display text-lg text-ink">Who we are</h2>
            <p className="mt-2">
              FollowUp (&quot;FollowUp&quot;, &quot;we&quot;, &quot;us&quot;) provides an AI-assisted sales
              follow-up tool. This policy explains what data we collect, why, and how you can control it.
              Contact us at{" "}
              <a href="mailto:work.sahilca@gmail.com" className="underline">
                work.sahilca@gmail.com
              </a>{" "}
              with any questions.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">What we collect</h2>
            <ul className="mt-2 space-y-2 list-disc pl-5">
              <li>
                <strong className="text-ink">Account info</strong> — your name and email address from Google
                sign-in.
              </li>
              <li>
                <strong className="text-ink">Gmail data</strong> — with your explicit permission, we read
                recent inbox threads to identify sales conversations, and store the ones we identify as leads
                (sender, subject, message content, timestamps) so we can score them and draft follow-ups. We
                only ever send email on your behalf when you click Send, or when you&apos;ve explicitly turned
                on automated sending for a specific lead.
              </li>
              <li>
                <strong className="text-ink">Leads you add yourself</strong> — manually entered leads or ones
                imported via CSV.
              </li>
              <li>
                <strong className="text-ink">Billing info</strong> — handled entirely by Stripe; we never see
                or store your card details ourselves.
              </li>
              <li>
                <strong className="text-ink">Usage data</strong> — basic product analytics (pages visited,
                features used) to improve FollowUp.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">Google user data — Limited Use disclosure</h2>
            <p className="mt-2">
              FollowUp&apos;s use and transfer of information received from Google APIs adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. Specifically:
            </p>
            <ul className="mt-2 space-y-2 list-disc pl-5">
              <li>We only access the Gmail scopes needed to identify sales conversations and send follow-ups on your behalf.</li>
              <li>We never use Gmail data for advertising.</li>
              <li>We never allow humans to read Gmail data except: (a) with your explicit consent, (b) to investigate abuse or a security issue, or (c) to comply with the law.</li>
              <li>We never transfer Gmail data to third parties except our AI processing provider (to draft/score follow-ups on your behalf), or as required by law.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">How we use AI</h2>
            <p className="mt-2">
              To score leads and draft follow-up messages, relevant conversation text is sent to our AI
              provider (currently OpenAI) for processing. That provider does not use your data to train its
              models under our account terms with them. AI-drafted messages are never sent without your
              approval unless you&apos;ve explicitly opted a specific lead into automated sending.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">Data retention &amp; deletion</h2>
            <p className="mt-2">
              We keep your data for as long as your account is active. You can delete an individual lead (and
              its full conversation history) at any time from that lead&apos;s page. To delete your entire
              account and all associated data, email{" "}
              <a href="mailto:work.sahilca@gmail.com" className="underline">
                work.sahilca@gmail.com
              </a>{" "}
              — we&apos;ll confirm deletion within 2 business days. Revoking FollowUp&apos;s Gmail access at{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                myaccount.google.com/permissions
              </a>{" "}
              stops future access immediately; it doesn&apos;t delete data already stored — use the account
              deletion request above for that.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">Third parties we use</h2>
            <ul className="mt-2 space-y-2 list-disc pl-5">
              <li><strong className="text-ink">Google</strong> — sign-in and Gmail access.</li>
              <li><strong className="text-ink">OpenAI</strong> — AI scoring and message drafting.</li>
              <li><strong className="text-ink">Stripe</strong> — subscription billing.</li>
              <li><strong className="text-ink">Supabase / hosting infrastructure</strong> — database and application hosting.</li>
            </ul>
            <p className="mt-2">We never sell your data.</p>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">Your rights</h2>
            <p className="mt-2">
              Depending on where you live, you may have rights to access, correct, export, or delete your
              personal data, and to object to certain processing. To exercise any of these, contact{" "}
              <a href="mailto:work.sahilca@gmail.com" className="underline">
                work.sahilca@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-ink">Changes to this policy</h2>
            <p className="mt-2">
              If we make material changes, we&apos;ll notify you by email or an in-app notice before they take
              effect.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-line py-8 text-center text-xs text-ink-soft">
        <Link href="/" className="underline">
          FollowUp
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline">
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
