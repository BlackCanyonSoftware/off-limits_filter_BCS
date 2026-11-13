import { WORKAROUND_CLASSES } from "./classes.js";
import type { AttemptRunner, Fixture, WorkaroundClass } from "./types.js";

/** How a class did against one layer. */
export type LayerResult =
  | { status: "tried"; held: number; total: number; gotThrough: string[] }
  | { status: "not-applicable"; reason: string }
  | { status: "not-tried" };

export interface ClassResult {
  readonly id: string;
  readonly title: string;
  readonly outsideTextMatching: boolean;
  readonly guard: LayerResult;
  readonly filter: LayerResult;
}

/** How many guard attempts run at once. Each is its own short process. */
const CONCURRENCY = 6;

async function inBatches<T, R>(
  items: readonly T[],
  size: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let at = 0; at < items.length; at += size) {
    results.push(...(await Promise.all(items.slice(at, at + size).map(work))));
  }
  return results;
}

/** Runs every class against the real guard and filter. */
export async function runSelfTest(
  fixture: Fixture,
  runner: AttemptRunner,
  classes: readonly WorkaroundClass[] = WORKAROUND_CLASSES,
): Promise<ClassResult[]> {
  const results: ClassResult[] = [];
  for (const workaround of classes) {
    const reason = workaround.notApplicable?.(fixture);
    const attempts = reason === undefined ? workaround.attempts(fixture) : [];

    const against = async (layer: "guard" | "filter"): Promise<LayerResult> => {
      if (!workaround.layers.includes(layer)) return { status: "not-tried" };
      if (reason !== undefined) return { status: "not-applicable", reason };
      const usable = attempts.filter((attempt) =>
        layer === "guard"
          ? attempt.command !== undefined || attempt.call !== undefined
          : attempt.command !== undefined || attempt.line !== undefined,
      );
      const outcomes =
        layer === "guard"
          ? await inBatches(usable, CONCURRENCY, (attempt) => runner.guard(attempt, fixture))
          : await runner.filter(usable, fixture);
      const gotThrough = usable
        .filter((_, index) => outcomes[index] === "got-through")
        .map((a) => a.label);
      return {
        status: "tried",
        held: usable.length - gotThrough.length,
        total: usable.length,
        gotThrough,
      };
    };

    const [guard, filter] = [await against("guard"), await against("filter")];
    results.push({
      id: workaround.id,
      title: workaround.title,
      outsideTextMatching: workaround.outsideTextMatching ?? false,
      guard,
      filter,
    });
  }
  return results;
}

/** True when a class that text matching is meant to cover let something through. */
export function anyGotThrough(results: readonly ClassResult[]): boolean {
  return results.some(
    (result) =>
      !result.outsideTextMatching &&
      [result.guard, result.filter].some(
        (layer) => layer.status === "tried" && layer.gotThrough.length > 0,
      ),
  );
}

const cell = (layer: LayerResult): string => {
  if (layer.status === "not-tried") return "-";
  if (layer.status === "not-applicable") return "not applicable";
  return layer.gotThrough.length === 0
    ? `held ${String(layer.held)}/${String(layer.total)}`
    : `GOT THROUGH ${String(layer.total - layer.held)}/${String(layer.total)}`;
};

/** The report, as lines of plain text. It uses made-up names only, so it is safe to share. */
export function formatReport(results: readonly ClassResult[]): string[] {
  const width = Math.max(...results.map((r) => r.title.length), 5);
  const lines = [
    "Off-Limits test: common ways of writing the same thing, tried against the real guard and filter",
    "with made-up names in a temporary folder. Your own policy is not read.",
    "",
    `${"Class".padEnd(width)}  ${"Guard".padEnd(16)}  Filter`,
  ];
  for (const result of results.filter((r) => !r.outsideTextMatching)) {
    lines.push(
      `${result.title.padEnd(width)}  ${cell(result.guard).padEnd(16)}  ${cell(result.filter)}`,
    );
  }
  const failures = results.flatMap((result) =>
    (["guard", "filter"] as const).flatMap((name) => {
      const layer = result[name];
      return !result.outsideTextMatching && layer.status === "tried"
        ? layer.gotThrough.map((label) => `  ${result.title} (${name}): ${label}`)
        : [];
    }),
  );
  if (failures.length > 0) lines.push("", "Got through:", ...failures);

  const outside = results.filter((r) => r.outsideTextMatching);
  for (const result of outside) {
    if (result.guard.status !== "tried") continue;
    lines.push(
      "",
      `${result.title}:`,
      `  Text matching is documented not to cover these (see docs/THREAT-MODEL.md). Result here: ${String(result.guard.gotThrough.length)} of ${String(result.guard.total)} got through.`,
    );
  }
  lines.push(
    "",
    failures.length === 0
      ? "Every class that text matching is meant to cover held."
      : "Some attempts got through. See the list above, and docs/THREAT-MODEL.md.",
  );
  return lines;
}
