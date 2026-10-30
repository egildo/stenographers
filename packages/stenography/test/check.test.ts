// The suite checks itself on a toy format, `key=value` lines addressed as `/key`: a writer that splices only the
// value passes every law, and one that writes the whole file again fails locality.

import { test } from "node:test";
import assert from "node:assert/strict";
import { check, type Host } from "../src/check.ts";
import { below, parent, steps, type EditData, type Refusal, type Writer } from "../src/index.ts";

const enc = new TextEncoder(), dec = new TextDecoder("utf-8", { fatal: true });
const no = (code: string, reason: string): Refusal => ({ ok: false, code, reason });

type Line = { key: string; start: number; end: number; value: string };
function lines(text: string): Line[] {
  const out: Line[] = [];
  let at = 0;
  for (const l of text.split("\n")) {
    const eq = l.indexOf("=");
    if (eq > 0) out.push({ key: l.slice(0, eq), start: at + eq + 1, end: at + l.length, value: l.slice(eq + 1) });
    at += l.length + 1;
  }
  return out;
}

function toyWriter(rewriteAll = false): Writer {
  return {
    claims: (location) => location.endsWith(".kv"),
    open(bytes) {
      let text: string;
      try { text = dec.decode(bytes); } catch { return no("open-unreadable", "not UTF-8"); }
      const found = (path: string) => lines(text).find(l => `/${l.key}` === path);
      const target = (path: string) => {
        if (typeof path !== "string") throw new TypeError("a path is a string");
        if (steps(path) === undefined) return no("path-malformed", `${path} is not a pointer`);
        return found(path) ?? no("edit-target-absent", `no ${path}`);
      };
      return {
        ok: true,
        document: {
          locate(path) {
            const t = target(path);
            return "ok" in t ? t : { ok: true, start: t.start, end: t.end };
          },
          write(path, value) {
            if (typeof value !== "string") throw new TypeError("a value is a string");
            const t = target(path);
            if ("ok" in t) return t;
            if (value.includes("\n")) return no("edit-unrepresentable", "a value holds no line break");
            if (!rewriteAll) return { ok: true, edit: { start: t.start, end: t.end, bytes: enc.encode(value) } };
            const all = lines(text).map(l => `${l.key}=${l === t ? value : l.value}`).join("\n") + "\n";
            return { ok: true, edit: { start: 0, end: bytes.length, bytes: enc.encode(all) } };
          },
        },
      };
    },
  };
}

const host = (writer: Writer): Host => ({
  writer,
  features: [],
  corpus: [enc.encode("# people\nname=Ada\nteam=north\n\ndays=5\n")],
  read(bytes) {
    const ls = lines(dec.decode(bytes));
    return { paths: ls.map(l => `/${l.key}`), at: (p: string): EditData | undefined => ls.find(l => `/${l.key}` === p)?.value };
  },
  edits: () => [{ path: "/name", value: "Bruno" }, { path: "/days", value: "12" }],
});

test("a writer that splices only the value passes every law", () => {
  for (const f of check(host(toyWriter()))) assert.deepEqual(f.failures, [], f.law);
});

test("a writer that writes the whole file again fails locality", () => {
  const f = check(host(toyWriter(true)));
  assert.ok(f.find(x => x.law === "locality")!.failures.length > 0);
  assert.ok(f.find(x => x.law === "independent")!.failures.length > 0);
});

test("a known law is reported as a skip with its reason", () => {
  const f = check({ ...host(toyWriter(true)), known: { locality: "rewrites the file" } });
  assert.equal(f.find(x => x.law === "locality")!.skip, "rewrites the file");
});

test("declared features are checked against the shape", () => {
  const f = check({ ...host(toyWriter()), features: ["add"] });
  assert.deepEqual(f.find(x => x.law === "shape")!.failures, ["add: declared but absent"]);
});

test("RFC 6901 syntax: steps, parent, below", () => {
  assert.deepEqual(steps("/a~1b/c~0d"), ["a/b", "c~d"]);
  assert.equal(steps("a"), undefined);
  assert.equal(steps("/~2"), undefined);
  assert.equal(parent("/a~1b/c"), "/a~1b");
  assert.equal(parent("/a"), "");
  assert.equal(parent(""), undefined);
  assert.ok(below("/a/b", "/a") && !below("/a", "/a") && !below("/ab", "/a") && below("/a", ""));
});
