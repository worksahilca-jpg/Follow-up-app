import { redirect } from "next/navigation";

/**
 * "Waiting on customers" (A-050) is a group in Customers now (A-219): the
 * same people, each with what happens next. Old links and bookmarks land there.
 */
export default function WaitingPage() {
  redirect("/leads?show=waiting");
}
