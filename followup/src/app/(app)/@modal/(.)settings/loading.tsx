import { SettingsWindowSkeleton } from "@/components/app/PageSkeleton";

// Settings opening as a window (A-213) shows the window at once, Settings'
// shape inside (A-254). Without this the slot borrowed (app)/loading.tsx,
// which sat beside the page and squeezed it while Settings loaded.
export default function Loading() {
  return <SettingsWindowSkeleton />;
}
