// The CSV stenographer against the contract (@stenographers/stenography): its host reads every well-formed row as a
// Map from header to string and every cell as a string, and its edits set a cell to a value that needs quotes, empty a
// cell, change a row, and rename a row by writing it with a new first cell (so the value reads back at its new path).
import fs from 'node:fs';
import path from 'node:path';
import { run } from '@stenographers/stenography/run';
import { csvWriter, table } from '../src/writer.js';

const dir = path.resolve(import.meta.dirname, '../fixtures');
const decode = (b) => new TextDecoder('utf-8', { fatal: true }).decode(b);
const step = (s) => s.replaceAll('~', '~0').replaceAll('/', '~1');

/** The rows whose key is unique and whose cells match the header, each a Map, and their cells. */
const keyIndex = (columns, key) => (key === undefined ? 0 : columns.indexOf(key));
const reader = (delimiter, key) => (bytes) => {
  let records;
  try { records = table(decode(bytes), delimiter).records; } catch { return undefined; }
  const [header, ...rows] = records;
  const columns = header.cells.map((c) => c.value);
  const k = keyIndex(columns, key);
  const keys = rows.map((r) => r.cells[k].value);
  const at = new Map();
  for (const r of rows) {
    const key = r.cells[k].value;
    if (r.cells.length !== columns.length || keys.indexOf(key) !== keys.lastIndexOf(key)) continue;
    at.set(`/${step(key)}`, new Map(columns.map((h, c) => [h, r.cells[c].value])));
    columns.forEach((h, c) => at.set(`/${step(key)}/${step(h)}`, r.cells[c].value));
  }
  return { paths: [...at.keys()], at: (p) => at.get(p) };
};

/** The host for one delimiter and key column over the fixtures named. */
const host = (delimiter, key, files) => ({
  writer: csvWriter({ delimiter, key }),
  features: ['add', 'remove', 'amend', 'shifted'],
  corpus: files.map((f) => fs.readFileSync(path.join(dir, f))),
  read: reader(delimiter, key),
  edits(bytes) {
    const { paths, at } = reader(delimiter, key)(bytes);
    const rows = paths.filter((p) => at(p) instanceof Map);
    const [first, last] = [rows[0], rows.at(-1)];
    const columns = [...at(first).keys()];
    const keyColumn = columns[keyIndex(columns, key)];
    const others = columns.filter((h) => h !== keyColumn);
    const renamed = `${at(first).get(keyColumn)}-renamed`;
    return [
      { path: `${first}/${step(others[0])}`, value: 'x, "y"\nz' },
      { path: `${first}/${step(others.at(-1))}`, value: '' },
      { path: last, value: new Map([...at(last), [others.at(-1), 'changed']]) },
      { path: first, value: new Map([...at(first), [keyColumn, renamed]]), at: `/${step(renamed)}` },
      { path: `${last}/${step(others[0])}`, value: 'tail' },
    ];
  }
});

run(host(',', undefined, ['bare.csv', 'floors-types.csv', 'small.csv']), 'csv');
run(host(';', undefined, ['semicolon.csv']), 'csv, semicolon');
run(host(';', 'data', ['letture.csv']), 'csv, keyed by data');
