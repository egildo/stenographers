// The quote's own write: blocks typed in, added and removed, the prefixes kept or taken from the first line. Each case parses a small quote, changes the element it means (`domOf`), writes it over its old slice and compares the exact bytes; the write refuses (null) when the bytes would not read back as the edited element.
import './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../src/parse.js';
import { domOf } from '../src/html.js';
import { writeNode } from '../src/write.js';

const markdown = { gfm: { autolinks: true, tables: true } };

/** The first block of `text` written after `edit` changed its element (or the one `pick` finds inside it). */
function write(text, edit, pick = (el) => el) {
  const md = parseMarkdown(text, markdown).children[0];
  const el = domOf(md).find((n) => n.nodeType === 1);
  edit(pick(el));
  return writeNode(el, { text: text.slice(md.position.start.offset, md.position.end.offset), column: 0, defs: '', markdown });
}
const p = (el, i = 0) => el.querySelectorAll('p')[i];
const add = (html) => (el) => { const q = document.createElement('p'); q.innerHTML = html; el.append(q, '\n'); };
const inner = (el) => el.querySelector('blockquote');

test('a word typed in a one-line quote', () => {
  assert.equal(write('> hello', (el) => { p(el).firstChild.data = 'hello world'; }), '> hello world');
});

test('a word typed in a multi-line paragraph keeps the lazy line without a prefix', () => {
  assert.equal(write('> one\ntwo\n> three', (el) => { p(el).firstChild.data = 'one\nTWO\nthree'; }), '> one\nTWO\n> three');
});

test('a paragraph added with Enter, and removed', () => {
  assert.equal(write('> a', add('b')), '> a\n>\n> b');
  assert.equal(write('> a\n>\n> b', (el) => p(el, 1).remove()), '> a');
  assert.equal(write('> a\n>\n> b', (el) => p(el, 0).remove()), '> b');
});

test('the first line prefix is kept: without a space, indented', () => {
  assert.equal(write('>a', add('b')), '>a\n>\n>b');
  // The slice starts at the `>`; the indent before it is the parent's.
  assert.equal(write(' > a\n > b', (el) => { p(el).firstChild.data = 'a\nbb'; }), '> a\n > bb');
  assert.equal(write(' > a', (el) => { p(el).firstChild.data = 'ab'; }), '> ab');
});

test('an untouched block keeps its bytes', () => {
  assert.equal(write('> a  *b*\n>\n> c', (el) => { p(el, 1).firstChild.data = 'cc'; }), '> a  *b*\n>\n> cc');
});

test('the element serialized with no whitespace between blocks keeps its bytes', () => {
  const text = '> a\n>\n> *b*';
  const md = parseMarkdown(text, markdown).children[0];
  const el = domOf(md).find((n) => n.nodeType === 1);
  el.innerHTML = el.innerHTML.replace(/>\n</g, '><');
  assert.equal(writeNode(el, { text, column: 0, defs: '', markdown }), text);
});

test('a nested quote', () => {
  assert.equal(write('> > a\n>\n> b', (el) => { p(el).firstChild.data = 'aa'; }), '> > aa\n>\n> b');
  assert.equal(write('> > a', add('b'), inner), '> > a\n> >\n> > b');
});

test('a quote holding a list', () => {
  assert.equal(write('> - a\n> - b', (el) => { el.querySelectorAll('li')[1].firstChild.data = 'bb'; }), '> - a\n> - bb');
  assert.equal(write('> - a\n> - b', (el) => { const li = document.createElement('li'); li.textContent = 'c'; el.querySelector('ul').append('\n', li); }), '> - a\n> - b\n> - c');
});

test('a quote inside a list item', () => {
  assert.equal(write('- x\n\n  > a\n  > b', (el) => { p(el.querySelector('blockquote')).firstChild.data = 'a\nbb'; }), '- x\n\n  > a\n  > bb');
  assert.equal(write('- > a', add('b'), (el) => el.querySelector('blockquote')), '- > a\n  >\n  > b');
});

test('a typed > at a line start is escaped', () => {
  assert.equal(write('> a', (el) => { p(el).firstChild.data = 'a\n> b'; }), '> a\n> \\> b');
});

test('a block no stenographer writes changes lane inside the quote', () => {
  assert.equal(write('> a', (el) => { const d = document.createElement('div'); d.innerHTML = '<b>x</b>'; el.append('\n', d); }), '> a\n>\n> <div><b>x</b></div>');
});

test('a definition in the quote refuses', () => {
  assert.equal(write('> [a]: /u\n>\n> b', (el) => { p(el).firstChild.data = 'c'; }), null);
});
