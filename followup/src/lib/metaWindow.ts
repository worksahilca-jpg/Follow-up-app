/**
 * Meta's messaging window, as a leaf module with NO imports.
 *
 * Lives apart from @/lib/automation for one reason: Settings is a "use
 * client" component and has to say the true number to the owner, and
 * automation.ts imports the Prisma client — which must never reach a client
 * bundle (the fix for exactly that bug, PR for issue #93). Same reason
 * @/lib/pricing and @/lib/scoreThresholds exist as pure constants. The
 * engine (automation.ts) and the badge (automationStatus.ts) re-import from
 * here, so there is still exactly one definition.
 *
 * ---
 *
 * The window: 24 hours from the lead's last INBOUND message, on Instagram
 * and Messenger. Past it the Send API refuses, and unlike WhatsApp there
 * is no approved-template escape on those two channels — see
 * research/product/2026-09-16-meta-window-close-what-shipped-products-do.md
 * §1 and §5.1, and research/integrations/2026-09-16-meta-channels-production-audit.md §3a.
 *
 * The collision UNANSWERED_META_DM_MAX_HOURS fixes: the window is measured
 * from the lead's last inbound message, and so is the unanswered rule. They
 * start the same instant. With the 24-hour default and an hourly cron, the
 * send is attempted somewhere in [24h, 25h) — i.e. AFTER the window shut,
 * every time, with no variance to hope for. FollowUp's most human-sounding
 * safety net ("Reply for me when I haven't") was calibrated to miss by
 * roughly an hour, permanently, on two of the three channels the product
 * now leads with.
 *
 * Four hours of headroom rather than one: the cron is hourly, a send can
 * be held for approval and re-attempted, and the drafting call itself
 * takes time. One hour of margin would put the retry back outside.
 *
 * A CAP, not a default. UNANSWERED_DEFAULT_HOURS is only the fallback —
 * the real value is Automation.triggerHours, which the business sets. A
 * business that chose 48 or 72 hours was not choosing a slower cadence on
 * Instagram; it was choosing one that never arrives. So this ceiling
 * applies whatever they configured. It is NOT invisible to them: Settings
 * says so, in the sentence that describes what is active, because a
 * setting that silently means something else on two channels is the kind
 * of surprise brand principle 1 forbids.
 *
 * NOT applied to WhatsApp, deliberately. It has the same 24-hour window
 * but does have approved templates as a sanctioned way through, and
 * sendWhatsApp already retries as a template on error 63016. Capping it
 * here would pre-empt a path that is supposed to work. (That path has its
 * own doubt — the audit flags that 63016 may arrive asynchronously — but
 * that is a separate bug with a separate fix, not something to paper over
 * by changing when we send.)
 */
export const META_DM_WINDOW_HOURS = 24;
export const UNANSWERED_META_DM_MAX_HOURS = 20;

/** The channels the ceiling applies to — those with no way through a shut window. */
export const META_DM_CHANNELS: ReadonlySet<string> = new Set(["instagram", "messenger"]);
