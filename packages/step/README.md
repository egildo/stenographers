# @stenographers/step

Write one edited value back into the STEP file it was read from, over its old bytes, and touch nothing else. STEP
here is ISO 10303-21, the clear-text encoding an IFC file is written in. A value is spelled as IfcOpenShell spells
it, so a file IfcOpenShell wrote is written again by it, after an edit made here, with no byte changed. FreeCAD and
ifcmerge call a file kept this way *Native IFC*.

The member knows the format and nothing of IFC: no schema, no attribute names, no property sets. Going from a wall
to the value of one of its properties is the caller's work, on its own model; the writer is given the address the
walk ends at.

## Install

```sh
npm install @stenographers/step
```

## What it is made of

One entry, `@stenographers/step/writer`:

- `stepWriter({ claims })`: Provenance's STEP writer, by shape (`claims`, `open` giving `locate` and `write`; no
  features yet). `claims` answers for `.ifc`, `.stp`, `.step` and `.p21` unless given.
- `instances(bytes)`: the file's instances, each with its number, keyword, span and attributes, and each value with
  its kind, span, source and value: the reading the writer itself uses, so a caller pairs its model with the same
  bytes and needs no second parser.
- `real(x)` and `string(s)`: the two spellings.

**The file.** `ISO-10303-21;`, a `HEADER;` section, one `DATA;` section, `END-ISO-10303-21;`. An instance is
`#12=KEYWORD(attribute, …);`. Between any two tokens there may be spaces, line breaks and `/* comments */`, and an
instance may run over several lines: all of it is read and none of it is touched. The bytes are read one character
each, so a span is a byte span.

**Paths.** A JSON Pointer. Every instance is a root, and a path never leaves its instance.

| Path | Names |
| --- | --- |
| `""` | the file; located, not written |
| `/#19` | the instance numbered 19, from `#` to `;`; located, not written |
| `/#19/0` | its first attribute; positions count from 0, as IfcOpenShell's `entity[0]` does |
| `/#15/0/1` | the second member of a list |
| `/#19/2/IFCREAL` | the value inside a typed value: the step is the type's keyword |

A reference (`#13`) is a leaf: a path does not go through it, so one value has one path. A number is a good name
while a session lasts and a poor one across a run of the tool that owns the model, which may make an instance again
under a new number; naming an instance by a key of its own (IFC's GlobalId) is the next version.

**Values.**

| In the file | Read as | Written from |
| --- | --- | --- |
| `$` | `null` | `null` |
| `.T.` `.F.` | `true`, `false` | a boolean |
| `2150.` | a number | a number or a bigint over a real; a number where there is no old number |
| `12` | a bigint | a bigint or a whole number over an integer; a bigint where there is no old number |
| `'text'` | a string | a string, except over an enumeration |
| `.NOTDEFINED.` | the string `NOTDEFINED` | over an enumeration, a string that is a valid name |
| `(0.,1.5)` | an array | an array, each member by these rules |
| `IFCREAL(2150.)` | a `Map` of one entry, `IFCREAL` to `2150` | a `Map` of one entry whose key is a keyword |
| `#13` | the string `#13` | never: `reference-fixed` |
| `*`, `"0F"` | no value | never |

The old token decides where the value's own type cannot. JavaScript has one string for STEP's string and its
enumeration, and a caller may hold a whole number as a number or as a bigint. So a number or a bigint written over
a real is a real, and over an integer an integer; a string written over an enumeration is an enumeration, or is
refused when it is not a name. Where no old token helps, the value's type decides.

Writing `2160` at `/#19/2/IFCREAL` keeps the type; writing a `Map` at `/#19/2` sets it, also over `$`.

Writing the value a token already holds, by meaning, answers its own bytes: a real another tool spelled `1.0`
stays `1.0`. The same inside a list written whole: a member that keeps its value keeps its bytes.

**Spelling.** IfcOpenShell's, checked against IfcOpenShell 0.8.5 and against every real and string of a model it
wrote (51,519 reals, 11,735 strings).

- A real is C's `%.17g`, the fraction's trailing zeros dropped and the point kept: `2100.`, `0.5`,
  `4.3499999999999996`. The exponent form comes when the decimal exponent is below -4 or at least 17: `1.5E-05`,
  `1.E+17`. Negative zero is `-0.`. The digits are computed exactly, so a tie is rounded to even as C rounds it
  (`1125899906842624.25` is `…624.2`), where JavaScript's `toPrecision` rounds it up.
- An integer is its digits. IfcOpenShell holds 32 bits; this is said, not enforced.
- A string is in `'`. Printable ASCII is written as it is, a `'` doubled and a `\` doubled. Every other character
  goes in a run, `\X2\` and four hexadecimal digits each, closed by `\X0\`; a run that holds a character beyond
  U+FFFF is `\X4\` with eight digits each. `più` is `'pi\X2\00F9\X0\'`. Reading also takes `\X\hh` and `\S\c`.
- A list is `(a,b,c)`, with no space; a typed value `KEYWORD(v)`; an enumeration `.NAME.`.

A file from another author keeps every byte but the value written, its spaces and comments included, because the
splice is the value's token alone. The value itself is spelled IfcOpenShell's way.

**Refusals.** The shared codes, and two of its own: `reference-fixed` for a write over a reference or over a list
that holds one, and `instance-complex` for a path into a complex instance (`#1=(A(…)B(…));`). A path below a
scalar, to a position past the end, or to an instance that is not there is `edit-target-absent`. An infinity, a
NaN, a fraction over an integer, a string that is no name over an enumeration, a write over a derived attribute
(`*`), and a write to the file or to a whole instance are `edit-unrepresentable`. Every write is read again with the
member's own reader before it is answered, and is `edit-read-back` when it would not read as the value given (a
bigint no double holds, written over a real). At `open`, `open-unreadable`: no `DATA;` section, a second one, a
string or a comment left open, a number that names two instances, a file cut short.

## What it does not do

- **Name an instance by a key.** Paths are rooted at a number. The key (IFC's GlobalId) and `shifted`, for an edit
  that stays staged while the model's own tool runs, are the next version.
- **Add or remove an instance.** Anything structural goes through the tool that owns the model: a new element, a
  new property in a set.
- **Write an enumeration where there was none**, or a binary anywhere. A string over `$` is a string.
- **Address the header**, or read the author's own way of spelling reals from the file.
- **Know IFC.** `IFCREAL(12)` is written if a caller asks for a bigint inside an `IFCREAL` over `$`.

## Conformance

It passes all seven laws of [`@stenographers/stenography`](../stenography/spec.md) 0.3.0 over two fixtures:
`native.ifc`, 30 instances written by IfcOpenShell 0.8.5 holding every kind of value, and `awkward.ifc`, written by
hand with what other tools write and Part 21 allows.
