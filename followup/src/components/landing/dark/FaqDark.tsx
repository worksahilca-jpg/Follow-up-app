"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import styles from "@/app/landing-dark.module.css";

export default function FaqDark({ items }: { items: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <div className={styles.faq}>
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.q} className={styles.faqItem}>
            <button type="button" onClick={() => setOpenIndex(open ? null : i)} aria-expanded={open} className={styles.faqBtn}>
              <span>{item.q}</span>
              <span className={`${styles.faqIcon} ${open ? styles.faqIconOpen : ""}`} aria-hidden="true">
                <Plus className="h-3.5 w-3.5" />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: "easeOut" }} style={{ overflow: "hidden" }}>
                  <p className={styles.faqAnswer}>{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
