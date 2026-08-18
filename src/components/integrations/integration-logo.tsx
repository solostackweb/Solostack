import type { ComponentType } from "react";
import {
  Apple,
  Banknote,
  CalendarDays,
  CreditCard,
  Globe2,
  Mail,
  Smartphone,
  Video,
} from "lucide-react";

type IntegrationLogoProps = {
  id: string;
  className?: string;
};

const SIMPLE_ICON_SLUGS: Record<string, { slug: string; label: string }> = {
  google_calendar: { slug: "googlecalendar", label: "Google Calendar" },
  google_drive: { slug: "googledrive", label: "Google Drive" },
  google_meet: { slug: "googlemeet", label: "Google Meet" },
  gmail: { slug: "gmail", label: "Gmail" },
  outlook: { slug: "microsoftoutlook", label: "Outlook" },
  paypal: { slug: "paypal", label: "PayPal" },
  payoneer: { slug: "payoneer", label: "Payoneer" },
  razorpay: { slug: "razorpay", label: "Razorpay" },
  remitly: { slug: "remitly", label: "Remitly" },
  revolut: { slug: "revolut", label: "Revolut" },
  stripe: { slug: "stripe", label: "Stripe" },
  stripe_link: { slug: "stripe", label: "Stripe" },
  upi: { slug: "upi", label: "UPI" },
  whatsapp: { slug: "whatsapp", label: "WhatsApp" },
  wise: { slug: "wise", label: "Wise" },
  zoom: { slug: "zoom", label: "Zoom" },
};

const FALLBACKS: Record<string, ComponentType<{ className?: string }>> = {
  apple_calendar: Apple,
  bank_wire: Banknote,
  calendar: CalendarDays,
  daily: Video,
  email: Mail,
  google_calendar: CalendarDays,
  google_drive: Globe2,
  google_meet: Video,
  gmail: Mail,
  other: Globe2,
  payment: CreditCard,
  upi: Smartphone,
  zoom: Video,
};

export function IntegrationLogo({ id, className = "h-5 w-5" }: IntegrationLogoProps) {
  const simpleIcon = SIMPLE_ICON_SLUGS[id];
  if (simpleIcon) {
    return (
      <span
        role="img"
        aria-label={`${simpleIcon.label} logo`}
        className={`${className} block bg-contain bg-center bg-no-repeat`}
        style={{ backgroundImage: `url(https://cdn.simpleicons.org/${simpleIcon.slug})` }}
      />
    );
  }

  const Fallback = FALLBACKS[id] ?? Globe2;
  return <Fallback className={className} aria-hidden="true" />;
}

export function IntegrationLogoTile({
  id,
  className = "",
}: IntegrationLogoProps) {
  return (
    <span
      className={[
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background shadow-sm",
        className,
      ].join(" ")}
    >
      <IntegrationLogo id={id} className="h-5 w-5" />
    </span>
  );
}
