# Whole-app study, part 1: what FollowUp has today (2026-10-10)

**Asked by the founder:** *"we need to strategise and study our whole app first, then only we can design the software
user friendly"*, then *"yes start part 1"*. The plan has six parts:
1. what we have;
2. owners' real jobs;
3. matching the two;
4. how familiar apps do it;
5. one strategy page;
6. then design.

**Method:** a real build of `main` at 0015783 (step 1 merged; the paused step 2 not included), on the local test
business. Every route, pop-up and the first-run setup were walked at 1440 px and 390 px. Words and controls were counted
inside `<main>`. The page with every screenshot (private): https://claude.ai/artifact/8XbwiyBLg9tugwdkip9KdR

## The numbers

- 30 screens, plus 8 pop-up windows and menus. 403 controls and 5,619 words (desk).
- **Settings is 54% of the words (3,054) and 55% of the controls (221).**
  - The Email page alone is 4,071 px tall, with 51 controls and 696 words.
  - Advanced has 463 words; Booking hours has 473.

## How the screens connect

- **In the menu:** Search, Today, Customers, Results, Settings (a window: 5 groups, 13 pages), Help, the bell, the
  business menu.
- **Opened from elsewhere:**
  - a customer's page;
  - Customers with one customer open beside the list;
  - Follow-up plans (`/workflows`, from Settings › Follow-up plan › Change);
  - Teach FollowUp (`/teach`, full screen, from Your business);
  - Coming up (from a line on Today);
  - Add a customer, Log a call, Import CSV, Clean up, Filter.
- **No link anywhere:**
  - `/activity` ("What FollowUp did", the log);
  - `/pipeline`;
  - `/waiting`;
  - `/inbox`, which just forwards to Customers.
  - `/activity` and `/pipeline` both have a "← Settings" back link that Settings doesn't return.

## Facts that stood out (judging them is part 3)

1. Settings is the biggest part of the app.
2. One customer has three layouts, with different facts in each:
   - Today's pane;
   - the panel beside Customers (the only place with Language);
   - their own page (the only place with Came from and Copy booking link).
3. The log of everything FollowUp sent or held, and why, a trust feature, has no link.
4. "Who sends without asking" is set in four places:
   - setup's Automatic or Assisted;
   - Replies' "Let FollowUp send without asking";
   - Replies' "Let some leads skip the check";
   - Team's "Only admins send".
5. Work happens inside Settings: the filtered-out emails with "This was a lead" sit on the Email page.
6. Setup can't start without Gmail or Outlook, so an owner on WhatsApp, Instagram or a website form alone can't get past
   step 1.
7. There are two feedback boxes: Help ("Tell us what went wrong") and Settings' "Something broke? Tell us".
8. "Write like me" and "Help improve FollowUp" sit on Your data, not How it writes.
9. Customers repeats itself: 15 of 17 rows say "Needs you", under a tab that already says Needs you 15.
10. Today on a phone is 1,832 px tall, a bit over two screens.
11. Results has no controls. That's fine for a report.
12. Pages carry their own "← Settings" or "← Today" back links, while Settings is now a window.

**Bug found (from step 1, live):** the Help window opens under the page, the same stacking problem fixed for Search, so
the list and reply card paint over it. The fix is to render it into `<body>`.

**Feedback on the page itself (founder, 2026-10-10):** *"I am not able to zoom this, bro."* Every screenshot now opens
full size on a tap, with + and −, pinch and double-tap to zoom, and next/previous. Rule for every study page from now
on: screenshots must open full size and zoom, on a phone too.
