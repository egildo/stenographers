// The stenographers' identity over BelType's manual (fixtures/, its nine files as they were on 2026-10-29, parsed with the manual's GFM options, autolinks and tables on), and the typing probe: the studio's `markdown:identity` check, in node, the element each node means taken from mdast-util-to-hast's translation (`domOf`) instead of a ProseMirror document's serializer.
import './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseMarkdown } from '../src/parse.js';
import { domOf, means } from '../src/html.js';
import { writeNode } from '../src/write.js';

const markdown = { gfm: { autolinks: true, tables: true } };
const dir = path.resolve(import.meta.dirname, '../fixtures');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => ({ name: f, text: fs.readFileSync(path.join(dir, f), 'utf8') }));
const WRITTEN = new Set(['paragraph', 'heading', 'list', 'listItem']);
const GAPS = new Set(['definition', 'footnoteDefinition', 'yaml', 'html']);

/** Every node of the kinds the stenographers write, at every depth outside the footnote definitions (a generated section's), and every other top-level block. */
function nodes(tree) {
  const out = [];
  (function walk(node, top) {
    if (node.type === 'footnoteDefinition') return;
    if (WRITTEN.has(node.type) || (top && !GAPS.has(node.type))) out.push(node);
    for (const child of node.children ?? []) walk(child, node.type === 'root');
  })(tree, false);
  return out;
}
const elementOf = (md) => domOf(md).find((n) => n.nodeType === 1);
const columnOf = (text, offset) => offset - (text.lastIndexOf('\n', offset - 1) + 1);
const defsOf = (tree, text) => tree.children.filter((n) => n.type === 'definition' || n.type === 'footnoteDefinition').map((n) => text.slice(n.position.start.offset, n.position.end.offset)).join('\n\n');

for (const { name, text } of files) {
  const tree = parseMarkdown(text, markdown);
  const defs = defsOf(tree, text);
  test(`${name}: every paragraph, heading, list and item written from its style alone is its slice; every other block keeps its bytes`, () => {
    const wrong = [];
    for (const md of nodes(tree)) {
      const slice = text.slice(md.position.start.offset, md.position.end.offset);
      const out = writeNode(elementOf(md), { text: slice, column: columnOf(text, md.position.start.offset), defs, markdown }, { force: WRITTEN.has(md.type) });
      if (out !== slice) wrong.push({ type: md.type, line: md.position.start.line, out: out?.slice(0, 80) ?? null });
    }
    assert.deepEqual(wrong, []);
  });
  test(`${name}: a key typed at the end of every top-level paragraph and heading reads back as the edited node, only the typed bytes changed`, () => {
    const wrong = [];
    for (const md of tree.children.filter((n) => n.type === 'paragraph' || n.type === 'heading')) {
      const slice = text.slice(md.position.start.offset, md.position.end.offset);
      const el = elementOf(md);
      el.append('x');
      el.normalize();
      const out = writeNode(el, { text: slice, column: 0, defs, markdown });
      const back = out && parseMarkdown(`${out}\n\n${defs}`, markdown).children[0];
      // Only the `x`, or, after a colon, the colon escaped with it (`:x` would open a text directive), or every colon of the touched text escaped: the read-back rule's second try, measured on `syntax.md`'s `:rocket: :compass:`, where escaping one colon makes the name before it a directive.
      const minimal = out === `${slice}x` || out?.replace(/\\:/g, ':') === `${slice}x`;
      if (!back || !means(el, back) || !minimal) wrong.push({ line: md.position.start.line, end: slice.slice(-30), out: out?.slice(-34) ?? null });
    }
    assert.deepEqual(wrong, []);
  });
}
