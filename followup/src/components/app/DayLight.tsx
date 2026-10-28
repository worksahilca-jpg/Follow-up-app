"use client";

import { useEffect } from "react";

/**
 * The soft photo behind the app's frame follows the day (A-331): a sunlit
 * street until 5 pm, the dusk street after, read from the device's clock.
 * The server always renders the day photo; the swap happens on the device
 * after mount, quietly, so nothing flashes or mismatches.
 */
export default function DayLight() {
  useEffect(() => {
    const set = () => {
      const h = new Date().getHours();
      document.documentElement.dataset.light = h >= 17 || h < 6 ? "evening" : "day";
    };
    set();
    const timer = setInterval(set, 10 * 60 * 1000);
    return () => {
      clearInterval(timer);
      delete document.documentElement.dataset.light;
    };
  }, []);
  return null;
}
