// The HTML stenographer against the contract (@stenographers/stenography): its host reads each container's blocks by
// what they mean, and its edits add a sentence to a container's first paragraph, insert a paragraph before its first
// block, and delete its last block.
import fs from 'node:fs';
import path from 'node:path';
import { run } from '@stenographers/stenography/run';
import { htmlWriter, means, outline } from '../src/writer.js';

const dir = path.resolve(import.meta.dirname, '../fixtures');
const decode = (b) => new TextDecoder('utf-8', { fatal: true }).decode(b);

function containers(bytes) {
  let text;
  try { text = decode(bytes); } catch { return undefined; }
  const runs = outline(text);
  const at = (p) => runs.get(p)?.blocks.map((b) => [means(b.node), text.slice(b.from, b.to), true]);
  return { paths: [...runs.keys()], at };
}

run({
  writer: htmlWriter(),
  features: [],
  corpus: fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort().map((f) => fs.readFileSync(path.join(dir, f))),
  read: containers,
  // A container is equal to another when its blocks mean the same HTML, whatever bytes they carry.
  equal: (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x[0] === b[i][0]),
  unreadable: [new Uint8Array([0x3c, 0x70, 0x3e, 0xff, 0xfe])],
  edits(bytes) {
    const c = containers(bytes);
    return c.paths.flatMap((p) => {
      const value = c.at(p);
      const i = value.findIndex(([h]) => h.startsWith('<p'));
      const added = i < 0 ? [] : [{ path: p, value: value.map((b, j) => (j === i ? [b[0].replace(/<\/p>$/, ' Added.</p>'), b[1], false] : b)) }];
      return [...added, { path: p, value: [['<p>Inserted.</p>', null, false], ...value] }, { path: p, value: value.slice(0, -1) }];
    });
  }
}, 'html');
