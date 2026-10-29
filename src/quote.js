// The blockquote (the studio's notes/markdown-round-3-orchestration.md, round 3b): a quote over its old bytes, its `> ` prefix taken off its lines and put back, which ./write.js's `block` asks for a `blockquote` over a blockquote. A seam for now: a changed quote refuses.

/**
 * A blockquote's bytes over its old slice, or null (the lane change).
 * @param {Element} el the quote as the HTML it means
 * @param {object} md the blockquote's mdast
 * @param {object} ctx the stenographers' context (./write.js)
 * @returns {string | null}
 */
export function quote(el, md, ctx) {
  return null;
}
