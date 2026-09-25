/**
 * A new draft must never inherit the old draft's risk verdict.
 *
 * 2026-09-25 audit (research/audit/2026-09-25-daily-path-bug-hunt.md F2):
 * six places wrote `suggestedMessage` and left `suggestedRiskLevel` alone.
 * The verdict judged the PREVIOUS words, so:
 *  - on a holding account, a draft that answered a new price question sat
 *    in "Send all routine" under the old "low", and went out unread;
 *  - on a sending account, the automation reused the old "low" for text it
 *    had never checked, and sent it.
 * The automation's own contract already said it (automation.ts): "A
 * verdict stored against a different draft would be worse than none."
 *
 * This is a static guard rather than six behaviour tests, because the bug
 * is an omission: the next writer added anywhere in src/ is the one that
 * will forget. Every Prisma `data: { … }` block that writes a non-empty
 * `suggestedMessage` must also write `suggestedRiskLevel` — null for an
 * unjudged draft, or the verdict for exactly the words being written.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(__dirname, "..", "..");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

/** The text of each `data: { … }` object literal in a file, brace-matched. */
function dataBlocks(source: string): { text: string; line: number }[] {
  const blocks: { text: string; line: number }[] = [];
  const re = /\bdata\s*:\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        blocks.push({ text: source.slice(open, i + 1), line: source.slice(0, m.index).split("\n").length });
        break;
      }
    }
  }
  return blocks;
}

/** Writes a real draft: `suggestedMessage: x` or shorthand `suggestedMessage,` — but not an empty "" placeholder. */
function writesDraft(block: string): boolean {
  // `(?<![.\w])`: a KEY named suggestedMessage, never a read such as
  // `lead.suggestedMessage` inside some other record's data (sending.ts
  // copies the draft into FollowUp.draftText — that is not a new draft).
  if (/(?<![.\w])suggestedMessage\s*[,}\n]/.test(block)) return true; // shorthand
  const m = block.match(/(?<![.\w])suggestedMessage\s*:\s*([^,\n}]+)/);
  return !!m && m[1].trim() !== '""';
}

describe("every writer of a new draft resets its risk verdict", () => {
  it("finds the known writers (the scan is actually looking)", () => {
    const writers = sourceFiles(join(ROOT))
      .filter((f) => !f.endsWith("demo-data.ts"))
      .flatMap((f) => dataBlocks(readFileSync(f, "utf8")).filter((b) => writesDraft(b.text)).map(() => f));
    // scoring, regenerate, sequences, and the automation's four — if this
    // drops, the scan broke and the guard below is passing vacuously.
    expect(writers.length).toBeGreaterThanOrEqual(7);
  });

  it("never leaves the old verdict on a new draft", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(ROOT)) {
      if (file.endsWith("demo-data.ts")) continue;
      for (const block of dataBlocks(readFileSync(file, "utf8"))) {
        if (!writesDraft(block.text)) continue;
        if (/\bsuggestedRiskLevel\b/.test(block.text)) continue;
        offenders.push(`${relative(ROOT, file)}:${block.line}`);
      }
    }
    expect(offenders, `new draft written without resetting suggestedRiskLevel: ${offenders.join(", ")}`).toEqual([]);
  });
});
