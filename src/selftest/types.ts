/** A temporary folder of made-up things, and the policy that protects some of them. */
export interface Fixture {
  readonly root: string;
  /** The made-up folder the policy protects. */
  readonly protectedDir: string;
  /** A link to the protected folder, or undefined where this system would not make one. */
  readonly link: string | undefined;
  readonly policyFile: string;
  readonly settingsFile: string;
  readonly countsFile: string;
  readonly platform: NodeJS.Platform;
}

/** What one attempt did: the guard or filter refused or hid it, or it got through. */
export type Outcome = "held" | "got-through";

export interface Attempt {
  /** What was tried, in words. It uses made-up names only. */
  readonly label: string;
  /** For the guard: the text of a Bash command. */
  readonly command?: string;
  /** For the guard: a call to some other tool. */
  readonly call?: { readonly tool: string; readonly input: Record<string, unknown> };
  /** For the filter: one line of output. Defaults to `command`. */
  readonly line?: string;
}

export interface WorkaroundClass {
  readonly id: string;
  readonly title: string;
  /** Which layers the class is tried against. */
  readonly layers: readonly ("guard" | "filter")[];
  /** Why the class cannot be tried on this system, if it cannot. */
  readonly notApplicable?: (fixture: Fixture) => string | undefined;
  readonly attempts: (fixture: Fixture) => Attempt[];
  /**
   * True for a group that string matching is documented not to cover. Its attempts are expected to
   * get through, and are shown so the limit is visible, not counted as failures.
   */
  readonly outsideTextMatching?: boolean;
}

/**
 * Runs attempts against the real guard or filter and says what happened to each. The filter takes
 * all of a class's lines at once, as one stream, and the answers come back in the same order.
 */
export interface AttemptRunner {
  guard(attempt: Attempt, fixture: Fixture): Promise<Outcome>;
  filter(attempts: readonly Attempt[], fixture: Fixture): Promise<Outcome[]>;
}
