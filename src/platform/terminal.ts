import { createInterface } from "node:readline";

/** True only when a person is typing at a terminal: both input and output are a TTY. */
export function isInteractive(): boolean {
  return isTerminal(process.stdin) && isTerminal(process.stdout);
}

/** `isTTY` is undefined, not false, when a stream is not a terminal. */
function isTerminal(stream: { isTTY?: boolean }): boolean {
  return stream.isTTY === true;
}

/** Asks one question and returns the answer. Returns an empty answer if input ends. */
export function ask(question: string): Promise<string> {
  const lines = createInterface({ input: process.stdin, output: process.stdout });
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
