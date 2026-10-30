# Stenography

**Draft, unreleased (0.0.0).** The contract a stenographer meets. The reasoning and the prior art behind each
rule are in 0km's `proposals/stenography-contract.md`.

A stenographer writes an edited value back over its old bytes, in the author's style, and touches nothing else.
This specification says what that means precisely enough for a suite to check it. It does not say how a
document is read into values, how edits are staged, or how files are written: those are the caller's.

## Terminology

- **Bytes as opened**: the `Uint8Array` that `open` was given. Every answer is against these bytes.
- **Path**: the address of one value, in RFC 6901 syntax: `/` before each step, `~0` for `~` and `~1` for `/`, no
  other escape. `""` is the root. What a step names (a key, an index, a heading) is the member's.
- **Parent**: a path without its last step. **Below**: a path is below another when it starts with all of the
  other's steps and has more.
- **Value**: an `EditData`: a string, number, bigint, boolean or null; an array of values; or a `Map` from strings
  to values. A plain object is not a value. What a value means is the member's.
- **Splice**: `{ start, end, bytes }`: replace bytes `start` to `end` of the bytes as opened with `bytes`.
  Offsets count bytes. `0 <= start <= end <= length`.
- **Refusal**: `{ ok: false, code, reason }`. `code` is a stable kebab-case word; `reason` is for people.
- **Writer**: anything with the shape below.
- **Stenographer**: a writer that passes the suite.

## The shape

The types are this package's `index.ts`. Required: `claims(location)`, `open(bytes)`, and on the document
`locate(path)` and `write(path, value)`. The **features** `add`, `remove`, `inside`, `amend` and `shifted` are
optional; an absent one means the member does not do it.

A writer carries no version and no vendor. Conformance is shown by passing the suite, not by a field.

## Refusal codes

When a situation is in this table, a member must answer its code. Any other refusal carries the member's own
stable kebab-case code.

| Code | When |
| --- | --- |
| `open-unreadable` | `open` cannot read the bytes (not the expected encoding, or not parseable) |
| `path-malformed` | the path's syntax is wrong |
| `edit-target-absent` | the path names nothing |
| `edit-target-exists` | `add` where the entry is already there |
| `edit-parent-scalar` | `add` under a value that cannot hold entries |
| `edit-unrepresentable` | the format cannot hold this value |
| `edit-read-back` | the write would not read back as the value given |

## The laws

Each law is a *must*, and its name is the name of its test. A host (below) supplies the reader the laws read
values with, and the equality they compare by.

1. **`shape`**. The required members are functions. A feature is present exactly when the host declares it.
2. **`deterministic`**. The same arguments get the same answers, and the bytes handed to `open` are never
   changed.
3. **`identity`**. Writing the value a path already holds answers a splice whose bytes equal the bytes it
   replaces.
4. **`read-back`**. After a `write` splice is applied, the path reads as the value written. A write that cannot
   meet this is a refusal, never a splice.
5. **`locality`**. A splice lies inside the span `locate` gives for the edited path or for its parent. After it
   is applied, every listed path that is not the edited one, below it or above it reads as before.
6. **`independent`**. Splices for two paths, neither below the other, do not overlap, and applied in either
   order give the same bytes.
7. **`refusal`**. A value that is not `EditData`, or a path that is not a string, throws a `TypeError`. A
   malformed path, a path that names nothing, a value the format cannot hold, and bytes `open` cannot read are
   refusals, with the codes above.

Style is not a law: copy the nearest sibling, take the line ending from the file's first break, ask the caller
for no style options. A member that cannot write a value in place may refuse it, rewrite an enclosing value, or
write it in another notation the format allows; each is conformant while the laws hold.

## The suite

`run(host)` from `@stenographers/stenography/run` registers one `node:test` test per law. A host is:

- `writer`, and the `features` it declares;
- `corpus`: documents `open` must take;
- `read(bytes)`: the paths in a document and the value at each;
- `edits(bytes)`: writes that must succeed, so a writer that refuses everything fails;
- optionally `equal`, `unreadable` (bytes to refuse as `open-unreadable`), and `known`: laws the member
  knowingly fails, each with its reason, reported as skips.

## Versions

This specification's version is the package's. A *normative* change alters what conformance means: a minor
version when it only adds, a major one when it breaks. An *informative* change is a patch. The changelog sorts
every change into one of the two.
