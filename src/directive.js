// The directive container (the studio's notes/markdown-plan.md, round 3b): `:::name[label]{attributes}` … `:::` over its old bytes, which ./write.js's `block` asks for a `div` over a container directive. mdast-util-to-hast gives a container directive no HTML of its own, so it means a bare `div` of its content (BelType's directive handlers give it its real element; ./html.js), whose first `p` is the label when the directive has one (to-hast renders it as a paragraph flagged `directiveLabel`). The opening line and the closing fence keep their bytes; a label that changed is written inside its brackets; the content is a flow (./flow.js) over the old blocks, paired with the new by meaning from both ends inward and in order in the middle when the counts match. A nested directive is one of those blocks, so writeNode routes it back here. The result is read back and refuses unless it means the element; an unclosed directive refuses.
import { isBlock, span, start, end, inline } from './write.js';
import { parseMarkdown } from './parse.js';
import { domOf, means, bare } from './html.js';
import { writeFlow } from './flow.js';

/**
 * A directive container's bytes over its old slice, or null (the lane change).
 * @param {Element} el the directive as the HTML it means
 * @param {object} md the containerDirective's mdast
 * @param {object} ctx the stenographers' context (./write.js)
 * @returns {string | null}
 */
export function directive(el, md, ctx) {
  const text = ctx.src, a = start(md), b = end(md);
  // The closing fence is the last line of the slice (never the opening line); without one the directive runs to the end of its parent.
  const lastNl = text.lastIndexOf('\n', b - 1);
  if (lastNl < a || !/^ {0,3}:{3,}[ \t]*$/.test(text.slice(lastNl + 1, b))) return null;
  const label = md.children[0]?.data?.directiveLabel ? md.children[0] : null;
  const old = md.children.slice(label ? 1 : 0);
  const nodes = [...el.childNodes];
  if (nodes.some((n) => (n.nodeType === 3 ? /\S/.test(n.data) : !isBlock(n)))) return null;
  const news = nodes.filter((n) => n.nodeType === 1);
  if (label && news[0]?.localName !== 'p') return null;
  // A label is only the first `p` of the div, so a label deleted would make the first paragraph of the content the label: when the blocks are the old content's in number and the first is the old first, the label is what went.
  const dropped = label && old.length && news.length === old.length && means(news[0], old[0]);
  const labelEl = label && !dropped ? news.shift() : null;

  // The opening line: up to the first line end after the label (the attributes follow the label on the same line).
  const open = text.indexOf('\n', label ? end(label) : a);
  if (open < 0 || open > lastNl) return null;
  let head = text.slice(a, open);
  if (dropped) head = head.slice(0, start(label) - a) + head.slice(end(label) - a);
  else if (label && !means(labelEl, label)) {
    const kids = label.children;
    if (!kids.length) return null;
    head = head.slice(0, start(label) - a) + span(ctx, start(label), start(kids[0])) + inline([...labelEl.childNodes], kids, ctx) + span(ctx, end(kids.at(-1)), end(label)) + head.slice(end(label) - a);
  }

  const same = (i, j) => !ctx.force && means(news[i], old[j]);
  const n = news.length, m = old.length;
  let h = 0;
  while (h < n && h < m && same(h, h)) h++;
  let t = 0;
  while (t < n - h && t < m - h && same(n - 1 - t, m - 1 - t)) t++;
  const blocks = news.map((e, i) => {
    const edge = i < h || i >= n - t;
    return { el: e, j: edge ? (i < h ? i : m - n + i) : n === m ? i : -1, same: edge };
  });
  const file = { defs: ctx.defs, markdown: ctx.markdown };
  // No new blocks: nothing between the fences. Old blocks: the flow over the lines between them. None old: the flow alone.
  let body = '';
  if (n) body = (m ? writeFlow(blocks, { text, spans: old.map((k) => [start(k), end(k)]), from: open + 1, to: lastNl + 1 }, file) : writeFlow(blocks, { text: '', spans: [] }, file)).text;
  const out = `${head}\n${body}${text.slice(lastNl + 1, b)}`;

  // Read back as a whole.
  const back = parseMarkdown(ctx.defs ? `${out}\n\n${ctx.defs}` : out, ctx.markdown).children[0];
  const dom = back?.type === 'containerDirective' && end(back) === out.length && domOf(back).find((d) => d.nodeType === 1);
  return dom && bare(dom).isEqualNode(bare(el)) ? out : null;
}
