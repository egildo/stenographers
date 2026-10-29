// The table (the studio's notes/markdown-round-3-orchestration.md, round 3b): a GFM table over its old bytes, which ./write.js's `block` asks for a `table` over a table. A seam for now: a changed table refuses.

/**
 * A table's bytes over its old slice, or null (the lane change).
 * @param {Element} el the table as the HTML it means
 * @param {object} md the table's mdast
 * @param {object} ctx the stenographers' context (./write.js)
 * @returns {string | null}
 */
export function table(el, md, ctx) {
  return null;
}
