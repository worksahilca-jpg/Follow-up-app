import BookingClient from "@/components/customer/BookingClient";
import s from "@/components/customer/customer.module.css";
import { publicSans, ibmPlexMono } from "@/lib/fonts";

// A customer's own booking link: never indexed, and titled for the
// customer rather than for FollowUp (A-017).
export const metadata = {
  title: "Book a call",
  robots: { index: false, follow: false },
};

export default async function BookingPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return (
    <div className={`${s.root} ${publicSans.variable} ${ibmPlexMono.variable}`}>
      <BookingClient leadId={leadId} />
    </div>
  );
}
