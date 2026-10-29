// The list's stenographers (the studio's notes/markdown-plan.md, "The list item, worked through"): a list over its old items, an item over its old blocks. A list pairs its new items with the old (the common head and tail by meaning, the middle in order when the counts match) and writes each pair over the old slice. An item without a partner is written fresh at the marker and content indent of the item above it (the one below when it is first), numbered one past the one above in an ordered list, the items below left as they are; an old item without a partner is gone with its gap. A list turned tight or loose gets a blank line between its items or loses them, and nothing else of the gaps changes. An item's task box is written over the old box's bytes when its state changed.
import { isBlock, sliceOf, span, start, end, writeNode, writeFresh } from './write.js';
import { parseMarkdown } from './parse.js';
import { domOf, uncounted } from './html.js';

// Tight or loose, as mdast-util-to-hast decides it: a list is loose when it or any item is spread, an item whose `spread` is unknown when it holds more than one child.
const looseItem = (item) => (item.spread == null ? item.children.length > 1 : item.spread);
const looseList = (list) => list.spread || list.children.some(looseItem);
const boxOf = (li) => (li.classList.contains('task-list-item') ? li.querySelector('input[type="checkbox"]') : null);
// An item's marker as its first line holds it, with the spaces up to its content.
const markerOf = (k, ctx) => { const m = /^(?:[-*+]|\d{1,9}[.)])(?: {1,4})?/.exec(sliceOf(ctx, k))[0]; return /\s$/.test(m) ? m : `${m} `; };
// The marker after another's: an ordered list counts on, keeping the delimiter and the spaces.
const bump = (marker) => marker.replace(/^\d+/, (d) => +d + 1);

export function list(el, md, ctx) {
  const items = [...el.children].filter((c) => c.localName === 'li');
  const old = md.children;
  const n = items.length, m = old.length;
  if (!n) return null;
  const loose = items.some((li) => [...li.children].some((c) => c.localName === 'p'));
  const turned = loose !== looseList(md);
  // The old items as the HTML of the list turned tight or loose as it now is, so an item that did not change is the same element in both.
  const oldLis = [...domOf({ ...md, spread: loose, children: old.map((k) => ({ ...k, spread: loose })) })[0].children].filter((c) => c.localName === 'li');
  const same = (i, j) => !ctx.force && uncounted(items[i]).isEqualNode(uncounted(oldLis[j]));
  let h = 0;
  while (h < n && h < m && same(h, h)) h++;
  let t = 0;
  while (t < n - h && t < m - h && same(n - 1 - t, m - 1 - t)) t++;
  // Each new item with its old partner or null; a middle that does not pair has no partners, and its old items are out.
  const pairs = items.map((li, i) => [li, i < h ? old[i] : i >= n - t ? old[m - n + i] : n === m ? old[i] : null]);
  const gaps = old.slice(1).map((k, i) => span(ctx, end(old[i]), start(k)));
  const defaultGap = looseList(md) ? '\n\n' : '\n';
  const below = pairs.find(([, k]) => k)?.[1] ?? old[0];
  let out = span(ctx, start(md), start(old[0])), gap = gaps[0] ?? defaultGap, last = null;
  for (const [i, [li, k]] of pairs.entries()) {
    let w, marker;
    if (k) {
      w = writeNode(li, { text: sliceOf(ctx, k), column: k.position.start.column - 1, defs: ctx.defs, markdown: ctx.markdown }, ctx);
      if (w == null) return null;
      marker = markerOf(k, ctx);
      // The last old item has no gap after it; the one before it has the list's last.
      gap = gaps[old.indexOf(k)] ?? gaps.at(-1) ?? defaultGap;
    } else {
      marker = last ? bump(last) : markerOf(below, ctx);
      w = freshItem(li, marker, loose, ctx);
    }
    last = marker;
    // Tight to loose: a blank line in a gap that has none; loose to tight: the blank lines out.
    const g = !turned ? gap : loose ? (/\n[ \t]*\n/.test(gap) ? gap : gap.replace('\n', '\n\n')) : gap.replace(/\n[ \t]*(?=\n)/g, '');
    out += w + (i + 1 < n ? g : '');
  }
  // Read back as a whole: a gap inside an item can keep a list loose that was turned tight, and one item cannot be loose at all.
  // ponytail: such a list changes lane; removing the blank lines between an item's own blocks would keep it Markdown.
  out += span(ctx, end(old.at(-1)), end(md));
  const back = parseMarkdown(ctx.defs ? `${out}\n\n${ctx.defs}` : out, ctx.markdown).children[0];
  const dom = back && domOf(back).find((d) => d.nodeType === 1);
  return dom && bare(dom).isEqualNode(bare(el)) ? out : null;
}

// A list without the whitespace between its items, which an editor's serializer need not write as mdast-util-to-hast does (a line end after each item).
const bare = (list) => {
  const copy = uncounted(list).cloneNode(true);
  for (const c of [...copy.childNodes]) if (c.nodeType === 3 && !/\S/.test(c.data)) c.remove();
  return copy;
};

// An item with no old bytes: its neighbour's marker, its blocks written fresh (a tight item's text is the one paragraph), the lines after the first at the content indent.
function freshItem(li, marker, loose, ctx) {
  li = li.cloneNode(true);
  const box = boxOf(li);
  const head = box ? `[${box.hasAttribute('checked') ? 'x' : ' '}] ` : '';
  const body = blocksOf(li).map((b) => lane(b, writeFresh(b, ctx))).join(loose ? '\n\n' : '\n');
  return (head + body ? marker + head + body : marker.trimEnd()).replace(/\n(?=[^\n])/g, `\n${' '.repeat(marker.length)}`);
}

// The paragraphs `blocksOf` makes of a tight item's text, which the HTML does not have: one that changes lane is its content as HTML, not a `p` that would make the item loose.
const MADE = new WeakSet();
const lane = (part, bytes) => (bytes === part.outerHTML && MADE.has(part) ? part.innerHTML : bytes);

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
    if (!run) { run = document.createElement('p'); MADE.add(run); out.push(run); runs.push(run); }
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
  // A task item stays one: the box is the marker's, and its state is written over the old box's bytes, an `x` or `X` kept while it stays ticked.
  const box = boxOf(el);
  if ((md.checked != null) !== !!box) return null;
  const ticked = box?.hasAttribute('checked');
  const mark = (s) => (box && ticked !== md.checked ? s.replace(/\[[ xX]\]/, ticked ? '[x]' : '[ ]') : s);
  const parts = blocksOf(el);
  if (!kids.length) return parts.length ? null : mark(sliceOf(ctx, md));
  if (parts.length !== kids.length) return null;
  let out = mark(span(ctx, start(md), start(kids[0])));
  for (const [i, part] of parts.entries()) {
    const k = kids[i];
    const w = writeNode(part, { text: sliceOf(ctx, k), column: k.position.start.column - 1, defs: ctx.defs, markdown: ctx.markdown }, ctx);
    // A part no stenographer writes changes lane, at the item's content indent so it stays in the item.
    out += (w ?? lane(part, part.outerHTML).replace(/\n/g, `\n${' '.repeat(k.position.start.column - 1)}`)) + span(ctx, end(k), i + 1 < kids.length ? start(kids[i + 1]) : end(md));
  }
  return out;
}

