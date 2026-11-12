import { NOTICE_SNIPPET } from "../../core/notice.js";
import { EXIT_OK } from "../../core/signal.js";
import type { Deps } from "../deps.js";

/** US-009: prints the notice for `AGENTS.md` or `CLAUDE.md`. It names nothing, so it runs anywhere. */
export function snippetCommand(deps: Deps): number {
  deps.io.stdout(NOTICE_SNIPPET.trimEnd());
  return EXIT_OK;
}
