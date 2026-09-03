"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

/**
 * Click-to-expand FAQ — one open at a time, animated height via
 * framer-motion (already a dependency, used by FadeIn). A plain static
 * list read fine but felt inert; this is the same content, just
 * interactive the way a real product page's FAQ usually is.
 */
export default function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-line">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.q}>
            <button
              onClick={() => setOpenIndex(open ? null : i)}
              className="w-full py-4 flex items-center justify-between gap-4 text-left"
            >
              <span className="font-medium">{item.q}</span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-ink-soft transition-transform"
                style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <p className="text-sm text-ink-soft leading-relaxed pb-4">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
