// Provenance's CSV writer, by shape (nothing here imports Provenance). The file is a header row and data rows, RFC 4180: cells split by a delimiter, the comma unless the writer is given another, a cell quoted with `"` may hold the delimiter, a quote (doubled) or a line break, records end in CRLF, LF or CR. A path is a JSON Pointer: `/<row>` names a row by its first cell, which must be unique in the file; `/<row>/<column>` names a cell by the row and the column's header. The first cell is the row's address and is changed by writing the row, whose value then reads back at the new path. A cell's value is a string; a row's is a Map from header to string. Style: a cell is quoted when its value needs it or when its old bytes were quoted; a new row is written in the header's order and takes the file's line ending, the first break in the file. Bytes are counted here and nowhere else.

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

/**
 * The records of a CSV text, each its span (without its line terminator), its cells (each its raw span and its value) and `end`, the offset after its terminator. Throws on a quote left open or on bytes after a closing quote.
 * @returns {{ eol: string, records: { from: number, to: number, end: number, cells: { from: number, to: number, value: string }[] }[] }}
 */
export function table(text, delimiter = ',') {
  const eol = /\r\n|\n|\r/.exec(text)?.[0] ?? '\n';
  const ends = (ch) => ch === delimiter || ch === '\r' || ch === '\n';
  const records = [];
  let i = 0;
  while (true) {
    const from = i, cells = [];
    while (true) {
      const cellFrom = i;
      let value = '';
      if (text[i] === '"') {
        i++;
        while (true) {
          if (i >= text.length) throw new SyntaxError(`a quote opened at ${cellFrom} is never closed`);
          if (text[i] === '"') { if (text[i + 1] === '"') { value += '"'; i += 2; continue; } i++; break; }
          value += text[i++];
        }
        if (i < text.length && !ends(text[i])) throw new SyntaxError(`bytes after the closing quote at ${i}`);
      } else {
        let to = i;
        while (to < text.length && !ends(text[to])) to++;
        value = text.slice(i, to);
        i = to;
      }
      cells.push({ from: cellFrom, to: i, value });
      if (text[i] === delimiter) { i++; continue; }
      break;
    }
    const to = i;
    if (text.startsWith('\r\n', i)) i += 2; else if (i < text.length) i += 1;
    records.push({ from, to, end: i, cells });
    if (i >= text.length) break;
  }
  return { eol, records };
}

const needsQuotes = (v, delimiter) => v.includes(delimiter) || /["\r\n]/.test(v) || /^\s|\s$/.test(v);
/** A cell's bytes for `value`: quoted when the value needs it or the old cell was. */
export const format = (value, wasQuoted = false, delimiter = ',') => (wasQuoted || needsQuotes(value, delimiter) ? `"${value.replaceAll('"', '""')}"` : value);

// Stenography's refusal rule: a wrong-typed path or value is the caller's bug and throws; a data problem is a refusal with its code.
const isEditData = (v) => v === null || ['string', 'number', 'bigint', 'boolean'].includes(typeof v) || (Array.isArray(v) && v.every(isEditData)) || (v instanceof Map && [...v].every(([k, x]) => typeof k === 'string' && isEditData(x)));
const steps = (path) => {
  if (typeof path !== 'string') throw new TypeError(`a path is a string, not ${typeof path}`);
  if (path === '') return [];
  if (!path.startsWith('/') || /~(?![01])/.test(path)) return undefined;
  return path.slice(1).split('/').map((s) => s.replaceAll('~1', '/').replaceAll('~0', '~'));
};
const refuse = (code, reason) => ({ ok: false, code, reason });

/**
 * @param {{ claims?: (location: string) => boolean, delimiter?: string }} [options] `delimiter`: the one character cells are split by, the comma unless given (`;` for a file Excel wrote in a locale whose decimal mark is the comma, `\t` for tab-separated).
 */
export function csvWriter({ claims = (location) => /\.csv$/i.test(location), delimiter = ',' } = {}) {
  if (typeof delimiter !== 'string' || delimiter.length !== 1 || /["\r\n]/.test(delimiter)) throw new TypeError('a delimiter is one character, not a quote or a line break');
  return {
    claims,
    open(bytes) {
      let text, parsed;
      try { text = decoder.decode(bytes); } catch { return refuse('open-unreadable', 'the file is not UTF-8'); }
      try { parsed = table(text, delimiter); } catch (e) { return refuse('open-unreadable', e.message); }
      const { eol, records } = parsed;
      const [header, ...rows] = records;
      if (text === '') return refuse('open-unreadable', 'the file has no header row');
      const columns = header.cells.map((c) => c.value);
      const twice = columns.find((c, k) => columns.indexOf(c) !== k);
      if (twice !== undefined) return refuse('column-duplicate', `the header names ${JSON.stringify(twice)} twice`);
      const byKey = new Map();
      for (const r of rows) { const k = r.cells[0].value; byKey.set(k, [...(byKey.get(k) ?? []), r]); }
      // ponytail: O(n) per offset; a prefix table if a register grows past a few thousand rows.
      const byte = (i) => encoder.encode(text.slice(0, i)).length;
      const splice = (from, to, out) => ({ ok: true, edit: { start: byte(from), end: byte(to), bytes: encoder.encode(out) } });
      // The row a key names, or the refusal.
      const row = (key) => {
        const found = byKey.get(key);
        if (!found) return refuse('edit-target-absent', `no row whose first cell is ${JSON.stringify(key)}`);
        if (found.length > 1) return refuse('row-key-duplicate', `${found.length} rows have ${JSON.stringify(key)} as their first cell`);
        if (found[0].cells.length !== columns.length) return refuse('row-ragged', `the row ${JSON.stringify(key)} has ${found[0].cells.length} cells, the header ${columns.length}`);
        return found[0];
      };
      const column = (name) => {
        const c = columns.indexOf(name);
        return c < 0 ? refuse('edit-target-absent', `no column ${JSON.stringify(name)} in the header`) : c;
      };
      // A path's target: the root, a row, a cell, or the refusal.
      const find = (path) => {
        const s = steps(path);
        if (s === undefined) return refuse('path-malformed', `${JSON.stringify(path)} is not a JSON Pointer`);
        if (s.length > 2) return refuse('edit-target-absent', `${JSON.stringify(path)} goes below a cell`);
        if (s.length === 0) return { root: true };
        const r = row(s[0]);
        if (r.ok === false) return r;
        if (s.length === 1) return { row: r };
        const c = column(s[1]);
        return c.ok === false ? c : { row: r, cell: r.cells[c] };
      };
      const wasQuoted = (cell) => text[cell.from] === '"';
      // A row's bytes for a Map value: a cell that keeps its value keeps its bytes.
      const rowBytes = (value, old) => {
        const unknown = [...value.keys()].find((k) => !columns.includes(k));
        if (unknown !== undefined) return refuse('edit-unrepresentable', `no column ${JSON.stringify(unknown)} in the header`);
        const bad = [...value.values()].find((v) => typeof v !== 'string');
        if (bad !== undefined) return refuse('edit-unrepresentable', 'a cell holds a string');
        return columns.map((h, c) => {
          const v = value.get(h) ?? '';
          const cell = old?.cells[c];
          return cell && v === cell.value ? text.slice(cell.from, cell.to) : format(v, cell && wasQuoted(cell), delimiter);
        }).join(delimiter);
      };
      const checkValue = (value) => { if (!isEditData(value)) throw new TypeError('a value is EditData: a scalar, an array or a Map, never a plain object'); };
      return {
        ok: true,
        document: {
          locate(path) {
            const t = find(path);
            if (t.ok === false) return t;
            const span = t.root ? { from: 0, to: text.length } : t.cell ?? t.row;
            return { ok: true, start: byte(span.from), end: byte(span.to) };
          },
          write(path, value) {
            checkValue(value);
            const t = find(path);
            if (t.ok === false) return t;
            if (t.root) return refuse('edit-unrepresentable', 'the file is written a row or a cell at a time');
            if (t.cell) {
              if (typeof value !== 'string') return refuse('edit-unrepresentable', 'a cell holds a string');
              // The first cell is the row's address: changing it alone would move every other cell of the row (the locality law). The row is written instead.
              if (t.cell === t.row.cells[0] && value !== t.cell.value) return refuse('row-key-fixed', 'the first cell is the row\'s address; write the row to rename it');
              return splice(t.cell.from, t.cell.to, value === t.cell.value ? text.slice(t.cell.from, t.cell.to) : format(value, wasQuoted(t.cell), delimiter));
            }
            if (!(value instanceof Map)) return refuse('edit-unrepresentable', 'a row is a Map from header to string');
            // A row given without its first cell keeps its key.
            const whole = new Map([[columns[0], t.row.cells[0].value], ...value]);
            const key = whole.get(columns[0]);
            if (key !== t.row.cells[0].value && byKey.has(key)) return refuse('row-key-duplicate', `a row whose first cell is ${JSON.stringify(key)} is already there`);
            const out = rowBytes(whole, t.row);
            return out.ok === false ? out : splice(t.row.from, t.row.to, out);
          },
          add(path, value) {
            checkValue(value);
            const s = steps(path);
            if (s === undefined) return refuse('path-malformed', `${JSON.stringify(path)} is not a JSON Pointer`);
            if (s.length !== 1) return refuse('edit-unrepresentable', 'only a row is added; a column is not added one cell at a time');
            if (byKey.has(s[0])) return refuse('edit-target-exists', `a row whose first cell is ${JSON.stringify(s[0])} is already there`);
            if (!(value instanceof Map)) return refuse('edit-unrepresentable', 'a row is a Map from header to string');
            if (value.has(columns[0]) && value.get(columns[0]) !== s[0]) return refuse('edit-read-back', `the row's first cell ${JSON.stringify(value.get(columns[0]))} is not its path ${JSON.stringify(s[0])}`);
            const out = rowBytes(new Map([[columns[0], s[0]], ...value]));
            if (out.ok === false) return out;
            const last = records.at(-1);
            return last.end > last.to ? splice(text.length, text.length, out + eol) : splice(text.length, text.length, eol + out);
          },
          // An operation applied inside a row a caller has staged: a cell set in its Map. A row's cells are its header's, so none is added or removed; a column outside the header has no cell.
          amend(staged, operation) {
            const a = steps(staged.path), b = steps(operation.path);
            if (a === undefined || b === undefined || a.length !== 1 || b.length !== 2 || b[0] !== a[0]) return { inside: false };
            const no = (reason) => ({ inside: true, ok: false, reason });
            if (!(staged.value instanceof Map)) return no('a row is a Map from header to string');
            if (!columns.includes(b[1])) return no(`no column ${JSON.stringify(b[1])} in the header`);
            if (operation.op !== 'set') return no(operation.op === 'add' ? 'a row has every cell of the header already; set it' : 'a cell is emptied, not removed');
            if (typeof operation.value !== 'string') return no('a cell holds a string');
            return { inside: true, ok: true, value: new Map([...staged.value, [b[1], operation.value]]) };
          },
          // Rows are named by their first cell and columns by their header: nothing along a path is a position, so no later version shifts one.
          shifted() { return false; },
          remove(path) {
            const t = find(path);
            if (t.ok === false) return t;
            if (!t.row || t.cell) return refuse('edit-unrepresentable', 'only a row is removed; a cell is emptied, a column stays');
            if (t.row.end > t.row.to) return splice(t.row.from, t.row.end, '');
            // The last row, with no line ending after it: it goes with the line ending before it.
            return splice(records[records.indexOf(t.row) - 1].to, t.row.to, '');
          }
        }
      };
    }
  };
}
