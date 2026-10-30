// The table (the studio's notes/markdown-round-3-orchestration.md, round 3b): a GFM table over its old bytes, which ./write.js's `block` asks for a `table` over a table. The header row and the divider row are kept, as is the column count and every alignment (a change of either refuses, for the lane change). The body rows pair with the old by meaning from both ends inward, as a list's items do (the middle in order when the counts match); a paired row keeps the bytes of every cell that did not change and writes the cells that did over their old width (the author's padding is kept where the new content fits, otherwise the cell is `one space, content, one space` and the row is left ragged), an inserted row copies the row beside it (its pipes, its padding), a deleted row goes with its line. A cell holding a block or a line break refuses. The result is read back as a whole and must mean the element. Whitespace between the table's elements is ignored everywhere, as an editor's serializer need not write what mdast-util-to-hast does.
import { isBlock, span, start, end, sliceOf, inline, fresh } from './write.js';
import { parseMarkdown } from './parse.js';
import { domOf, bare } from './html.js';

const rowsOf = (table) => [...table.querySelectorAll('tr')];
const cellsOf = (tr) => [...tr.children];

// A row's cells as the bytes hold them: mdast gives a cell its leading pipe and, for the last, its trailing one, so a cell is `lead`, `seg` (the padding and the content) and, last, `trail`.
function cutRow(row, ctx) {
  return row.children.map((cell, i) => {
    const raw = sliceOf(ctx, cell);
    const lead = raw.startsWith('|') ? '|' : '';
    const last = i === row.children.length - 1;
    const trail = last && raw.length > lead.length && /(^|[^\\])(\\\\)*\|$/.test(raw) ? '|' : '';
    return { lead, seg: raw.slice(lead.length, raw.length - trail.length), trail };
  });
}

// `content` in a cell of `old`'s width (`open`: the last cell of a row with no closing pipe): the old leading padding and a trailing space where it had one, filled up to the old width; if it does not fit, one space each side.
function fit(old, content, open) {
  const blank = !old.trim();
  const lead = blank ? Math.min(1, old.length >> 1) : /^ */.exec(old)[0].length;
  const trail = blank ? lead : /\s$/.test(old) ? 1 : 0;
  // A last cell with no closing pipe has no width to fill.
  if (open) return ' '.repeat(lead) + content;
  return lead + content.length + trail <= old.length ? ' '.repeat(lead) + content.padEnd(old.length - lead) : ` ${content} `;
}

// A cell's content as Markdown, `|` escaped (typed or not, one that is not already is a cell's end); null when it holds what a cell cannot.
function cellBytes(td, old, ctx) {
  if ([...td.querySelectorAll('*')].some((e) => isBlock(e) || e.localName === 'br')) return null;
  const nodes = [...td.childNodes];
  const out = old?.children.length ? inline(nodes, old.children, ctx) : nodes.map(fresh).join('');
  return /\n/.test(out) ? null : out.replace(/(\\*)\|/g, (m, b) => (b.length % 2 ? m : `${b}\\|`));
}

/**
 * A table's bytes over its old slice, or null (the lane change).
 * @param {Element} el the table as the HTML it means
 * @param {object} md the table's mdast
 * @param {object} ctx the stenographers' context (./write.js)
 * @returns {string | null}
 */
export function table(el, md, ctx) {
  const now = bare(el);
  const was = bare(domOf(md).find((n) => n.nodeType === 1));
  const rows = rowsOf(now), oldRows = rowsOf(was);
  const old = md.children;
  const cols = md.align.length;
  // The header is the first row, alone in a thead; every cell is as wide as the columns and aligned as the divider says.
  if (now.querySelectorAll('thead tr').length !== 1 || rows[0].parentNode.localName !== 'thead' || rows.slice(1).some((tr) => tr.parentNode.localName === 'thead')) return null;
  if (cellsOf(rows[0]).length !== cols) return null;
  for (const tr of rows) {
    for (const [i, c] of cellsOf(tr).entries()) if (i >= cols || (c.getAttribute('align') ?? null) !== (md.align[i] ?? null)) return null;
  }
  const n = rows.length - 1, m = old.length - 1;
  const same = (a, b) => !ctx.force && bare(rows[a]).isEqualNode(bare(oldRows[b]));
  let h = 1;
  while (h <= n && h <= m && same(h, h)) h++;
  let t = 0;
  while (t < n - h + 1 && t < m - h + 1 && same(n - t, m - t)) t++;
  // Each new row with its old partner or null; the header's is the old header. A middle that does not pair has none, and its old rows are out.
  const pairs = rows.map((tr, i) => [tr, i < h ? old[i] : i > n - t ? old[m - n + i] : n === m ? old[i] : null]);
  const divider = old.length > 1 ? span(ctx, end(old[0]), start(old[1])) : `${span(ctx, end(old[0]), end(md))}\n`;
  const gaps = old.slice(2).map((k, i) => span(ctx, end(old[i + 1]), start(k)));
  const defaultGap = `\n${/\n( *)/.exec(divider)?.[1] ?? ''}`;
  const written = [];
  for (const [i, [tr, k]] of pairs.entries()) {
    const cells = cellsOf(tr);
    let bytes;
    if (k) {
      // A row longer than the columns has cells to-hast leaves out; they keep their bytes.
      const oldCells = cellsOf(oldRows[old.indexOf(k)]);
      if (cells.length !== oldCells.length) return null;
      const cut = cutRow(k, ctx);
      bytes = '';
      for (const [j, { lead, seg, trail }] of cut.entries()) {
        const c = cells[j];
        let s = seg;
        if (c && (ctx.force || !bare(c).isEqualNode(bare(oldCells[j])))) {
          const content = cellBytes(c, k.children[j], ctx);
          if (content == null) return null;
          s = fit(seg, content, j === cut.length - 1 && !trail);
        }
        bytes += lead + s + trail;
      }
    } else {
      // A row with no old bytes copies the one above it (the one below when it is the first body row) down to the pipes and the padding.
      const near = pairs.slice(0, i).reverse().find(([, o]) => o && o !== old[0]) ?? pairs.slice(i + 1).find(([, o]) => o);
      let cut = near && near[1].children.length === cells.length ? cutRow(near[1], ctx) : null;
      cut ??= cutRow(old[0], ctx);
      if (cells.length !== cols) return null;
      bytes = '';
      for (const [j, c] of cells.entries()) {
        const content = cellBytes(c, null, ctx);
        if (content == null) return null;
        bytes += cut[j].lead + fit(cut[j].seg, content, j === cut.length - 1 && !cut[j].trail) + cut[j].trail;
      }
    }
    written.push([bytes, k]);
  }
  let out = span(ctx, start(md), start(old[0])) + written[0][0];
  if (written.length === 1) out += divider.trimEnd();
  else {
    out += divider;
    for (const [i, [bytes, k]] of written.entries()) {
      if (!i) continue;
      out += bytes + (i < written.length - 1 ? (k && gaps[old.indexOf(k) - 1]) || gaps.at(-1) || defaultGap : '');
    }
  }
  if (old.length > 1) out += span(ctx, end(old.at(-1)), end(md));
  // Read back as a whole.
  const back = parseMarkdown(ctx.defs ? `${out}\n\n${ctx.defs}` : out, ctx.markdown).children[0];
  const dom = back?.type === 'table' && end(back) === out.length && domOf(back).find((d) => d.nodeType === 1);
  return dom && bare(dom).isEqualNode(now) ? out : null;
}
