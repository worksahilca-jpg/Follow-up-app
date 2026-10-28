"use client";

import { useEffect } from "react";

/** Tells the server the owner opened this customer, so the list row stops reading bold. Renders nothing. */
export default function MarkOpened({ leadId }: { leadId: string }) {
  useEffect(() => {
    fetch(`/api/leads/${leadId}/opened`, { method: "POST", keepalive: true }).catch(() => {});
  }, [leadId]);
  return null;
}
