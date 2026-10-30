// The Markdown stenographer against the contract (@stenographers/stenography): its host reads each section by the
// HTML its blocks mean, and its edits add a sentence to a section's first paragraph.
import './dom.js';
import fs from 'node:fs';
import path from 'node:path';
import { run } from '@stenographers/stenography/run';
import { parseMarkdown } from '../src/parse.js';
import { domOf } from '../src/html.js';
import { markdownWriter, outline } from '../src/writer.js';

const markdown = { gfm: { autolinks: true, tables: true } };
const dir = path.resolve(import.meta.dirname, '../fixtures');
const decode = (b) => new TextDecoder('utf-8', { fatal: true }).decode(b);
const html = (block) => domOf(block).find((n) => n.nodeType === 1)?.outerHTML ?? '';

function sections(bytes) {
  let text;
  try { text = decode(bytes); } catch { return undefined; }
  const { runs } = outline(parseMarkdown(text, markdown), text);
  const at = (p) => runs.get(p)?.blocks.map((b) => [html(b), text.slice(b.position.start.offset, b.position.end.offset), true]);
  return { runs, paths: [...runs.keys()], at };
}

run({
  writer: markdownWriter({ markdown }),
  features: ['shifted'],
  corpus: fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => fs.readFileSync(path.join(dir, f))),
  read: sections,
  // A section is equal to another when its blocks mean the same HTML, whatever bytes they carry.
  equal: (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x[0] === b[i][0]),
  edits(bytes) {
    const s = sections(bytes);
    return s.paths.flatMap((p) => {
      const value = s.at(p);
      const i = value.findIndex(([h]) => h.startsWith('<p>'));
      if (i < 0) return [];
      return [{ path: p, value: value.map((b, j) => (j === i ? [b[0].replace(/<\/p>$/, ' Added.</p>'), b[1], false] : b)) }];
    });
  },
}, 'markdown');
