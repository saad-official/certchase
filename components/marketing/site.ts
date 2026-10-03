/**
 * Shared constants and class strings for the marketing site, so header,
 * footer and pages link to the same places and focus looks the same everywhere.
 */

export const links = {
  repo: "https://github.com/saad-official/certchase",
  issues: "https://github.com/saad-official/certchase/issues",
  series: "https://github.com/saad-official/vibe-build-series",
  signIn: "/sign-in",
  signUp: "/sign-up",
  howItWorks: "/#how-it-works",
  pricing: "/pricing",
  privacy: "/privacy",
  terms: "/terms",
} as const;

/** Page container: max-w-6xl with a 16px gutter on phones. */
export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

/**
 * Solid graphite focus outline. The global default is a 50% cobalt outline,
 * which is too faint against bone; marketing links and summaries use this.
 */
export const focusRing =
  "rounded-[2px] outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-foreground";

/** Inline text link inside prose. */
export const textLink =
  "rounded-[2px] text-foreground underline decoration-foreground/30 decoration-1 underline-offset-4 hover:decoration-foreground outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-foreground";
