import { z } from "zod";

/**
 * A URL that is safe to put in an `href`.
 *
 * `z.string().url()` alone is NOT that. Zod 3 validates with `new URL()`, which
 * happily accepts any scheme — verified against the pinned 3.25.76:
 *
 *   z.string().url().safeParse("javascript:alert(document.cookie)")  → success
 *   z.string().url().safeParse("data:text/html,<script>…</script>")  → success
 *   z.string().url().safeParse("file:///etc/passwd")                 → success
 *
 * Both places that store a user-supplied URL render it straight into an anchor
 * (`finance.tsx` receipts, `media.tsx` external links), so a stored
 * `javascript:` URL executes in our origin the moment someone clicks it. Every
 * writer here is an admin, which caps the blast radius — but "only staff can
 * plant it" is not the same as "it does nothing", and the fix is one predicate.
 *
 * http/https only. Anything that stores a link for a human to click should use
 * this instead of a bare `.url()`.
 */
export const HttpUrl = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine(
    (v) => {
      try {
        const scheme = new URL(v).protocol;
        return scheme === "http:" || scheme === "https:";
      } catch {
        return false;
      }
    },
    { message: "http 또는 https 주소만 사용할 수 있습니다." },
  );
