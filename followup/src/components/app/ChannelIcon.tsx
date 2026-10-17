import { Globe, Mail, Phone } from "lucide-react";
import { BrandMark } from "@/components/brandLogos";
import { LEAD_FORM } from "@/lib/displayChannel";

/**
 * The small channel glyph the canvas rows draw after a name or before a
 * channel's name: the app's own logo where there is one (brandLogos.tsx).
 */
export function ChannelIcon({ channel, className = "h-3.5 w-3.5 shrink-0 text-ink-faint" }: { channel: string | null | undefined; className?: string }) {
  if (channel === "email") return <Mail className={className} strokeWidth={1.8} aria-label="Email" />;
  if (channel === "call" || channel === "text") return <Phone className={className} strokeWidth={1.8} aria-label={channel === "call" ? "Phone" : "Text"} />;
  if (channel === "web") return <Globe className={className} strokeWidth={1.8} aria-label="Website form" />;
  // The apps' own logos, in their own colours (founder 2026-10-17, A-276). Email stays a plain envelope: it can be
  // Gmail or Outlook, and the row doesn't say which.
  if (channel === LEAD_FORM) return <BrandMark brand="facebook" className={className} />;
  if (channel === "instagram") return <BrandMark brand="instagram" className={className} />;
  if (channel === "whatsapp") return <BrandMark brand="whatsapp" className={className} />;
  if (channel === "messenger") return <BrandMark brand="messenger" className={className} />;
  return null;
}

/** A customer with no messages yet still came from somewhere: read it off the source's name. */
export function channelFromSource(source: string | null | undefined): string | null {
  const s = (source ?? "").toLowerCase();
  if (/gmail|outlook|mail/.test(s)) return "email";
  if (/instagram/.test(s)) return "instagram";
  if (/whatsapp/.test(s)) return "whatsapp";
  if (/facebook lead ad/.test(s)) return LEAD_FORM;
  if (/messenger|facebook/.test(s)) return "messenger";
  if (/website|form|widget/.test(s)) return "web";
  if (/call|voice|phone/.test(s)) return "call";
  if (/sms|text/.test(s)) return "text";
  return null;
}
