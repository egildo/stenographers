# stenographers

Writers that write an edited value back over its old bytes, in the author's style, and touch nothing else. A
*writer* is anything with the shape; a *stenographer* is a writer that passes the suite.

## Packages

- [`@stenographers/markdown`](packages/markdown): the Markdown stenographer, Provenance's Markdown writer by shape.

## Planned

- `@stenographers/stenography`: the specification, its types and the conformance suite every member runs. The
  contract is drafted in 0km's `proposals/stenography-contract.md`.
- YAML and JSON, from Cascata's writers, once they pass the suite.
