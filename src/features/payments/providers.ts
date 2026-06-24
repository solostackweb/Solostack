/**
 * Registry of external payment platforms a freelancer can connect.
 *
 * Stackivo never collects money — these are the freelancer's OWN accounts /
 * links, displayed on the invoice for international clients to pay. Adding a
 * new platform is just a new entry here (no migration needed — the DB stores
 * `provider` as free text).
 *
 * `kind`:
 *   - "link"   → value is a full pay URL; we render a "Pay with X" button.
 *   - "handle" → value is an identifier (email / id); we show it + copy + the
 *                freelancer's instructions.
 */

export type PaymentProviderKind = "link" | "handle";

export interface PaymentProvider {
  id: string;
  name: string;
  /** Default capture style; the connection can still override `kind`. */
  kind: PaymentProviderKind;
  /** Label for the input the freelancer fills (the link or handle). */
  valueLabel: string;
  valuePlaceholder: string;
  /** Short helper text under the input. */
  help?: string;
  /** Mainly for international receiving (vs domestic UPI). */
  scope: "international" | "both";
}

export const PAYMENT_PROVIDERS: PaymentProvider[] = [
  {
    id: "paypal",
    name: "PayPal",
    kind: "link",
    valueLabel: "PayPal.me link or PayPal email",
    valuePlaceholder: "https://paypal.me/yourname",
    help: "Create a PayPal.me link in your PayPal account, or paste your PayPal email.",
    scope: "international",
  },
  {
    id: "wise",
    name: "Wise",
    kind: "link",
    valueLabel: "Wise payment link",
    valuePlaceholder: "https://wise.com/pay/me/yourname",
    help: "In Wise → Receive → 'Get paid', copy your payment link.",
    scope: "international",
  },
  {
    id: "payoneer",
    name: "Payoneer",
    kind: "link",
    valueLabel: "Payoneer 'Request a Payment' link",
    valuePlaceholder: "https://payoneer.com/...",
    help: "In Payoneer → Request a Payment, share the generated link.",
    scope: "international",
  },
  {
    id: "stripe_link",
    name: "Stripe",
    kind: "link",
    valueLabel: "Stripe Payment Link",
    valuePlaceholder: "https://buy.stripe.com/...",
    help: "Create a Payment Link in your Stripe dashboard.",
    scope: "international",
  },
  {
    id: "revolut",
    name: "Revolut",
    kind: "link",
    valueLabel: "Revolut.me link",
    valuePlaceholder: "https://revolut.me/yourname",
    scope: "international",
  },
  {
    id: "remitly",
    name: "Remitly",
    kind: "handle",
    valueLabel: "Receiving details / email",
    valuePlaceholder: "your@email.com",
    scope: "international",
  },
  {
    id: "bank_wire",
    name: "Bank transfer (SWIFT/wire)",
    kind: "handle",
    valueLabel: "Account / IBAN / SWIFT details",
    valuePlaceholder: "Acct, IBAN, SWIFT/BIC, bank name",
    help: "Shown to the client with your instructions. Use the notes field for full details.",
    scope: "international",
  },
  {
    id: "other",
    name: "Other",
    kind: "link",
    valueLabel: "Payment link or details",
    valuePlaceholder: "https://… or account details",
    help: "Any other platform — paste a link or details.",
    scope: "international",
  },
];

/** A freelancer's saved connection to one of the above platforms. */
export interface PaymentConnection {
  id: string;
  userId: string;
  provider: string;
  label: string | null;
  kind: PaymentProviderKind;
  value: string;
  instructions: string | null;
  isDefault: boolean;
  status: "active" | "disabled";
  createdAt: string;
}

export function getProvider(id: string): PaymentProvider | undefined {
  return PAYMENT_PROVIDERS.find((p) => p.id === id);
}

export function providerName(id: string): string {
  return getProvider(id)?.name ?? id;
}

/** True when a stored value looks like a usable http(s) link. */
export function isPayUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}
