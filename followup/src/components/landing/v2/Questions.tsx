"use client";

import { useState } from "react";
import styles from "./landing.module.css";
import { PlusIcon } from "./icons";

/**
 * "Straight answers." One list for both widths. The two money questions
 * moved here from under the price cards (A-057 on the phone, A-063 on the
 * desktop), so the pricing section says only the prices.
 *
 * The first answer is the sending promise, and it has to match what
 * onboarding does (PRODUCT_DIRECTION, 2026-09-26): the owner chooses
 * Automatic or Assisted, and on Automatic prices, dates and anything tense
 * still come to them. trustCopy.test.ts pins it.
 */
export const FAQS: { q: string; a: string }[] = [
  {
    q: "Will it send things on its own?",
    a: "If you choose Automatic when you set up, yes: thanks, answers it is sure of, and check-ins. A price, a date or anything tense comes to you first. It stops the moment a customer answers. Prefer to check everything? Choose Assisted, or switch any time in Settings.",
  },
  {
    q: "What happens when the beta ends?",
    a: "Nothing is charged unless you pick a plan. You stay on Free, with everything you set up.",
  },
  {
    q: "What counts as a customer?",
    a: "One new person who writes to you, counted once, however many messages they send.",
  },
  {
    q: "Why not just set a reminder?",
    a: "A reminder tells you it's time. FollowUp does the follow-up itself, and tells you only what needs you.",
  },
  {
    q: "What about Instagram's 24-hour rule?",
    a: "Instagram lets apps reply for 24 hours after a customer's last message. After that, FollowUp writes one message you send with a tap.",
  },
  {
    q: "Is my data safe? Can I leave?",
    a: "It only reads the inboxes you connect, and replies go from your own address. Nothing is sold. Leave any time, and delete all of it whenever you want.",
  },
  {
    q: "Is it for a team, or just me?",
    a: "Both. On Pro, new customers are shared out evenly, or land in a shared list anyone can pick up, and you can see who on your team is behind.",
  },
  {
    q: "Can it answer my phone?",
    a: "Not yet. It's built, but phone numbers need approval first, so nothing on your phone line is picked up today. It works with Gmail, Outlook, Instagram, Messenger, WhatsApp and your website form.",
  },
];

export default function Questions() {
  const [open, setOpen] = useState(0);
  return (
    <div className={styles.faqList}>
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className={styles.faqItem}>
            <h3 style={{ margin: 0 }}>
              <button
                type="button"
                id={`faq-q-${i}`}
                aria-expanded={isOpen}
                aria-controls={`faq-a-${i}`}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className={styles.faqQ}
              >
                <span>{f.q}</span>
                <PlusIcon open={isOpen} />
              </button>
            </h3>
            <p id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} hidden={!isOpen} className={styles.faqA}>
              {f.a}
            </p>
          </div>
        );
      })}
    </div>
  );
}
