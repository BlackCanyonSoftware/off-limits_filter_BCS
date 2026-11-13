import { EXIT_ERROR, EXIT_OK } from "../../core/signal.js";
import { anyGotThrough, formatReport, runSelfTest } from "../../selftest/run.js";
import type { Deps } from "../deps.js";

/**
 * US-012: tries common ways of writing the same thing against the real guard and filter, using
 * made-up names in a temporary folder, and reports what held. It never reads the owner's policy,
 * so its report is safe to share, and it runs anywhere. It exits 1 when a class that text matching
 * is meant to cover let something through.
 */
export async function testCommand(deps: Deps): Promise<number> {
  let results;
  const made = deps.selfTest.createFixture();
  try {
    results = await runSelfTest(made.fixture, deps.selfTest.runner);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "an unknown problem";
    deps.io.stderr(
      `Could not run the test: ${reason}. Has the project been built (npm run build)?`,
    );
    return EXIT_ERROR;
  } finally {
    made.cleanup();
  }
  for (const line of formatReport(results)) deps.io.stdout(line);
  return anyGotThrough(results) ? EXIT_ERROR : EXIT_OK;
}
