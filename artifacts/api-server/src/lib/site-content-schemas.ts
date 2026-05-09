import { z } from "zod";
import type { SiteContentKey } from "./site-content-defaults";

const homeSchema = z.object({
  hero: z.object({
    eyebrow: z.string(),
    headlineLine1: z.string(),
    headlineLine2: z.string(),
    body: z.string(),
    ctaLabel: z.string(),
  }),
  intro: z.object({
    eyebrow: z.string(),
    title: z.string(),
    body: z.string(),
    features: z.array(z.object({ title: z.string(), desc: z.string() })),
  }),
  applicants: z.object({
    eyebrow: z.string(),
    title: z.string(),
    items: z.array(z.string()),
  }),
  flow: z.object({
    eyebrow: z.string(),
    title: z.string(),
    steps: z.array(z.object({ month: z.string(), title: z.string(), desc: z.string() })),
  }),
  schedule: z.object({
    eyebrow: z.string(),
    title: z.string(),
    steps: z.array(z.object({ phase: z.string(), date: z.string(), desc: z.string() })),
  }),
  faqTeaser: z.object({
    eyebrow: z.string(),
    title: z.string(),
    items: z.array(z.object({ q: z.string(), a: z.string() })),
    ctaLabel: z.string(),
  }),
  cta: z.object({ title: z.string(), body: z.string(), ctaLabel: z.string() }),
});

const aboutSchema = z.object({
  title: z.string(),
  intro: z.string(),
  sections: z.array(z.object({ heading: z.string(), body: z.string() })),
  values: z.array(z.object({ label: z.string(), desc: z.string() })),
});

const programSchema = z.object({
  title: z.string(),
  curriculum: z.object({
    heading: z.string(),
    items: z.array(z.object({ title: z.string(), desc: z.string() })),
  }),
  benefits: z.object({
    heading: z.string(),
    items: z.array(z.string()),
  }),
});

const faqSchema = z.object({
  title: z.string(),
  items: z.array(z.object({ q: z.string(), a: z.string() })),
});

export const SITE_CONTENT_SCHEMAS: Record<SiteContentKey, z.ZodTypeAny> = {
  "page.home": homeSchema,
  "page.about": aboutSchema,
  "page.program": programSchema,
  "page.faq": faqSchema,
};
