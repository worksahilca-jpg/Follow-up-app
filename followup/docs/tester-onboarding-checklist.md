# Bringing a beta tester in — the checklist (2026-09-19)

Sign-up is invite-only and the founder adds every tester himself. Three separate lists
gate what a tester can do, and none of them is in FollowUp's own code. Do all three before
telling the tester to sign in, or they hit a refusal somewhere and blame the product.

## Founder, per tester (about 10 minutes)

| # | Where | What | Why |
|---|---|---|---|
| 1 | followupbase.io/admin → Beta testers | Add their Google email | Sign-in refuses anyone not on this list (`src/lib/auth.ts`). Their business is put on the beta plan — every Pro feature, free — the moment they sign in. Removing them takes it away. |
| 2 | Google Cloud Console → APIs & Services → OAuth consent screen → Test users | Add the same email | The Google app is in Testing mode. Anyone not on this list gets "access_denied" when connecting Gmail. Limit 100. Their Gmail connection expires every 7 days until Google verification clears (`docs/google-verification-pack.md`). |
| 3 | developers.facebook.com → FollowUp → App roles → Roles → Add people → Tester | Add them by Facebook name | The Meta app is not reviewed. Only people with a role on the app can connect Instagram, Messenger or WhatsApp. They must accept the invite in their Facebook notifications. |

Then send them the welcome text at the bottom of this page, or say it in your own words.

## Founder, once (not per tester)

- Vercel Production has `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`,
  `WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID` (done 2026-09-19) and **`INSTAGRAM_APP_ID`,
  `INSTAGRAM_APP_SECRET`** (still missing on 2026-09-19 — without them "Connect with
  Instagram" does not appear and Instagram DMs fail the signature check). Both come from
  Meta → FollowUp → Instagram → API setup with Instagram Login.
- Meta Business Verification for the FollowUp portfolio: needed before anyone but the
  founder can connect WhatsApp (`docs/meta-oauth-setup.md` §3, point 6).

## What the tester does

1. Open followupbase.io → Start free → sign in with the Google account you were added with.
2. Name the business, pick the industry, press Continue.
3. Connect Gmail. Google shows a warning that the app is unverified — that is expected in
   beta; press "Continue". FollowUp imports the last 3 months of conversations.
4. Settings → Channels: connect Instagram and Facebook if you use them. WhatsApp only once
   the founder says verification has cleared.
5. Settings → Website widget: paste the snippet on your site if you have a contact form.
6. Use it for a week. Anything wrong: the "Something broke?" link in the sidebar.

## What will happen that is not a bug

- Gmail asks to be reconnected after 7 days (Google Testing mode). The dashboard says so.
- Instagram and Facebook connect only for people the founder added as testers.
- WhatsApp says "can't onboard customers right now" until Meta verifies FollowUp's business.
- The first automatic reply waits about two minutes on a DM, so the owner can answer first.

## Tester welcome (copy, send as is)

> You're in. Sign in at followupbase.io with this Google account. It asks two questions,
> then connects your Gmail — Google will warn the app is unverified while we're in beta,
> press Continue. From then on it reads new customer enquiries, tells you who is going
> quiet, and drafts the reply; nothing goes out without your OK unless you turn that on.
> Gmail will ask to reconnect after a week, that's Google, not us. Anything odd, hit
> "Something broke?" in the sidebar or reply to this message.
