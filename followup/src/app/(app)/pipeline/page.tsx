import { redirect } from "next/navigation";

/**
 * Pipeline was a second copy of the customer list, grouped by stage (A-219).
 * The stages are a filter on Everyone in Customers now, with each stage's
 * total; a customer's stage changes on their own page. Old links land there.
 */
export default function PipelinePage() {
  redirect("/leads?show=all");
}
