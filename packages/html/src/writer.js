// Provenance's HTML writer, by shape (nothing here imports Provenance), at the grain of blocks (0km's proposals/studio.md, "The first proof starts from HTML"). A path is a JSON Pointer over the document's containers: the body is the empty path, and an element with an `id` whose own children are blocks is a container, its step the id, `~0` `~1` escaping `~` `/` as RFC 6901 does, nested under the container it sits in (`/measure/first-room`). A path addresses its container's run, the bytes between its start tag and its end tag. The value is the run's blocks, the container's child elements in order, each its HTML, the bytes it had at the base and whether it is unchanged: a block unchanged keeps its bytes, a block changed is written as its HTML, whole. What lies between blocks (white space, comments, `<script>`, `<style>`, `<template>`) is the gaps', not the value's, and stays. Only `set`: a block inserted, deleted or moved is a new value for its container. Bytes are counted here and nowhere else.
import { defaultTreeAdapter, parse, parseFragment, serializeOuter } from 'parse5';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
// The elements that are a gap's bytes, not blocks: a reader that keeps the text holds none of them (the studio's frame seats a `<style>` itself).
const GAPS = new Set(['script', 'style', 'template']);
const isBlock = (n) => n.tagName && !GAPS.has(n.tagName);
const ink = (n) => n.nodeName === '#text' && /\S/.test(n.value);
// The elements whose content is running text (HTML's phrasing content, and the blocks that hold only it): nothing in them is a container, whatever its children.
const TEXT = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'button', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'i', 'img', 'input', 'ins', 'kbd', 'label', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'svg', 'math', 'picture', 'select', 'textarea', 'output', 'meter', 'progress']);
const inText = (el) => TEXT.has(el.tagName) || el.childNodes.some(ink);

/** A container's step: its id, escaped as RFC 6901 escapes a step. */
export const step = (id) => id.replace(/~/g, '~0').replace(/\//g, '~1');

/**
 * The containers of an HTML text, by path, in document order: the body, then every element with an `id` whose end tag is written and which is not running text nor inside it (a paragraph, a `<span>`, an element holding text of its own, and all they hold).
 * ponytail: a container whose end tag is implied (an `<li id>` closed by the next) is a block of its parent, and an id repeated under one parent names its first; widen when a document needs them.
 * @returns {Map<string, { from: number, to: number, tag: string, blocks: { from: number, to: number, node: object }[] }>} each run's span in the text and its blocks' spans
 */
export function outline(text) {
  const runs = new Map();
  const visit = (node, path) => {
    for (const child of node.childNodes ?? []) {
      if (!child.tagName || GAPS.has(child.tagName)) continue;
      const id = child.attrs.find((a) => a.name === 'id')?.value;
      const own = id != null && id !== '' && container(child) ? `${path}/${step(id)}` : null;
      if (own != null && !runs.has(own)) add(own, child);
      if (!inText(child)) visit(child, own ?? path);
    }
  };
  const container = (el) => el.sourceCodeLocation?.startTag && el.sourceCodeLocation.endTag && !inText(el);
  const add = (path, el) => {
    const { startTag, endTag } = el.sourceCodeLocation;
    const blocks = el.childNodes.filter(isBlock).map((node) => ({ from: node.sourceCodeLocation.startOffset, to: node.sourceCodeLocation.endOffset, node }));
    runs.set(path, { from: startTag.endOffset, to: endTag.startOffset, tag: el.tagName, blocks });
  };
  const body = parse(text, { sourceCodeLocationInfo: true }).childNodes.find((n) => n.tagName === 'html')?.childNodes.find((n) => n.tagName === 'body');
  if (body && container(body)) add('', body);
  if (body) visit(body, '');
  return runs;
}

/** What a block means: its HTML as the parser reads it in its container, so two spellings of one element compare equal. */
export const means = (node) => serializeOuter(node);
/** The blocks an HTML string means inside a container of the given tag. */
export const meaningsIn = (tag, html) => parseFragment(defaultTreeAdapter.createElement(tag, 'http://www.w3.org/1999/xhtml', []), html).childNodes.filter(isBlock).map(means);

/**
 * A run's new bytes over its old. Each entry of the value is a block: its HTML, the bytes it had at the base (null for a block that had none) and whether it is that block unchanged. A block finds its old block by those bytes, in order; one whose bytes are not in this version of the run is written as new. A block unchanged keeps its bytes; any other is written as its HTML. The separator before a block is the old gap when it follows the block it followed, else the run's indent; a deleted block takes its bytes and the gap before it, unless that gap holds something of its own (a comment, a script), which stays.
 * @param {string} text the file's text
 * @param {{ from: number, to: number, blocks: { from: number, to: number }[] }} run the run in it, from `outline`
 * @param {[string, string | null, boolean][]} value
 * @returns {{ text: string, kept: number[] }} the run's new bytes, and for each value block the old block whose bytes it kept (-1: written as its HTML)
 */
export function writeRun(text, run, value) {
  const olds = run.blocks;
  const bytes = olds.map((b) => text.slice(b.from, b.to));
  // The bytes before old block k; gap(0) is the run's lead, gap(n) its tail.
  const gap = (k) => text.slice(k === 0 ? run.from : olds[k - 1].to, k === olds.length ? run.to : olds[k].from);
  // A held gap brings its own white space either side; where another gap follows it, its trailing white space gives way, so a deleted block leaves no blank line behind.
  const join = (h, g) => (h && /^\s/.test(g) ? h.trimEnd() + g : h + g);
  const held = (a, b) => { let kept = ''; for (let k = a; k < b; k++) if (/\S/.test(gap(k))) kept = join(kept, gap(k)); return kept; };
  const indent = /\s*$/.exec(gap(olds.length > 1 ? 1 : 0))[0] || '\n';
  const used = new Set();
  const kept = [];
  let next = 0, prev = -1, out = '';
  for (const [html, was, same] of value) {
    let j = -1;
    if (was != null) {
      j = bytes.findIndex((b, k) => k >= next && !used.has(k) && b === was);
      if (j < 0) j = bytes.findIndex((b, k) => !used.has(k) && b === was);
    }
    if (j >= 0) { used.add(j); next = j + 1; }
    const sep = j > prev ? join(held(prev + 1, j), gap(j)) : indent;
    kept.push(j >= 0 && same ? j : -1);
    out += sep + (j >= 0 && same ? bytes[j] : html);
    if (j > prev) prev = j;
  }
  // What follows the last block written: the gaps of the blocks deleted after it that hold something, then the run's tail.
  return { text: out + join(held(prev + 1, olds.length), gap(olds.length)), kept };
}

// Stenography's refusal rule: a wrong-typed path or value is the caller's bug and throws; a data problem is a refusal with its shared code.
const isEditData = (v) => v === null || ['string', 'number', 'bigint', 'boolean'].includes(typeof v) || (Array.isArray(v) && v.every(isEditData)) || (v instanceof Map && [...v].every(([k, x]) => typeof k === 'string' && isEditData(x)));
const pointer = (path) => {
  if (typeof path !== 'string') throw new TypeError(`a path is a string, not ${typeof path}`);
  return path === '' || (path.startsWith('/') && !/~(?![01])/.test(path));
};
const refuse = (code, reason) => ({ ok: false, code, reason });
const wellFormed = (value) => Array.isArray(value) && value.every((b) => Array.isArray(b) && b.length === 3 && typeof b[0] === 'string' && (b[1] === null || typeof b[1] === 'string') && typeof b[2] === 'boolean');

/**
 * @param {{ claims?: (location: string) => boolean }} [options]
 */
export function htmlWriter({ claims = (location) => /\.html?$/i.test(location) } = {}) {
  return {
    claims,
    open(bytes) {
      let text;
      try { text = decoder.decode(bytes); } catch { return refuse('open-unreadable', 'the file is not UTF-8'); }
      const runs = outline(text);
      const byte = (i) => encoder.encode(text.slice(0, i)).length;
      const find = (path) => {
        if (!pointer(path)) return refuse('path-malformed', `${JSON.stringify(path)} is not a JSON Pointer`);
        return runs.get(path) ?? refuse('edit-target-absent', `no container at ${JSON.stringify(path)}`);
      };
      const opened = {
        locate(path) {
          const run = find(path);
          return run.ok === false ? run : { ok: true, start: byte(run.from), end: byte(run.to) };
        },
        write(path, value) {
          if (!isEditData(value)) throw new TypeError('a value is EditData: a scalar, an array or a Map, never a plain object');
          const run = find(path);
          if (run.ok === false) return run;
          if (!wellFormed(value)) return refuse('edit-unrepresentable', 'the value of a container is its blocks, each [html, its bytes at the base or null, unchanged]');
          const { text: out, kept } = writeRun(text, run, value);
          // Read back: the container, parsed again in the new text, holds the blocks the value means. A block that kept its bytes means what they meant: unchanged is the caller's word, and the caller's HTML of it may be a reader's narrower one.
          const after = outline(text.slice(0, run.from) + out + text.slice(run.to)).get(path);
          const wanted = value.flatMap(([html], i) => (kept[i] >= 0 ? [means(run.blocks[kept[i]].node)] : meaningsIn(run.tag, html)));
          if (wanted.length !== value.length || !after || after.blocks.length !== wanted.length || after.blocks.some((b, i) => means(b.node) !== wanted[i])) {
            return refuse('edit-read-back', `the blocks given for ${JSON.stringify(path)} do not read back as themselves in a <${run.tag}>`);
          }
          return { ok: true, edit: { start: byte(run.from), end: byte(run.to), bytes: encoder.encode(out) } };
        }
      };
      return { ok: true, document: opened };
    }
  };
}
