// The list's stenographers (the studio's notes/markdown-plan.md, "The list item, worked through"): a list over its old items, an item over its old blocks. Moved out of ./write.js as they were, so the list's own write is this file's alone.
import { isBlock, sliceOf, span, start, end, writeNode } from './write.js';

// Tight or loose, as mdast-util-to-hast decides it: a list is loose when it or any item is spread, an item whose `spread` is unknown when it holds more than one child.
const looseItem = (item) => (item.spread == null ? item.children.length > 1 : item.spread);
const looseList = (list) => list.spread || list.children.some(looseItem);

export function list(el, md, ctx) {
  const items = [...el.children].filter((c) => c.localName === 'li');
  // ponytail: an item inserted or deleted, and a list turned tight or loose, are refused for now (the list's own write, the gaps between items, is the next step), so the flow above writes the list as HTML.
  if (items.length !== md.children.length) return null;
  if (looseList(md) !== items.some((li) => [...li.children].some((c) => c.localName === 'p'))) return null;
  let out = span(ctx, start(md), start(md.children[0]));
  for (const [i, li] of items.entries()) {
    const k = md.children[i];
    const w = writeNode(li, { text: sliceOf(ctx, k), column: k.position.start.column - 1, defs: ctx.defs, markdown: ctx.markdown }, ctx);
    if (w == null) return null;
    out += w + span(ctx, end(k), i + 1 < items.length ? start(md.children[i + 1]) : end(md));
  }
  return out;
}

/** An item's content as blocks: a stretch of inline content (a tight item's text) is one paragraph, the whitespace between blocks is the gap's, a task item's checkbox is its marker's. */
function blocksOf(li) {
  // `li` is writeNode's copy, so it is taken apart in place.
  const box = li.classList.contains('task-list-item') && li.querySelector('input[type="checkbox"]');
  if (box) {
    const after = box.nextSibling;
    box.remove();
    if (after?.nodeType === 3 && after.data.startsWith(' ')) after.data = after.data.slice(1);
  }
  const out = [], runs = [];
  let run = null;
  for (const n of [...li.childNodes]) {
    if (isBlock(n)) { run = null; out.push(n); continue; }
    // Whitespace between blocks is the gap's; whitespace that starts a stretch of text is the text's.
    if (n.nodeType === 3 && !/\S/.test(n.data) && !run && (!n.nextSibling || isBlock(n.nextSibling))) continue;
    if (!run) { run = document.createElement('p'); out.push(run); runs.push(run); }
    run.append(n);
  }
  // The line end mdast-util-to-hast puts between a tight item's text and its sublist is the gap's, not the text's.
  for (const r of runs) {
    const last = r.lastChild;
    if (last?.nodeType === 3) last.data = last.data.replace(/\n$/, '');
    if (last?.nodeType === 3 && !last.data) last.remove();
  }
  return out;
}

export function item(el, md, ctx) {
  const kids = md.children;
  const parts = blocksOf(el);
  if (!kids.length) return parts.length ? null : sliceOf(ctx, md);
  if (parts.length !== kids.length) return null;
  let out = span(ctx, start(md), start(kids[0]));
  for (const [i, part] of parts.entries()) {
    const k = kids[i];
    const w = writeNode(part, { text: sliceOf(ctx, k), column: k.position.start.column - 1, defs: ctx.defs, markdown: ctx.markdown }, ctx);
    // A part no stenographer writes changes lane, at the item's content indent so it stays in the item.
    out += (w ?? part.outerHTML.replace(/\n/g, `\n${' '.repeat(k.position.start.column - 1)}`)) + span(ctx, end(k), i + 1 < kids.length ? start(kids[i + 1]) : end(md));
  }
  return out;
}

