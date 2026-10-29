# stenographers

Write an edited document back into the Markdown it was read from, keeping the author's bytes. A *stenographer* is the writer of one kind of node with the old transcript in hand: it writes the node over its old slice in the author's style (the bullet character, the emphasis character, the indent, the fence), every node that still means what it meant keeps its bytes, and only typed text is escaped, for what its position could misread. It is not a serializer: `mdast-util-to-markdown` rewrites a document in its own style (measured on BelType's manual: 14.3 percent of the lines changed with the defaults), and a stenographer rewrites nothing it was not asked to.

## What it is made of

Five entries (`exports`, no index):

- `stenographers/parse`: the plain parse, `parseMarkdown(text, { autolinks, tables })`: mdast-util-from-markdown with BelType's four syntax extensions (frontmatter, math, directive, GFM's parts in the order BelType registers them) and nothing else, the only parse whose positions are exact.
- `stenographers/html`: what Markdown means in HTML, mdast-util-to-hast's translation written as markup and parsed by the browser (`hastOf`, `htmlOf`, `domOf`), and `means(node, mdast)`, the test that lets an unchanged node keep its bytes (a footnote reference's number, the document's count, is left out of it).
- `stenographers/write`: `writeNode(element, { text, column, defs, gfm })`, a node's new bytes over its old slice, for paragraph, heading, list, list item, fenced code and inline content (text, em, strong, del, code, link and reference link, break, image, footnote reference, text directive); `writeFresh(element)` for a block with no old bytes; `escape`. A node is read as the HTML element it means, never by a type name. A stenographer that cannot write its node answers null and its parent writes it; the last step is the lane change, the node written as raw HTML. A paragraph's or a heading's bytes are read back before they are given.
- `stenographers/flow`: `writeFlow(blocks, old, file)`, a flow of blocks over its old bytes: the parent owns the gaps (the old gap before a block that follows the one it followed, a blank line otherwise; a deleted block's gap kept when it holds a definition or a comment; two lists that would read as one kept apart by an empty comment).
- `stenographers/writer`: Provenance's Markdown writer, by shape (`markdownWriter({ gfm })`: `claims`, `open` giving `locate`, `write`, `shifted`), with `outline` and `writeRun`. A path is a JSON Pointer over the heading outline addressing a section's own run (its heading line and the blocks after it, up to the next heading of any rank); the value is the run's blocks, each `[html, bytes at the base, unchanged, prior bytes, whether they stand]`; only `set`. Bytes are counted here and nowhere else.

## What it does not do

It holds no document, no file and no editor: what changed, and which old block a new one stands for, is the caller's (by node identity in an editor, by the bytes a block had in the writer). It imports no ProseMirror, no BelType and no Provenance: Provenance's writer is met by shape, as its spec asks. It needs a DOM (`document`, for `<template>` and element comparison): a page's, or in node one the caller installs. Containers beyond lists (blockquote, table, directive containers) keep their bytes while unchanged and change lane when changed; a parent's prefix is spaces only; a text run whose bytes are not its value (an escape, an entity) is written fresh once touched; no list item is inserted or deleted by the list's own write (the list changes lane).

## Extracted from

The studio, beltype-studio-experiment's `src/markdown/stenographers/` at commit `3a526b0` (branch `round/markdown-1`), as prosemirror-stores was: built and proved there against BelType's manual, the pages and Provenance, then moved when green. The plan is the studio's `notes/markdown-plan.md`, the record of its round `notes/markdown-results.md`. The studio keeps what is its own: the read into its schema, the file as a client of its authority, saving, the venue host and the Markdown pane.

## Proved by

`npm test`, under `node:test` with happy-dom as the DOM (a dev dependency only): 25 tests. Over BelType's manual (`fixtures/`, its nine files as they were on 2026-10-29, the manual's GFM options): every paragraph, heading, list and list item, written from its style alone, is its slice byte for byte, and every other top-level block keeps its bytes; a key typed at the end of every top-level paragraph and heading reads back as the edited node with only the typed bytes changed (after a colon, the colon escaped too). The writer: the outline's paths and their escapes and ordinals, `locate` in bytes over UTF-8, every run of a file written again from its own value equal to its bytes, one paragraph changed changing only it, a malformed value refused. `test/layers.test.js`: every import is a sibling or a package of the Markdown parse.
