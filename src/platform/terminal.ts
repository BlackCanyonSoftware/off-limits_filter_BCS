import { createInterface } from "node:readline";

/** True only when a person is typing at a terminal: both input and output are a TTY. */
export function isInteractive(): boolean {
  return isTerminal(process.stdin) && isTerminal(process.stdout);
}

/** `isTTY` is undefined, not false, when a stream is not a terminal. */
function isTerminal(stream: { isTTY?: boolean }): boolean {
  return stream.isTTY === true;
}

/**
 * Asks one question and returns the answer. Returns an empty answer if input ends. Given
 * suggestions, Tab completes what has been typed so far (US-016).
 */
export function ask(question: string, suggestions: readonly string[] = []): Promise<string> {
  const lines = createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: (typed: string): [string[], string] => {
      const wanted = typed.toLowerCase();
      const hits = suggestions.filter((suggestion) => suggestion.toLowerCase().startsWith(wanted));
      return [hits, typed];
    },
  });
  return new Promise<string>((resolve) => {
    lines.once("close", () => {
      resolve("");
    });
    lines.question(question, (answer) => {
      resolve(answer);
      lines.close();
    });
  });
}
