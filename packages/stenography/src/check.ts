// The laws, checked against a member's host: plain data in, findings out (spec.md, "The laws"). `run` turns them
// into node:test tests; this file has no test runner of its own, so the suite can check itself.

import { FEATURES, below, parent, type EditData, type Feature, type Splice, type Writer, type WriterDocument } from "./index.ts";

export type Law = "shape" | "deterministic" | "identity" | "read-back" | "locality" | "independent" | "refusal";
export const LAWS: readonly Law[] = ["shape", "deterministic", "identity", "read-back", "locality", "independent", "refusal"];

/** What a member hands over. */
export interface Host {
  writer: Writer;
  /** The optional members it has; checked against the shape. */
  features: readonly Feature[];
  /** Its own documents, each of which `open` must take. */
  corpus: readonly Uint8Array[];
  /** The values in a document, by path: what the laws read with. `undefined` when the bytes do not read. */
  read(bytes: Uint8Array): { paths: readonly string[]; at(path: string): EditData | undefined } | undefined;
  /** Writes that must succeed in a document. */
  edits(bytes: Uint8Array): readonly { path: string; value: EditData }[];
  /** The member's meaning; default structural. */
  equal?(a: EditData, b: EditData): boolean;
  /** Bytes `open` must refuse as `open-unreadable`; default invalid UTF-8. */
  unreadable?: Uint8Array;
  /** Laws the member knowingly fails, each with its reason: reported as skips. */
  known?: Partial<Record<Law, string>>;
}

export type Finding = { law: Law; failures: string[]; skip?: string };

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function check(host: Host): Finding[] {
  const failures = new Map<Law, string[]>(LAWS.map(l => [l, []]));
  const fail = (law: Law, message: string) => failures.get(law)!.push(message);
  const equal = host.equal ?? same;
  const coded = (where: string, r: { ok: boolean; code?: unknown }) => {
    if (!r.ok && (typeof r.code !== "string" || !KEBAB.test(r.code))) fail("refusal", `${where}: refused with no kebab-case code`);
    return r.ok;
  };
  const guard = (law: Law, where: string, f: () => void) => {
    try { f(); } catch (e) { fail(law, `${where}: threw ${(e as Error)?.message ?? e}`); }
  };

  // shape
  const w = host.writer;
  for (const m of ["claims", "open"] as const) if (typeof w[m] !== "function") fail("shape", `writer.${m} is not a function`);
  const opened = host.corpus.map((bytes, i) => {
    const copy = bytes.slice();
    let doc: WriterDocument | undefined;
    guard("shape", `document ${i}: open`, () => {
      const r = w.open(copy);
      if (coded(`document ${i}: open`, r) && r.ok) doc = r.document;
      else fail("shape", `document ${i}: open refused it`);
    });
    return { i, bytes, copy, doc, view: host.read(bytes) };
  });
  const first = opened.find(o => o.doc)?.doc;
  if (first) {
    for (const m of ["locate", "write"] as const) if (typeof first[m] !== "function") fail("shape", `document.${m} is not a function`);
    for (const f of FEATURES) {
      const has = typeof first[f] === "function", declared = host.features.includes(f);
      if (has !== declared) fail("shape", `${f}: ${has ? "present but not declared" : "declared but absent"}`);
    }
  } else fail("shape", "no document in the corpus opened");

  for (const { i, bytes, copy, doc, view } of opened) {
    if (!doc) continue;
    if (!view) { fail("shape", `document ${i}: the host could not read it`); continue; }
    const at = `document ${i}`;
    const edits = host.edits(bytes);

    // deterministic: a second opening answers the same; the caller's bytes are left as they were
    guard("deterministic", at, () => {
      const again = w.open(bytes.slice());
      if (!again.ok) return fail("deterministic", `${at}: a second open refused`);
      for (const p of view.paths) if (!sameResult(doc.locate(p), again.document.locate(p))) fail("deterministic", `${at}: locate ${p} answers differently`);
      for (const e of edits) if (!sameResult(doc.write(e.path, e.value), again.document.write(e.path, e.value))) fail("deterministic", `${at}: write ${e.path} answers differently`);
    });

    // identity: writing what a path holds answers its bytes
    for (const p of view.paths) guard("identity", `${at} ${p}`, () => {
      const value = view.at(p);
      if (value === undefined) return fail("identity", `${at}: the host lists ${p} but reads nothing there`);
      const r = doc.write(p, value);
      if (!coded(`${at} ${p}`, r) || !r.ok) return fail("identity", `${at}: writing ${p}'s own value was refused`);
      if (!bytesEqual(r.edit.bytes, bytes.subarray(r.edit.start, r.edit.end))) fail("identity", `${at}: writing ${p}'s own value changes its bytes`);
    });

    // read-back and locality, per edit
    const splices: { path: string; edit: Splice }[] = [];
    for (const e of edits) guard("read-back", `${at} ${e.path}`, () => {
      const r = doc.write(e.path, e.value);
      if (!coded(`${at} ${e.path}`, r) || !r.ok) return fail("read-back", `${at}: the edit at ${e.path} was refused`);
      if (!wellFormed(r.edit, bytes.length)) return fail("read-back", `${at}: the splice for ${e.path} lies outside the bytes`);
      splices.push({ path: e.path, edit: r.edit });
      const after = host.read(apply(bytes, [r.edit]));
      const read = after?.at(e.path);
      if (read === undefined || !equal(read, e.value)) fail("read-back", `${at}: ${e.path} does not read back as written`);

      const own = doc.locate(e.path), up = parent(e.path), outer = up === undefined ? undefined : doc.locate(up);
      if (!(own.ok && inside(r.edit, own)) && !(outer?.ok && inside(r.edit, outer))) fail("locality", `${at}: the splice for ${e.path} lies outside its own span and its parent's`);
      for (const p of view.paths) {
        if (p === e.path || below(p, e.path) || below(e.path, p)) continue;
        const was = view.at(p), now = after?.at(p);
        if (was !== undefined && (now === undefined || !equal(now, was))) fail("locality", `${at}: writing ${e.path} changed ${p}`);
      }
    });

    // independent: splices for unrelated paths do not overlap and commute
    for (let a = 0; a < splices.length; a++) for (let b = a + 1; b < splices.length; b++) {
      const x = splices[a]!, y = splices[b]!;
      if (x.path === y.path || below(x.path, y.path) || below(y.path, x.path)) continue;
      if (overlap(x.edit, y.edit)) { fail("independent", `${at}: the splices for ${x.path} and ${y.path} overlap`); continue; }
      if (!bytesEqual(apply(apply(bytes, [y.edit]), [shift(x.edit, y.edit)]), apply(apply(bytes, [x.edit]), [shift(y.edit, x.edit)])))
        fail("independent", `${at}: ${x.path} and ${y.path} give different bytes in the two orders`);
    }

    if (!bytesEqual(bytes, copy)) fail("deterministic", `${at}: the bytes handed to open were changed`);
  }

  // refusal: wrong types throw a TypeError; data problems refuse with the shared code
  const sample = opened.find(o => o.doc && host.edits(o.bytes).length);
  if (!sample?.doc) fail("refusal", "no document with an edit to try refusals on");
  else {
    const doc = sample.doc, e = host.edits(sample.bytes)[0]!;
    throwsType(() => doc.write(e.path, { not: "EditData" } as unknown as EditData), "a plain object as the value");
    throwsType(() => doc.write(42 as unknown as string, e.value), "a number as the path");
    refuses(() => doc.write("no-leading-slash", e.value), "path-malformed", "a path with no leading /");
    refuses(() => doc.write("/~2", e.value), "path-malformed", "a path with ~2");
    refuses(() => doc.write("/stenography-absent/stenography-absent", e.value), "edit-target-absent", "a path that names nothing");
  }
  refuses(() => w.open(host.unreadable ?? new Uint8Array([0xff, 0xfe, 0xfd])), "open-unreadable", "unreadable bytes");

  return LAWS.map(law => ({ law, failures: failures.get(law)!, ...(host.known?.[law] ? { skip: host.known[law] } : {}) }));

  function throwsType(f: () => unknown, what: string) {
    try { f(); fail("refusal", `${what}: did not throw`); } catch (e) { if (!(e instanceof TypeError)) fail("refusal", `${what}: threw ${(e as Error)?.name}, not a TypeError`); }
  }
  function refuses(f: () => { ok: boolean; code?: string }, code: string, what: string) {
    try {
      const r = f();
      if (r.ok) fail("refusal", `${what}: was not refused`);
      else if (r.code !== code) fail("refusal", `${what}: refused as ${r.code ?? "no code"}, not ${code}`);
    } catch (e) { fail("refusal", `${what}: threw ${(e as Error)?.message ?? e}`); }
  }
}

function apply(bytes: Uint8Array, splices: readonly Splice[]): Uint8Array {
  let out = bytes;
  for (const s of [...splices].sort((a, b) => b.start - a.start)) {
    const next = new Uint8Array(out.length - (s.end - s.start) + s.bytes.length);
    next.set(out.subarray(0, s.start)); next.set(s.bytes, s.start); next.set(out.subarray(s.end), s.start + s.bytes.length);
    out = next;
  }
  return out;
}
/** `s` moved to stand in bytes that `before` has already been applied to; `before` lies wholly on one side of it. */
const shift = (s: Splice, before: Splice): Splice =>
  before.start >= s.end ? s : { ...s, start: s.start + before.bytes.length - (before.end - before.start), end: s.end + before.bytes.length - (before.end - before.start) };
const overlap = (a: Splice, b: Splice) => a.start < b.end && b.start < a.end || (a.start === b.start && (a.start === a.end || b.start === b.end));
const inside = (s: Splice, span: { start: number; end: number }) => span.start <= s.start && s.end <= span.end;
const wellFormed = (s: Splice, length: number) => Number.isInteger(s.start) && Number.isInteger(s.end) && 0 <= s.start && s.start <= s.end && s.end <= length && s.bytes instanceof Uint8Array;
const bytesEqual = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

function sameResult(a: { ok: boolean }, b: { ok: boolean }): boolean {
  return JSON.stringify(a, (_, v) => (v instanceof Uint8Array ? [...v] : typeof v === "bigint" ? `${v}n` : v)) ===
    JSON.stringify(b, (_, v) => (v instanceof Uint8Array ? [...v] : typeof v === "bigint" ? `${v}n` : v));
}

/** Structural equality of two values: arrays by position, maps by key, scalars by `Object.is` (so `1n` is not `1`). */
export function same(a: EditData, b: EditData): boolean {
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]!));
  if (a instanceof Map) return b instanceof Map && a.size === b.size && [...a].every(([k, v]) => b.has(k) && same(v, b.get(k)!));
  return Object.is(a, b);
}
