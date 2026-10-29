// What a piece of Markdown means in HTML: mdast-util-to-hast's translation (the one remark-rehype makes in BelType's belt), written as markup and parsed by the browser, so raw HTML split across several mdast nodes (`<span>`, text, `</span>`) becomes the one element it is.
import { toHast } from 'mdast-util-to-hast';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
// hast's property names as HTML's attribute names, for the properties mdast-util-to-hast writes.
const attrName = (k) => (k === 'className' ? 'class' : k === 'htmlFor' ? 'for' : k.startsWith('aria') ? `aria-${k.slice(4).toLowerCase()}` : k.startsWith('data') ? k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`) : k.toLowerCase());

/** The markup of a hast tree. */
export function htmlOf(node) {
  if (node.type === 'text') return escText(node.value);
  if (node.type === 'raw') return node.value;
  if (node.type === 'comment') return `<!--${node.value}-->`;
  const inner = (node.children ?? []).map(htmlOf).join('');
  if (node.type !== 'element') return inner;
  const attrs = Object.entries(node.properties ?? {}).filter(([, v]) => v != null && v !== false)
    .map(([k, v]) => (v === true ? ` ${attrName(k)}=""` : ` ${attrName(k)}="${escAttr(Array.isArray(v) ? v.join(' ') : String(v))}"`)).join('');
  return VOID.has(node.tagName) ? `<${node.tagName}${attrs}>` : `<${node.tagName}${attrs}>${inner}</${node.tagName}>`;
}

/** The hast of an mdast tree. A text directive has no HTML of its own here (BelType's directive handlers give it one; the plan's round 3), so it is a `span`: inline, it stays in its paragraph, where to-hast's default would make it a `div` the browser closes the paragraph for. */
export function hastOf(mdast) {
  (function inline(node) {
    if (node.type === 'textDirective') node.data = { ...node.data, hName: node.data?.hName ?? 'span' };
    node.children?.forEach(inline);
  })(mdast);
  return toHast(mdast, { allowDangerousHtml: true });
}

/** The DOM nodes an mdast node stands for in HTML. */
export function domOf(mdast) {
  const t = document.createElement('template');
  t.innerHTML = htmlOf(hastOf(mdast));
  return [...t.content.childNodes];
}

/** Whether a DOM node is what an mdast node means in HTML (the test that lets an unchanged node keep its bytes), the whitespace between its blocks aside (`bare`). */
export function means(node, mdast) {
  const dom = domOf(mdast).filter((n) => n.nodeType !== 3 || /\S/.test(n.data) || n.data === node.data);
  return dom.length === 1 && bare(dom[0]).isEqualNode(bare(node));
}

// The elements whose neighbours' whitespace is layout, not text: blocks and the parts of lists and tables.
const STRUCTURE = new Set(['address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'dd', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'ul']);
const layout = (n) => !n || (n.nodeType === 1 && STRUCTURE.has(n.localName));
// Layout whitespace is HTML's own (space, tab, line ends); a no-break space or an em space is text.
const LAYOUT = /^[ \t\n\r\f]+$/;

/** A copy of an element, its count left out (`uncounted`), without the whitespace between its blocks, which mdast-util-to-hast writes as line ends and an editor's serializer need not write at all: what a container's read-back compares. Whitespace with no element beside it (a cell's or a paragraph's whole text) is kept: it is content. */
export function bare(el) {
  const copy = uncounted(el).cloneNode(true);
  copy.normalize?.();
  // A preformatted block's whitespace is its text.
  (function walk(p) {
    if (p.localName === 'pre') return;
    for (const c of [...p.childNodes]) {
      if (c.nodeType === 3 && LAYOUT.test(c.data) && STRUCTURE.has(p.localName) && (c.previousSibling || c.nextSibling) && layout(c.previousSibling) && layout(c.nextSibling)) c.remove();
      else if (c.nodeType === 1) walk(c);
    }
  })(copy);
  return copy;
}

// A footnote reference's number and id are the document's count, not the reference's meaning: a paragraph read alone counts from one.
export function uncounted(node) {
  if (node.nodeType !== 1 || !node.querySelector('a[data-footnote-ref]')) return node;
  const copy = node.cloneNode(true);
  for (const a of copy.querySelectorAll('a[data-footnote-ref]')) { a.textContent = ''; a.removeAttribute('id'); }
  return copy;
}
