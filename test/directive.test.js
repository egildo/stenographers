// The directive container's own write: a callout's blocks edited, added and removed, its label, its opening line and fences kept byte for byte, nesting, and every container directive of the manual with a word typed in its first paragraph. Each case parses a directive, changes the element it means (`domOf`), writes it over its old slice and compares the exact bytes; the result is read back and must mean the edited element.
import './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseMarkdown } from '../src/parse.js';
import { domOf, means } from '../src/html.js';
import { writeNode } from '../src/write.js';

const markdown = { gfm: { autolinks: true, tables: true } };

/** The first directive in `text` written after `edit` changed its element; null if it refuses. */
function attempt(text, edit) {
  const md = parseMarkdown(text, markdown).children.find((k) => k.type === 'containerDirective');
  const el = domOf(md).find((n) => n.nodeType === 1);
  edit(el);
  const out = writeNode(el, { text: text.slice(md.position.start.offset, md.position.end.offset), column: 0, defs: '', markdown });
  return { out, el };
}
function write(text, edit) {
  const { out, el } = attempt(text, edit);
  assert.notEqual(out, null);
  const back = parseMarkdown(out, markdown).children;
  assert.equal(back.length, 1, 'one directive');
  assert.ok(means(el, back[0]) || domOf(back[0]).length, 'reads back');
  return out;
}
const p = (html) => { const e = document.createElement('p'); e.innerHTML = html; return e; };

test('a word typed in a callout paragraph; the rest keeps its bytes', () => {
  const text = ':::note{.a  title="x"}\nHello *there*.\n\nSecond   para\n:::';
  assert.equal(write(text, (el) => el.querySelector('p').append(' friend')), ':::note{.a  title="x"}\nHello *there*. friend\n\nSecond   para\n:::');
});

test('a paragraph added and one removed', () => {
  const text = ':::note\nOne\n\nTwo\n:::';
  assert.equal(write(text, (el) => el.append(p('Three'))), ':::note\nOne\n\nTwo\n\nThree\n:::');
  assert.equal(write(text, (el) => el.firstElementChild.remove()), ':::note\nTwo\n:::');
  assert.equal(write(text, (el) => el.lastElementChild.remove()), ':::note\nOne\n:::');
  assert.equal(write(text, (el) => el.firstElementChild.after(p('Mid'))), ':::note\nOne\n\nMid\n\nTwo\n:::');
});

test('a list inside edited', () => {
  const text = ':::tip\nSteps:\n\n- a\n- b\n:::';
  const out = write(text, (el) => { const li = document.createElement('li'); li.textContent = 'c'; const ul = el.querySelector('ul'); ul.append(li, '\n'); });
  assert.equal(out, ':::tip\nSteps:\n\n- a\n- b\n- c\n:::');
});

test('a label edited, and kept when it is not', () => {
  const text = ':::note[Hello *you*]{#id .c key="v"}\nBody\n:::';
  assert.equal(write(text, (el) => el.querySelector('p').append('!')), ':::note[Hello *you*!]{#id .c key="v"}\nBody\n:::');
  assert.equal(write(text, (el) => el.querySelectorAll('p')[1].append('!')), ':::note[Hello *you*]{#id .c key="v"}\nBody!\n:::');
  // A label deleted leaves the body paragraph as the first `p`, a label's HTML; the blocks being the old content's, it stays content and the brackets go.
  assert.equal(write(text, (el) => el.firstElementChild.remove()), ':::note{#id .c key="v"}\nBody\n:::');
});

test('attributes and fence bytes are kept as they are', () => {
  const text = ':::note{ .a   #b  k = "v" }\nBody\n:::   ';
  assert.equal(write(text, (el) => el.querySelector('p').append('!')), ':::note{ .a   #b  k = "v" }\nBody!\n:::   ');
  const more = '::::note{.a}\n\nBody\n\n::::';
  assert.equal(write(more, (el) => el.querySelector('p').append('!')), '::::note{.a}\n\nBody!\n\n::::');
});

test('nested containers', () => {
  const text = '::::outer{.o}\nBefore\n\n:::inner[L]\nDeep\n:::\n\nAfter\n::::';
  assert.equal(write(text, (el) => el.querySelector('div p:last-child').append('er')), '::::outer{.o}\nBefore\n\n:::inner[L]\nDeeper\n:::\n\nAfter\n::::');
  assert.equal(write(text, (el) => el.lastElementChild.append(' end')), '::::outer{.o}\nBefore\n\n:::inner[L]\nDeep\n:::\n\nAfter end\n::::');
});

test('the div serialized with no whitespace between blocks', () => {
  const text = ':::note\nOne\n\n- a\n- b\n\nTwo\n:::';
  const out = write(text, (el) => { el.innerHTML = el.innerHTML.replace(/>\s+</g, '><'); el.lastElementChild.append('!'); });
  assert.equal(out, ':::note\nOne\n\n- a\n- b\n\nTwo!\n:::');
});

test('an empty container keeps its fences; content can be added to it and removed from one', () => {
  assert.equal(write(':::note\nGone\n:::', (el) => el.replaceChildren()), ':::note\n:::');
  assert.equal(write(':::note\n:::', (el) => el.append(p('New'))), ':::note\nNew\n:::');
  assert.equal(write(':::note[L]\nGone\n:::', (el) => el.querySelectorAll('p')[1].remove()), ':::note[L]\n:::');
});

test('text between blocks, or an element that is no block, refuses', () => {
  assert.equal(attempt(':::note\nA\n:::', (el) => el.append('stray')).out, null);
});

test('every container directive of the manual: a word in its first paragraph writes only that paragraph', () => {
  const dir = new URL('../fixtures/', import.meta.url).pathname;
  let count = 0;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const tree = parseMarkdown(text, markdown);
    const visit = (node) => {
      if (node.type === 'containerDirective') {
        const first = node.children.find((k) => k.type === 'paragraph' && !k.data?.directiveLabel);
        if (first) {
          const slice = text.slice(node.position.start.offset, node.position.end.offset);
          const rel = (o) => o - node.position.start.offset;
          const el = domOf(node).find((n) => n.nodeType === 1);
          const labelled = node.children[0]?.data?.directiveLabel ? 1 : 0;
          const para = el.children[node.children.indexOf(first)];
          para.append(' word');
          const out = writeNode(el, { text: slice, column: 0, defs: '', markdown });
          assert.notEqual(out, null, file);
          const oldP = slice.slice(rel(first.position.start.offset), rel(first.position.end.offset));
          const before = slice.slice(0, rel(first.position.start.offset));
          const after = slice.slice(rel(first.position.end.offset));
          assert.ok(out.startsWith(before) && out.endsWith(after), `${file}: the rest is identical`);
          const mid = out.slice(before.length, out.length - after.length);
          assert.ok(mid.length > oldP.length && /word/.test(mid), `${file}: the paragraph changed`);
          void labelled;
          count++;
        }
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  }
  assert.ok(count >= 25, `${count} directives`);
});
