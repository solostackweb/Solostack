import { z } from "zod";

const nullishToEmptyString = (value: unknown) => (value == null ? "" : value);

const optionalUuid = z
  .preprocess(nullishToEmptyString, z.string().trim().optional().or(z.literal("")))
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => !v || /^[0-9a-fA-F-]{36}$/.test(v), "Invalid id");

const optionalText = (max: number) =>
  z
    .preprocess(nullishToEmptyString, z.string().trim().max(max).optional().or(z.literal("")))
    .transform((v) => (v && v.length > 0 ? v : undefined));

const optionalDate = z
  .preprocess(nullishToEmptyString, z.string().trim().optional().or(z.literal("")))
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date");

export const contractKindSchema = z.enum(["proposal", "contract"]);
export const contractStatusSchema = z.enum([
  "draft",
  "sent",
  "viewed",
  "signed",
  "declined",
  "expired",
]);

export const contractCrudSchema = z.object({
  kind: contractKindSchema.default("contract"),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title is too long"),
  content: optionalText(50_000),
  clientId: optionalUuid,
  projectId: optionalUuid,
  status: contractStatusSchema.default("draft"),
  currency: z.string().trim().toUpperCase().min(3).max(3).default("INR"),
  valueAmount: z
    .union([z.coerce.number().min(0), z.literal("")])
    .optional()
    .transform((v) => (typeof v === "number" ? v : undefined)),
  expiresAt: optionalDate,
});

export type ContractCrudInput = z.infer<typeof contractCrudSchema>;

export const contractIdSchema = z.string().uuid("Invalid contract id");
