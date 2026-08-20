"use client";

import * as React from "react";
import { INDIAN_STATES } from "@/features/gst/state-codes";

/**
 * Dropdown of all Indian state / UT codes. Submits the two-digit code via
 * a hidden input so the surrounding `<form>` works without controlled state.
 */
export function StateSelect({
  name,
  defaultValue,
  value,
  onValueChange,
  required,
  placeholder = "Select state",
  id,
}: {
  name: string;
  id?: string;
  defaultValue?: string | null;
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const [internalValue, setInternalValue] = React.useState<string>(
    defaultValue ?? "",
  );
  const isControlled = typeof value !== "undefined";
  const selected = isControlled ? value : internalValue;
  const handleChange = (next: string) => {
    if (!isControlled) setInternalValue(next);
    onValueChange?.(next);
  };
  return (
    <select
      id={id}
      name={name}
      value={selected}
      required={required}
      onChange={(event) => handleChange(event.target.value)}
      className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {INDIAN_STATES.map((s) => (
        <option key={s.code} value={s.code}>
          {s.name} ({s.code})
        </option>
      ))}
    </select>
  );
}
