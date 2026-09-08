"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

/**
 * Same interaction as src/components/FaqAccordion.tsx (click to expand,
 * one open at a time) but styled with this page's own inline design
 * tokens instead of Tailwind's text-ink-soft/divide-line utilities —
 * those resolve against the dashboard's global palette, which would leak
 * the wrong (cool, blue-accented) colors into this page's warm one.
 */
export default function LandingFaq({ items }: { items: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div>
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.q} style={{ borderBottom: i < items.length - 1 ? "1px solid rgba(24,20,15,0.1)" : undefined }}>
            <button
              onClick={() => setOpenIndex(open ? null : i)}
              className="w-full py-4 flex items-center justify-between gap-4 text-left"
            >
              <span className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>
                {item.q}
              </span>
              <ChevronDown
                className="h-4 w-4 shrink-0 transition-transform"
                style={{ color: "var(--ink-soft)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <p className="text-[13.5px] leading-relaxed pb-4" style={{ color: "var(--ink-soft)" }}>
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
