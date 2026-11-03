// The HTML writer over the Quiet Press and a small document: what each edit changes, in exact bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { htmlWriter, means, outline } from '../src/writer.js';

const dir = path.resolve(import.meta.dirname, '../fixtures');
const decoder = new TextDecoder();

/** The file's text after writing `value` at `path`, or the refusal. */
function written(file, path, edit) {
  const bytes = fs.readFileSync(`${dir}/${file}`);
  const text = decoder.decode(bytes);
  const run = outline(text).get(path);
  const value = edit(run.blocks.map((b) => [means(b.node), text.slice(b.from, b.to), true]), text);
  const result = htmlWriter().open(bytes).document.write(path, value);
  if (!result.ok) return result;
  const { start, end, bytes: out } = result.edit;
  return { text, after: decoder.decode(new Uint8Array([...bytes.subarray(0, start), ...out, ...bytes.subarray(end)])) };
}

test('a paragraph edited changes its own bytes and nothing else', () => {
  const { text, after } = written('quiet-press.html', '/measure', (v) => v.map((b, i) => (i === 1 ? [b[0].replace(/<\/p>$/, ' Added.</p>'), b[1], false] : b)));
  const was = outline(text).get('/measure').blocks[1];
  let head = 0, tail = 0;
  while (text[head] === after[head]) head++;
  while (text.at(-1 - tail) === after.at(-1 - tail)) tail++;
  assert.ok(head >= was.from && text.length - tail <= was.to, 'the change lies inside the paragraph');
  assert.match(after, / Added\.<\/p>/);
});

test('a block inserted takes its neighbours\' indent', () => {
  const { text, after } = written('quiet-press.html', '/measure', (v) => [...v.slice(0, 2), ['<p>Inserted.</p>', null, false], ...v.slice(2)]);
  const run = outline(text).get('/measure');
  const indent = /\s*$/.exec(text.slice(run.blocks[1].to, run.blocks[2].from))[0];
  assert.equal(after, text.slice(0, run.blocks[1].to) + indent + '<p>Inserted.</p>' + text.slice(run.blocks[1].to));
});

test('a block deleted takes its gap, but a script or comment in the gap stays', () => {
  const { text, after } = written('small.html', '', (v) => v.filter((_, i) => i !== 1));
  const run = outline(text).get('');
  assert.equal(after, text.slice(0, run.blocks[1].from).trimEnd() + text.slice(run.blocks[1].to));
  assert.match(after, /<\/h1>\r\n  <script>var x = 1;<\/script>\r\n  <section/);
});

test('a block unchanged keeps its bytes, whatever HTML the caller reads it as', () => {
  const result = written('small.html', '', (v) => v.map((b, i) => (i === 1 ? ['<p>Il primo paragrafo.</p>', b[1], true] : b)));
  assert.ok(result.after, `written, not refused (${result.code})`);
  assert.equal(result.after, result.text);
});

test('blocks that would not read back as themselves are refused', () => {
  for (const html of ['<td>cell</td>', '<p>one<p>two']) {
    const result = written('small.html', '', (v) => [[html, null, false], ...v]);
    assert.equal(result.code, 'edit-read-back', html);
  }
});

test('a container\'s step is its id, escaped; a paragraph with an id, and an id inside running text, are not containers', () => {
  const runs = outline(fs.readFileSync(`${dir}/small.html`, 'utf8'));
  assert.deepEqual([...runs.keys()], ['', '/a~1b~0c', '/a~1b~0c/interno']);
  assert.equal(htmlWriter().open(fs.readFileSync(`${dir}/small.html`)).document.locate('/testo').code, 'edit-target-absent');
  // A footnote reference, as the trattato writes them: a `<sup>` holding only a link, inside a paragraph.
  const note = outline('<!doctype html><body><p>Testo<sup id="rinvio-1"><a href="#nota-1">1</a></sup>.</p><p id="solo"><span>uno</span></p></body>');
  assert.deepEqual([...note.keys()], ['']);
});
