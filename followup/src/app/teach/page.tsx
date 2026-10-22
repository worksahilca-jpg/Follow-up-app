import { redirect } from "next/navigation";

/** The old "Teach FollowUp your business" steps (A-100) are now a conversation (A-312): old links land there. */
export default function TeachPage() {
  redirect("/tell");
}
