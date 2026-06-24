/**
 * Convert a rupee amount to words using the Indian numbering system
 * (thousand / lakh / crore). Used on invoices/PDFs where "Amount in words"
 * is a conventional and expected line on Indian tax documents.
 *
 *   amountInWordsINR(22500)   → "Indian Rupees Twenty-Two Thousand Five Hundred Only"
 *   amountInWordsINR(1234.50) → "Indian Rupees One Thousand Two Hundred Thirty-Four and Fifty Paise Only"
 */

const ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
  "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
  "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
  "Eighty", "Ninety",
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o === 0 ? TENS[t]! : `${TENS[t]}-${ONES[o]}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(`${ONES[h]} Hundred`);
  if (rest > 0) parts.push(twoDigits(rest));
  return parts.join(" ");
}

/** Whole-number portion → words using the Indian numbering system. */
function intToIndianWords(num: number): string {
  if (num === 0) return "Zero";
  const crore = Math.floor(num / 10_000_000);
  num %= 10_000_000;
  const lakh = Math.floor(num / 100_000);
  num %= 100_000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundreds = num;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${intToIndianWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundreds > 0) parts.push(threeDigits(hundreds));
  return parts.join(" ");
}

export function amountInWordsINR(amount: number): string {
  const safe = Math.max(0, Math.round((Number(amount) || 0) * 100) / 100);
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);
  const rupeeWords = intToIndianWords(rupees);
  if (paise > 0) {
    return `Indian Rupees ${rupeeWords} and ${twoDigits(paise)} Paise Only`;
  }
  return `Indian Rupees ${rupeeWords} Only`;
}

export function invoiceAmountInWords(amount: number, currency = "INR"): string {
  const code = (currency || "INR").toUpperCase();
  if (code === "INR") return amountInWordsINR(amount);
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
  return `${formatted} (${code})`;
}
