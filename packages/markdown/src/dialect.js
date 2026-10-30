// BelType's notations on the plain parse (the studio's notes/markdown-round-3-orchestration.md, agent C): `==mark==` and `=k=mark==` (core's remark-flexible-markers 1.3.5), `~sub~` and `^sup^` (core's remark-supersub 1.0.0), found where core finds them, in text values, and positioned in the bytes through each text node's map from its value to its bytes; and their stenographers, which the inline stenographers of ./write.js ask first.
import { inline, fresh, span, start, end } from './write.js';

// core's letter table; a key letter gives `flexible-marker flexible-marker-<colour>`, no key `flexible-marker flexible-marker-default`.
const COLOURS = { a: 'amber', b: 'blue', c: 'cyan', d: 'brown', e: 'espresso', f: 'fuchsia', g: 'green', h: 'hotpink', i: 'indigo', j: 'jade', k: 'kiwi', l: 'lime', m: 'magenta', n: 'navyblue', o: 'orange', p: 'purple', q: 'pink', r: 'red', s: 'silver', t: 'teal', u: 'umber', v: 'violet', w: 'white', x: 'gray', y: 'yellow', z: 'black' };
const BASE = 'flexible-marker';
const KEYS = Object.fromEntries(Object.entries(COLOURS).map(([k, v]) => [`${BASE}-${v}`, k]));
// core's regexes: a mark in one text node; the opening and the closing of a mark across formatting.
const MARK = /=([a-z]?)=(?![\s=])([\s\S]*?)(?<![\s=])==/g;
const OPENING = /=([a-z]?)=(?![\s]|=+\s)/;
const CLOSING = /(?<!\s|\s=|\s==|\s===|\s====)==/;

// A text node's value against its bytes: where each character of the value stands in them (one past the last at the end), or null when they do not align. A byte the value does not hold is passed over: an escape's backslash (the character it escapes standing for itself), an entity's name (every character it decodes to standing at its `&`), a continuation line's prefix.
function align(raw, value) {
  const map = [];
  let r = 0;
  for (let v = 0; v < value.length; v++) {
    for (;;) {
      if (r >= raw.length) return null;
      if (raw[r] === '\\' && raw[r + 1] === value[v] && /[!-/:-@[-`{-~]/.test(value[v])) { map.push(r); r += 2; break; }
      if (raw[r] === value[v]) { map.push(r++); break; }
      const e = raw[r] === '&' && /^&(?:#\d+|#x[\da-f]+|\w+);/i.exec(raw.slice(r));
      if (e) {
        const t = document.createElement('textarea');
        t.innerHTML = e[0];
        if (value.startsWith(t.value, v)) { for (let i = 0; i < t.value.length; i++) map.push(r); v += t.value.length - 1; r += e[0].length; break; }
      }
      r++;
    }
  }
  map.push(r);
  return map;
}

// Visits every parent's children in order; `f(parent, i)` answers whether it replaced child `i`, which is then looked at again.
function walk(parent, f) {
  for (let i = 0; i < parent.children.length; i++) {
    if (f(parent, i)) { i--; continue; }
    if (parent.children[i].children) walk(parent.children[i], f);
  }
}

/**
 * Finds the notations in a tree of the plain parse, in place: each becomes an mdast node of its own (`mark`, `subscript`, `superscript`) whose `data.hName` mdast-util-to-hast reads, positioned in `text`. Marks are found as core finds them, in one text node or from an opening in one text node to a closing in a later sibling (across emphasis, code, links); an empty mark (`====`) is left as text. They are found in values, as core finds them, so an escaped delimiter is a delimiter (`\^2\^` is a superscript in core too): what this package reads is what core renders, and typed text holding a pair of delimiters, which no escape can keep text, reads back as the notation and refuses (the paragraph changes lane). Like core, a text node with an odd number of carets (or tildes) holds no superscript (subscript).
 * @param {object} tree the plain parse's mdast
 * @param {string} text the text it was parsed from
 * @param {import('./parse.js').Markdown} markdown `mark: false` and `supersub: false` switch them off
 */
export function dialect(tree, text, markdown) {
  const lines = [0];
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) lines.push(i + 1);
  const maps = new Map();
  const mapOf = (t) => { if (!maps.has(t)) maps.set(t, t.type === 'text' && t.position ? align(text.slice(t.position.start.offset, t.position.end.offset), t.value) : null); return maps.get(t); };
  const ok = (t) => mapOf(t) != null;
  // The point `k` characters into a text node's value, in the text.
  const point = (t, k) => {
    const offset = t.position.start.offset + mapOf(t)[k];
    let lo = 0, hi = lines.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lines[mid] <= offset) lo = mid; else hi = mid - 1; }
    return { line: lo + 1, column: offset - lines[lo] + 1, offset };
  };
  // A new text node keeps a map of its own, the part of its parent's.
  const piece = (t, a, b) => { if (a >= b) return null; const p = { type: 'text', value: t.value.slice(a, b), position: { start: point(t, a), end: point(t, b) } }; maps.set(p, mapOf(t).slice(a, b + 1).map((o) => o - mapOf(t)[a])); return p; };
  const make = (type, hName, hProperties, t0, a, t1, b, children) => ({ type, data: { hName, hProperties }, children, position: { start: point(t0, a), end: point(t1, b) } });
  const markOf = (key, ...at) => make('mark', 'mark', { className: [BASE, key ? `${BASE}-${COLOURS[key]}` : `${BASE}-default`] }, ...at);
  const delim = (ch, type, name) => (parent, i) => {
    const t = parent.children[i];
    if (!ok(t)) return false;
    const parts = t.value.split(ch);
    if (parts.length < 3 || parts.length % 2 === 0 || parts.some((p, k) => k % 2 && !p)) return false;
    let at = 0;
    const out = parts.map((p, k) => {
      if (k % 2 === 0) { at += p.length; return piece(t, at - p.length, at); }
      at += p.length + 2;
      return make(type, name, {}, t, at - p.length - 2, t, at, [piece(t, at - p.length - 1, at - 1)]);
    });
    parent.children.splice(i, 1, ...out.filter(Boolean));
    return true;
  };
  if (markdown.mark !== false) {
    walk(tree, (parent, i) => {
      const t = parent.children[i];
      if (!ok(t)) return false;
      const ms = [...t.value.matchAll(MARK)];
      if (!ms.length) return false;
      let at = 0;
      const out = [];
      for (const m of ms) {
        const open = m[0].length - m[2].length - 2, b = m.index + m[0].length;
        out.push(piece(t, at, m.index), markOf(m[1], t, m.index, t, b, [piece(t, m.index + open, b - 2)]));
        at = b;
      }
      out.push(piece(t, at, t.value.length));
      parent.children.splice(i, 1, ...out.filter(Boolean));
      return true;
    });
    walk(tree, (parent, i) => {
      const t = parent.children[i];
      if (!ok(t)) return false;
      const o = OPENING.exec(t.value);
      const j = o ? parent.children.findIndex((c, k) => k > i && c.type === 'text' && CLOSING.test(c.value)) : -1;
      if (j < 0 || !ok(parent.children[j])) return false;
      const c = parent.children[j], e = CLOSING.exec(c.value);
      const kids = [piece(t, o.index + o[0].length, t.value.length), ...parent.children.slice(i + 1, j), piece(c, 0, e.index)].filter(Boolean);
      if (!kids.length) return false;
      parent.children.splice(i, j - i + 1, ...[piece(t, 0, o.index), markOf(o[1], t, o.index, c, e.index + 2, kids), piece(c, e.index + 2, c.value.length)].filter(Boolean));
      return true;
    });
  }
  if (markdown.supersub !== false) {
    walk(tree, delim('^', 'superscript', 'sup'));
    walk(tree, delim('~', 'subscript', 'sub'));
  }
}

const KINDS = { mark: 'mark', sub: 'subscript', sup: 'superscript' };
const texts = (n) => n.childNodes.length > 0 && [...n.childNodes].every((c) => c.nodeType === 3);
// A mark element's key letter ('' for the default colour), or null when it is not exactly core's output (another class, any other attribute).
function keyOf(n) {
  const cls = (n.getAttribute('class') ?? '').split(/\s+/);
  if (n.attributes.length !== 1 || cls.length !== 2 || cls[0] !== BASE) return null;
  return cls[1] === `${BASE}-default` ? '' : (KEYS[cls[1]] ?? null);
}
const opening = (k) => (k ? `=${k}=` : '==');
// What the notation cannot carry, so that its bytes would read back as something else: a mark with a space at an edge or `==` in it; a sub- or superscript holding an element, a space or either delimiter.
const uncarried = (n) => (n.localName === 'mark' ? /^\s|\s$|==/.test(n.textContent) : !texts(n) || /[\s~^]/.test(n.textContent));

/**
 * An element over an old inline node, when it is a notation's: its bytes, or `undefined` when it is not this file's to write (./write.js's `pair` goes on). The delimiters keep their bytes and the content is written as an emphasis's is; a mark whose colour changed has its key rewritten, and a notation that is no longer exactly core's output, or holds what its notation cannot carry, is raw HTML (that element alone, the paragraph keeping its bytes).
 * @param {Node} n the element (or text) as the HTML it means
 * @param {object} o the old mdast node it is paired with
 * @param {object} ctx the stenographers' context (./write.js)
 * @returns {string | undefined}
 */
export function pairDialect(n, o, ctx) {
  if (n.nodeType !== 1 || KINDS[n.localName] !== o.type || !o.children?.length) return undefined;
  if (!n.childNodes.length || uncarried(n)) return n.outerHTML;
  let open = span(ctx, start(o), start(o.children[0]));
  if (n.localName === 'mark') {
    const k = keyOf(n);
    if (k == null) return n.outerHTML;
    open = opening(k);
  }
  return open + inline([...n.childNodes], o.children, ctx) + span(ctx, end(o.children.at(-1)), end(o));
}

/**
 * An inline element with no old bytes, when a notation writes it: its bytes, or `undefined` when it is not this file's (./write.js's `fresh` goes on). What the notation cannot carry is raw HTML: a mark with a class outside core's table, any other attribute, no content, or what the notation cannot carry.
 * @param {Element} n
 * @returns {string | undefined}
 */
export function freshDialect(n) {
  if (!KINDS[n.localName]) return undefined;
  const inner = [...n.childNodes].map(fresh).join('');
  if (!n.childNodes.length || uncarried(n)) return n.outerHTML;
  if (n.localName === 'mark') { const k = keyOf(n); return k == null ? n.outerHTML : `${opening(k)}${inner}==`; }
  const ch = n.localName === 'sub' ? '~' : '^';
  return ch + inner + ch;
}
