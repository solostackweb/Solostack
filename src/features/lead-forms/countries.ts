export type LeadFormCountry = {
  code: string;
  name: string;
  currency: string;
  phoneCode: string;
};

export const LEAD_FORM_COUNTRIES: LeadFormCountry[] = [
  { code: "IN", name: "India", currency: "INR", phoneCode: "+91" },
  { code: "US", name: "United States", currency: "USD", phoneCode: "+1" },
  { code: "GB", name: "United Kingdom", currency: "GBP", phoneCode: "+44" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", phoneCode: "+971" },
  { code: "AU", name: "Australia", currency: "AUD", phoneCode: "+61" },
  { code: "CA", name: "Canada", currency: "CAD", phoneCode: "+1" },
  { code: "SG", name: "Singapore", currency: "SGD", phoneCode: "+65" },
  { code: "DE", name: "Germany", currency: "EUR", phoneCode: "+49" },
  { code: "FR", name: "France", currency: "EUR", phoneCode: "+33" },
  { code: "NL", name: "Netherlands", currency: "EUR", phoneCode: "+31" },
  { code: "ES", name: "Spain", currency: "EUR", phoneCode: "+34" },
  { code: "IE", name: "Ireland", currency: "EUR", phoneCode: "+353" },
  { code: "CH", name: "Switzerland", currency: "CHF", phoneCode: "+41" },
  { code: "JP", name: "Japan", currency: "JPY", phoneCode: "+81" },
  { code: "NZ", name: "New Zealand", currency: "NZD", phoneCode: "+64" },
  { code: "ZA", name: "South Africa", currency: "ZAR", phoneCode: "+27" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", phoneCode: "+966" },
  { code: "ZZ", name: "Other / not listed", currency: "USD", phoneCode: "" },
];

export function countryForLeadForm(code: string | null | undefined): LeadFormCountry {
  const normalized = (code || "IN").toUpperCase();
  return LEAD_FORM_COUNTRIES.find((country) => country.code === normalized) ?? LEAD_FORM_COUNTRIES[0]!;
}

export function normalizeLeadPhone(rawPhone: string, countryCode: string): string {
  const phone = rawPhone.trim();
  if (!phone) return "";
  if (phone.startsWith("+")) return phone;
  const dialCode = countryForLeadForm(countryCode).phoneCode;
  return dialCode ? `${dialCode} ${phone}` : phone;
}
