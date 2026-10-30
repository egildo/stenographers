// The directive: core's rule (BelType's packages/core/src/plugins/directives.js) and the container's stenographer, which ./write.js's `block` asks for the element a container directive means. `directives` marks each container and leaf directive of a tree of the plain parse, in place, with the element core gives it (`data.hName`, `data.hProperties`): a built-in's or a binding's tag and class, any other name a `div` (a leaf a `span`) of class `directive directive-name`, the author's attributes over the class (an author's `.class` replaces it, as core's spread does). A binding's container takes its `title` attribute, or the binding's default title, as a first paragraph of class `directive-title` (`data.directiveTitle`, which ./html.js's `hastOf` draws), the attribute not written on the element. Its children and their positions are left as they are.
//
// The container's write: `:::name[label]{attributes}` … `:::` over its old bytes. Its first `p` after the title is the label when the directive has one (to-hast renders it as a paragraph flagged `directiveLabel`). The opening line and the closing fence keep their bytes; a label that changed is written inside its brackets; a title that changed is written inside its attribute's quotes, an attribute added or removed alone; the content is a flow (./flow.js) over the old blocks, paired with the new by meaning from both ends inward and in order in the middle when the counts match. A nested directive is one of those blocks, so writeNode routes it back here. The result is read back and refuses unless it means the element; an unclosed directive refuses.
import { isBlock, span, start, end, inline } from './write.js';
import { parseMarkdown } from './parse.js';
import { domOf, means, bare } from './html.js';
import { writeFlow } from './flow.js';

/** Core's built-ins, as its directives plugin has them. */
export const BUILT_IN = {
  tip: { tag: 'div', className: 'alert alert-tip', defaultTitle: 'Tip' },
  warning: { tag: 'div', className: 'alert alert-warning', defaultTitle: 'Warning' },
  danger: { tag: 'div', className: 'alert alert-danger', defaultTitle: 'Danger' },
  info: { tag: 'div', className: 'alert alert-info', defaultTitle: 'Info' },
  aside: { tag: 'aside', className: 'sidebar' }
};

/**
 * Marks each container and leaf directive of a tree, in place, with the element core gives it.
 * @param {object} tree the plain parse's mdast
 * @param {Record<string, { tag?: string, className?: string, defaultTitle?: string }>} [bound] the venue's `directives:` bindings, over the built-ins (a binding's `render` hook is not run here)
 */
export function directives(tree, bound = {}) {
  const table = { ...BUILT_IN, ...bound };
  (function walk(node) {
    if (node.type === 'containerDirective' || node.type === 'leafDirective') {
      const b = Object.hasOwn(table, node.name) ? table[node.name] : null;
      const attributes = { ...node.attributes };
      const own = { className: b ? b.className : `directive directive-${node.name}` };
      if (b && node.type === 'containerDirective') {
        const title = attributes.title || b.defaultTitle;
        delete attributes.title;
        if (title) own.title = title;
        own.defaultTitle = b.defaultTitle;
      }
      node.data = { ...node.data, hName: b ? b.tag || 'div' : node.type === 'leafDirective' ? 'span' : 'div', hProperties: { ...node.data?.hProperties, class: own.className, ...attributes }, directive: own };
      if (own.title) node.data.directiveTitle = own.title;
    }
    node.children?.forEach(walk);
  })(tree);
}

// The attributes' tokens on the opening line: `#id`, `.class`, `key`, `key=value` quoted or not, each with its span.
const TOKEN = /\s*(?:#([^\s#.{}"'=]+)|\.([^\s#.{}"'=]+)|([^\s#.{}"'=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`{}]+)))?)/y;
function tokens(s, from) {
  const out = [];
  let to = from;
  TOKEN.lastIndex = from;
  for (let m; (m = TOKEN.exec(s)) && m[0].trim(); to = TOKEN.lastIndex) out.push({ key: m[1] != null ? 'id' : m[2] != null ? 'class' : m[3], short: m[1] != null || m[2] != null, quote: m[4] != null ? '"' : m[5] != null ? "'" : '', from: m.index, to: TOKEN.lastIndex });
  return { list: out, to };
}
// A value as an attribute: quoted as the old one was, unquoted only when it was and still can be, a new one in double quotes; a character reference for the quote and for an ampersand that would start one.
function attr(key, value, quote) {
  const q = quote || (/^[^\s"'=<>`{}]+$/.test(value) ? '' : '"');
  const v = value.replace(/&(?=#?\w+;)/g, '&amp;');
  return q ? `${key}=${q}${q === '"' ? v.replace(/"/g, '&quot;') : v.replace(/'/g, '&#39;')}${q}` : `${key}=${v}`;
}

/**
 * The opening line with the author's attributes made `want`, each attribute that kept its value keeping its bytes; null when the line's attributes cannot be read.
 * @param {string} head the opening line
 * @param {number} after where the attributes may start (past the name and label)
 * @param {Record<string, string>} had the attributes as read
 * @param {Record<string, string>} want
 */
function reattribute(head, after, had, want) {
  const keys = new Set([...Object.keys(had), ...Object.keys(want)]);
  const changed = [...keys].filter((k) => had[k] !== want[k]);
  if (!changed.length) return head;
  const open = head.slice(after).match(/^\s*\{/);
  const fresh = (k) => (k === 'id' && /^[^\s#.{}"'=]+$/.test(want.id) ? `#${want.id}` : k === 'class' && /^[^#.{}"'=]+$/.test(want.class) ? want.class.trim().split(/\s+/).map((c) => `.${c}`).join(' ') : attr(k, want[k], '"'));
  if (!open) {
    if (!/^\s*$/.test(head.slice(after))) return null;
    const added = changed.filter((k) => want[k] != null);
    return `${head.slice(0, after)}{${added.map(fresh).join(' ')}}${head.slice(after)}`;
  }
  const { list, to } = tokens(head, after + open[0].length);
  if (!/^\s*\}/.test(head.slice(to))) return null;
  const close = to + head.slice(to).indexOf('}');
  let out = '', at = after + open[0].length;
  const done = new Set();
  for (const t of list) {
    out += head.slice(at, t.from);
    at = t.to;
    const k = t.key;
    if (!changed.includes(k)) { out += head.slice(t.from, t.to); continue; }
    // A changed attribute: its first token rewritten, quoted as it was (a class's tokens are one attribute, so the rest go), a removed one dropped with the space before it.
    if (done.has(k) || want[k] == null) continue;
    done.add(k);
    const lead = head.slice(t.from, t.to).match(/^\s*/)[0];
    out += lead + (t.short || k === 'class' || k === 'id' ? fresh(k) : attr(k, want[k], t.quote));
  }
  const added = changed.filter((k) => want[k] != null && !done.has(k) && !list.some((t) => t.key === k));
  const tail = head.slice(at, close);
  out += (added.length ? `${tail.replace(/\s+$/, '')}${list.length ? ' ' : ''}${added.map(fresh).join(' ')}${tail.match(/\s*$/)[0]}` : tail);
  // Every attribute gone, the braces go.
  return out.trim() ? `${head.slice(0, after + open[0].length)}${out}${head.slice(close)}` : `${head.slice(0, after)}${head.slice(close + 1)}`;
}

/**
 * A directive container's bytes over its old slice, or null (the lane change).
 * @param {Element} el the directive as the HTML it means
 * @param {object} md the containerDirective's mdast
 * @param {object} ctx the stenographers' context (./write.js)
 * @returns {string | null}
 */
export function directive(el, md, ctx) {
  const text = ctx.src, a = start(md), b = end(md);
  const own = md.data?.directive ?? {};
  if (el.localName !== (md.data?.hName ?? 'div')) return null;
  // The closing fence is the last line of the slice (never the opening line); without one the directive runs to the end of its parent.
  const lastNl = text.lastIndexOf('\n', b - 1);
  if (lastNl < a || !/^ {0,3}:{3,}[ \t]*$/.test(text.slice(lastNl + 1, b))) return null;
  const label = md.children[0]?.data?.directiveLabel ? md.children[0] : null;
  const old = md.children.slice(label ? 1 : 0);
  const nodes = [...el.childNodes];
  if (nodes.some((n) => (n.nodeType === 3 ? /\S/.test(n.data) : !isBlock(n)))) return null;
  const news = nodes.filter((n) => n.nodeType === 1);
  // The title: a binding's first paragraph, plain text, the attribute's value; gone, the attribute goes.
  const titleEl = 'defaultTitle' in own && news[0]?.localName === 'p' && news[0].getAttribute('class') === 'directive-title' ? news.shift() : null;
  if (titleEl && [...titleEl.childNodes].some((n) => n.nodeType !== 3)) return null;
  if (label && news[0]?.localName !== 'p') return null;
  // A label is only the first `p` of the content, so a label deleted would make the first paragraph of the content the label: when the blocks are the old content's in number and the first is the old first, the label is what went.
  const dropped = label && old.length && news.length === old.length && means(news[0], old[0]);
  const labelEl = label && !dropped ? news.shift() : null;

  // The opening line: up to the first line end after the label (the attributes follow the label on the same line).
  const open = text.indexOf('\n', label ? end(label) : a);
  if (open < 0 || open > lastNl) return null;
  let head = text.slice(a, open);
  const name = /^ {0,3}:{3,}[^\s[{]*/.exec(head)[0].length;
  // The author's attributes: the element's, its class the author's only when it is not the one core gives, the title the paragraph's.
  const had = { ...md.attributes };
  const want = Object.fromEntries([...el.attributes].map((x) => [x.name, x.value]));
  if (want.class === (had.class ?? own.className)) want.class = had.class;
  if (want.class == null || want.class === own.className) delete want.class;
  for (const k of Object.keys(want)) if (want[k] == null) delete want[k];
  if ('defaultTitle' in own) {
    const t = titleEl?.textContent;
    if (t === own.title) { if (had.title != null) want.title = had.title; }
    else if (t != null && t !== '') want.title = t;
  }
  for (const k of Object.keys(had)) if (had[k] == null) delete had[k];
  const after = label ? end(label) - a : name;
  if (dropped) head = head.slice(0, start(label) - a) + head.slice(end(label) - a);
  else if (label && !means(labelEl, label)) {
    const kids = label.children;
    if (!kids.length) return null;
    head = head.slice(0, start(label) - a) + span(ctx, start(label), start(kids[0])) + inline([...labelEl.childNodes], kids, ctx) + span(ctx, end(kids.at(-1)), end(label)) + head.slice(end(label) - a);
  }
  head = reattribute(head, after + head.length - (open - a), had, want);
  if (head == null) return null;

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

  // Read back as a whole; a title deleted reads back as the default one, which is what core shows.
  const back = parseMarkdown(ctx.defs ? `${out}\n\n${ctx.defs}` : out, ctx.markdown).children[0];
  const dom = back?.type === 'containerDirective' && end(back) === out.length && domOf(back).find((d) => d.nodeType === 1);
  if (!dom) return null;
  const mine = bare(el);
  if (!titleEl?.textContent) {
    if (titleEl) mine.firstElementChild.remove();
    if (own.defaultTitle && dom.firstElementChild?.getAttribute('class') === 'directive-title') dom.firstElementChild.remove();
  }
  return bare(dom).isEqualNode(mine) ? out : null;
}
