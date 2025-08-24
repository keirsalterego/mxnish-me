import { defineCollection, z } from "astro:content";

const production = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string().optional()
  })
});

const now = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    lastUpdated: z.string().optional()
  })
});

const journal = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z
      .string()
      .or(z.date())
      .transform((val) => new Date(val)),
    description: z.string().optional()
  })
});

export const collections = {
  production,
  now,
  journal
};
