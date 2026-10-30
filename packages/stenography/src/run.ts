// The suite as node:test tests: one per law, named by the law, its failures in the message (spec.md, "The suite").
// A law the host lists as known is a visible skip with its reason.

import { test } from "node:test";
import { check, type Host } from "./check.ts";

export type { Host, Law, Finding } from "./check.ts";

export function run(host: Host, name = "stenography"): void {
  for (const f of check(host)) {
    test(`${name}: ${f.law}`, f.skip ? { skip: f.skip } : {}, () => {
      if (f.failures.length) throw new Error(`${f.failures.length} failure(s):\n${f.failures.slice(0, 20).join("\n")}`);
    });
  }
}
