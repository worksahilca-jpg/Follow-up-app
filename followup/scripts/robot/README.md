# The robot tester

A nightly check that clicks through FollowUp the way an owner would, on a
**local copy only**, and reports anything broken. It never touches the live
site or the production database. The founder approved it on 2026-09-29.

## What it checks

1. A customer writes in through the website form, and is saved as a lead.
2. Every main screen opens without an error, on desktop (1280px) and phone
   (390px): Today, Inbox, Customers, Coming up, Waiting, Activity, Settings
   and its main pages, and the new customer's own page.
3. On each screen: no crash screen, no 500s, no bounce to sign-in, and no
   sideways scrolling.
4. A few words that must be there: the new customer on Today, "Your
   business", and the "Founding tester" plan card (A-074).

## How to run it

From `followup/`, with a local Postgres running:

```
LOCAL_ENV=/path/to/local.env bash scripts/robot/run.sh
```

`LOCAL_ENV` sets `DATABASE_URL` and `DIRECT_URL` to a **localhost** database,
plus `NEXTAUTH_SECRET` and `NEXTAUTH_URL`. `run.sh` refuses any other
database. Next.js also reads `followup/.env`; `run.sh` blanks every other key
the app reads before starting it, so no real email, text, payment or AI call
can leave a run.

Output: `robot-report.json` (or `ROBOT_OUT`) with every check and its result.
The exit code is non-zero if anything failed.

## What it doesn't do (yet)

- No sending: the fake business has no inbox, so approve-and-send and
  follow-ups aren't exercised.
- No AI: keys are blank, so no drafts are written.
- Real Gmail, Instagram and Facebook can't be tested by a robot; those need
  real accounts.
