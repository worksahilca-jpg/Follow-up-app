# Meta status check (2026-10-18)

Read by the founder, read-only (pages opened by address, nothing clicked), and reported back.

- **Access verification:** still "In review", submitted 2026-09-25. Deadline is now **2026-12-16** (was read as Dec 11
  on Oct 13). Business verification: Verified.
- **No action items**, no warnings, no unread alerts.
- **Approved:** `instagram_business_basic`, `instagram_business_manage_messages` (Oct 9).
- **Not approved yet ("Ready for testing" = own accounts and testers only):** Instagram Human Agent (0 calls),
  `pages_messaging`, `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement`, `leads_retrieval`,
  `business_management`, both WhatsApp permissions.
- **Never requested:** Business Asset User Profile Access (needed for Messenger names).

## What this changes for the Messenger + Lead Ads submission

1. Add **Instagram Human Agent** to it (confirmed never granted), as the Oct 13 pack suspected (Video F).
2. Add **Business Asset User Profile Access** to the app before recording Video C.
3. `pages_manage_ads`, `ads_management`, `ads_read` are switched on in the app but **no FollowUp code uses them**
   (`lib/facebook.ts` asks only for `leads_retrieval,pages_read_engagement` on top of the Page scopes). Do not request
   them in the review.
4. WhatsApp permissions are not in this submission; they need their own review later.
5. If access verification is still in review on 2026-10-20, open a Meta developer support ticket.
