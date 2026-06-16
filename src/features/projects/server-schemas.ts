/**
 * Server-side Zod schemas for project CRUD.
 * Independent of the legacy `./schema.ts` so the persistence layer can
 * evolve without touching the frontend mock UI.
 */

import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : undefined));

const optionalDate = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date");

const optionalUuid = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => !v || /^[0-9a-fA-F-]{36}$/.test(v), "Invalid id");

export const projectStatusSchema = z.enum([
  "lead",
  "planning",
  "active",
  "waiting_on_client",
  "revision",
  "review",
  "on_hold",
  "completed",
  "cancelled",
  "archived",
]);

export const projectCrudSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
  description: optionalText(2000),
  clientId: optionalUuid,
  status: projectStatusSchema.default("planning"),
  startDate: optionalDate,
  dueDate: optionalDate,
  billingEnabled: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((v) => v === true || v === "true")
    .default(false),
  hourlyRate: z.coerce.number().min(0).default(0),
});

export type ProjectCrudInput = z.infer<typeof projectCrudSchema>;

export const projectIdSchema = z.string().uuid("Invalid project id");
