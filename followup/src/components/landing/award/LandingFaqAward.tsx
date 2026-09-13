"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import styles from "@/app/landing-award.module.css";

export default function LandingFaqAward({ items }: { items: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div>
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.q} className={styles.faqItem}>
            <button
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="w-full py-4 flex items-center justify-between gap-4 text-left"
            >
              <span className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>
                {item.q}
              </span>
              <span className={`${styles.faqIcon} ${open ? styles.faqIconOpen : ""}`} aria-hidden="true">
                <Plus className="h-3.5 w-3.5" />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <p className="text-[13.5px] leading-relaxed pb-4 max-w-[560px]" style={{ color: "var(--ink-soft)" }}>
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
