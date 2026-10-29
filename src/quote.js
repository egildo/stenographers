// The blockquote (the studio's notes/markdown-round-3-orchestration.md, round 3b): a quote over its old bytes, which ./write.js's `block` asks for a `blockquote` over a blockquote. Each line's `> ` prefix is taken off (remembering it exactly; a lazy line has none) and the body parsed alone, the file's definitions after it, so the blocks are written the way a document's are: the new blocks are paired with the old by meaning (the common head and tail, the middle in order when the counts match), a pair is written over its old slice by `writeNode`, a block without a partner is written fresh, an old one without a partner goes with its gap, and the gaps are the body's. The prefixes go back line by line while the line count is unchanged; once it changed every line takes the first line's prefix (a blank one the prefix trimmed). The result is read back and must mean the element, whitespace between its blocks aside, or the quote refuses. A body holding a definition refuses (to-hast has no element for it to pair).
import { sliceOf, span, start, end, writeNode, writeFresh, isBlock } from './write.js';
import { parseMarkdown } from './parse.js';
import { domOf, means, bare } from './html.js';

/**
 * A blockquote's bytes over its old slice, or null (the lane change).
 * @param {Element} el the quote as the HTML it means
 * @param {object} md the blockquote's mdast
 * @param {object} ctx the stenographers' context (./write.js)
 * @returns {string | null}
 */
export function quote(el, md, ctx) {
  const kids = [...el.childNodes].filter((n) => n.nodeType !== 3 || /\S/.test(n.data));
  // Blocks and comments (a comment is a block of raw HTML in the quote, written as itself).
  if (!kids.length || kids.some((n) => n.nodeType !== 1 && n.nodeType !== 8)) return null;
  const lines = sliceOf(ctx, md).split('\n');
  const prefixes = lines.map((l) => /^ {0,3}> ?/.exec(l)?.[0] ?? '');
  const body = lines.map((l, i) => l.slice(prefixes[i].length)).join('\n');
  const tree = parseMarkdown(ctx.defs ? `${body}\n\n${ctx.defs}` : body, ctx.markdown);
  // The file's definitions, appended after the body, are not the quote's blocks.
  const old = tree.children.filter((k) => start(k) < body.length);
  if (!old.length || old.some((k) => k.type === 'definition' || k.type === 'footnoteDefinition')) return null;
  const b = { src: body };
  const n = kids.length, m = old.length;
  const same = (i, j) => !ctx.force && means(kids[i], old[j]);
  let h = 0;
  while (h < n && h < m && same(h, h)) h++;
  let t = 0;
  while (t < n - h && t < m - h && same(n - 1 - t, m - 1 - t)) t++;
  const pairs = kids.map((c, i) => [c, i < h ? old[i] : i >= n - t ? old[m - n + i] : n === m ? old[i] : null]);
  const gaps = old.slice(1).map((k, i) => span(b, end(old[i]), start(k)));
  let out = span(b, 0, start(old[0])), gap = gaps[0] ?? '\n\n';
  for (const [i, [c, k]] of pairs.entries()) {
    let w;
    if (k) {
      // A block its old one's stenographer cannot write (it changed kind: a paragraph made a heading) is written fresh, Markdown where it can be, raw HTML where not.
      w = writeNode(c, { text: sliceOf(b, k), column: 0, defs: ctx.defs, markdown: ctx.markdown }, ctx) ?? writeFresh(c, ctx);
      gap = gaps[old.indexOf(k)] ?? gaps.at(-1) ?? '\n\n';
    } else w = writeFresh(c, ctx);
    out += w + (i + 1 < n ? gap : '');
  }
  out += span(b, end(old.at(-1)), body.length);
  const outLines = out.split('\n');
  const first = prefixes[0];
  // A blank line never takes a lazy line's empty prefix: without its `>` it would end the quote.
  const result = outLines.map((l, i) => (outLines.length === lines.length && (l || prefixes[i]) ? prefixes[i] : l ? first : first.trimEnd()) + l).join('\n');
  const back = parseMarkdown(ctx.defs ? `${result}\n\n${ctx.defs}` : result, ctx.markdown).children[0];
  const dom = back?.type === 'blockquote' && domOf(back).find((d) => d.nodeType === 1);
  return dom && bare(dom).isEqualNode(bare(el)) ? result : null;
}
