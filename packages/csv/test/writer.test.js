// The CSV writer over viale-merello's floor types and two small files: what each edit changes, in exact bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { csvWriter, table } from '../src/writer.js';

const dir = path.resolve(import.meta.dirname, '../fixtures');
const decoder = new TextDecoder();
const bytesOf = (file) => fs.readFileSync(`${dir}/${file}`);

/** The file's text after the edit, or the refusal. */
function after(bytes, edit) {
  const result = edit(csvWriter().open(bytes).document);
  if (!result.ok) return result;
  const { start, end, bytes: out } = result.edit;
  return decoder.decode(new Uint8Array([...bytes.subarray(0, start), ...out, ...bytes.subarray(end)]));
}

test('a cell edited changes its own bytes; quotes come when the value needs them', () => {
  const text = decoder.decode(bytesOf('small.csv'));
  assert.equal(after(bytesOf('small.csv'), (d) => d.write('/floor-tiles/Layers', 'tiles:10;screed:84')), text.replace('floor-tiles,,', 'floor-tiles,tiles:10;screed:84,'));
  assert.equal(after(bytesOf('small.csv'), (d) => d.write('/floor-tiles/Note', 'Tile, "grey"')), text.replace('Tile not chosen', '"Tile, ""grey"""'));
  assert.equal(after(bytesOf('small.csv'), (d) => d.write('/floor-tiles/Note', 'two\r\nlines')), text.replace('Tile not chosen', '"two\r\nlines"'));
});

test('a cell quoted in the file stays quoted; a cell emptied keeps its quotes too', () => {
  const text = decoder.decode(bytesOf('small.csv'));
  assert.equal(after(bytesOf('small.csv'), (d) => d.write('/skirting/Layers', 'wood:18')), text.replace('"wood:20"', '"wood:18"'));
  assert.equal(after(bytesOf('small.csv'), (d) => d.write('/skirting/Layers', '')), text.replace('"wood:20"', '""'));
  assert.equal(after(bytesOf('small.csv'), (d) => d.write('/floor-parquet/Note', 'Oak, "spina" cut\r\nbrushed')), text);
});

test('a row written keeps the bytes of every cell it does not change; a column left out is emptied, the key stays', () => {
  const bytes = bytesOf('floors-types.csv'), text = decoder.decode(bytes);
  const { records } = table(text);
  const columns = records[0].cells.map((c) => c.value);
  const tiles = records.find((r) => r.cells[0].value === '3aEeOVJlH4avKjv6IRUfbk');
  const row = new Map(columns.map((h, c) => [h, tiles.cells[c].value]));
  row.set('Note', 'Tile chosen: grey porcelain');
  assert.equal(after(bytes, (d) => d.write('/3aEeOVJlH4avKjv6IRUfbk', row)), text.replace('Tile product not chosen yet', 'Tile chosen: grey porcelain'));
  const partial = after(bytes, (d) => d.write('/3aEeOVJlH4avKjv6IRUfbk', new Map([['Note', 'Tile chosen: grey porcelain']])));
  assert.match(partial, /\n3aEeOVJlH4avKjv6IRUfbk,{13}Tile chosen: grey porcelain\n/);
});

test('a row added goes at the end, in header order, with the file\'s line ending', () => {
  const crlf = decoder.decode(bytesOf('small.csv'));
  assert.equal(after(bytesOf('small.csv'), (d) => d.add('/floor-stone', new Map([['Note', 'quarry, local'], ['Layers', 'stone:30']]))), `${crlf}floor-stone,stone:30,"quarry, local"\r\n`);
  const bare = decoder.decode(bytesOf('bare.csv'));
  assert.equal(after(bytesOf('bare.csv'), (d) => d.add('/c', new Map([['Value', '3']]))), `${bare}\nc,3`);
  assert.equal(after(bytesOf('bare.csv'), (d) => d.add('/c', new Map([['Name', 'd']]))).code, 'edit-read-back');
  assert.equal(after(bytesOf('bare.csv'), (d) => d.add('/a', new Map())).code, 'edit-target-exists');
});

test('a row removed takes its line ending; the last row with none takes the one before it', () => {
  assert.equal(after(bytesOf('small.csv'), (d) => d.remove('/floor-tiles')), 'Name,Layers,Note\r\nfloor-parquet,parquet:10;screed:84,"Oak, ""spina"" cut\r\nbrushed"\r\nskirting,"wood:20",\r\n');
  assert.equal(after(bytesOf('bare.csv'), (d) => d.remove('/b')), 'Name,Value\na,1');
  assert.equal(after(bytesOf('bare.csv'), (d) => d.remove('/b/Value')).code, 'edit-unrepresentable');
});

test('a row is renamed by writing it with a new first cell, never by the cell alone; a name another row has is refused', () => {
  assert.equal(after(bytesOf('bare.csv'), (d) => d.write('/a', new Map([['Name', 'z'], ['Value', '1']]))), 'Name,Value\nz,1\nb,2');
  assert.equal(after(bytesOf('bare.csv'), (d) => d.write('/a/Name', 'a')), 'Name,Value\na,1\nb,2');
  assert.equal(after(bytesOf('bare.csv'), (d) => d.write('/a/Name', 'z')).code, 'row-key-fixed');
  assert.equal(after(bytesOf('bare.csv'), (d) => d.write('/a', new Map([['Name', 'b']]))).code, 'row-key-duplicate');
});

test('refusals: a key repeated, a ragged row, a column the header lacks, a quote left open, a header name twice', () => {
  const enc = (s) => new TextEncoder().encode(s);
  const doc = csvWriter().open(enc('Name,Value\na,1\na,2\nb,2,3\n')).document;
  assert.equal(doc.locate('/a').code, 'row-key-duplicate');
  assert.equal(doc.write('/b/Value', 'x').code, 'row-ragged');
  assert.equal(doc.locate('/zz/Value').code, 'edit-target-absent');
  const ok = csvWriter().open(enc('Name,Value\na,1\n')).document;
  assert.equal(ok.locate('/a/Colour').code, 'edit-target-absent');
  assert.equal(ok.write('/a/Value', 3).code, 'edit-unrepresentable');
  assert.equal(ok.write('', 'x').code, 'edit-unrepresentable');
  assert.equal(csvWriter().open(enc('Name,Value\na,"1\n')).code, 'open-unreadable');
  assert.equal(csvWriter().open(enc('Name,Value\na,"1"x\n')).code, 'open-unreadable');
  assert.equal(csvWriter().open(enc('')).code, 'open-unreadable');
  assert.equal(csvWriter().open(enc('Name,Name\na,1\n')).code, 'column-duplicate');
});

test('locate: a row is its bytes without the line ending, a cell its raw bytes with quotes', () => {
  const bytes = bytesOf('small.csv'), text = decoder.decode(bytes);
  const doc = csvWriter().open(bytes).document;
  const row = doc.locate('/skirting');
  assert.equal(text.slice(row.start, row.end), 'skirting,"wood:20",');
  const cell = doc.locate('/skirting/Layers');
  assert.equal(text.slice(cell.start, cell.end), '"wood:20"');
  const root = doc.locate('');
  assert.deepEqual([root.start, root.end], [0, bytes.length]);
});

test('amend: a cell set inside a staged row changes its Map; what is not below it, or not a cell, is not inside', () => {
  const doc = csvWriter().open(bytesOf('bare.csv')).document;
  const staged = { path: '/a', value: new Map([['Name', 'a'], ['Value', '1']]) };
  assert.deepEqual(doc.amend(staged, { op: 'set', path: '/a/Value', value: '9' }), { inside: true, ok: true, value: new Map([['Name', 'a'], ['Value', '9']]) });
  assert.deepEqual(staged.value, new Map([['Name', 'a'], ['Value', '1']]), 'the staged value is left as it was');
  assert.deepEqual(doc.amend(staged, { op: 'set', path: '/b/Value', value: '9' }), { inside: false });
  assert.deepEqual(doc.amend({ path: '/a/Value', value: '1' }, { op: 'set', path: '/a/Value/x', value: '9' }), { inside: false });
  assert.equal(doc.amend(staged, { op: 'set', path: '/a/Colour', value: 'red' }).ok, false);
  assert.equal(doc.amend(staged, { op: 'add', path: '/a/Value', value: '9' }).ok, false);
  assert.equal(doc.amend(staged, { op: 'remove', path: '/a/Value' }).ok, false);
  assert.equal(doc.amend(staged, { op: 'set', path: '/a/Value', value: 9 }).ok, false);
});

test('shifted: a row named by its first cell never shifts', () => {
  const doc = csvWriter().open(bytesOf('bare.csv')).document;
  const newer = csvWriter().open(new TextEncoder().encode('Name,Value\nz,0\na,1\nb,2\n')).document;
  assert.equal(doc.shifted('/b/Value', newer), false);
});
