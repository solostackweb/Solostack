import { z } from "zod";

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().uuid().optional(),
);

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
);

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(max).nullable().optional(),
  );

export const proposalStatusSchema = z.enum([
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
  "converted",
]);

export const proposalIdSchema = z.string().uuid();

export const proposalCrudSchema = z.object({
  title: z.string().trim().min(1, "Add a proposal title.").max(180),
  clientId: optionalUuid,
  projectId: optionalUuid,
  status: proposalStatusSchema.default("draft"),
  currency: z
    .string()
    .trim()
    .min(3)
    .max(3)
    .default("INR")
    .transform((value) => value.toUpperCase()),
  subtotal: z.coerce.number().min(0).default(0),
  taxAmount: z.coerce.number().min(0).default(0),
  totalAmount: z.coerce.number().min(0).default(0),
  validUntil: optionalDate,
  scope: optionalText(4000),
  deliverables: optionalText(4000),
  timeline: optionalText(1200),
  terms: optionalText(2500),
});

export type ProposalCrudInput = z.infer<typeof proposalCrudSchema>;

export const proposalItemInputSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().positive().default(1),
  unitPrice: z.coerce.number().min(0).default(0),
});

export const proposalItemsSchema = z.array(proposalItemInputSchema).max(40);

export type ProposalItemInput = z.infer<typeof proposalItemInputSchema>;
