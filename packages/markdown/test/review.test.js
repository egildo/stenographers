// Round 3b's review, each finding kept as a case: whitespace that is text (a no-break space) is not layout, a directive's label deleted is not its first paragraph promoted, and the quote's refusals that lost a write.
import './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../src/parse.js';
import { domOf } from '../src/html.js';
import { writeNode } from '../src/write.js';

const markdown = { gfm: { tables: true } };
const write = (text, edit) => {
  const el = domOf(parseMarkdown(text, markdown).children[0]).find((n) => n.nodeType === 1);
  edit(el);
  return writeNode(el, { text, column: 0, defs: '', markdown });
};

test('a no-break space is text: a cell holding one, cleared, is written cleared', () => {
  assert.equal(write('| a | b |\n| - | - |\n| &nbsp; | x |', (el) => { el.querySelector('td').textContent = ''; }), '| a | b |\n| - | - |\n|        | x |');
});

test('a directive whose label is deleted loses its brackets, its first paragraph staying content', () => {
  assert.equal(write(':::note[Title]{.x}\nBody\n:::', (el) => el.querySelector('p').remove()), ':::note{.x}\nBody\n:::');
});

test('a quote: a lazy line\'s place made blank takes the quote\'s prefix; a comment in it is a block; a block changed in kind is written fresh', () => {
  assert.equal(write('> a\nb\n> c', (el) => { el.querySelector('p').outerHTML = '<p>a</p><p>c</p>'; }), '> a\n>\n> c');
  assert.equal(write('> a\n> <!-- c -->\n> b', (el) => { el.querySelector('p').textContent = 'aa'; }), '> aa\n> <!-- c -->\n> b');
  assert.equal(write('> a\n>\n> b', (el) => { el.querySelectorAll('p')[1].outerHTML = '<h2>b</h2>'; }), '> a\n>\n> ## b');
});
