# stenographers

Writers that write an edited value back over its old bytes, in the author's style, and touch nothing else. A
*writer* is anything with the shape; a *stenographer* is a writer that passes the suite.

## Packages

- [`@stenographers/markdown`](packages/markdown): the Markdown stenographer, Provenance's Markdown writer by shape.
- [`@stenographers/html`](packages/html): the HTML stenographer at the grain of blocks, Provenance's HTML writer by
  shape.
- [`@stenographers/csv`](packages/csv): the CSV stenographer, Provenance's CSV writer by shape: a cell or a row over
  its old bytes.
- [`@stenographers/step`](packages/step): the STEP stenographer, for the text an IFC file is written in: one value
  over its old bytes, spelled as IfcOpenShell spells it.

## Planned

- `@stenographers/stenography`: the specification, its types and the conformance suite every member runs. The
  contract is drafted in 0km's `proposals/stenography-contract.md`.
- YAML and JSON, from Cascata's writers, once they pass the suite.
