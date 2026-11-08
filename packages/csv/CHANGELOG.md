# Changelog

## 0.2.0 — 2026-11-08

- **All four features.** `amend` applies a cell set inside a row a caller has staged, answering the row's new Map;
  a cell added or removed, a column the header lacks, or a value that is not a string is refused inside. `shifted`
  answers false: rows are named by their first cell and columns by their header, so nothing along a path is a
  position.

## 0.1.0 — 2026-11-08

- **First version.** Provenance's CSV writer, by shape: a path names a row by its first cell and a cell by the
  row and the column's header; a cell is a string, a row a Map from header to string. A cell keeps its quotes, a
  row keeps the bytes of the cells it does not change, a new row goes at the end in header order with the file's
  line ending. Rows are added and removed; columns are not. It passes all seven laws of the stenography suite.
