# @stenographers/html

Write an edited HTML document back over the bytes it was read from, at the grain of blocks. A block not edited keeps
its bytes; an edited block is written whole, as the HTML the caller gives for it. Writing inside a block, in the
author's style (attribute order, quotes, white space), is not done yet, and comes without undoing this.

## Install

```sh
npm install @stenographers/html
```

## What it is made of

One entry, `@stenographers/html/writer`:

- `htmlWriter()`: Provenance's HTML writer, by shape (`claims`, `open` giving `locate` and `write`). Only `set`.
- `outline(text)`: the document's containers by path, each its run's span and its blocks' spans, the reading the
  writer itself uses, so a caller pairs its blocks with the same bytes.
- `means(node)`, `meaningsIn(tag, html)`: what a block means, its HTML as parse5 reads it in its container.
- `writeRun(text, run, value)`: a run's new bytes over its old.

**Paths.** A JSON Pointer over the containers. The body is `""`. An element with an `id`, whose own children hold
no text and whose end tag is written, is a container; its step is the id, escaped as RFC 6901 escapes a step, under
the container it sits in: `/measure`, `/measure/first-room`. So a path names a block by its nearest ancestor with
an id, and the value says its position there (0km's `proposals/studio.md`, "Addresses", settled 2026-11-03).

**Values.** A container's run, the bytes between its start tag and its end tag, is its blocks: its child elements,
in order, each `[html, its bytes at the base or null, unchanged]`. A block finds its old block by those bytes; an
unchanged one keeps them, whatever HTML the caller reads it as; any other is written as its `html`. A block inserted
takes its neighbours' indent; a block deleted takes the gap before it. What lies between blocks (white space,
comments, `<script>`, `<style>`, `<template>`) is the gaps', and stays.

**Refusals.** The shared codes. A value whose blocks would not read back as themselves in their container (a
`<td>` in a body, two paragraphs given as one) is `edit-read-back`.

## What it does not do

It holds no document, no file and no editor: which old block a new one stands for is the caller's, by node identity
in an editor. A changed block is written whole, a list or a header with it. A container whose end tag is implied (an
`<li id>` closed by the next one) is a block of its parent, and an id repeated under one parent names its first. The
head is not written.

## Proved by

`npm test`: the seven laws of `@stenographers/stenography` over the Quiet Press (the BelType studio's demo) and a
small document with CRLF line ends, a comment, a script, nested containers and an id that needs escaping; and
`test/writer.test.js`, each edit in exact bytes.
