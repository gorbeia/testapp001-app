import { z } from "zod";

export const setupChecklistItemIdSchema = z.enum([
  "contact",
  "sepa",
  "category",
  "product",
  "table",
  "members",
  "subdomain",
]);

export type SetupChecklistItemId = z.infer<typeof setupChecklistItemIdSchema>;

export const setupChecklistItemSchema = z.object({
  id: setupChecklistItemIdSchema,
  done: z.boolean(),
  /** When false, UI may hide the row (e.g. subdomain when apex is not configured). */
  applicable: z.boolean().optional(),
});

export type SetupChecklistItem = z.infer<typeof setupChecklistItemSchema>;

export const setupChecklistResponseSchema = z.object({
  items: z.array(setupChecklistItemSchema),
});

export type SetupChecklistResponse = z.infer<typeof setupChecklistResponseSchema>;
