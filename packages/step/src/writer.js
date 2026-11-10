// Provenance's STEP writer, by shape (nothing here imports Provenance). The file is ISO 10303-21, the clear-text encoding an IFC file is written in: a header, one `DATA;` section of instances (`#12=KEYWORD(attribute, …);`), spaces, line breaks and `/* comments */` allowed between any two tokens. This member knows the format and nothing of IFC. A path is a JSON Pointer rooted at an instance's number: `/#19` the instance, `/#19/0` its first attribute, `/#15/0/1` a list's second member, `/#19/2/IFCREAL` the value inside a typed value. A reference (`#13`) is a leaf, so one value has one path. The grain is the value: a write is a splice of one token and of no other byte. Spelling is IfcOpenShell's, so a file it wrote is written again by it with no byte changed. The bytes are read one character each, so every offset here is a byte offset.

const latin = new TextDecoder('latin1'); // one character per byte, whatever the byte
const utf8 = new TextDecoder();
const encoder = new TextEncoder();

const REFERENCE = /#\d+/y;
const NUMBER = /[+-]?\d+(\.\d*(?:E[+-]?\d+)?)?/y;
const ENUMERATION = /\.[A-Z_][A-Z0-9_]*\./y;
const KEYWORD = /!?[A-Za-z_][A-Za-z0-9_]*/y;
const WORD = /[A-Za-z0-9_-]+/y;
const NAME = /^[A-Z_][A-Z0-9_]*$/;
const INDEX = /^(0|[1-9]\d*)$/;

/** A string's value from the text between its quotes. `\S\` is read as ISO 8859-1 whatever page `\P.\` names. */
const unescaped = (s) => s.replace(/''|\\\\|\\S\\([\s\S])|\\X\\([0-9A-F]{2})|\\X2\\((?:[0-9A-F]{4})+)\\X0\\|\\X4\\((?:[0-9A-F]{8})+)\\X0\\|\\P[A-I]\\/g, (m, s, x, x2, x4) => {
  if (m === "''") return "'";
  if (m === '\\\\') return '\\';
  if (s !== undefined) return String.fromCharCode(s.charCodeAt(0) + 128);
  if (x !== undefined) return String.fromCharCode(parseInt(x, 16));
  if (x2 !== undefined) return x2.match(/.{4}/g).map((h) => String.fromCharCode(parseInt(h, 16))).join('');
  if (x4 !== undefined) return x4.match(/.{8}/g).map((h) => (parseInt(h, 16) <= 0x10ffff ? String.fromCodePoint(parseInt(h, 16)) : '�')).join('');
  return '';
});

/**
 * The instances of a STEP file, in the file's order: the reading the writer itself uses. Each has its `number`, its `keyword`, its span (`from` at `#`, `to` after `;`) and its `attributes`; a complex instance (`#1=(A(…)B(…));`) has a span and neither keyword nor attributes. A value has a `kind` (`unset`, `derived`, `enumeration`, `real`, `integer`, `string`, `binary`, `reference`, `list` with `members`, `typed` with `keyword` and `inner`), its span, its `source` (its bytes as written) and its `value`, decoded when asked for: `$` null, `.T.` and `.F.` booleans, any other enumeration its name, a real a number, an integer a bigint, a string a string, a reference the string `#13`, a list an array, a typed value a Map of one entry; a derived value (`*`), a binary, and anything holding one have no value. Throws a SyntaxError on text that is not one `DATA;` section of instances.
 * @param {Uint8Array} bytes
 */
export function instances(bytes) {
  const text = latin.decode(bytes);
  const fail = (what, at) => { throw new SyntaxError(`${what}, at byte ${at}`); };
  const at = (re, i) => { re.lastIndex = i; return re.exec(text); };
  const read = (n) => {
    switch (n.kind) {
      case 'unset': return null;
      case 'enumeration': { const s = text.slice(n.from + 1, n.to - 1); return s === 'T' ? true : s === 'F' ? false : s; }
      case 'real': return Number(text.slice(n.from, n.to));
      case 'integer': return BigInt(text.slice(n.from, n.to));
      case 'string': return unescaped(utf8.decode(bytes.subarray(n.from + 1, n.to - 1)));
      case 'reference': return text.slice(n.from, n.to);
      case 'list': { const v = n.members.map(read); return v.includes(undefined) ? undefined : v; }
      case 'typed': { const v = read(n.inner); return v === undefined ? undefined : new Map([[n.keyword, v]]); }
    }
  };
  const proto = { get value() { return read(this); }, get source() { return text.slice(this.from, this.to); } };
  const node = (kind, from, to, more) => ({ __proto__: proto, kind, from, to, ...more });
  // The offset of the next token: spaces, line breaks and comments passed over.
  const skip = (i) => {
    for (;;) {
      const c = text.charCodeAt(i);
      if (c <= 32) i++;
      else if (c === 47 && text.charCodeAt(i + 1) === 42) { const end = text.indexOf('*/', i + 2); if (end < 0) fail('a comment left open', i); i = end + 2; }
      else return i;
    }
  };
  // The offset after the string or binary that opens at i; a quote doubled is inside it.
  const quoted = (i, q) => {
    for (let j = i + 1; ; j++) {
      j = text.indexOf(q, j);
      if (j < 0) fail('a string left open', i);
      if (text[j + 1] !== q) return j + 1;
      j++;
    }
  };
  const value = (i) => {
    const c = text[i];
    if (c === '$') return node('unset', i, i + 1);
    if (c === '*') return node('derived', i, i + 1);
    if (c === "'") return node('string', i, quoted(i, "'"));
    if (c === '"') return node('binary', i, quoted(i, '"'));
    if (c === '(') {
      const members = [];
      let j = skip(i + 1);
      while (text[j] !== ')') {
        if (members.length) { if (text[j] !== ',') fail('a list left open', i); j = skip(j + 1); }
        const m = value(j);
        members.push(m);
        j = skip(m.to);
      }
      return node('list', i, j + 1, { members });
    }
    let m;
    if ((m = at(REFERENCE, i))) return node('reference', i, i + m[0].length);
    if ((m = at(ENUMERATION, i))) return node('enumeration', i, i + m[0].length);
    if ((m = at(NUMBER, i))) return node(m[1] === undefined ? 'integer' : 'real', i, i + m[0].length);
    if ((m = at(KEYWORD, i))) {
      let j = skip(i + m[0].length);
      if (text[j] !== '(') fail('a keyword with no value', i);
      const inner = value(skip(j + 1));
      j = skip(inner.to);
      if (text[j] !== ')') fail('a typed value holds one value', i);
      return node('typed', i, j + 1, { keyword: m[0], inner });
    }
    return fail('no value', i);
  };
  // The offset after the next `DATA;`, from i on, or -1: strings and comments are passed over, so a header may say DATA.
  const section = (i) => {
    for (;;) {
      i = skip(i);
      if (i >= text.length) return -1;
      if (text[i] === "'" || text[i] === '"') { i = quoted(i, text[i]); continue; }
      const m = at(WORD, i);
      if (!m) { i++; continue; }
      i += m[0].length;
      if (m[0] === 'DATA' && text[skip(i)] === ';') return skip(i) + 1;
    }
  };

  let i = section(0);
  if (i < 0) fail('no DATA; section', 0);
  const out = [], seen = new Set();
  for (;;) {
    i = skip(i);
    if (text.startsWith('ENDSEC', i)) break;
    const from = i, id = at(REFERENCE, i);
    if (!id) fail('no instance', i);
    const number = Number(id[0].slice(1));
    if (seen.has(number)) fail(`#${number} names two instances`, i);
    seen.add(number);
    i = skip(i + id[0].length);
    if (text[i] !== '=') fail('an instance number with no =', from);
    i = skip(i + 1);
    let keyword, attributes;
    if (text[i] === '(') {
      // A complex instance: read to its closing parenthesis, located and not entered.
      let depth = 0;
      do {
        i = skip(i);
        const c = text[i];
        if (c === undefined) fail('an instance left open', from);
        if (c === "'" || c === '"') { i = quoted(i, c); continue; }
        if (c === '(') depth++; else if (c === ')') depth--;
        i++;
      } while (depth > 0);
    } else {
      const k = at(KEYWORD, i);
      if (!k) fail('an instance with no keyword', from);
      keyword = k[0];
      i = skip(i + keyword.length);
      if (text[i] !== '(') fail('an instance with no attributes', from);
      const list = value(i);
      attributes = list.members;
      i = list.to;
    }
    i = skip(i);
    if (text[i] !== ';') fail('an instance left open', from);
    out.push({ number, keyword, from, to: ++i, attributes });
  }
  if (section(i) >= 0) fail('a second DATA; section', i);
  return out;
}

/** The 17 significant digits of a positive double and its decimal exponent, exact and rounded half to even, as C's `%.17g` rounds. */
const digits = (x) => {
  const bits = new BigUint64Array(new Float64Array([x]).buffer)[0];
  let m = bits & 0xfffffffffffffn, e = Number((bits >> 52n) & 0x7ffn);
  if (e === 0) e = 1; else m |= 1n << 52n;
  e -= 1075; // x is m × 2^e, exactly
  for (let X = Math.floor(Math.log10(x)); ; ) {
    let num = m, den = 1n; // x ÷ 10^(X − 16), as a fraction
    if (e >= 0) num <<= BigInt(e); else den <<= BigInt(-e);
    if (X >= 16) den *= 10n ** BigInt(X - 16); else num *= 10n ** BigInt(16 - X);
    let q = num / den;
    if (q >= 10n ** 17n) { X++; continue; }
    if (q < 10n ** 16n) { X--; continue; } // the exponent is settled before rounding: 1e-7 is a little under 10^-7
    const twice = 2n * (num % den);
    if (twice > den || (twice === den && q & 1n)) q++;
    return q === 10n ** 17n ? ['1'.padEnd(17, '0'), X + 1] : [String(q), X];
  }
};

/** A real's bytes, as IfcOpenShell spells it: C's `%.17g`, the fraction's trailing zeros dropped and the point kept. `undefined` for an infinity or NaN. */
export const real = (x) => {
  if (!Number.isFinite(x)) return undefined;
  if (x === 0) return Object.is(x, -0) ? '-0.' : '0.';
  const [d, X] = digits(Math.abs(x)), sign = x < 0 ? '-' : '', short = d.replace(/0+$/, '');
  if (X < -4 || X >= 17) return `${sign}${short[0]}.${short.slice(1)}E${X < 0 ? '-' : '+'}${String(Math.abs(X)).padStart(2, '0')}`;
  return X < 0 ? `${sign}0.${'0'.repeat(-X - 1)}${short}` : `${sign}${d.slice(0, X + 1)}.${d.slice(X + 1).replace(/0+$/, '')}`;
};

/** A string's bytes, as IfcOpenShell spells it: printable ASCII as it is, `'` and `\` doubled, every other character in a `\X2\` run, or a `\X4\` run when one of them is beyond U+FFFF. */
export const string = (t) => {
  let out = "'", run = [];
  const flush = () => {
    if (!run.length) return;
    const wide = run.some((c) => c > 0xffff);
    out += (wide ? '\\X4\\' : '\\X2\\') + run.map((c) => c.toString(16).toUpperCase().padStart(wide ? 8 : 4, '0')).join('') + '\\X0\\';
    run = [];
  };
  for (const ch of t) {
    const c = ch.codePointAt(0);
    if (c < 0x20 || c > 0x7e) { run.push(c); continue; }
    flush();
    out += ch === "'" ? "''" : ch === '\\' ? '\\\\' : ch;
  }
  flush();
  return out + "'";
};

// Stenography's refusal rule: a wrong-typed path or value is the caller's bug and throws; a data problem is a refusal with its code.
const isEditData = (v) => v === null || ['string', 'number', 'bigint', 'boolean'].includes(typeof v) || (Array.isArray(v) && v.every(isEditData)) || (v instanceof Map && [...v].every(([k, x]) => typeof k === 'string' && isEditData(x)));
const steps = (path) => {
  if (typeof path !== 'string') throw new TypeError(`a path is a string, not ${typeof path}`);
  if (path === '') return [];
  if (!path.startsWith('/') || /~(?![01])/.test(path)) return undefined;
  return path.slice(1).split('/').map((s) => s.replaceAll('~1', '/').replaceAll('~0', '~'));
};
const refuse = (code, reason) => ({ ok: false, code, reason });

/** Whether a token already holds `v`, by meaning: `1.0` holds 1, an integer holds a whole number given as a number or a bigint, an enumeration holds its name, a reference its own text. */
const agree = (n, v) => {
  if (Array.isArray(v)) return n.kind === 'list' && n.members.length === v.length && v.every((x, i) => agree(n.members[i], x));
  if (v instanceof Map) return n.kind === 'typed' && v.size === 1 && v.has(n.keyword) && agree(n.inner, v.get(n.keyword));
  const old = n.value;
  if (typeof v === 'number' || typeof v === 'bigint') return (n.kind === 'real' || n.kind === 'integer') && old == v && Object.is(Number(old), Number(v));
  return old === v;
};
const holdsReference = (n) => n.kind === 'reference' || (n.kind === 'list' && n.members.some(holdsReference)) || (n.kind === 'typed' && holdsReference(n.inner));

/** A value's bytes, or the refusal. The old token decides where the value's own type cannot: a number over an integer is an integer, a string over an enumeration is an enumeration. */
const spell = (v, old) => {
  if (v === null) return '$';
  if (typeof v === 'boolean') return v ? '.T.' : '.F.';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return refuse('edit-unrepresentable', 'STEP has no infinity and no NaN');
    if (old?.kind !== 'integer') return real(v);
    return Number.isInteger(v) ? String(BigInt(v)) : refuse('edit-unrepresentable', `${v} has a fraction, and the old value is an integer`);
  }
  if (typeof v === 'bigint') return old?.kind === 'real' ? real(Number(v)) : String(v);
  if (typeof v === 'string') {
    if (old?.kind !== 'enumeration') return string(v);
    return NAME.test(v) ? `.${v}.` : refuse('edit-unrepresentable', `${JSON.stringify(v)} is not an enumeration's name`);
  }
  if (Array.isArray(v)) {
    const out = [];
    for (const [i, x] of v.entries()) {
      const o = old?.kind === 'list' ? old.members[i] : undefined;
      const s = o && agree(o, x) ? o.source : spell(x, o); // a member that keeps its value keeps its bytes
      if (typeof s !== 'string') return s;
      out.push(s);
    }
    return `(${out.join(',')})`;
  }
  const [[k, x]] = v.size === 1 ? v : [['']];
  if (!NAME.test(k)) return refuse('edit-unrepresentable', 'a typed value is a Map of one entry whose key is a keyword');
  const s = spell(x, old?.kind === 'typed' && old.keyword === k ? old.inner : undefined);
  return typeof s === 'string' ? `${k}(${s})` : s;
};

/**
 * @param {{ claims?: (location: string) => boolean }} [options]
 */
export function stepWriter({ claims = (location) => /\.(ifc|stp|step|p21)$/i.test(location) } = {}) {
  return {
    claims,
    open(bytes) {
      let all;
      try { all = instances(bytes); } catch (e) { return refuse('open-unreadable', e.message); }
      const byNumber = new Map(all.map((i) => [`#${i.number}`, i]));
      // A path's target: the file, an instance, a value, or the refusal.
      const find = (path) => {
        const s = steps(path);
        if (s === undefined) return refuse('path-malformed', `${JSON.stringify(path)} is not a JSON Pointer`);
        if (s.length === 0) return { from: 0, to: bytes.length, whole: 'the file' };
        const instance = byNumber.get(s[0]);
        if (!instance) return refuse('edit-target-absent', `no instance ${JSON.stringify(s[0])}`);
        if (s.length === 1) return { from: instance.from, to: instance.to, whole: 'an instance' };
        if (!instance.attributes) return refuse('instance-complex', `${s[0]} is a complex instance: located, not entered`);
        let n = { kind: 'list', members: instance.attributes };
        for (const step of s.slice(1)) {
          n = n.kind === 'list' && INDEX.test(step) ? n.members[Number(step)] : n.kind === 'typed' && step === n.keyword ? n.inner : undefined;
          if (!n) return refuse('edit-target-absent', `${JSON.stringify(path)} names no value`);
        }
        return n;
      };
      return {
        ok: true,
        document: {
          locate(path) {
            const t = find(path);
            return t.ok === false ? t : { ok: true, start: t.from, end: t.to };
          },
          write(path, value) {
            if (!isEditData(value)) throw new TypeError('a value is EditData: a scalar, an array or a Map, never a plain object');
            const t = find(path);
            if (t.ok === false) return t;
            if (t.whole) return refuse('edit-unrepresentable', `${t.whole} is located, not written: write one of its values`);
            const splice = (out) => ({ ok: true, edit: { start: t.from, end: t.to, bytes: encoder.encode(out) } });
            if (agree(t, value)) return splice(t.source);
            if (holdsReference(t)) return refuse('reference-fixed', 'a reference is the model\'s structure: it is changed by the tool that owns the model');
            if (t.kind === 'derived') return refuse('edit-unrepresentable', 'a derived attribute (*) holds no value of its own');
            const out = spell(value, t);
            if (typeof out !== 'string') return out;
            // Read the new bytes with the member's own reader before answering.
            let back;
            try { back = instances(encoder.encode(`DATA;#1=X(${out});ENDSEC;`))[0].attributes; } catch { /* refused below */ }
            if (back?.length !== 1 || !agree(back[0], value)) return refuse('edit-read-back', `${out} would not read back as the value given`);
            return splice(out);
          }
        }
      };
    }
  };
}
