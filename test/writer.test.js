// Provenance's Markdown writer, by shape: the outline's paths, `locate` in bytes, a run written again from its own value unchanged, and a value that changes one paragraph.
import './dom.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseMarkdown } from '../src/parse.js';
import { domOf } from '../src/html.js';
import { markdownWriter, outline, writeRun } from '../src/writer.js';

const gfm = { autolinks: true, tables: true };
const text = fs.readFileSync(path.resolve(import.meta.dirname, '../fixtures/style.md'), 'utf8');
const encode = (s) => new TextEncoder().encode(s);
const decode = (b) => new TextDecoder().decode(b);
const valueOf = (run) => run.blocks.map((b) => [domOf(b).find((n) => n.nodeType === 1).outerHTML, text.slice(b.position.start.offset, b.position.end.offset), true]);

test('the outline: the preamble, then each heading by its path, nested by rank', () => {
  const { runs } = outline(parseMarkdown(text, gfm), text);
  const paths = [...runs.keys()];
  assert.equal(paths[0], '');
  assert.equal(paths[1], '/The house style');
  assert.ok(paths.includes('/The house style/Voice per kind'));
  // No two runs share a byte, and together they cover the file from the preamble on.
  const spans = [...runs.values()].map((r) => [r.from, r.to]);
  for (let i = 1; i < spans.length; i++) assert.equal(spans[i][0], spans[i - 1][1]);
  assert.equal(spans.at(-1)[1], text.length);
});

test('a step escapes ~, / and @, and a repeated sibling heading takes an ordinal', () => {
  const md = '# A/B ~ c@d\n\n## Same\n\none\n\n## Same\n\ntwo\n';
  const paths = [...outline(parseMarkdown(md), md).runs.keys()];
  assert.deepEqual(paths, ['', '/A~1B ~0 c~2d', '/A~1B ~0 c~2d/Same', '/A~1B ~0 c~2d/Same@2']);
});

test('locate answers bytes, not string positions', () => {
  const md = '# Città\n\nÈ qui.\n\n# Dopo\n\nfine\n';
  const { document } = markdownWriter().open(encode(md));
  const at = document.locate('/Dopo');
  assert.equal(decode(encode(md).slice(at.start, at.end)), '# Dopo\n\nfine\n');
});

test('a run written again from its own value, every block unchanged, is its bytes', () => {
  const { runs } = outline(parseMarkdown(text, gfm), text);
  for (const run of runs.values()) assert.equal(writeRun(text, run, valueOf(run), { gfm }).text, text.slice(run.from, run.to));
});

test('write: one paragraph changed in a run changes only that paragraph', () => {
  const { document } = markdownWriter({ gfm }).open(encode(text));
  const { runs } = outline(parseMarkdown(text, gfm), text);
  const path = '/The house style';
  const run = runs.get(path);
  const value = valueOf(run).map((entry) => (entry[0].startsWith('<p>') ? [entry[0].replace('</p>', ' Added.</p>'), entry[1], false] : entry));
  const result = document.write(path, value);
  assert.ok(result.ok);
  const written = decode(result.edit.bytes);
  const old = text.slice(run.from, run.to);
  assert.ok(written.includes(' Added.'));
  assert.equal(written.replace(' Added.', ''), old);
});

test('a malformed value is refused, not thrown', () => {
  const { document } = markdownWriter().open(encode('# A\n\ntext\n'));
  assert.equal(document.write('/A', '<p>text</p>').ok, false);
  assert.equal(document.write('/B', []).ok, false);
});
