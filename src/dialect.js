// BelType's notations on the plain parse (the studio's notes/markdown-round-3-orchestration.md, agent C): `==mark==` and `=k=mark==` (core's remark-flexible-markers), `~sub~` and `^sup^` (core's remark-supersub), found where core finds them but only in text whose bytes are its value, so every node they make is positioned; and their stenographers, which the inline stenographers of ./write.js ask first. A seam for now: nothing is found, and every element is left to ./write.js.

/**
 * Finds the notations in a tree of the plain parse, in place: each becomes an mdast node of its own (`mark`, `subscript`, `superscript`) whose `data.hName` mdast-util-to-hast reads, positioned in `text`.
 * @param {object} tree the plain parse's mdast
 * @param {string} text the text it was parsed from
 * @param {import('./parse.js').Markdown} markdown `mark: false` and `supersub: false` switch them off
 */
export function dialect(tree, text, markdown) {}

/**
 * An element over an old inline node, when it is a notation's: its bytes, or `undefined` when it is not this file's to write (./write.js's `pair` goes on).
 * @param {Node} n the element (or text) as the HTML it means
 * @param {object} o the old mdast node it is paired with
 * @param {object} ctx the stenographers' context (./write.js)
 * @returns {string | undefined}
 */
export function pairDialect(n, o, ctx) {
  return undefined;
}

/**
 * An inline element with no old bytes, when a notation writes it: its bytes, or `undefined` when it is not this file's (./write.js's `fresh` goes on).
 * @param {Element} n
 * @returns {string | undefined}
 */
export function freshDialect(n) {
  return undefined;
}
