# @stenographers/csv

Write an edited cell or row back into the CSV file it was read from, over its old bytes, and touch nothing else. A
cell keeps its quotes, a row keeps the bytes of every cell it does not change, a new row takes the header's order
and the file's line ending.

## Install

```sh
npm install @stenographers/csv
```

## What it is made of

One entry, `@stenographers/csv/writer`:

- `csvWriter()`: Provenance's CSV writer, by shape (`claims`, `open` giving `locate`, `write`, `add` and `remove`).
- `table(text)`: the file's records, each its span, its cells' spans and values, the reading the writer itself
  uses, so a caller pairs its values with the same bytes.
- `format(value, wasQuoted)`: a cell's bytes for a value.

**The file.** RFC 4180: a header row, then data rows; cells split by commas; a cell in `"` may hold a comma, a quote
(doubled) or a line break; records end in CRLF, LF or CR, and the last may end in none. UTF-8.

**Paths.** A JSON Pointer. `/<row>` names a row by its first cell, which must be unique in the file; `/<row>/<column>`
names a cell by the row and the column's header, each step escaped as RFC 6901 escapes a step. In viale-merello's
registers the first cell is the IFC GlobalId, so `/3aEeOVJlH4avKjv6IRUfbk/Layers` is one cell. Rows are not named
by index: an insert would rename every row after it. The root `""` is the whole file, located but not written.

**Values.** A cell is a string. A row is a `Map` from header to string: a column left out is written empty, except
the first, which is the row's address and stays unless the Map names a new one. `write` sets a cell or a row;
`add` at `/<row>` appends a row at the end, in the header's order (the first cell is the path, or the Map's first
cell when they agree); `remove` at `/<row>` takes the row and its line ending. A column is not added, removed or
written whole: that is a later version, when a register grows a field.

**Style.** A cell is quoted when its value holds a comma, a quote, a line break or an outer space, or when its old
bytes were quoted; otherwise bare. The line ending is the file's first break. Nothing else in the file is touched.

**Refusals.** The shared codes, and three of its own: `row-key-duplicate` for a path to a row whose first cell
another row has too, or a write that would make one; `row-ragged` for a path to a row with more or fewer cells than
the header; `row-key-fixed` for a write to a row's first cell alone, which would move every other cell of the row
(write the row to rename it, and read it back at the new path). A header that names a column twice is refused at
`open` as `column-duplicate`; a quote left open, bytes after a closing quote, an empty file and bytes that are not
UTF-8 are `open-unreadable`.

## What it does not do

One delimiter, the comma. No column added, removed or renamed. No header written. No row inserted at a place: a row
added goes at the end. It holds no file: it answers a splice over the bytes it was given, and writing it is the
caller's.

## Proved by

`npm test`: the seven laws of `@stenographers/stenography` over viale-merello's `model/floors/types.csv`, a small
file with CRLF line ends, a quoted cell holding a comma, a quote and a line break, an empty cell and a quoted cell
that needs no quotes, and a bare file with no line ending after its last row; and `test/writer.test.js`, each edit
in exact bytes.
