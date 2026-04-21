import { z } from "zod";

export const projectInputSchema = z.object({
  title: z.string().trim().min(1, "Title required").max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
