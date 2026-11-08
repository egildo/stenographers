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
function read(bytes) {
  let records;
  try { records = table(decode(bytes)).records; } catch { return undefined; }
  const [header, ...rows] = records;
  const columns = header.cells.map((c) => c.value);
  const keys = rows.map((r) => r.cells[0].value);
  const at = new Map();
  for (const r of rows) {
    const key = r.cells[0].value;
    if (r.cells.length !== columns.length || keys.indexOf(key) !== keys.lastIndexOf(key)) continue;
    at.set(`/${step(key)}`, new Map(columns.map((h, c) => [h, r.cells[c].value])));
    columns.forEach((h, c) => at.set(`/${step(key)}/${step(h)}`, r.cells[c].value));
  }
  return { paths: [...at.keys()], at: (p) => at.get(p) };
}

run({
  writer: csvWriter(),
  features: ['add', 'remove', 'amend', 'shifted'],
  corpus: fs.readdirSync(dir).filter((f) => f.endsWith('.csv')).sort().map((f) => fs.readFileSync(path.join(dir, f))),
  read,
  edits(bytes) {
    const { paths, at } = read(bytes);
    const rows = paths.filter((p) => at(p) instanceof Map);
    const [first, last] = [rows[0], rows.at(-1)];
    const columns = [...at(first).keys()];
    const renamed = `${at(first).get(columns[0])}-renamed`;
    return [
      { path: `${first}/${step(columns[1])}`, value: 'x, "y"\nz' },
      { path: `${first}/${step(columns.at(-1))}`, value: '' },
      { path: last, value: new Map([...at(last), [columns.at(-1), 'changed']]) },
      { path: first, value: new Map([...at(first), [columns[0], renamed]]), at: `/${step(renamed)}` },
      { path: `${last}/${step(columns[1])}`, value: 'tail' },
    ];
  }
}, 'csv');
