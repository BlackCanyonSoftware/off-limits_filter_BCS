/**
 * The short instruction an owner places in `AGENTS.md` or `CLAUDE.md`, so an assistant knows
 * what a boundary signal means and how to behave at it. It names no entry (ADR 0003).
 */
export const NOTICE_SNIPPET = `## Off-Limits

Some things on this machine are intentionally hidden or off-limits to you.

If a tool call is refused with \`[offlimits:blocked]\`, or output shows \`[offlimits:filtered]\`,
that is expected. Please stop there: carry on with the rest of your task without that
part, or tell the owner what you were trying to do and let them decide. Please do not retry
the same thing with a different spelling, path or tool, and leave Off-Limits' own files and
settings as they are.
`;
