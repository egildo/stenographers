// The stenographer contract's types, its shared refusal codes and its path syntax (spec.md). Types and two small
// functions only: no node: import, so a consumer that accepts writers (Provenance, a browser) can depend on it.

/** The value an edit sets: a scalar, a sequence or a mapping (a `Map` of string keys), nested. A plain object is not one. */
export type EditData = string | number | bigint | boolean | null | readonly EditData[] | ReadonlyMap<string, EditData>;

export type EditOperation =
  | { readonly op: "set" | "add"; readonly path: string; readonly value: EditData }
  | { readonly op: "remove"; readonly path: string };

/** Replace bytes `start` to `end` of the bytes as opened with `bytes`; `0 <= start <= end <= length`. */
export type Splice = { readonly start: number; readonly end: number; readonly bytes: Uint8Array };

/** A data problem: a stable kebab-case `code` (one of `CODES` when the situation is one of theirs) and words for people. */
export type Refusal = { readonly ok: false; readonly code: string; readonly reason: string };

export type OpenResult = { readonly ok: true; readonly document: WriterDocument } | Refusal;
export type LocateResult = { readonly ok: true; readonly start: number; readonly end: number } | Refusal;
export type WriteResult = { readonly ok: true; readonly edit: Splice } | Refusal;
export type AmendResult =
  | { readonly inside: false }
  | { readonly inside: true; readonly ok: true; readonly value: EditData }
  | { readonly inside: true; readonly ok: false; readonly reason: string };

/** The shape. Anything that has it is a writer; a writer that passes the suite is a stenographer. */
export interface Writer {
  claims(location: string): boolean;
  open(bytes: Uint8Array): OpenResult;
}

/** A document a writer has parsed once; every answer is against the bytes as opened. */
export interface WriterDocument {
  locate(path: string): LocateResult;
  write(path: string, value: EditData): WriteResult;
  add?(path: string, value: EditData): WriteResult;
  remove?(path: string): WriteResult;
  inside?(path: string, within: string): boolean;
  amend?(staged: { readonly path: string; readonly value: EditData }, operation: EditOperation): AmendResult;
  shifted?(path: string, newer: WriterDocument): boolean;
}

export type Feature = "add" | "remove" | "inside" | "amend" | "shifted";
export const FEATURES: readonly Feature[] = ["add", "remove", "inside", "amend", "shifted"];

/** The shared refusal codes: a member answers these for these situations, and its own codes for any other. */
export const CODES = {
  "open-unreadable": "open cannot read the bytes (not the expected encoding, or not parseable)",
  "path-malformed": "the path's syntax is wrong",
  "edit-target-absent": "the path names nothing",
  "edit-target-exists": "add where the entry is already there",
  "edit-parent-scalar": "add under a value that cannot hold entries",
  "edit-unrepresentable": "the format cannot hold this value",
  "edit-read-back": "the write would not read back as the value given",
} as const;
export type Code = keyof typeof CODES;

/**
 * A path's steps, by RFC 6901's syntax (`/` between steps, `~0` for `~`, `~1` for `/`), or `undefined` when the
 * syntax is wrong. What a step names is the member's.
 */
export function steps(path: string): string[] | undefined {
  if (path === "") return [];
  if (!path.startsWith("/") || /~(?![01])/.test(path)) return undefined;
  return path.slice(1).split("/").map(s => s.replaceAll("~1", "/").replaceAll("~0", "~"));
}

/** The path one step up, or `undefined` for the root or a malformed path. */
export function parent(path: string): string | undefined {
  const s = steps(path);
  if (s === undefined || s.length === 0) return undefined;
  return s.slice(0, -1).map(t => `/${t.replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");
}

/** Whether `path` lies strictly below `within`: its steps start with all of `within`'s. */
export function below(path: string, within: string): boolean {
  const a = steps(path), b = steps(within);
  return a !== undefined && b !== undefined && a.length > b.length && b.every((t, i) => a[i] === t);
}
