"use client";

import { useState, type ReactNode } from "react";
import { keepPageCopies, type PageCopies } from "@/lib/pageCopies";

/**
 * Keeps the answers a page brought (src/lib/pageCopies.ts) before its parts
 * render: this runs first, so every part's opening fetchOnOpen finds them.
 */
export default function PageCopiesProvider({ copies, children }: { copies: PageCopies; children: ReactNode }) {
  useState(() => keepPageCopies(copies));
  return children;
}
