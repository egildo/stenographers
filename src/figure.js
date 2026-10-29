// The figure (the studio's notes/markdown-round-3-orchestration.md, agent B): core's rule (packages/core/src/plugins/figure.js), a paragraph whose only meaningful child is an image with a title is a `figure` holding the image and a `figcaption` of the title, the title's trailing `{#id}` the figure's id; and the figure's stenographer, which ./write.js's `block` asks for a `figure` over a paragraph. A seam for now: nothing is promoted, and a figure refuses.

/**
 * Marks each figure of a tree of the plain parse, in place, for mdast-util-to-hast (`data.hName`, `data.hProperties`, `data.hChildren` on the paragraph), leaving its children and their positions as they are.
 * @param {object} tree the plain parse's mdast
 */
export function figures(tree) {}

/**
 * A figure's bytes over the paragraph it was read from, or null (the lane change).
 * @param {Element} el the figure as the HTML it means
 * @param {object} md the paragraph's mdast
 * @param {object} ctx the stenographers' context (./write.js)
 * @returns {string | null}
 */
export function figure(el, md, ctx) {
  return null;
}
