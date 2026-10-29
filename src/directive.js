// The directive container (the studio's notes/markdown-round-3-orchestration.md, round 3b): `:::name[label]{attributes}` … `:::` over its old bytes, which ./write.js's `block` asks for a `div` over a container directive. mdast-util-to-hast gives a container directive no HTML of its own, so it means a bare `div` of its content (BelType's directive handlers give it its real element; ./html.js). A seam for now: a changed directive refuses.

/**
 * A directive container's bytes over its old slice, or null (the lane change).
 * @param {Element} el the directive as the HTML it means
 * @param {object} md the containerDirective's mdast
 * @param {object} ctx the stenographers' context (./write.js)
 * @returns {string | null}
 */
export function directive(el, md, ctx) {
  return null;
}
