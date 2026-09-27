"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./landing.module.css";
import { CheckIcon } from "./icons";
import { FREE_TIER_LEAD_CAP } from "@/lib/pricing";

/**
 * Pricing (A-054/A-055, HubSpot/Intercom study). Desktop: three cards,
 * Plus marked quietly as recommended. Phone (A-057): pick a plan, see one.
 * The money answers live in the FAQ at both widths (A-063), and "prices and
 * dates come to you" is said once, in the hero, not again here.
 *
 * Every line is a fact about the product today:
 *  - "Up to N new customers a month" is FREE_TIER_LEAD_CAP.
 *  - Pro says "New customers shared out evenly", NOT the canvas's "Every
 *    new customer gets an owner": a business can route new customers to a
 *    shared list nobody owns yet (the pool), so "every … gets an owner" is
 *    not always true. See trustCopy.test.ts, team routing.
 *  - Nothing about sending here promises more than onboarding's choice
 *    delivers: Plus "follows up on its own" is what Automatic does.
 */
export const PLANS = [
  {
    name: "Free",
    price: "$0",
    desc: "Try it on your real inbox.",
    lead: "Including:",
    items: [
      "No email or form enquiry missed",
      `Up to ${FREE_TIER_LEAD_CAP} new customers a month`,
      "Catch customers before they go cold",
    ],
  },
  {
    name: "Plus",
    price: "$39",
    desc: "Every channel, followed up for you.",
    lead: "Everything in Free, plus:",
    badge: "Recommended for one owner",
    items: [
      "Follows up on its own, on every channel",
      "No DM missed on Instagram, Messenger or WhatsApp",
      "Answer in any language",
      "Your CRM contacts, followed up too",
      "Every Monday: who came back, who booked",
    ],
  },
  {
    name: "Pro",
    price: "$79",
    desc: "For a team that shares customers.",
    lead: "Everything in Plus, plus:",
    items: ["Know which teammate is falling behind", "New customers shared out evenly", "No limit on customers", "Priority support"],
  },
];

function PlanItems({ items }: { items: string[] }) {
  return (
    <ul className={styles.planList}>
      {items.map((t) => (
        <li key={t}>
          <CheckIcon size={15} className={styles.check} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function PlanCards() {
  return (
    <div className={styles.plans}>
      {PLANS.map((p) => (
        <div key={p.name} className={`${styles.card} ${styles.plan} ${p.badge ? styles.planHot : ""}`}>
          <div className={styles.planTop}>
            <span className={styles.planName}>{p.name}</span>
            {p.badge && (
              <span className={styles.mono} style={{ color: "var(--ink)" }}>
                {p.badge}
              </span>
            )}
          </div>
          <div className={styles.planPrice}>
            <span className={styles.planAmount}>{p.price}</span>
            <span className={styles.planPer}>/month</span>
          </div>
          <div className={styles.planDesc}>{p.desc}</div>
          <Link href="/signin" className={`${p.badge ? styles.btn : styles.btnGhost} ${styles.planCta}`} style={{ fontSize: 15 }}>
            Start free
          </Link>
          <div className={styles.planNote}>No credit card.</div>
          <PlanItems items={p.items} />
        </div>
      ))}
    </div>
  );
}

export function PlanPicker() {
  const [pick, setPick] = useState(1);
  const plan = PLANS[pick];
  return (
    <div className={styles.planPicker}>
      <div role="tablist" aria-label="Plans" className={styles.pickTabs}>
        {PLANS.map((p, i) => (
          <button
            key={p.name}
            type="button"
            role="tab"
            id={`plan-tab-${i}`}
            aria-selected={i === pick}
            aria-controls="plan-panel"
            onClick={() => setPick(i)}
            className={styles.pickTab}
          >
            <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--soft)" }}>{p.name}</span>
            <span style={{ display: "block", marginTop: 2, fontSize: 24, fontWeight: 300, letterSpacing: "-0.03em" }}>{p.price}</span>
          </button>
        ))}
      </div>
      <div
        id="plan-panel"
        role="tabpanel"
        aria-labelledby={`plan-tab-${pick}`}
        className={styles.card}
        style={{ marginTop: 12, padding: "22px 20px 24px", display: "flex", flexDirection: "column" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className={styles.planName}>{plan.name}</span>
          <span style={{ fontSize: 15, color: "var(--soft)" }}>{plan.price}/month</span>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.5, color: "var(--soft)" }}>{plan.desc}</p>
        <div style={{ marginTop: 16, fontSize: 13, fontWeight: 500, color: "var(--soft)" }}>{plan.lead}</div>
        <PlanItems items={plan.items} />
        <Link href="/signin" className={styles.btn} style={{ marginTop: 20, fontSize: 15 }}>
          Start free
        </Link>
      </div>
    </div>
  );
}
