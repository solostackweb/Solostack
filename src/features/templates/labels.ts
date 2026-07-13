import type { TemplateType } from "./builtin";

export function templateTypeLabel(type: TemplateType): string {
  return type === "invoice_note"
    ? "Invoice note"
    : type.charAt(0).toUpperCase() + type.slice(1);
}
