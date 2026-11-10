# Changelog

## 0.1.0 — 2026-11-10

- **First version: values by number.** Provenance's STEP writer, by shape, for ISO 10303-21, the text an IFC file is
  written in. A path names an instance by its number, then an attribute by position, a list's member by position
  and a typed value's inside by its keyword; a reference is a leaf. A write is a splice of one value's token,
  spelled as IfcOpenShell 0.8.5 spells it: reals as C's `%.17g`, ties to even; strings with `\X2\` and `\X4\` runs.
  The old token decides between real and integer and between string and enumeration. `instances`, `real` and
  `string` are exported. No features yet: the key and `shifted` are next. It passes all seven laws of the
  stenography suite.
