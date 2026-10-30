// BelType's notations: ==mark==, =k=mark==, ~sub~ and ^sup^, read as the elements core makes and written back over their bytes.
import './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseMarkdown } from '../src/parse.js';
import { domOf, means } from '../src/html.js';
import { writeNode, writeFresh, fresh } from '../src/write.js';

const para = (text, markdown = {}) => parseMarkdown(text, markdown).children[0];
const el = (md) => domOf(md).find((n) => n.nodeType === 1);
const kinds = (md) => md.children.map((c) => c.type);
const old = (text, markdown = {}) => ({ text, column: 0, defs: '', markdown });
// The paragraph of `text` with its first text node's value changed, as an editor would after typing.
const typed = (text, edit) => { const p = el(para(text)); edit(p); return writeNode(p, old(text)); };
const nodeOf = (md, type) => md.children.find((c) => c.type === type);

test('each notation reads as core\'s element', () => {
  assert.equal(el(para('==a==')).innerHTML, '<mark class="flexible-marker flexible-marker-default">a</mark>');
  assert.equal(el(para('=r=a==')).innerHTML, '<mark class="flexible-marker flexible-marker-red">a</mark>');
  assert.equal(el(para('=d=a==')).querySelector('mark').className, 'flexible-marker flexible-marker-brown');
  assert.equal(el(para('H~2~O')).innerHTML, 'H<sub>2</sub>O');
  assert.equal(el(para('x^2^')).innerHTML, 'x<sup>2</sup>');
  assert.equal(el(para('==a **b** c==')).innerHTML, '<mark class="flexible-marker flexible-marker-default">a <strong>b</strong> c</mark>');
  assert.equal(el(para('==*a*==')).querySelector('mark em').textContent, 'a');
});

test('positions: every new node\'s slice is its source', () => {
  const text = 'one ==mark== two =r=red== H~2~O x^2^ and ==a **b** c== end';
  const md = para(text);
  const slices = [];
  (function walk(n) {
    if (['mark', 'subscript', 'superscript'].includes(n.type)) slices.push(text.slice(n.position.start.offset, n.position.end.offset));
    n.children?.forEach(walk);
  })(md);
  assert.deepEqual(slices, ['==mark==', '=r=red==', '~2~', '^2^', '==a **b** c==']);
  const sub = nodeOf(md, 'subscript');
  assert.equal(sub.position.start.column - 1, text.indexOf('~2~'));
  assert.equal(sub.position.start.line, 1);
  // a second line: line and column
  const m2 = para('first\nx ^2^ y');
  const sup = nodeOf(m2, 'superscript');
  assert.deepEqual([sup.position.start.line, sup.position.start.column, sup.position.end.column], [2, 3, 6]);
});

test('switched off, they stay text', () => {
  assert.deepEqual(kinds(para('==a== ~b~ ^c^', { mark: false, supersub: false })), ['text']);
  assert.deepEqual(kinds(para('==a== ~b~ ^c^', { mark: false })), ['text', 'subscript', 'text', 'superscript']);
  assert.deepEqual(kinds(para('==a== ~b~ ^c^', { supersub: false })), ['mark', 'text']);
});

test('escaped delimiters are delimiters, as core reads values; escapes in the content are positioned', () => {
  assert.deepEqual(kinds(para('x \\^2\\^')), ['text', 'superscript']);
  assert.deepEqual(kinds(para('~a~ and \\~')), ['text']); // three tildes in the text node: none, as core
  const src = 'see ==snake\\_case== x', md = para(src);
  assert.deepEqual(kinds(md), ['text', 'mark', 'text']);
  assert.equal(src.slice(md.children[1].position.start.offset, md.children[1].position.end.offset), '==snake\\_case==');
});

test('punctuation typed beside a notation is escaped and the notation stays', () => {
  assert.equal(typed('Hello ==world== and more', (p) => { p.lastChild.data += '_x'; }), 'Hello ==world== and more\\_x');
  assert.equal(typed('H~2~O and more', (p) => { p.lastChild.data += ' a*b'; }), 'H~2~O and more a\\*b');
  assert.equal(typed('x^2^ costs \\$5', (p) => { p.lastChild.data = ' costs $6'; }), 'x^2^ costs \\$6');
});

test('the manual\'s lines are their slices, written from their meaning', () => {
  const text = fs.readFileSync(new URL('../fixtures/syntax.md', import.meta.url), 'utf8');
  for (const line of ['==highlighted== and =r=red== and =b=blue== and =y=yellow==', 'H~2~O and x^2^']) {
    const at = text.indexOf(line);
    const md = para(line);
    assert.ok(at >= 0 && md.children.length > 1);
    for (const force of [true, false]) assert.equal(writeNode(el(md), old(line), { force }), line);
  }
});

test('typing inside each keeps the delimiters; typing round them does not touch them', () => {
  assert.equal(typed('a ==b== c', (p) => { p.querySelector('mark').firstChild.data = 'bX'; }), 'a ==bX== c');
  assert.equal(typed('a =r=b== c', (p) => { p.querySelector('mark').firstChild.data = 'Xb'; }), 'a =r=Xb== c');
  assert.equal(typed('H~2~O', (p) => { p.querySelector('sub').firstChild.data = '23'; }), 'H~23~O');
  assert.equal(typed('x^2^ y', (p) => { p.querySelector('sup').firstChild.data = 'n'; }), 'x^n^ y');
  assert.equal(typed('==a **b** c==', (p) => { p.querySelector('strong').firstChild.data = 'B'; }), '==a **B** c==');
  assert.equal(typed('H~2~O', (p) => { p.lastChild.data = 'OO'; }), 'H~2~OO');
});

test('a colour change rewrites the key only', () => {
  const set = (text, cls) => typed(text, (p) => { p.querySelector('mark').className = cls; });
  assert.equal(set('a =r=b== c', 'flexible-marker flexible-marker-blue'), 'a =b=b== c');
  assert.equal(set('a =r=b== c', 'flexible-marker flexible-marker-default'), 'a ==b== c');
  assert.equal(set('a ==b== c', 'flexible-marker flexible-marker-yellow'), 'a =y=b== c');
  assert.equal(set('a ==b== c', 'flexible-marker flexible-marker-mauve'), 'a <mark class="flexible-marker flexible-marker-mauve">b</mark> c');
  assert.equal(set('a ==b== c', 'other'), 'a <mark class="other">b</mark> c');
});

test('fresh forms read back', () => {
  const cases = [
    ['<mark class="flexible-marker flexible-marker-default">a</mark>', '==a=='],
    ['<mark class="flexible-marker flexible-marker-teal">a <em>b</em></mark>', '=t=a *b*=='],
    ['<sub>2</sub>', '~2~'],
    ['<sup>n</sup>', '^n^'],
  ];
  for (const [html, md] of cases) {
    const t = document.createElement('template');
    t.innerHTML = `<p>x ${html} y</p>`;
    const p = t.content.firstChild;
    assert.equal(fresh(p.childNodes[1]), md);
    const out = writeFresh(p);
    assert.equal(out, `x ${md} y`);
    assert.ok(means(p, para(out)));
  }
});

test('what the notation cannot carry is raw HTML', () => {
  const f = (html) => { const t = document.createElement('template'); t.innerHTML = html; return fresh(t.content.firstChild); };
  const mark = '<mark class="flexible-marker flexible-marker-default">';
  assert.equal(f('<mark class="flexible-marker flexible-marker-mauve">a</mark>'), '<mark class="flexible-marker flexible-marker-mauve">a</mark>');
  assert.equal(f(`<mark class="flexible-marker flexible-marker-default" id="i">a</mark>`), '<mark class="flexible-marker flexible-marker-default" id="i">a</mark>');
  assert.equal(f('<mark>a</mark>'), '<mark>a</mark>');
  assert.equal(f(`${mark}</mark>`), `${mark}</mark>`);
  assert.equal(f(`${mark}a_b</mark>`), '==a\\_b=='); // an escape in the content: the mark is read from values
  assert.equal(f(`${mark}a </mark>`), `${mark}a </mark>`);
  assert.equal(f(`${mark}a==b</mark>`), `${mark}a==b</mark>`);
  assert.equal(f('<sub>a b</sub>'), '<sub>a b</sub>');
  assert.equal(f('<sup>a^b</sup>'), '<sup>a^b</sup>');
  assert.equal(f('<sub><em>a</em></sub>'), '<sub><em>a</em></sub>');
  assert.equal(f('<sub></sub>'), '<sub></sub>');
});

test('typed text with a single delimiter reads back as text; a typed pair, which no escape keeps text, refuses', () => {
  const p = el(para('a'));
  p.firstChild.data = '2^10 and ~ and a = b';
  const out = writeNode(p, old('a'));
  assert.deepEqual(kinds(para(out)), ['text']);
  assert.equal(el(para(out)).textContent, '2^10 and ~ and a = b');
  p.firstChild.data = 'x^2^';
  assert.equal(writeNode(p, old('a')), null);
});
