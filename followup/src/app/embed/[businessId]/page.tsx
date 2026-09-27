import ContactForm from "@/components/customer/ContactForm";
import s from "@/components/customer/customer.module.css";
import { publicSans, ibmPlexMono } from "@/lib/fonts";

// The form a business places on its own website, in an iframe. Never
// indexed on its own; the business's page is the one that should rank.
export const metadata = {
  title: "Contact",
  robots: { index: false, follow: false },
};

export default async function EmbedLeadPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return (
    <div className={`${s.root} ${publicSans.variable} ${ibmPlexMono.variable}`}>
      <ContactForm businessId={businessId} />
    </div>
  );
}
