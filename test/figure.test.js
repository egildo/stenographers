// The figure: core's rule read at mdast level, and its stenographer writing only the bytes that changed.
import './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseMarkdown } from '../src/parse.js';
import { domOf } from '../src/html.js';
import { writeNode } from '../src/write.js';

const html = (text, markdown) => domOf(parseMarkdown(text, markdown).children[0]).map((n) => n.outerHTML ?? n.data).join('');
const elOf = (text) => domOf(parseMarkdown(text).children[0])[0];
const write = (el, text, defs = '') => writeNode(el, { text, column: 0, defs, markdown: {} });
const edit = (text, f) => { const el = elOf(text); f(el); return write(el, text); };
const cap = (e, t) => { e.querySelector('figcaption').textContent = t; };

test('a titled lone image is core\'s figure, with and without an id', () => {
  assert.equal(html('![a](x.png "Cap")'), '<figure><img src="x.png" alt="a"><figcaption>Cap</figcaption></figure>');
  assert.equal(html('![a](x.png "Cap {#fig:r}")'), '<figure id="fig:r"><img src="x.png" alt="a"><figcaption>Cap</figcaption></figure>');
});
test('an untitled image, an image beside text, an image in a link, and figure: false stay a paragraph', () => {
  assert.equal(html('![a](x.png)'), '<p><img src="x.png" alt="a"></p>');
  assert.match(html('![a](x.png "Cap") text'), /^<p>/);
  assert.match(html('[![a](x.png "Cap")](u)'), /^<p><a/);
  assert.match(html('![a](x.png "Cap")', { figure: false }), /^<p>/);
});
test('in a tight list item the image stays an image, as core renders it; in a loose one it is a figure', () => {
  assert.match(html('- ![a](x.png "Cap")\n- b'), /^<ul>\s*<li><img src="x.png" alt="a" title="Cap"><\/li>/);
  assert.match(html('- ![a](x.png "Cap")\n\n- b'), /<li>\s*<figure>/);
  const s = '- ![a](x.png "Cap")\n- b', ul = elOf(s);
  ul.querySelectorAll('li')[1].textContent = 'bee';
  assert.equal(write(ul, s), '- ![a](x.png "Cap")\n- bee');
});
test('a title with spaces at its edges keeps them through an alt edit', () => {
  assert.equal(edit('![a](x.png " Cap ")', (e) => e.querySelector('img').setAttribute('alt', 'b')), '![b](x.png " Cap ")');
});
test('a figure written from its own meaning is its slice', () => {
  for (const s of ['![a](x.png "Cap")', "![a](x.png 'Cap {#fig:r}')", '![a](x.png (Cap))']) assert.equal(write(elOf(s), s), s);
});
test('a caption edit rewrites only the title text, keeping quote and id', () => {
  assert.equal(edit('![a](x.png "Cap {#fig:r}")', (e) => cap(e, 'New cap')), '![a](x.png "New cap {#fig:r}")');
  assert.equal(edit("![a](x.png 'Cap')", (e) => cap(e, 'Cap!')), "![a](x.png 'Cap!')");
  assert.equal(edit('![a](x.png (Cap))', (e) => cap(e, 'Cap!')), '![a](x.png (Cap!))');
});
test('a quote typed in a caption is escaped', () => {
  assert.equal(edit('![a](x.png "Cap")', (e) => cap(e, 'A "b" c')), '![a](x.png "A \\"b\\" c")');
  assert.equal(edit('![a](x.png (Cap))', (e) => cap(e, 'A (b) c')), '![a](x.png (A \\(b\\) c))');
});
test('alt and source edits change only their bytes', () => {
  assert.equal(edit('![a *b*](x.png "Cap")', (e) => e.querySelector('img').setAttribute('alt', 'n[1]')), '![n\\[1\\]](x.png "Cap")');
  assert.equal(edit('![a](x.png "Cap")', (e) => e.querySelector('img').setAttribute('src', 'y.png')), '![a](y.png "Cap")');
});
test('an id edit rewrites the suffix, adding and removing it', () => {
  assert.equal(edit('![a](x.png "Cap  {#fig:r}")', (e) => e.setAttribute('id', 'fig:s')), '![a](x.png "Cap  {#fig:s}")');
  assert.equal(edit('![a](x.png "Cap")', (e) => e.setAttribute('id', 'f')), '![a](x.png "Cap {#f}")');
  assert.equal(edit('![a](x.png "Cap {#f}")', (e) => e.removeAttribute('id')), '![a](x.png "Cap")');
});
test('what a title cannot hold refuses', () => {
  const s = '![a](x.png "Cap")';
  assert.equal(edit(s, (e) => { e.querySelector('figcaption').innerHTML = 'a <em>b</em>'; }), null);
  assert.equal(edit(s, (e) => cap(e, '  ')), null);
  assert.equal(edit(s, (e) => e.append('x')), null);
  assert.equal(edit(s, (e) => e.querySelector('figcaption').remove()), null);
  // A reference image's title is a definition's, not the paragraph's bytes.
  const defs = '[r]: x.png "Cap"';
  const el = domOf(parseMarkdown(`![a][r]\n\n${defs}`).children[0])[0];
  assert.equal(el.localName, 'figure');
  cap(el, 'Other');
  assert.equal(write(el, '![a][r]', defs), null);
});
test('the manual\'s own figure', () => {
  const text = fs.readFileSync(path.resolve(import.meta.dirname, '../fixtures/syntax.md'), 'utf8');
  const line = '![A map of the route](assets/route.svg "The annual migration {#fig:route}")';
  assert.ok(text.includes(`\n${line}\n`));
  assert.equal(write(elOf(line), line), line);
  assert.equal(edit(line, (e) => cap(e, 'The migration')), line.replace('The annual migration', 'The migration'));
});
