/** Exit codes shared by every command. See docs/DESIGN.md. */
export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_BLOCKED = 2;

/**
 * The one refusal text, identical for every entry and every rule. It never names what was
 * matched, so the assistant learns that a boundary exists without learning what is behind it.
 * See ADR 0003.
 */
export const BLOCKED_MESSAGE =
  "[offlimits:blocked] This touches something the owner has marked off-limits. " +
  "Do not try another way. Tell the owner.";
