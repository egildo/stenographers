// The figure: core's rule (BelType's packages/core/src/plugins/figure.js), a paragraph whose only meaningful child is an image with a title is a `figure` holding the image (its title taken off) and a `figcaption` of the title, the title's trailing `{#id}` the figure's id and not part of the caption; and the figure's stenographer, which ./write.js's `block` asks for a `figure` over a paragraph. `figures` marks the paragraph for mdast-util-to-hast and leaves its children and positions as they are, so the figure is written over the paragraph's own bytes: the caption is the text inside the title's quotes, the alt the text inside the brackets, the source the destination, and each is rewritten alone, the rest kept.
import { toHast } from 'mdast-util-to-hast';
import { checked, span, start, end, sliceOf } from './write.js';
import { domOf } from './html.js';

const LABEL = /\s*\{#([^}]+)\}\s*$/;

/**
 * Marks each figure of a tree of the plain parse, in place, for mdast-util-to-hast (`data.hName`, `data.hProperties`, `data.hChildren` on the paragraph), leaving its children and their positions as they are.
 * @param {object} tree the plain parse's mdast
 */
export function figures(tree) {
  // A reference image takes its url and title from the definition, as to-hast gives them (the first definition of an identifier wins).
  const defs = new Map();
  (function find(node) {
    if (node.type === 'definition' && !defs.has(node.identifier)) defs.set(node.identifier, node);
    node.children?.forEach(find);
  })(tree);
  // A tight list's items hold their paragraphs unwrapped (mdast-util-to-hast's rule, the list's looseness), so core, which promotes a `p`, finds none there.
  const loose = (list) => list.spread || list.children.some((i) => (i.spread == null ? i.children.length > 1 : i.spread));
  (function walk(node, tight) {
    if (node.type === 'paragraph' && !tight) {
      const kids = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
      const k = kids.length === 1 ? kids[0] : null;
      const def = k?.type === 'imageReference' ? defs.get(k.identifier) : null;
      const img = k?.type === 'image' ? k : def ? { type: 'image', url: def.url, alt: k.alt, title: def.title } : null;
      if (img?.title) {
        const m = LABEL.exec(img.title);
        const caption = m ? img.title.slice(0, m.index).trim() : img.title;
        node.data = {
          ...node.data,
          hName: 'figure',
          hProperties: m ? { id: m[1] } : {},
          hChildren: [toHast({ ...img, title: null }), { type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: caption }] }]
        };
      }
    }
    const items = node.type === 'list' && !loose(node);
    node.children?.forEach((c) => walk(c, items ? 'item' : tight === 'item' && node.type === 'listItem'));
  })(tree, false);
}

// Backslash and the characters that would close the title, as Markdown escapes them.
const escTitle = (s, open) => s.replace(/\\/g, '\\\\').replace(open === '(' ? /[()]/g : new RegExp(open, 'g'), '\\$&').replace(/&(?=#?\w+;)/g, '\\&');
const escAlt = (s) => s.replace(/[\\[\]]/g, '\\$&');
// A source as the HTML has it (already percent-encoded but for whitespace).
const dest = (s) => s.replace(/\s/g, encodeURIComponent).replace(/[()\\]/g, '\\$&');

/**
 * A figure's bytes over the paragraph it was read from, or null (the lane change).
 * @param {Element} el the figure as the HTML it means
 * @param {object} md the paragraph's mdast
 * @param {object} ctx the stenographers' context (./write.js)
 * @returns {string | null}
 */
export function figure(el, md, ctx) {
  const img = md.children.find((c) => c.type === 'image');
  const old = domOf(md)[0];
  if (!img || old?.localName !== 'figure') return null;
  // Exactly an img and a figcaption of plain text (spaces between allowed), the figure carrying nothing but an id.
  const kids = [...el.childNodes].filter((n) => n.nodeType !== 3 || n.data.trim());
  const [pic, cap] = kids;
  if (kids.length !== 2 || pic.localName !== 'img' || cap.localName !== 'figcaption' || [...cap.childNodes].some((n) => n.nodeType !== 3)) return null;
  if ([...el.attributes].some((a) => a.name !== 'id') || cap.attributes.length || [...pic.attributes].some((a) => a.name !== 'src' && a.name !== 'alt')) return null;
  // Untrimmed, as the caption is read: a title with no `{#id}` keeps its edge spaces in the figcaption.
  const caption = cap.textContent;
  if (!caption.trim() || /\n\s*\n/.test(caption)) return null;
  const raw = sliceOf(ctx, img);
  // The image's parts in its bytes: the alt up to the `]` that closes it, then `(destination title)`.
  if (raw.slice(0, 2) !== '![') return null;
  let i = 2, depth = 0;
  for (; i < raw.length; i++) {
    if (raw[i] === '\\') i++;
    else if (raw[i] === '[') depth++;
    else if (raw[i] === ']' && !depth--) break;
  }
  // No inline title in the bytes (a reference image, whose title is a definition's) refuses here.
  const m = /^\]\((\s*(?:<[^>\n]*>|\S*))(\s+(["'(]))([\s\S]*)([")'])(\s*)\)$/.exec(raw.slice(i));
  if (!m) return null;
  const [, to, gap, open, title, , tail] = m;
  const alt = pic.getAttribute('alt') ?? '';
  const src = pic.getAttribute('src') ?? '';
  const oldImg = old.querySelector('img');
  const label = LABEL.exec(img.title);
  const oldCaption = label ? img.title.slice(0, label.index).trim() : img.title;
  // The title's bytes: the caption's (kept when unchanged), then the label's, its spacing kept and only the id inside the braces rewritten.
  const rawLabel = /\s*\{#[^}]*\}\s*$/.exec(title);
  const id = el.getAttribute('id') ?? '';
  const keptCaption = rawLabel ? title.slice(0, rawLabel.index) : title;
  const suffix = !id ? '' : rawLabel ? rawLabel[0].replace(/\{#[^}]*\}/, () => `{#${id}}`) : ` {#${id}}`;
  const titleBytes = (caption === oldCaption ? keptCaption : escTitle(caption, open)) + suffix;
  const close = open === '(' ? ')' : open;
  return checked(el, ctx, (c) => {
    const altBytes = alt === (oldImg.getAttribute('alt') ?? '') ? raw.slice(2, i) : escAlt(alt);
    const dst = src === oldImg.getAttribute('src') ? to : dest(src);
    return `${span(c, start(md), start(img))}![${altBytes}](${dst}${gap}${titleBytes}${close}${tail})${span(c, end(img), end(md))}`;
  });
}
