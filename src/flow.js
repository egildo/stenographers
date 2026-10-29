// A flow of blocks written over its old bytes (the studio's notes/markdown-plan.md, "Escalation": the parent owns the gaps). The caller says which old block each new one stands for, by identity (the file, the studio's src/markdown/file.js) or by meaning (Provenance's writer, ./writer.js); this writes them. A block that is its old one unchanged keeps its bytes, and so does one whose bytes the caller gives as they stand (what the Markdown pane typed); one that stands for an old block is written by its stenographer over that slice, or over the bytes the caller gives it, raw HTML if it refuses; one that stands for none is written fresh. The separator before a block is the old gap when it follows the block it followed, a blank line otherwise; an old block no new one stands for takes its bytes and the gap before it, unless that gap holds something of its own (a link definition, a comment), which stays. Two lists that were not neighbours and would read as one (the same kind, the same marker) are kept apart by an empty comment, as mdast-util-to-markdown does.
import { writeFresh, writeNode } from './write.js';

const marker = (bytes) => /^\s*(?:([-*+])|\d+([.)]))/.exec(bytes)?.slice(1).join('') ?? null;
const merges = (a, aBytes, b, bBytes) => a.localName === b.localName && /^[uo]l$/.test(a.localName) && marker(aBytes) != null && marker(aBytes) === marker(bBytes);

/**
 * @param {{ el: Element, j: number, same: boolean, bytes?: string | null, over?: string | null }[]} blocks the new blocks in order: the HTML each means, the index of the old block it stands for (-1: none), whether it is that block unchanged; `bytes`, the block's bytes as they stand (written as they are); `over`, the bytes a changed block is written over (its old block's by default)
 * @param {{ text: string, spans: [number, number][], from?: number, to?: number }} old the old text, its blocks' spans in it in order, and the stretch of it they lie in (all of it by default)
 * @param {{ defs?: string, gfm?: object }} [file] the file's definitions and GFM options, for the stenographers' re-parse
 * @returns {{ text: string, spans: [number, number][], report: { kept: number, written: number, fresh: number, deleted: number } }} the stretch's new bytes, and each new block's span in them
 */
export function writeFlow(blocks, old, file = {}) {
  const { text, spans } = old;
  const from = old.from ?? 0, to = old.to ?? text.length;
  const report = { kept: 0, written: 0, fresh: 0, deleted: 0 };
  const used = new Set(blocks.filter((b) => b.j >= 0).map((b) => b.j));
  const slice = (k) => text.slice(...spans[k]);
  // The bytes between old block k-1 and old block k; the lead holds what is before the first.
  const gap = (k) => (k === 0 ? '' : text.slice(spans[k - 1][1], spans[k][0]));
  const held = (a, b) => { let kept = ''; for (let k = a + 1; k < b; k++) if (!used.has(k) && /\S/.test(gap(k))) kept += gap(k); return kept; };
  let out = text.slice(from, spans[0]?.[0] ?? to);
  const next = [];
  let prev = -1, last = '';
  for (const [i, { el, j, same, bytes: given, over }] of blocks.entries()) {
    let bytes;
    if (given != null) { bytes = given; report.kept++; }
    else if (same) { bytes = slice(j); report.kept++; }
    else if (j < 0 && over == null) { bytes = writeFresh(el, file); report.fresh++; }
    else { bytes = writeNode(el, { text: over ?? slice(j), column: 0, ...file }) ?? el.outerHTML; report.written++; }
    const adjacent = i > 0 && j >= 0 && j === prev + 1 && blocks[i - 1].j === prev;
    let sep = i === 0 ? (j >= 0 ? held(-1, j) : '') : j > prev ? held(prev, j) + gap(j) || '\n\n' : '\n\n';
    if (i > 0 && !adjacent && !/\S/.test(sep) && merges(blocks[i - 1].el, last, el, bytes)) sep = '\n\n<!-- -->\n\n';
    out += sep + bytes;
    last = bytes;
    next.push([out.length - bytes.length, out.length]);
    if (j >= 0) prev = j;
  }
  out += held(prev, spans.length) + (spans.length ? text.slice(spans.at(-1)[1], to) : '');
  // A stretch that had no blocks has no gap after them: the new ones are separated from what follows.
  if (!spans.length && blocks.length) out += to < text.length ? '\n\n' : '\n';
  report.deleted = spans.length - used.size;
  return { text: out, spans: next, report };
}
