import { Globe, Mail, MessageCircle, Phone } from "lucide-react";

/**
 * The small channel glyph the canvas rows draw after a name or before a
 * channel's name. lucide has no brand icons, so Instagram is drawn here as
 * the canvas draws it (a rounded square and a circle).
 */
export function ChannelIcon({ channel, className = "h-3.5 w-3.5 shrink-0 text-ink-faint" }: { channel: string | null | undefined; className?: string }) {
  if (channel === "email") return <Mail className={className} strokeWidth={1.8} aria-label="Email" />;
  if (channel === "call" || channel === "text") return <Phone className={className} strokeWidth={1.8} aria-label={channel === "call" ? "Phone" : "Text"} />;
  if (channel === "web") return <Globe className={className} strokeWidth={1.8} aria-label="Website form" />;
  if (channel === "instagram")
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-label="Instagram" role="img">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    );
  if (channel === "whatsapp" || channel === "messenger")
    return <MessageCircle className={className} strokeWidth={1.8} aria-label={channel === "whatsapp" ? "WhatsApp" : "Messenger"} />;
  return null;
}

/** A customer with no messages yet still came from somewhere: read it off the source's name. */
export function channelFromSource(source: string | null | undefined): string | null {
  const s = (source ?? "").toLowerCase();
  if (/gmail|outlook|mail/.test(s)) return "email";
  if (/instagram/.test(s)) return "instagram";
  if (/whatsapp/.test(s)) return "whatsapp";
  if (/messenger|facebook/.test(s)) return "messenger";
  if (/website|form|widget/.test(s)) return "web";
  if (/call|voice|phone/.test(s)) return "call";
  if (/sms|text/.test(s)) return "text";
  return null;
}
