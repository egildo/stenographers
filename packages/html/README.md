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
- `outline(text)`: the document's containers and data blocks by path, each its run's span and its blocks' spans
  (a data block's `tag` is `script` and its blocks are none), the reading the writer itself uses, so a caller pairs
  its blocks, or a data block's text, with the same bytes.
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

**Data blocks.** One gap element has a path of its own: a `<script>` with an `id` whose `type` ends in `json`, HTML's
data block (`<script type="application/ld+json" id="__beltype-store">`, where BelType's studio keeps a document's
values). Its path is its id under the container it sits in, like a container's; its value is its text, a string,
written over the text between its tags, which keep their bytes along with everything around them. It is not one
of its container's blocks, so writing the container leaves it, and writing it leaves the container's blocks. The
caller serializes the JSON; text that would end the element early (`</script` inside it) is refused as
`edit-read-back`, and the JSON way around it is to write `</` as `<\/`, which means the same.

**Refusals.** The shared codes. A value whose blocks would not read back as themselves in their container (a
`<td>` in a body, two paragraphs given as one), or a data block's text that would not read back whole, is
`edit-read-back`.

## What it does not do

It holds no document, no file and no editor: which old block a new one stands for is the caller's, by node identity
in an editor. A changed block is written whole, a list or a header with it. A container whose end tag is implied (an
`<li id>` closed by the next one) is a block of its parent, and an id repeated under one parent names its first. The
head is not written. A data block without an id, a `<style>`, a `<template>` and a comment have no path.

## Proved by

`npm test`: the seven laws of `@stenographers/stenography` over the Quiet Press (the BelType studio's demo), a
small document with CRLF line ends, a comment, a script, nested containers and an id that needs escaping, and
BelType's bill specimen with its JSON-LD data block; and `test/writer.test.js`, each edit in exact bytes.
