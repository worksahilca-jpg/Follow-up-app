# References — Messaging

Inboxes, conversation threads, composers, multi-channel views, message state.

## What to look for here

- **Thread legibility** — how sender, time, channel, and direction are made obvious
  without chrome on every bubble.
- **Multi-channel unification.** When one contact reaches you by email, SMS, and DM, how
  is that shown as one conversation without losing which channel each message used?
- **Composer design.** How much power is visible by default vs. revealed.
- **Message state** — sending, sent, delivered, failed, read. Especially *failed*, which
  most products handle badly and which matters enormously here.
- **Drafts and approval.** Anywhere a message is prepared but not yet sent.

## The FollowUp-specific question

FollowUp's messaging is unusual: **some messages are drafted by the system and await
approval, and some are sent automatically.** The user must always be able to tell, at a
glance, who sent what and whether something is waiting on them. Almost no reference
product has this problem — so study their thread clarity, then design our approval
distinction originally.

## Anti-patterns to notice and name

Chat-bot framing; typing indicators for automated systems; bubbles so styled the content
is secondary; unclear failed-send states; approval flows buried behind a click.
