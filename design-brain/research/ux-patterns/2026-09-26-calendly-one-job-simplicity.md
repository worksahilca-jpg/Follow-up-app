# Calendly: one job, instantly understood, and what FollowUp takes from it

**Asked by:** the founder, 2026-09-26: *"study Calendly for one job: simplicity for follow-up application. Make
the co[r]e instantly understandable."* ("code" read as "core", i.e. the product.)
**Builds on, not repeated:** `followup/research/product/2026-09-10-ux-simplification.md`. It counted 41 concepts,
7 nav items, 12 settings sections and 32 stat tiles, and proposed a 4-item nav plus a plain-words terminology table.
**Grades:** B = search summary of a named source; C = blog or vendor claim.

## What Calendly does

| Principle | What it looks like | Grade |
|---|---|---|
| **One job** | "Be really, really good at one thing, because people will always ask you to do more" (founder Tope Awotona). | B (AfroTech, Atlanta Ventures) |
| **One object you can hold** | The link. Everything in the product exists to make that one link work. | B |
| **Outcome first** | A new account already has a ready event ("30 minute meeting") and a link. You understand the product before you've configured anything. | B (Aubergine, GoodUX/Appcues) |
| **Under two minutes to value** | Connect calendar → set availability → copy link. Done. | C (Medium GTM piece, StartupShortcut) |
| **Defaults do the work** | Working hours and a meeting length are pre-set. Most people never change them. | C |
| **The other side needs nothing** | The invitee needs no account: pick a time, type a name, done. That's what makes it spread. | B (OpenView) |
| **Saying no** | The free plan has one event type and one calendar. Power features stay out of the first screens. | C |

## FollowUp's version

1. **The one job, in one sentence:** *every customer who writes to you gets an answer.* It matches A-013's
   headline. Every screen should serve that sentence or leave.
2. **The one object: a reply waiting for your OK.** Calendly has the link; FollowUp has the reply. Today, Inbox and
   the person page all end in the same black reply block with Send (A-022, A-026).
3. **Outcome first:** after connecting, the first screen is a real customer and their written reply (the proof
   screen), not a dashboard or a setup checklist.
4. **Defaults that already work: the follow-up plan, in one sentence.** Calendly's pre-made "30 minute meeting" is
   our pre-made plan. It's already live in the code (`reminderCadence.ts`):
   - a quick "got your message" right away;
   - check-ins on **day 3, 7, 14 and 30** if they go quiet;
   - it stops the moment they answer;
   - apart from that first "got it", everything waits for your OK.

   It's shown as one readable card with one "Change" link. It is not a workflow builder.
5. **Three places, not seven: Today, Inbox, Settings.** A person lives inside Inbox, and what FollowUp did lives
   inside each person. Pipeline, Analytics, Follow-up plans and Activity stop being top-level pages: the weekly
   email and one line on Today cover "is it working?". This goes one step past the 2026-09-10 proposal (4 items).
   It's the founder's call, because it removes pages that exist today.
6. **The customer needs nothing:** they get a normal message from the owner's own address. There is no
   FollowUp branding in what they receive (A-017's spirit).
7. **Say no on the first screens:** routing rules, CRM sync, webhooks and the voice agent live under
   Settings → More.

## Not taken

Calendly's viral "Powered by Calendly" footer. Putting FollowUp's name in the owner's customer messages would
break principle 1 (trust) and A-017.

## Sources

- Aubergine, Calendly redesign case study: https://www.aubergine.co/insights/ux-re-design-experiments-elevating-calendlys-one-on-one-event-type-feature
- GoodUX (Appcues), Calendly's effortless scheduling: https://goodux.appcues.com/blog/calendlys-scheduling-experience
- Medium, Calendly's self-serve GTM model: https://medium.com/@cagdasbalci0/calendlys-self-serve-gtm-model-b540f36beedb
- StartupShortcut, Calendly PLG: https://startupshortcut.com/knowledge-base/how-calendly-mastered-product-led-growth-with-simplicity-integrations
- OpenView, SaaS viral loops: https://openviewpartners.com/blog/saas-product-viral-loop/
- AfroTech, Tope Awotona: https://afrotech.com/tope-awotona-calendly-afrotech-labs
- Uitify/Foundey, the UX story of Calendly: https://uitify.com/blog/from-frustration-to-viral-adoption-the-ux-story-of-calendly

---

## Follow-up research (same day): is cutting the menu to three right?

The founder asked: *"I guess we should do more research about it."* There are three checks.

**1. Platform rules (B).**
- Apple's HIG: use **3–5 tabs** on iPhone, and avoid a "More" tab.
- Material 3: a navigation bar holds **3–5 destinations**.
- Three tabs is inside both.
- https://developer.apple.com/design/human-interface-guidelines/tab-bars · https://m3.material.io/components/navigation-bar/guidelines

**2. Hidden navigation costs (B, NN/g, 179 participants).**
- Hiding navigation behind a menu cut discoverability by about 20% and slowed people down (15% on mobile).
- **Implication:** whatever leaves the menu must move into a screen people already open, like the person page or Settings. It must not move into a hidden "More" drawer.
- https://www.nngroup.com/articles/hamburger-menus/

**3. Similar products (B–C, from help-centre summaries).**
- Podium (the closest: small-business messaging) is built around one Inbox for every channel.
- Follow Up Boss's phone app centres on People and Inbox.
- Jobber uses a bottom bar plus a "More" tab. HubSpot's app has a Tasks tab.
- A messaging-first app for small businesses with a few tabs is normal. Three is the low end, and Podium is close to it.
- https://podium.my.site.com/knowledgebase/s/article/Navigating-the-Podium-Mobile-App-Inbox · https://help.followupboss.com/hc/en-us/articles/360016174733-iPhone-App-Overview · https://help.getjobber.com/hc/en-us/articles/7061327071639-Jobber-App-Basics

**4. Our own usage** (production database, 2026-09-26; counts only; **10 accounts, 33 customers**, so directional, not proof):

| Feature | Used by |
|---|---|
| Replies (sent, held, dismissed) | 216 actions, the core |
| Pipeline stages moved | 1 of 10 accounts |
| Follow-up plans created | 1 of 10 |
| Saved lists | 0 |
| Tasks | 0 |
| Deals | 1 |

**Conclusion:**
- Three places on the phone (Today, Inbox, Settings) fits the platform rules, the category, and what testers actually do.
- On desktop, add People (A-025).
- Nothing removed should go into a hidden "More". Instead:
  - a person's stage and deal value become fields on the person page, for the one account that uses them;
  - the follow-up plan lives in Settings;
  - "what FollowUp did" lives inside each person.
- **Re-check the usage counts at 30 accounts** before deleting any page's code.
