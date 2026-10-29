// Provenance's Markdown writer (the studio's notes/markdown-plan.md, "Saving through Provenance"): the editing half of a format plug-in, in Provenance's `Writer` shape and by shape only (nothing here imports Provenance). A path is a JSON Pointer over the heading outline: each step a heading's plain text, `~0` `~1` `~2` escaping `~` `/` `@`, a repeated sibling heading's step suffixed `@n`; the empty path is the preamble. A path addresses a section's own run: its heading line and the blocks after it, up to the next heading of any rank, so no two paths share a byte. The value is the run's blocks, each its HTML, the bytes it had at the base and whether it is unchanged (`writeRun`); the writer writes them with the stenographers over the run's bytes in the version it opened, a block finding its old self by those bytes. Only `set`: every edit is a new value for a run, structural ones included (a heading deleted is its run without it, a section deleted its run set to nothing). Bytes are counted here and nowhere else: the writer decodes UTF-8, works in string positions, and answers in byte positions.
import { parseMarkdown } from './parse.js';
import { writeFlow } from './flow.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
// The mdast nodes that are the gaps' bytes, not blocks: nothing in the value stands for them (a comment between blocks is the gap's, as it is the file's, the studio's src/markdown/file.js).
const GAPS = new Set(['definition', 'footnoteDefinition', 'yaml']);
const gap = (n) => GAPS.has(n.type) || (n.type === 'html' && /^\s*<!--[\s\S]*?-->\s*$/.test(n.value));

const plain = (node) => ('value' in node && typeof node.value === 'string' ? node.value : (node.children ?? []).map(plain).join(''));
/** A heading's step: its plain text, whitespace collapsed, escaped. */
export const step = (text) => text.replace(/\s+/g, ' ').trim().replace(/~/g, '~0').replace(/\//g, '~1').replace(/@/g, '~2');

/**
 * The runs of a Markdown text, by path, in order: the preamble (after any frontmatter) and each top-level heading's run. Nesting follows the ranks as BelType's sectioning reads them: a heading is the child of the nearest earlier heading of a lower rank.
 * @returns {{ runs: Map<string, { from: number, to: number, blocks: object[] }>, siblings: Map<string, number> }} the runs, and how many siblings share each parent and text (for `shifted`)
 */
export function outline(tree, text) {
  const top = tree.children;
  const yaml = top[0]?.type === 'yaml' ? top[0] : null;
  const headings = top.filter((n) => n.type === 'heading');
  const runs = new Map(), siblings = new Map();
  const blocksIn = (from, to) => top.filter((n) => !gap(n) && n.position.start.offset >= from && n.position.start.offset < to);
  const first = headings[0]?.position.start.offset ?? text.length;
  const preamble = yaml ? yaml.position.end.offset : 0;
  runs.set('', { from: preamble, to: first, blocks: blocksIn(preamble, first) });
  const stack = [];
  headings.forEach((h, i) => {
    while (stack.length && stack.at(-1).depth >= h.depth) stack.pop();
    const parent = stack.map((s) => `/${s.step}`).join('');
    const name = step(plain(h));
    const key = `${parent}\0${name}`;
    const n = (siblings.get(key) ?? 0) + 1;
    siblings.set(key, n);
    const own = n > 1 ? `${name}@${n}` : name;
    stack.push({ depth: h.depth, step: own });
    const from = h.position.start.offset, to = headings[i + 1]?.position.start.offset ?? text.length;
    runs.set(`${parent}/${own}`, { from, to, blocks: blocksIn(from, to), heading: true });
  });
  return { runs, siblings };
}

/**
 * A run's new bytes over its old: the one function the file (the studio's src/markdown/file.js, against its base) and Provenance's writer (against whatever version it opened) both write with, so a preview is the file's working text. Each entry of the value is a block: its HTML, the bytes it had at the base the value was made against (null for a block that had none), whether it is that block unchanged, the bytes it had in the working text before this change (`prior`, null for none), and whether those stand as they are (`keep`: the block did not change since, or they are what the Markdown pane typed). A block finds its old block by its base bytes, in order; one whose bytes are not in this version of the run (the disk changed it) takes the next unpaired old block of its kind; a block with no bytes is new. A block that keeps its prior bytes is written as them; a changed one is written by its stenographer over its prior bytes, or over its old block's.
 * @param {string} text the file's text
 * @param {{ from: number, to: number, blocks: object[], heading?: boolean }} run the run in it, from `outline` (`heading`: a section's run, not the preamble)
 * @param {[string, string | null, boolean, (string | null)?, boolean?][]} value
 * @param {{ defs?: string, gfm?: object }} file
 * @returns {{ text: string, spans: [number, number][] }} the run's bytes, and each value block's span in them
 */
export function writeRun(text, run, value, file) {
  if (!value.length) return { text: '', spans: [] };
  const olds = run.blocks.map((b) => [b.position.start.offset, b.position.end.offset]);
  const bytes = olds.map((span) => text.slice(...span));
  const holder = globalThis.document.createElement('template');
  const used = new Set();
  let next = 0;
  const blocks = value.map(([html, was, same, prior = null, keep = false]) => {
    holder.innerHTML = html;
    const el = holder.content.firstElementChild;
    let j = -1;
    if (was != null) {
      j = bytes.findIndex((b, k) => k >= next && !used.has(k) && b === was);
      if (j < 0) j = bytes.findIndex((b, k) => !used.has(k) && b === was);
      if (j < 0) for (let k = next; k < olds.length; k++) if (!used.has(k) && sameKind(el, run.blocks[k])) { j = k; break; }
    }
    if (j >= 0) { used.add(j); next = j + 1; }
    return { el, j, same: j >= 0 && same && bytes[j] === was, bytes: keep && prior != null ? prior : null, over: prior };
  });
  const out = writeFlow(blocks, { text, spans: olds, from: run.from, to: run.to }, file);
  // A section's run that lost its heading and now begins with a list puts that list next to whatever ends the run before, which this run cannot see: the run before may be staged too, and Provenance writes the two independently. So it always opens with an empty comment, which keeps two lists apart as the flow does; at worst a comment where none was needed, never two lists read as one.
  if (run.heading && /^[uo]l$/.test(blocks[0].el.localName)) {
    const sep = '<!-- -->\n\n';
    return { text: sep + out.text, spans: out.spans.map(([a, b]) => [a + sep.length, b + sep.length]) };
  }
  return out;
}
const KIND = { paragraph: 'p', code: 'pre', blockquote: 'blockquote', table: 'table', thematicBreak: 'hr' };
const sameKind = (el, md) => {
  if (md.type === 'heading') return /^h[1-6]$/.test(el.localName);
  if (md.type === 'list') return el.localName === (md.ordered ? 'ol' : 'ul');
  return KIND[md.type] === el.localName;
};
const wellFormed = (value) => Array.isArray(value) && value.every((b) => Array.isArray(b) && typeof b[0] === 'string' && (b[1] === null || typeof b[1] === 'string') && typeof b[2] === 'boolean' && (b[3] == null || typeof b[3] === 'string') && (b[4] == null || typeof b[4] === 'boolean'));

/**
 * @param {{ gfm?: { autolinks?: boolean, tables?: boolean }, claims?: (location: string) => boolean }} [options]
 */
export function markdownWriter({ gfm, claims = (location) => /\.md$/i.test(location) } = {}) {
  return {
    claims,
    open(bytes) {
      let text;
      try { text = decoder.decode(bytes); } catch { return { ok: false, reason: 'the file is not UTF-8' }; }
      const tree = parseMarkdown(text, gfm);
      const { runs, siblings } = outline(tree, text);
      const defs = tree.children.filter((n) => n.type === 'definition' || n.type === 'footnoteDefinition').map((n) => text.slice(n.position.start.offset, n.position.end.offset)).join('\n\n');
      const byte = (i) => encoder.encode(text.slice(0, i)).length;
      const opened = {
        siblings,
        locate(path) {
          const run = runs.get(path);
          return run ? { ok: true, start: byte(run.from), end: byte(run.to) } : { ok: false, reason: `no section at ${JSON.stringify(path)}` };
        },
        write(path, value) {
          const run = runs.get(path);
          if (!run) return { ok: false, reason: `no section at ${JSON.stringify(path)}` };
          if (!wellFormed(value)) return { ok: false, reason: 'the value of a section is its blocks, each [html, its bytes at the base or null, unchanged, its prior bytes or null, whether they stand]' };
          const out = writeRun(text, run, value, { defs, gfm }).text;
          return { ok: true, edit: { start: byte(run.from), end: byte(run.to), bytes: encoder.encode(out) } };
        },
        // A list along the path changed length when a step with an ordinal names siblings whose count changed.
        shifted(path, newer) {
          let parent = '';
          for (const s of path.split('/').slice(1)) {
            const name = s.replace(/@\d+$/, '');
            const key = `${parent}\0${name}`;
            if (s !== name && siblings.get(key) !== newer.siblings?.get(key)) return true;
            parent += `/${s}`;
          }
          return false;
        }
      };
      return { ok: true, document: opened };
    }
  };
}
