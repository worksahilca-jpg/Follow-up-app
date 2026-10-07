"use client";

import { useEffect, useState } from "react";

/**
 * How FollowUp's replies have done (research round 2, #3; drawn and
 * approved 2026-10-07): "You sent 18 of the last 20 as FollowUp wrote
 * them." In Settings, never on Today, where it would be one more thing on
 * the screen (R-026). Shown only from five replies on: fewer is not a
 * record, it is a coin toss.
 */
const MIN_REPLIES = 5;

export default function TrackRecord({ holdAll }: { holdAll: boolean }) {
  const [record, setRecord] = useState<{ asWritten: number; total: number } | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/business/track-record")
      .then((r) => r.json())
      .then((d: { success?: boolean; asWritten?: number; total?: number }) => {
        if (live && d?.success && typeof d.asWritten === "number" && typeof d.total === "number") {
          setRecord({ asWritten: d.asWritten, total: d.total });
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  if (!record || record.total < MIN_REPLIES) return null;
  const changed = record.total - record.asWritten;
  return (
    <div className="mt-4 box p-5">
      <p className="text-[13px] text-ink-soft">How FollowUp&apos;s replies have done</p>
      <p className="mt-1.5 text-[19px] leading-snug">
        You sent{" "}
        <b className="font-semibold">
          {record.asWritten} of the last {record.total}
        </b>{" "}
        as FollowUp wrote them.
      </p>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
        {changed === 0 ? "You didn't change any." : changed === 1 ? "You changed 1." : `You changed ${changed}.`}
        {holdAll ? " Every reply still waits for your OK." : ""}
      </p>
    </div>
  );
}
