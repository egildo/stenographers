# Changelog

## 0.2.0 — 2026-11-08

- **Data blocks.** A `<script>` with an `id` whose `type` ends in `json` has a path of its own, its id under the
  container it sits in, and a value of its own, its text; the write replaces the text between its tags and keeps
  everything else. Text that would end the element early is refused as `edit-read-back`. `outline` lists it with
  `tag` `script` and no blocks. The suite runs over BelType's bill specimen as well.

## 0.1.0 — 2026-11-08

- **First version.** Provenance's HTML writer, by shape, at the grain of blocks: a path names a container by its
  id, the value is its blocks, an unchanged block keeps its bytes, a changed one is written whole. It passes all
  seven laws of the stenography suite.
