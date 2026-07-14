import type { TemplateType } from "./builtin";

export function templateTypeLabel(type: TemplateType): string {
  if (type === "invoice_note") return "Invoice note";
  if (type === "welcome_doc") return "Welcome doc";
  return type.charAt(0).toUpperCase() + type.slice(1);
}
