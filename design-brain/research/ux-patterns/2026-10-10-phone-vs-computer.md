# Phone vs computer: how big companies do it (2026-10-10)

**Question (founder):** *"For phone we gotta figure out something, because we cannot just fit the desktop in this
mobile one. Can you figure out how big companies do that?"*

## What they do (sources at the end; evidence quality noted)

1. **One brand, two layouts.** Google's Material guidance sorts screens by width: compact (under 600dp), medium
   (600–840dp) and expanded (840dp and up). Each width gets its own navigation: a bottom bar on a compact screen, a rail
   or drawer on a wide one. The colours, type and words stay the same; the layout changes. *(Android developer docs,
   first party.)*
2. **List, then detail, one screen at a time on a phone.** On a compact screen only the list or the detail shows. Tap
   an item and the detail takes the whole screen; Back brings the list back. A wide screen shows both side by side.
   *(Android canonical layouts; SAP Fiori says the same.)*
3. **The phone is a companion for the jobs done away from the desk, not the whole desktop.** Linear's mobile app
   (Sept 2024) is described as a companion, "purpose-designed for on-demand workflows that complement the desktop":
   an inbox you clear by tapping, swiping and snoozing. *(Linear changelog, first party, via search; the page itself
   couldn't be opened from here.)*
4. **Re-ask what people do on the phone, then redesign the navigation for that.** Slack re-examined the core mobile use
   cases and moved to a plain bottom tab bar (Home, DMs, Mentions, You), because the old menus hid what people
   needed most. *(Slack's own blog, via search.)*
5. **Swap desktop tools for touch ones.** Superhuman: keyboard shortcuts on the desktop; "faster gestures" on the
   phone. Swipe left is Done, swipe right is a reminder, and a triage bar sits at the bottom. *(Superhuman's help
   centre and blog, first party.)*
6. **Thumb first.** The main action sits low, where the thumb rests; navigation and secondary things sit at the top or
   in a sheet. Tab bars hold three to five places and never actions. *(Third-party summaries of Apple's guidelines;
   Apple's pages couldn't be opened from here, so treat them as secondhand.)*

## Where FollowUp's phone still looks like a squeezed computer (checked on the running app, 390×844)

- **A customer's page stacks the computer's side column under the chat:** State, Last wrote, Came from, Already spoke,
  Copy booking link, Call, Details, Delete. Chat apps keep this behind an info button that opens a sheet.
- **Two bars at the bottom of a chat:** the reply box sits on top of the four tabs. Chat apps hide the tabs inside a
  conversation.
- **The brand bar ("FollowUp · Alerts") stays on a customer's page.** Apps swap it for Back + the person's name on a
  detail screen.
- **Today puts a card inside a card,** a computer framing, and the last links can fall behind the tabs.

## What this means for FollowUp (proposal, not yet approved)

- Keep one look and one set of words (A-221), and give the phone its **own layout** for each screen.
- **A customer on the phone works like a chat app:** Back, their name and channel, and an info button at the top; the
  chat fills the screen; the reply box at the bottom; no tabs. The facts and actions open in a sheet from the info
  button.
- **Today on the phone:** no outer card; Send, Edit and Later stay in thumb reach at the bottom.
- **The brand bar shows only on the four main places;** inner screens get a Back bar.
- The computer stays as it is.

## Sources

- Android developers, "Build responsive navigation" (https://developer.android.com/develop/ui/views/layout/build-responsive-navigation)
  and "Canonical layouts" (https://developer.android.com/develop/adaptive-apps/guides/canonical-layouts)
- SAP Fiori for Android, "Canonical Layouts" (https://www.sap.com/design-system/fiori-design-android/v26-4/foundations/adaptive-layout/canonical-layouts)
- Linear, "Introducing Linear Mobile", 2024-09-19 (https://linear.app/changelog/2024-09-19-introducing-linear-mobile)
- Slack, "A simpler, more organized Slack on your phone" (https://slack.com/intl/de-de/blog/productivity/simpler-more-organized-slack-mobile-app)
- Superhuman help centre, "Superhuman Mobile" (https://help.superhuman.com/article/506-mobile) and blog
  (https://blog.superhuman.com/superhuman-for-iphone-now-faster-than-ever/)
