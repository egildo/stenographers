// The stenographers' write (the studio's notes/markdown-plan.md, "Stenographers" and "Escalation"): a node's new bytes, written over its old transcript in the author's style. A stenographer reads a node as the HTML it means (the schema's document serializer's element), never by a ProseMirror type name, and its old slice re-parsed alone, with the file's definitions after it so a reference resolves as it did in the file. Every node that still means what its old bytes meant keeps them; only typed text is escaped, and only for what it could be misread as. A stenographer that cannot write its node answers null, and its parent writes it: the list for an item, the flow for a list; the last step is the lane change, the node written as raw HTML.
import { parseMarkdown } from './parse.js';
import { domOf, means } from './html.js';
import { list, item } from './list.js';
import { figure } from './figure.js';
import { pairDialect, freshDialect } from './dialect.js';

const BLOCKS = new Set(['address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'fieldset', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul']);
export const isBlock = (n) => n.nodeType === 1 && BLOCKS.has(n.localName);
export const span = (ctx, from, to) => ctx.src.slice(from, to);
export const start = (n) => n.position.start.offset;
export const end = (n) => n.position.end.offset;
export const sliceOf = (ctx, n) => span(ctx, start(n), end(n));

/**
 * A node's new bytes, written over its old slice.
 * @param {Element} el the node as the HTML it means
 * @param {{ text: string, column: number, defs?: string, markdown?: import('./parse.js').Markdown }} old its old slice, the column the slice's first byte stands at in the file (the lines after the first carry the parent's prefix up to it), the file's definitions and footnote definitions as source, the venue's Markdown options
 * @param {{ force?: boolean }} [opts] `force`: no node keeps its bytes for meaning what they meant, every one is written from its style (the identity check's mode)
 * @returns {string | null} null when the node refuses, for its parent to write
 */
export function writeNode(el, old, { force = false } = {}) {
  const { body, prefixes } = dedent(old.text, old.column);
  const tree = parseMarkdown(old.defs ? `${body}\n\n${old.defs}` : body, old.markdown);
  let md = tree.children[0];
  if (el.localName === 'li') md = md?.type === 'list' ? md.children[0] : null;
  if (!md || start(md) !== 0) return null;
  el = el.cloneNode(true);
  el.normalize();
  const out = block(el, md, { src: body, force, defs: old.defs, markdown: old.markdown });
  return out == null ? null : reindent(out, prefixes, old.column);
}

// The parent's prefix on each line after the first (the indent of a list item's content), taken off so the node is written at column 0 and put back after. ponytail: spaces only; a tab or a `> ` prefix waits for round 3 (blockquote).
function dedent(text, column) {
  const lines = text.split('\n');
  const prefixes = [''];
  for (let i = 1; i < lines.length; i++) {
    const k = Math.min(column, /^ */.exec(lines[i])[0].length);
    prefixes.push(lines[i].slice(0, k));
    lines[i] = lines[i].slice(k);
  }
  return { body: lines.join('\n'), prefixes };
}
// Each line takes back its old prefix while the node has as many lines as it had (a lazy line keeps its shorter one); once the count changed, the old prefixes no longer belong to the lines at their index, and every line that is not blank takes the column.
const reindent = (text, prefixes, column) => {
  const lines = text.split('\n');
  const same = lines.length === prefixes.length;
  return lines.map((line, i) => (i === 0 ? line : (same ? prefixes[i] : line ? ' '.repeat(column) : '') + line)).join('\n');
};

function block(el, md, ctx) {
  const tag = el.localName;
  if (!ctx.force && means(el, md)) return sliceOf(ctx, md);
  if (tag === 'p' && md.type === 'paragraph') return paragraph(el, md, ctx);
  if (/^h[1-6]$/.test(tag) && md.type === 'heading') return heading(el, md, ctx);
  if ((tag === 'ul' || tag === 'ol') && md.type === 'list') return list(el, md, ctx);
  if (tag === 'li' && md.type === 'listItem') return item(el, md, ctx);
  if (tag === 'pre' && md.type === 'code') return code(el, md, ctx);
  if (tag === 'figure' && md.type === 'paragraph') return figure(el, md, ctx);
  // A node no stenographer of this lane writes keeps its bytes while it means them, and refuses once it does not.
  return means(el, md) ? sliceOf(ctx, md) : null;
}

// A textblock's bytes are read back before they are given. Bytes that do not mean the node are written once more with every colon of the touched text escaped (the plain parse reads `:name` as a directive unless a colon follows it, so escaping one colon can make the name before it one), and refused after that.
export function checked(el, ctx, write) {
  for (const strict of [false, true]) {
    const out = write({ ...ctx, strict });
    const md = parseMarkdown(ctx.defs ? `${out}\n\n${ctx.defs}` : out, ctx.markdown).children[0];
    if (md && means(el, md)) return out;
  }
  return null;
}

function paragraph(el, md, ctx) {
  const kids = md.children;
  if (!kids.length) return null;
  return checked(el, ctx, (c) => span(c, start(md), start(kids[0])) + edges(inline([...el.childNodes], kids, c)) + span(c, end(kids.at(-1)), end(md)));
}

// A space at a textblock's edge, which Markdown strips, written as its character reference so it stays (Enter just before a space leaves one at the new paragraph's start).
export const edges = (s) => s.replace(/^ /, '&#32;').replace(/ $/, '&#32;');

function heading(el, md, ctx) {
  const level = Number(el.localName[1]);
  const kids = md.children;
  const atx = /^ {0,3}#/.test(sliceOf(ctx, md));
  if (!kids.length) return atx ? sliceOf(ctx, md).replace(/#+/, '#'.repeat(level)) : null;
  const head = span(ctx, start(md), start(kids[0]));
  const tail = span(ctx, end(kids.at(-1)), end(md));
  return checked(el, ctx, (c) => {
    const content = edges(inline([...el.childNodes], kids, c));
    if (atx) return head.replace(/#+/, '#'.repeat(level)) + content + tail;
    if (level === md.depth) return head + content + tail;
    // A setext heading keeps its underline's length; past level 2 it becomes ATX.
    if (level <= 2) return head + content + tail.replace(/[=-]+/, (u) => (level === 1 ? '=' : '-').repeat(u.length));
    return `${'#'.repeat(level)} ${content.replace(/\n/g, ' ')}`;
  });
}

// A fenced code block keeps its fence lines and writes its new body; its language, when it changed, is the opening fence's first word. An indented block, or a body with a line that would close the fence, refuses.
function code(el, md, ctx) {
  const lines = sliceOf(ctx, md).split('\n');
  const fence = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(lines[0]);
  if (!fence) return null;
  // A fenced body ends with a line end, which the read gives the code; without it (its last line end deleted) the block cannot be fenced.
  if (el.textContent && !el.textContent.endsWith('\n')) return null;
  const body = el.textContent.replace(/\n$/, '');
  const closes = new RegExp(`^ {0,3}${fence[2][0] === '`' ? '`' : '~'}{${fence[2].length},}\\s*$`);
  if (body.split('\n').some((line) => closes.test(line))) return null;
  const was = /\blanguage-(\S+)/.exec(el.querySelector('code')?.className ?? '')?.[1] ?? '';
  let open = lines[0];
  if (was !== (md.lang ?? '')) open = `${fence[1]}${fence[2]}${was}${md.meta ? ` ${md.meta}` : ''}`;
  const close = lines.length > 1 && closes.test(lines.at(-1)) ? `\n${lines.at(-1)}` : '';
  return `${open}\n${body}${close}`;
}

// ---- inline content ----

const same = (n, o, ctx) => !ctx.force && means(n, o);

/** The bytes of new inline content over the old: the nodes that still mean what they meant keep their bytes, the rest are paired with the old in order and written in their style, or written fresh. */
export function inline(nodes, kids, ctx) {
  const n = nodes.length, m = kids.length;
  let i = 0;
  while (i < n && i < m && same(nodes[i], kids[i], ctx)) i++;
  let j = 0;
  while (j < n - i && j < m - i && same(nodes[n - 1 - j], kids[m - 1 - j], ctx)) j++;
  const from = start(kids[0]), to = end(kids[m - 1]);
  const midFrom = i < m ? start(kids[i]) : to;
  const midTo = j ? start(kids[m - j]) : to;
  const nMid = nodes.slice(i, n - j), oMid = kids.slice(i, m - j);
  const mid = nMid.length === oMid.length ? nMid.map((x, k) => pair(x, oMid[k], ctx)).join('') : nMid.map((x) => fresh(x)).join('');
  return span(ctx, from, midFrom) + mid + span(ctx, midTo, to);
}

const WRAPS = { em: 'emphasis', strong: 'strong', del: 'delete' };

function pair(n, o, ctx) {
  const notation = pairDialect(n, o, ctx);
  if (notation !== undefined) return notation;
  if (n.nodeType === 3) return o.type === 'text' ? text(n.data, o, ctx) : fresh(n);
  if (n.nodeType !== 1) return fresh(n);
  const tag = n.localName;
  // A text directive keeps its name, label brackets and attributes; its label is inline content like any other.
  if (tag === 'span' && o.type === 'textDirective') {
    if (!o.children.length) return n.childNodes.length ? fresh(n) : sliceOf(ctx, o);
    return span(ctx, start(o), start(o.children[0])) + inline([...n.childNodes], o.children, ctx) + span(ctx, end(o.children.at(-1)), end(o));
  }
  const wraps = (WRAPS[tag] === o.type || (tag === 'a' && (o.type === 'link' || o.type === 'linkReference'))) && o.children?.length;
  if (wraps) {
    const close = span(ctx, end(o.children.at(-1)), end(o));
    if (tag === 'a' && !sameTarget(n, o)) {
      if (o.type !== 'link' || sliceOf(ctx, o)[0] !== '[') return fresh(n);
      return `${span(ctx, start(o), start(o.children[0]))}${inline([...n.childNodes], o.children, ctx)}](${target(n)})`;
    }
    return span(ctx, start(o), start(o.children[0])) + inline([...n.childNodes], o.children, ctx) + close;
  }
  if (tag === 'code' && o.type === 'inlineCode') return n.textContent === o.value ? sliceOf(ctx, o) : fresh(n);
  if (tag === 'br' && o.type === 'break') return sliceOf(ctx, o);
  // A footnote reference's text is its number, which the document counts: anything else typed into it is not Markdown's to say.
  if (tag === 'sup' && o.type === 'footnoteReference') return sameTarget(n.querySelector('a') ?? n, o) && /^\d+$/.test(n.textContent) ? sliceOf(ctx, o) : fresh(n);
  return means(n, o) ? sliceOf(ctx, o) : fresh(n);
}

// A link's (or a footnote reference's) target as the HTML says it, against what the old node meant: the reference resolved through the definitions.
function sameTarget(a, o) {
  const dom = domOf(o.children ? { ...o, children: [] } : o)[0];
  const was = dom?.localName === 'a' ? dom : dom?.querySelector?.('a');
  return !!was && a.getAttribute('href') === was.getAttribute('href') && a.getAttribute('title') === was.getAttribute('title');
}
const target = (a) => `${a.getAttribute('href') ?? ''}${a.hasAttribute('title') ? ` "${a.getAttribute('title').replace(/"/g, '\\"')}"` : ''}`;

/** Typed text over an old text node: the common head and tail keep their bytes, the middle is escaped. */
function text(now, o, ctx) {
  const raw = sliceOf(ctx, o);
  if (now === o.value) return raw;
  if (ctx.strict) return escape(now, o.position.start.column === 1).replace(/(?<!\\):/g, '\\:');
  // ponytail: a text run whose bytes are not its value (an escape, an entity, an indented continuation line) is written fresh once touched; mapping value to bytes would keep the author's escapes.
  if (raw !== o.value) return escape(now, o.position.start.column === 1);
  let p = 0;
  while (p < now.length && p < raw.length && now[p] === raw[p]) p++;
  let s = 0;
  while (s < now.length - p && s < raw.length - p && now[now.length - 1 - s] === raw[raw.length - 1 - s]) s++;
  const lineStart = p === 0 ? o.position.start.column === 1 : raw[p - 1] === '\n';
  let head = raw.slice(0, p), mid = escape(now.slice(p, now.length - s), lineStart);
  const tail = raw.slice(raw.length - s);
  // A word typed against a colon would make the two a text directive (`:name`), so the colon is escaped, the old one included.
  if (/^\w/.test(mid) && /(^|[^\\]):$/.test(head)) head = `${head.slice(0, -1)}\\:`;
  if (/:$/.test(mid) && /^\w/.test(tail)) mid = `${mid.slice(0, -1)}\\:`;
  return head + mid + tail;
}

/** Text as Markdown that reads back as the same text: CommonMark's inline punctuation, BelType's notations (`:name` directives, `==` marks, `^` and `~` super- and subscript, `{…}` attributes, `$` math), and at a line's start what would open a block. */
export function escape(s, lineStart) {
  let out = s.replace(/[\\`*_[\]<>{}$^~]/g, '\\$&').replace(/&(?=#?\w+;)/g, '\\&').replace(/:(?=\w)/g, '\\:').replace(/==/g, '\\=\\=');
  out = out.replace(/\n(.*)/g, (_, line) => `\n${opener(line)}`);
  return lineStart ? opener(out) : out;
}
// What would open a block at a line's start (a heading, a quote, a list item), escaped.
const opener = (t) => t.replace(/^( {0,3})([#>+-])/, '$1\\$2').replace(/^( {0,3}\d+)([.)])/, '$1\\$2');

/**
 * A block written with no old bytes (a paragraph Enter made, a block inserted): a paragraph or a heading in Markdown's own syntax, read back before it is given; anything else, or what does not read back, as raw HTML (the lane change).
 * @param {Element} el the block as the HTML it means
 * @param {{ defs?: string, markdown?: import('./parse.js').Markdown }} [file] the file's definitions and Markdown options, for the read-back
 */
export function writeFresh(el, { defs, markdown } = {}) {
  if (el.nodeType === 8) return `<!--${el.data}-->`;
  const tag = el.localName;
  const inner = () => edges(opener([...el.childNodes].map(fresh).join('')));
  const out = tag === 'p' ? inner() : /^h[1-6]$/.test(tag) ? `${'#'.repeat(Number(tag[1]))} ${inner()}` : null;
  if (out) {
    const md = parseMarkdown(defs ? `${out}\n\n${defs}` : out, markdown).children[0];
    if (md && means(el, md)) return out;
  }
  return el.outerHTML;
}

/** An inline node written with no old bytes to keep: Markdown's own syntax where it has one, raw HTML where it has none (the lane change). */
export function fresh(n) {
  // The line end mdast-util-to-hast puts after a `br` is the break's own, which `\` and a line end already write.
  if (n.nodeType === 3) return escape(n.previousSibling?.localName === 'br' ? n.data.replace(/^\n/, '') : n.data, false);
  if (n.nodeType !== 1) return '';
  const notation = freshDialect(n);
  if (notation !== undefined) return notation;
  const inner = () => [...n.childNodes].map(fresh).join('');
  switch (n.localName) {
    case 'em': return `*${inner()}*`;
    case 'strong': return `**${inner()}**`;
    case 'del': return `~~${inner()}~~`;
    case 'a': return n.hasAttribute('href') && n.attributes.length <= 2 ? `[${inner()}](${target(n)})` : n.outerHTML;
    case 'br': return '\\\n';
    case 'img': return n.attributes.length <= 3 ? `![${n.getAttribute('alt') ?? ''}](${target({ getAttribute: (k) => n.getAttribute(k === 'href' ? 'src' : k), hasAttribute: (k) => n.hasAttribute(k) })})` : n.outerHTML;
    case 'code': {
      const t = n.textContent;
      const longest = Math.max(0, ...(t.match(/`+/g) ?? []).map((r) => r.length));
      const fence = '`'.repeat(longest + 1);
      const pad = /^`|`$/.test(t) ? ' ' : '';
      return `${fence}${pad}${t}${pad}${fence}`;
    }
    default: return n.outerHTML;
  }
}
