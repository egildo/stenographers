// The list's own write: items inserted and deleted, a list turned tight or loose, a task's box. Each case parses a small list, changes the element it means (`domOf`), writes it over its old slice and compares the exact bytes; the result is read back and must mean the edited element.
import './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseMarkdown } from '../src/parse.js';
import { domOf, means } from '../src/html.js';
import { writeNode } from '../src/write.js';

const markdown = { gfm: { autolinks: true, tables: true } };
const lisOf = (el) => [...el.children].filter((c) => c.localName === 'li');
// A list element's items are separated by line ends, as to-hast writes them; a loose item's content is `\n<p>…</p>\n`.
const makeLi = (html, loose) => {
  const li = document.createElement('li');
  li.innerHTML = loose ? `\n<p>${html}</p>\n` : html;
  return li;
};
const insert = (el, at, html, loose = false) => {
  const lis = lisOf(el);
  const li = makeLi(html, loose);
  if (at < lis.length) { lis[at].before(li, '\n'); } else { lis.at(-1).after('\n', li); }
};
const remove = (el, at) => {
  const li = lisOf(el)[at];
  li.nextSibling?.remove();
  li.remove();
};

/** The list in `text` written after `edit` changed its element: the bytes, and whether they read back as the edited element. */
function write(text, edit) {
  const md = parseMarkdown(text, markdown).children[0];
  const el = domOf(md).find((n) => n.nodeType === 1);
  edit(el);
  const out = writeNode(el, { text: text.slice(md.position.start.offset, md.position.end.offset), column: 0, defs: '', markdown });
  assert.notEqual(out, null);
  const back = parseMarkdown(out, markdown).children;
  assert.equal(back.length, 1, 'one list');
  assert.ok(means(el, back[0]), `reads back as the edited list: ${JSON.stringify(out)}`);
  return out;
}

test('an untouched item keeps its bytes while another is inserted', () => {
  const text = '* one *em*\n* two  \n* three\n';
  assert.equal(write(text, (el) => insert(el, 1, 'x')), '* one *em*\n* x\n* two  \n* three');
});

test('insert in the middle, at the start and at the end of a bullet list', () => {
  const text = '- a\n- b\n- c';
  assert.equal(write(text, (el) => insert(el, 1, 'new')), '- a\n- new\n- b\n- c');
  assert.equal(write(text, (el) => insert(el, 0, 'new')), '- new\n- a\n- b\n- c');
  assert.equal(write(text, (el) => insert(el, 3, 'new')), '- a\n- b\n- c\n- new');
});

test('an inserted item takes the marker and the content indent above it', () => {
  assert.equal(write('*   a\n*   b', (el) => insert(el, 1, 'new')), '*   a\n*   new\n*   b');
  assert.equal(write('+ a\n+ b', (el) => insert(el, 2, 'new <em>x</em> y')),'+ a\n+ b\n+ new *x* y');
});

test('an inserted item written with typed text escapes it, and a line break keeps the content indent', () => {
  assert.equal(write('- a\n- b', (el) => insert(el, 1, '1. x *y*')), '- a\n- 1\\. x \\*y\\*\n- b');
  assert.equal(write('1. a\n2. b', (el) => insert(el, 1, 'x\ny')), '1. a\n2. x\n   y\n2. b');
});

test('insert in an ordered list: the number after the one above, the delimiter kept, the items below not renumbered', () => {
  assert.equal(write('1. a\n2. b\n3. c', (el) => insert(el, 1, 'new')), '1. a\n2. new\n2. b\n3. c');
  assert.equal(write('1. a\n2. b\n3. c', (el) => insert(el, 3, 'new')), '1. a\n2. b\n3. c\n4. new');
  assert.equal(write('3) a\n4) b', (el) => insert(el, 2, 'new')), '3) a\n4) b\n5) new');
  assert.equal(write('3) a\n4) b', (el) => insert(el, 1, 'new')), '3) a\n4) new\n4) b');
  // First: the number of the item below, the list's start unchanged.
  assert.equal(write('3) a\n4) b', (el) => insert(el, 0, 'new')), '3) new\n3) a\n4) b');
});

test('two items inserted in a row count on', () => {
  assert.equal(write('1. a\n2. b', (el) => { insert(el, 2, 'x'); insert(el, 3, 'y'); }), '1. a\n2. b\n3. x\n4. y');
});

test('delete the middle, the first and the last item', () => {
  const text = '- a\n- b\n- c';
  assert.equal(write(text, (el) => remove(el, 1)), '- a\n- c');
  assert.equal(write(text, (el) => remove(el, 0)), '- b\n- c');
  assert.equal(write(text, (el) => remove(el, 2)), '- a\n- b');
});

test('a deleted item takes its gap, a loose list keeps its blank lines, a trailing line end stays', () => {
  const text = '- a\n\n- b\n\n- c\n';
  const md = parseMarkdown(text, markdown).children[0];
  const run = (edit) => {
    const el = domOf(md).find((n) => n.nodeType === 1);
    edit(el);
    return writeNode(el, { text: text.slice(md.position.start.offset, md.position.end.offset), column: 0, defs: '', markdown });
  };
  assert.equal(run((el) => remove(el, 1)), '- a\n\n- c');
  assert.equal(run((el) => remove(el, 2)), '- a\n\n- b');
  assert.equal(write(text, (el) => insert(el, 3, 'z', true)), '- a\n\n- b\n\n- c\n\n- z');
});

test('the item written by the pair is the item changed over its bytes', () => {
  const text = '- a *b*\n- c\n- d';
  const out = write(text, (el) => { lisOf(el)[1].textContent = 'c more'; insert(el, 3, 'e'); });
  assert.equal(out, '- a *b*\n- c more\n- d\n- e');
});

test('tight to loose writes a blank line between the items, loose to tight takes them out', () => {
  assert.equal(write('- a\n- b\n- c', (el) => lisOf(el).forEach((li) => { li.innerHTML = `\n<p>${li.innerHTML}</p>\n`; })), '- a\n\n- b\n\n- c');
  assert.equal(write('- a\n\n- b\n\n- c', (el) => lisOf(el).forEach((li) => { li.innerHTML = li.querySelector('p').innerHTML; })), '- a\n- b\n- c');
  assert.equal(write('1. a\n2. b', (el) => lisOf(el).forEach((li) => { li.innerHTML = `\n<p>${li.innerHTML}</p>\n`; })), '1. a\n\n2. b');
});

test('turned loose with an item inserted: the items that did not change keep their bytes', () => {
  const out = write('- a *b*\n- c', (el) => {
    lisOf(el).forEach((li) => { li.innerHTML = `\n<p>${li.innerHTML}</p>\n`; });
    insert(el, 1, 'new', true);
  });
  assert.equal(out, '- a *b*\n\n- new\n\n- c');
});

test('a nested list rides with its item through a delete', () => {
  const text = '- a\n  - a1\n  - a2\n- b\n- c';
  assert.equal(write(text, (el) => remove(el, 1)), '- a\n  - a1\n  - a2\n- c');
  assert.equal(write(text, (el) => insert(el, 1, 'x')), '- a\n  - a1\n  - a2\n- x\n- b\n- c');
});

test('tick and untick a task, a ticked X kept', () => {
  const text = '- [ ] a\n- [x] b\n- [X] c';
  const box = (el, i) => lisOf(el)[i].querySelector('input');
  assert.equal(write(text, (el) => box(el, 0).setAttribute('checked', '')), '- [x] a\n- [x] b\n- [X] c');
  assert.equal(write(text, (el) => box(el, 1).removeAttribute('checked')), '- [ ] a\n- [ ] b\n- [X] c');
  assert.equal(write(text, (el) => box(el, 2).removeAttribute('checked')), '- [ ] a\n- [x] b\n- [ ] c');
  assert.equal(write(text, (el) => { box(el, 0).setAttribute('checked', ''); lisOf(el)[2].lastChild.data += '!'; }), '- [x] a\n- [x] b\n- [X] c!');
});

test('what Markdown cannot say is refused, for the flow to write as HTML: a loose list turned tight with a blank line inside an item, one item made loose', () => {
  const refused = (text, edit) => {
    const md = parseMarkdown(text, markdown).children[0];
    const el = domOf(md).find((n) => n.nodeType === 1);
    edit(el);
    return writeNode(el, { text, column: 0, defs: '', markdown });
  };
  const tight = (text) => domOf(parseMarkdown(text, markdown).children[0]).find((n) => n.nodeType === 1);
  assert.equal(refused('- a\n\n  - b\n\n- c', (el) => el.replaceChildren(...tight('- a\n  - b\n- c').childNodes)), null);
  assert.equal(refused('- a', (el) => { lisOf(el)[0].innerHTML = '\n<p>a</p>\n'; }), null);
});

test('an inserted item with a line break stays tight: the break is `\\` and a line end, not a blank line', () => {
  assert.equal(write('8. a\n9. b', (el) => insert(el, 2, 'c<br>\nd')), '8. a\n9. b\n10. c\\\n    d');
});

test('an item inserted as an editor serializes it, with no line end beside it, is written as Markdown', () => {
  const text = '- a\n- [ ] b', el = domOf(parseMarkdown(text, markdown).children[0]).find((n) => n.nodeType === 1);
  const li = document.createElement('li');
  li.textContent = 'new';
  lisOf(el)[0].after(li);
  assert.equal(writeNode(el, { text, column: 0, defs: '', markdown }), '- a\n- new\n- [ ] b');
});

test('a task inserted into a task list is written with its box', () => {
  const li = () => { const l = document.createElement('li'); l.className = 'task-list-item'; l.innerHTML = '<input type="checkbox" disabled=""> new'; return l; };
  assert.equal(write('- [ ] a\n- [x] b', (el) => { lisOf(el)[0].after('\n', li()); }), '- [ ] a\n- [ ] new\n- [x] b');
});

test('every top-level tight bullet list of the manual takes an item at its end and loses its last, the other bytes kept', () => {
  const dir = path.resolve(import.meta.dirname, '../fixtures');
  let seen = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const md of parseMarkdown(text, markdown).children) {
      if (md.type !== 'list' || md.ordered || looseOf(md) || md.children.length < 2 || md.children.some((k) => k.checked != null)) continue;
      const slice = text.slice(md.position.start.offset, md.position.end.offset);
      const old = md.children;
      const probe = (edit, want) => {
        const el = domOf(md).find((n) => n.nodeType === 1);
        edit(el);
        const out = writeNode(el, { text: slice, column: 0, defs: '', markdown });
        assert.equal(out, want, `${f}:${md.position.start.line}`);
      };
      const upto = (k) => slice.slice(0, k.position.end.offset - md.position.start.offset);
      const marker = /^(?:[-*+]) +/.exec(text.slice(old.at(-1).position.start.offset))[0];
      probe((el) => remove(el, old.length - 1), upto(old.at(-2)));
      probe((el) => insert(el, old.length, 'zz'), `${slice}${text.slice(old.at(-2).position.end.offset, old.at(-1).position.start.offset)}${marker}zz`);
      seen++;
    }
  }
  assert.ok(seen > 0);
});

const looseOf = (md) => md.spread || md.children.some((k) => k.spread);
