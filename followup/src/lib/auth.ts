/**
 * NextAuth configuration — Google sign-in, and the actual multi-tenant
 * signup moment.
 *
 * This is a separate concern from Gmail *data* access
 * (src/lib/integrations/gmail.ts): this only proves who's signing into the
 * app. It reuses the same Google OAuth client (same GOOGLE_CLIENT_ID/
 * SECRET) since we already have one, but requests only basic profile/email
 * scopes — no Gmail scopes here.
 *
 * Multi-tenancy: a brand-new email signing in gets its OWN new Business —
 * that's the real "signup" — UNLESS someone already invited that exact
 * email to their team (see the Invite model / src/lib/team.ts), in which
 * case they join that business instead, at whatever role the invite named.
 * A returning email is attached to whatever business it already belongs
 * to; one that was removed from its team (businessId null — see
 * removeMember() in team.ts) is re-checked for a pending invite the same
 * way, and falls back to a fresh new business if there isn't one, so
 * nobody is ever permanently locked out. businessId + userId are embedded
 * in the JWT here so every server-side request can scope its data without
 * an extra DB round-trip — see src/lib/session.ts.
 *
 * Who may create an account is decided by the gate in the signIn callback
 * below. It is closed unless PUBLIC_SIGNUP is explicitly "true": a new
 * email gets in only via ALLOWED_EMAILS, an approved AccessRequest, or a
 * pending team invite. Emptying ALLOWED_EMAILS no longer opens the door —
 * it used to, which is the bug that made this gate what it is.
 *
 * It governs sign-UP only. An email that already belongs to a business
 * signs in regardless, so tightening the setting never locks out an
 * existing account.
 */

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import { grantBetaPlan } from "@/lib/billing";

/**
 * The founder's tester list, read per call rather than at module load.
 *
 * Read once at import, this was untestable — a test cannot stub an env
 * var that was consumed before it ran — which meant one of the three ways
 * into the product had no coverage at all. For a gate that decides who
 * gets an account, "cannot be tested" is itself the defect.
 */
function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Is this deployment open to strangers?
 *
 * Must be set, out loud, to the string "true". Anything else — unset,
 * empty, "1", "yes", a typo — means closed.
 *
 * ## Why this exists (2026-09-23)
 *
 * The gate used to be `if (allowedEmails.length > 0 && !isTester)`, which
 * fails OPEN: an empty or missing ALLOWED_EMAILS meant "let everyone in".
 * That is exactly backwards for a product whose own rule (R-012) is that
 * sign-up is invite-only, and it is not a theoretical concern — the
 * founder found the live site through a Google search on a friend's phone
 * and watched that friend's Google account create a real, onboarded
 * business. ALLOWED_EMAILS was simply not set in production, and nothing
 * anywhere said so.
 *
 * A gate whose disabled state is indistinguishable from a missing
 * variable is not a gate. Deleting one env var must never silently open
 * signup, so the safe state is now the DEFAULT state and opening up takes
 * a deliberate act.
 */
function publicSignupEnabled(): boolean {
  return process.env.PUBLIC_SIGNUP === "true";
}

/**
 * How long a team invite stays usable.
 *
 * Module scope because TWO places need the same answer — the signup gate
 * and the transaction that consumes the invite. Read separately they
 * could drift, and a gate that admits someone the consumer then treats as
 * a brand-new signup would silently put an invited teammate into their own
 * empty business instead of the team that invited them.
 */
const INVITE_VALID_DAYS = 30;
function inviteWindowStart(): Date {
  return new Date(Date.now() - INVITE_VALID_DAYS * 24 * 60 * 60_000);
}

/**
 * Can a team invite, on its own, get someone in?
 *
 * Now always yes, which is what "invite-only" has to mean: an admin
 * naming an address IS the invitation. Exported for the Settings panel,
 * which reports this to the owner.
 *
 * It was not always yes. The old gate checked ALLOWED_EMAILS before it
 * ever looked for an invite, so while the allowlist was set an invited
 * teammate was refused and their invite never consumed — while Settings
 * cheerfully said "they'll join automatically the next time they sign
 * in". Keeping that behaviour while closing the gate by default would
 * have broken team invites outright on every deployment, since closed is
 * now the default.
 */
export function inviteAloneIsEnough(): boolean {
  return true;
}

// A session cookie is good for a week at most — after that, sign in again.
// Down from NextAuth's 30-day default: this app holds other people's
// conversations, so a stolen or forgotten-open cookie shouldn't stay a
// live credential for a month.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// How often a still-valid session gets its businessId re-checked against
// the DB (see the jwt callback below) — bounds how long someone removed
// from their team (removeMember() in team.ts sets businessId to null) can
// keep using an already-issued token, without paying a DB round trip on
// every single request the way a check-every-time approach would.
const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();

      // Who is a beta tester: the env allowlist, or an email the founder
      // approved on /admin (an AccessRequest row he added himself) — the
      // same invite, granted without a redeploy. While the allowlist gate
      // is on, anyone else is refused. Either way a tester's business is
      // put on the beta plan below (grantBetaPlan: Pro, free — founder's
      // decision 2026-09-19), which is a no-op for a business that already
      // pays.
      const approved = await prisma.accessRequest.findUnique({ where: { email }, select: { status: true } });
      const isTester = allowedEmails().includes(email) || approved?.status === "approved";

      const existing = await prisma.user.findUnique({ where: { email } });

      /**
       * The gate, and it governs sign-UP, not sign-in.
       *
       * Someone who already belongs to a business is not signing up; they
       * are coming back. Gating them would mean that tightening this
       * setting locks out every existing account — including the founder's
       * own, whose address is not necessarily in ALLOWED_EMAILS. Access is
       * taken away by removing someone from their team (removeMember() in
       * team.ts, which nulls businessId and drops them back through this
       * gate), never by an env var changing under them.
       *
       * Three ways to be let in as a new account, and all three are a
       * human having named this address:
       *
       *   1. ALLOWED_EMAILS — the founder's own tester list.
       *   2. An approved AccessRequest — the same thing granted from
       *      /admin without a redeploy.
       *   3. A pending, unexpired team invite — an admin of an existing
       *      business asked for this person by email.
       *
       * Anything else is refused unless PUBLIC_SIGNUP is explicitly
       * "true". Checked BEFORE the transaction below so a refusal creates
       * nothing: no user row, no business, and the invite (if any) is left
       * unconsumed for a legitimate attempt later.
       */
      if (!existing?.businessId && !isTester && !publicSignupEnabled()) {
        const invited = await prisma.invite.findFirst({
          where: { email, createdAt: { gte: inviteWindowStart() } },
          select: { id: true },
        });
        if (!invited) return false;
      }
      if (existing) {
        // Returning user with a business already — nothing to create. If
        // their name changed on Google's side, keep it fresh.
        if (existing.businessId) {
          if (user.name && user.name !== existing.name) {
            await prisma.user.update({ where: { id: existing.id }, data: { name: user.name } });
          }
          if (isTester) await grantBetaPlan(existing.businessId);
          return true;
        }

        // Existing but team-less (removed from a business — see
        // removeMember() in team.ts): falls through to the invite check
        // below, exactly like a brand-new signup, just updating the row
        // instead of creating one.
      }

      // Either a brand-new email, or a returning one with no business.
      // Someone may already have invited this exact email to their
      // team — join that business at the invited role instead of
      // spinning up a new one, and consume the invite either way.
      //
      // The invite lookup, the user upsert, and the invite delete all run
      // in one transaction — two overlapping completions of this same
      // flow (the same person accepting from two tabs, or a client retry
      // landing as a second callback before the first finishes) used to
      // run these as separate, unguarded statements, so both could read
      // the same still-present invite before either deleted it; the
      // loser's plain `delete` then threw an uncaught P2025 ("record not
      // found"), surfacing to the user as a failed sign-in even though
      // their business assignment had already succeeded moments before.
      // `deleteMany` here is count-tolerant (never throws when the row is
      // already gone), so a losing concurrent request now completes sign-
      // in successfully instead (research/audit/2026-09-09-fifth-pass-
      // audit.md finding #2).
      const joinedBusinessId = await prisma.$transaction(async (tx) => {
        // An invite is proof that an admin named THIS email, so joining on
        // it is the intended flow — but it had no expiry, and an invite
        // that never expires is a standing key. An admin who typos an
        // address, or invites someone who then leaves, has no way to take
        // it back except to notice and delete the row: whoever controls
        // that mailbox can walk into the business months later and read
        // every lead in it.
        //
        // Thirty days from the existing createdAt — no migration, and long
        // enough that nobody meets it in normal use. A stale invite is not
        // deleted here (that is the sweep's job, and deleting on a failed
        // sign-in would tell an attacker their guess was close); it simply
        // stops working, and the person gets a fresh business of their own
        // exactly as any other new sign-up does.
        // Same window the gate above used (INVITE_VALID_DAYS, module
        // scope) — if these two disagreed, an invite good enough to get
        // someone past the gate but stale here would drop them into a
        // brand-new business of their own instead of the team that
        // invited them.
        const pendingInvite = await tx.invite.findFirst({
          where: { email, createdAt: { gte: inviteWindowStart() } },
        });

        const businessId = pendingInvite
          ? pendingInvite.businessId
          : (
              await tx.business.create({
                data: {
                  name: user.name ? `${user.name}'s Business` : "My Business",
                  // Follow-up is on from day one (see AutomationTier in
                  // schema.prisma): the master switch exists so an owner can
                  // turn it OFF, not something they have to discover to turn on.
                  automations: {
                    create: [
                      { name: "Auto follow-up on silence", action: "auto_send", enabled: true, triggerDays: 5 },
                      { name: "Instant reply to new leads", action: "instant_ack", enabled: true, triggerDays: 0 },
                      { name: "Reply for me when I haven't", action: "unanswered_reply", enabled: true, triggerDays: 1, triggerHours: 24 },
                    ],
                  },
                },
              })
            ).id;
        const role = pendingInvite ? pendingInvite.role : "ADMIN";

        if (existing) {
          await tx.user.update({
            where: { id: existing.id },
            data: { businessId, role, name: user.name ?? existing.name },
          });
        } else {
          await tx.user.create({
            data: { email, name: user.name ?? undefined, businessId, role },
          });
        }
        if (pendingInvite) {
          await tx.invite.deleteMany({ where: { id: pendingInvite.id } });
        }
        return businessId;
      });

      if (isTester) await grantBetaPlan(joinedBusinessId);
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        // `user` is only present right after a real round-trip through
        // Google's own sign-in screen just completed — not on the
        // thousands of ordinary requests that merely reuse an existing
        // cookie. Stamping it here is what lets requireRecentAuth()
        // (src/lib/session.ts) tell "this session was actively re-proven
        // N minutes ago" from "this cookie has just been sitting in a
        // browser for days" — the step-up check before rotating a secret
        // or deleting a business.
        token.authTime = Date.now();
      }

      // Re-derived right after sign-in (when `user` is present) AND
      // retried on every later request as long as businessId is still
      // missing from the token — a token that never got it on that first
      // pass (a transient DB hiccup, timing) used to be stuck that way for
      // the token's whole lifetime, since this used to only ever run once:
      // signed in with Google successfully, but permanently bounced back
      // to /signin with no error, because getSessionContext() requires
      // businessId and nothing ever gave it a second chance to appear.
      // Once businessId is set, this is a no-op fast path on every future
      // request, same as before — no extra DB hit for the common case.
      const email = user?.email ?? token.email;
      if (!token.businessId && email) {
        const dbUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (dbUser?.businessId) {
          token.userId = dbUser.id;
          token.businessId = dbUser.businessId;
          token.checkedAt = Date.now();
        }
        return token;
      }

      // Periodic revalidation: without this, a user removed from their
      // team (businessId set to null — removeMember() in team.ts) or
      // whose whole business was deleted (src/lib/businessData.ts) keeps
      // an already-issued token that still claims the old businessId for
      // as long as the token itself is valid — up to SESSION_MAX_AGE_SECONDS.
      // Re-checking here on a short interval instead of trusting the token
      // forever bounds that exposure window to REVALIDATE_INTERVAL_MS,
      // while keeping the common case (checked within the last few
      // minutes) a zero-DB-hit no-op, same as before this existed.
      const lastChecked = typeof token.checkedAt === "number" ? token.checkedAt : 0;
      if (token.userId && Date.now() - lastChecked > REVALIDATE_INTERVAL_MS) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.userId }, select: { businessId: true } });
        if (!dbUser?.businessId) {
          // Removed from their team, or the user row itself is gone —
          // strip the claims that grant data access. getSessionContext()
          // treats a token with no businessId as "not signed in."
          token.userId = undefined;
          token.businessId = undefined;
        } else {
          token.businessId = dbUser.businessId;
        }
        token.checkedAt = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId && token.businessId) {
        session.user.id = token.userId;
        session.user.businessId = token.businessId;
      }
      session.authTime = token.authTime ?? 0;
      return session;
    },
  },
};
