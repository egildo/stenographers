// The table's own write: a cell edited, a row inserted or deleted, refusals, and the manual's 56 tables with one cell changed. Each case parses a small table, changes the element it means (`domOf`), writes it over its old slice and compares the exact bytes; the result is read back and must mean the edited element.
import './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseMarkdown } from '../src/parse.js';
import { domOf, means } from '../src/html.js';
import { writeNode } from '../src/write.js';

const markdown = { gfm: { autolinks: true, tables: true } };
const rowsOf = (el) => [...el.querySelectorAll('tr')];
const cell = (el, r, c) => [...rowsOf(el)[r].children][c];
// to-hast writes a line end between a table's elements; `bare` is what an editor writes.
const strip = (el) => {
  for (const t of [...el.querySelectorAll('table, thead, tbody, tr'), el]) for (const c of [...t.childNodes]) if (c.nodeType === 3 && !/\S/.test(c.data)) c.remove();
  return el;
};
const newRow = (el, at, cells) => {
  const tr = document.createElement('tr');
  tr.innerHTML = cells.map((h, i) => `<td${rowsOf(el)[0].children[i].getAttribute('align') ? ` align="${rowsOf(el)[0].children[i].getAttribute('align')}"` : ''}>${h}</td>`).join('');
  const rows = rowsOf(el);
  if (at < rows.length) rows[at].before(tr);
  else if (el.querySelector('tbody')) el.querySelector('tbody').append(tr);
  else { const tb = document.createElement('tbody'); tb.append(tr); el.append(tb); }
};
const dropRow = (el, at) => {
  const tr = rowsOf(el)[at];
  const body = tr.parentNode;
  tr.remove();
  if (body.localName === 'tbody' && !body.children.length) body.remove();
};

function run(text, edit, { compact = false } = {}) {
  const md = parseMarkdown(text, markdown).children[0];
  const el = domOf(md).find((n) => n.nodeType === 1);
  if (compact) strip(el);
  edit(el);
  const out = writeNode(el, { text: text.slice(md.position.start.offset, md.position.end.offset), column: 0, defs: '', markdown });
  return { out, el };
}
/** The bytes, and that they read back as the edited table. */
function write(text, edit, opts) {
  const { out, el } = run(text, edit, opts);
  assert.notEqual(out, null);
  const back = parseMarkdown(out, markdown).children;
  assert.equal(back.length, 1, 'one table');
  assert.ok(means(opts?.compact ? (strip(el), el) : el, back[0]) || strip(el).isEqualNode(strip(domOf(back[0]).find((n) => n.nodeType === 1))), `reads back as the edited table: ${JSON.stringify(out)}`);
  return out;
}

const T = '| Name  | Qty |\n| :---- | --: |\n| apple | 10  |\n| *pear* | 2   |';

test('a cell edited keeps the padding where it fits', () => {
  assert.equal(write(T, (el) => { cell(el, 1, 0).textContent = 'fig'; }), '| Name  | Qty |\n| :---- | --: |\n| fig   | 10  |\n| *pear* | 2   |');
});

test('a cell edited too wide is written with a space each side, the row left ragged', () => {
  assert.equal(write(T, (el) => { cell(el, 1, 0).textContent = 'watermelon'; }), '| Name  | Qty |\n| :---- | --: |\n| watermelon | 10  |\n| *pear* | 2   |');
});

test('a typed pipe is escaped', () => {
  assert.equal(write(T, (el) => { cell(el, 1, 0).textContent = 'a|b'; }), '| Name  | Qty |\n| :---- | --: |\n| a\\|b  | 10  |\n| *pear* | 2   |');
  assert.equal(write(T, (el) => { cell(el, 1, 0).textContent = 'a\\|b'; }).split('\n')[2], '| a\\\\\\|b | 10  |');
});

test('a cell with emphasis keeps the emphasis bytes when its text changes', () => {
  assert.equal(write('| a | b |\n| - | - |\n| _x_ y | z |', (el) => { cell(el, 1, 0).lastChild.data = ' w'; }), '| a | b |\n| - | - |\n| _x_ w | z |');
});

test('a header cell edited', () => {
  assert.equal(write(T, (el) => { cell(el, 0, 1).textContent = 'N'; }), '| Name  | N   |\n| :---- | --: |\n| apple | 10  |\n| *pear* | 2   |');
});

test('a row inserted in the middle and at the end copies the row above', () => {
  assert.equal(write(T, (el) => newRow(el, 2, ['fig', '5'])), '| Name  | Qty |\n| :---- | --: |\n| apple | 10  |\n| fig   | 5   |\n| *pear* | 2   |');
  assert.equal(write(T, (el) => newRow(el, 4, ['fig', '5'])), `${T}\n| fig    | 5   |`);
});

test('a row inserted into a table with no body', () => {
  assert.equal(write('| a | b |\n| - | - |', (el) => newRow(el, 1, ['x', 'y'])), '| a | b |\n| - | - |\n| x | y |');
});

test('a row deleted takes its line; the last body row too', () => {
  assert.equal(write(T, (el) => dropRow(el, 1)), '| Name  | Qty |\n| :---- | --: |\n| *pear* | 2   |');
  assert.equal(write(T, (el) => dropRow(el, 2)), '| Name  | Qty |\n| :---- | --: |\n| apple | 10  |');
  assert.equal(write(T, (el) => { dropRow(el, 2); dropRow(el, 1); }), '| Name  | Qty |\n| :---- | --: |');
});

test('a table without outer pipes', () => {
  const t = 'a | b\n--|--\n1 | 2\n3 | 4';
  assert.equal(write(t, (el) => { cell(el, 1, 1).textContent = 'two'; }), 'a | b\n--|--\n1 | two\n3 | 4');
  assert.equal(write(t, (el) => newRow(el, 3, ['5', '6'])), `${t}\n5 | 6`);
});

test('a table with outer pipes and no padding', () => {
  const t = '|a|b|\n|-|-|\n|1|2|';
  assert.equal(write(t, (el) => { cell(el, 1, 1).textContent = 'two'; }), '|a|b|\n|-|-|\n|1| two |');
  assert.equal(write(t, (el) => newRow(el, 2, ['3', '4'])), `${t}\n|3|4|`);
});

test('the element serialized with no whitespace between its elements', () => {
  assert.equal(write(T, (el) => { cell(el, 1, 0).textContent = 'fig'; }, { compact: true }), '| Name  | Qty |\n| :---- | --: |\n| fig   | 10  |\n| *pear* | 2   |');
  assert.equal(write(T, (el) => dropRow(el, 1), { compact: true }), '| Name  | Qty |\n| :---- | --: |\n| *pear* | 2   |');
  assert.equal(write(T, (el) => newRow(el, 2, ['fig', '5']), { compact: true }), '| Name  | Qty |\n| :---- | --: |\n| apple | 10  |\n| fig   | 5   |\n| *pear* | 2   |');
});

test('a table unchanged but for whitespace keeps its bytes', () => {
  assert.equal(write(T, () => {}, { compact: true }), T);
});

test('refusals: a column added or dropped, an alignment changed, a block or a break in a cell', () => {
  assert.equal(run(T, (el) => { for (const tr of rowsOf(el)) tr.lastElementChild.remove(); }).out, null);
  assert.equal(run(T, (el) => { cell(el, 1, 0).insertAdjacentHTML('afterend', '<td>x</td>'); }).out, null);
  assert.equal(run(T, (el) => { cell(el, 0, 0).setAttribute('align', 'right'); }).out, null);
  assert.equal(run(T, (el) => { cell(el, 1, 0).innerHTML = '<p>x</p>'; }).out, null);
  assert.equal(run(T, (el) => { cell(el, 1, 0).innerHTML = 'x<br>y'; }).out, null);
  assert.equal(run(T, (el) => newRow(el, 2, ['only one'])).out, null);
});

// ---- the manual ----
const dir = new URL('../fixtures/', import.meta.url).pathname;
test('every table of the manual, one cell changed, writes only that cell', () => {
  let tables = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const walk = (n, hit) => { if (n.type === 'table') hit(n); n.children?.forEach((c) => walk(c, hit)); };
    walk(parseMarkdown(src, markdown), (md) => {
      tables++;
      const slice = src.slice(md.position.start.offset, md.position.end.offset);
      const el = domOf(md).find((n) => n.nodeType === 1);
      // The first body cell with text; its bytes by position.
      const r = 1, c = md.children[1].children.findIndex((k) => k.children.length);
      if (c < 0) return;
      const oldCell = md.children[r].children[c];
      const td = cell(el, r, c);
      td.textContent = 'ZZ';
      const out = writeNode(el, { text: slice, column: 0, defs: '', markdown });
      assert.notEqual(out, null, `${f}: ${slice.slice(0, 60)}`);
      const lines = slice.split('\n'), now = out.split('\n');
      assert.equal(now.length, lines.length);
      const row = md.children[r].position.start.line - md.position.start.line;
      now.forEach((l, i) => { if (i !== row) assert.equal(l, lines[i], `${f} line ${i}`); });
      assert.ok(now[row].includes('ZZ'));
      assert.ok(oldCell);
    });
  }
  assert.equal(tables, 56);
});
