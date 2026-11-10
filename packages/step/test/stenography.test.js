// The STEP stenographer against the contract (@stenographers/stenography): its host reads every attribute, every list
// member and every typed value's inside, with references as strings, and leaves out what has no value (a derived
// attribute, a binary, a complex instance). Its edits write one value of each kind the document holds.
import fs from 'node:fs';
import path from 'node:path';
import { run } from '@stenographers/stenography/run';
import { stepWriter, instances } from '../src/writer.js';

const dir = path.resolve(import.meta.dirname, '../fixtures');

/** Every value of a document, by path, with the node it was read from. */
const values = (bytes) => {
  const at = new Map();
  const walk = (p, n) => {
    if (n.value !== undefined) at.set(p, n);
    n.members?.forEach((m, i) => walk(`${p}/${i}`, m));
    if (n.inner) walk(`${p}/${n.keyword}`, n.inner);
  };
  for (const i of instances(bytes)) i.attributes?.forEach((a, k) => walk(`/#${i.number}/${k}`, a));
  return at;
};

const read = (bytes) => {
  let at;
  try { at = values(bytes); } catch { return undefined; }
  return { paths: [...at.keys()], at: (p) => at.get(p)?.value };
};

run({
  writer: stepWriter(),
  features: [],
  corpus: ['native.ifc', 'awkward.ifc'].map((f) => fs.readFileSync(path.join(dir, f))),
  read,
  edits(bytes) {
    const all = [...values(bytes)];
    // The first value of a kind, outside every path already taken, so no two edits are one below the other.
    const taken = [];
    const first = (test) => {
      const found = all.find(([p, n]) => test(n) && !taken.some((t) => p.startsWith(`${t}/`) || t.startsWith(`${p}/`) || t === p));
      if (found) taken.push(found[0]);
      return found?.[0];
    };
    const plain = (n) => n.kind === 'list' && n.members.length > 1 && n.members.every((m) => m.kind === 'real');
    return [
      { path: first(plain), value: [1.5, -0, 1e-7, 3] },
      { path: first((n) => n.kind === 'real'), value: 2160.1 },
      { path: first((n) => n.kind === 'integer'), value: -7n },
      { path: first((n) => n.kind === 'string'), value: 'più alto, l\'architrave \\ 😀' },
      { path: first((n) => n.kind === 'enumeration' && typeof n.value === 'string'), value: 'USERDEFINED' },
      { path: first((n) => n.kind === 'enumeration' && typeof n.value === 'boolean'), value: false },
      { path: first((n) => n.kind === 'unset'), value: new Map([['IFCLABEL', 'a label']]) },
      { path: first((n) => n.kind === 'typed'), value: null },
      { path: first((n) => n.kind === 'string'), value: true },
    ].filter((e) => e.path !== undefined);
  }
}, 'step');
