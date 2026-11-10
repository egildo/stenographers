// The STEP writer over a file IfcOpenShell wrote and one written by hand: what each edit changes, in exact bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stepWriter, instances, real, string } from '../src/writer.js';

const dir = path.resolve(import.meta.dirname, '../fixtures');
const decoder = new TextDecoder();
const bytesOf = (file) => fs.readFileSync(`${dir}/${file}`);
const textOf = (file) => decoder.decode(bytesOf(file));

/** The file's text after the writes, each a [path, value], or the first refusal. */
function after(file, ...writes) {
  const bytes = bytesOf(file), doc = stepWriter().open(bytes).document;
  const edits = [];
  for (const [p, v] of writes) { const r = doc.write(p, v); if (!r.ok) return r; edits.push(r.edit); }
  let out = bytes;
  for (const { start, end, bytes: b } of edits.sort((a, b) => b.start - a.start)) out = new Uint8Array([...out.subarray(0, start), ...b, ...out.subarray(end)]);
  return decoder.decode(out);
}
const code = (file, p, v) => after(file, [p, v]).code;

test('two values of one instance, as IfcOpenShell wrote the same edit', () => {
  assert.equal(
    after('native.ifc', ['/#19/2/IFCREAL', 2160.1], ['/#19/1', 'più alto, l\'architrave']),
    textOf('native.ifc').replace("#19=IFCPROPERTYSINGLEVALUE('Head',$,IFCREAL(2100.),$);", "#19=IFCPROPERTYSINGLEVALUE('Head','pi\\X2\\00F9\\X0\\ alto, l''architrave',IFCREAL(2160.0999999999999),$);"));
});

test('reals as IfcOpenShell 0.8.5 spells them', () => {
  const table = [
    [0, '0.'], [-0, '-0.'], [1, '1.'], [2150, '2150.'], [-2150.5, '-2150.5'],
    [0.1, '0.10000000000000001'], [0.3, '0.29999999999999999'], [4.35, '4.3499999999999996'],
    [0.1 + 0.2, '0.30000000000000004'], [1 / 3, '0.33333333333333331'],
    [0.5, '0.5'], [123456.789, '123456.789'], [0.0001, '0.0001'], [0.000123, '0.00012300000000000001'],
    [1e-5, '1.0000000000000001E-05'], [1.5e-5, '1.5E-05'], [1e-7, '9.9999999999999995E-08'], [1e-10, '1.E-10'],
    [1e15, '1000000000000000.'], [1e16, '10000000000000000.'], [9999999999999998, '9999999999999998.'],
    [1e17, '1.E+17'], [1.5e17, '1.5E+17'], [1e22, '1.E+22'], [1e100, '1.E+100'],
    [999999999999999.9, '999999999999999.88'],
    [5e-324, '4.9406564584124654E-324'], [1.7976931348623157e308, '1.7976931348623157E+308'],
    [1125899906842624.25, '1125899906842624.2'], // a tie: C rounds it to even, toPrecision rounds it up
    [0.017453292519943295, '0.017453292519943295'],
  ];
  for (const [x, written] of table) assert.equal(real(x), written);
  assert.equal(real(Infinity), undefined);
  assert.equal(real(NaN), undefined);
});

test('strings as IfcOpenShell 0.8.5 spells them', () => {
  const table = [
    ["it's", "'it''s'"], ['a\\b', "'a\\\\b'"], ['', "''"],
    ['caffè', "'caff\\X2\\00E8\\X0\\'"], ['àèìòù', "'\\X2\\00E000E800EC00F200F9\\X0\\'"],
    ['x€y€z', "'x\\X2\\20AC\\X0\\y\\X2\\20AC\\X0\\z'"],
    ['😀', "'\\X4\\0001F600\\X0\\'"], ['é😀é', "'\\X4\\000000E90001F600000000E9\\X0\\'"],
    ['\n', "'\\X2\\000A\\X0\\'"], ['\t', "'\\X2\\0009\\X0\\'"], ['\x7f', "'\\X2\\007F\\X0\\'"],
    ['\\X2\\', "'\\\\X2\\\\'"],
  ];
  for (const [s, written] of table) {
    assert.equal(string(s), written);
    assert.equal(after('native.ifc', ['/#14/2', s]), textOf('native.ifc').replace("'Muro dell''ingresso'", written)); // and each reads back, or the write would be refused
  }
});

test('the old token decides where the value\'s own type cannot', () => {
  const text = textOf('native.ifc');
  assert.equal(after('native.ifc', ['/#18/8', 2150n]), text.replace(',2100.,800.,', ',2150.,800.,')); // a bigint over a real is a real
  assert.equal(after('native.ifc', ['/#22/2/IFCINTEGER', 2]), text.replace('IFCINTEGER(1)', 'IFCINTEGER(2)')); // a whole number over an integer is an integer
  assert.equal(code('native.ifc', '/#22/2/IFCINTEGER', 1.5), 'edit-unrepresentable');
  assert.equal(after('native.ifc', ['/#18/10', 'DOUBLE_DOOR']), text.replace('.DOOR.,', '.DOUBLE_DOOR.,')); // a string over an enumeration is one
  assert.equal(code('native.ifc', '/#18/10', 'a door'), 'edit-unrepresentable');
  assert.equal(code('native.ifc', '/#18/10', 'T'), 'edit-read-back'); // .T. reads as true, not as the name T
  assert.equal(after('native.ifc', ['/#18/3', 'DOOR']), text.replace("'Porta',$,$,", "'Porta','DOOR',$,")); // and no enumeration where there was none
  assert.equal(after('native.ifc', ['/#18/3', 12]), text.replace("'Porta',$,$,", "'Porta',12.,$,"));
  assert.equal(after('native.ifc', ['/#18/3', 12n]), text.replace("'Porta',$,$,", "'Porta',12,$,"));
  assert.equal(code('native.ifc', '/#18/8', Infinity), 'edit-unrepresentable');
  assert.equal(code('native.ifc', '/#18/8', 2n ** 80n + 1n), 'edit-read-back'); // no double holds it
});

test('a typed value is a Map of one entry, with its own step', () => {
  const text = textOf('native.ifc');
  assert.equal(after('native.ifc', ['/#19/2/IFCREAL', 2160]), text.replace('IFCREAL(2100.)', 'IFCREAL(2160.)'));
  assert.equal(after('native.ifc', ['/#19/2', new Map([['IFCLENGTHMEASURE', 2160]])]), text.replace('IFCREAL(2100.)', 'IFCLENGTHMEASURE(2160.)'));
  assert.equal(after('native.ifc', ['/#26/2', new Map([['IFCBOOLEAN', true]])]), text.replace("'Empty',$,$,$", "'Empty',$,IFCBOOLEAN(.T.),$"));
  assert.equal(after('native.ifc', ['/#26/2', new Map([['IFCINTEGER', -12n]])]), text.replace("'Empty',$,$,$", "'Empty',$,IFCINTEGER(-12),$"));
  assert.equal(after('native.ifc', ['/#27/2/1/IFCLABEL', 'DEMOLISH']), text.replace("IFCLABEL('NEW')", "IFCLABEL('DEMOLISH')"));
  assert.equal(code('native.ifc', '/#26/2', new Map([['IFCREAL', 1], ['IFCLABEL', 'x']])), 'edit-unrepresentable');
  assert.equal(code('native.ifc', '/#26/2', new Map([['a label', 'x']])), 'edit-unrepresentable');
  assert.equal(code('native.ifc', '/#19/2/IFCLABEL', 'x'), 'edit-target-absent'); // the step is the type's keyword
});

test('a list is written whole or a member at a time; a member that keeps its value keeps its bytes', () => {
  assert.equal(after('native.ifc', ['/#15/0/1', 0.25]), textOf('native.ifc').replace('(1250.,0.10000000000000001,0.)', '(1250.,0.25,0.)'));
  assert.equal(after('native.ifc', ['/#15/0', [1250, 0.25]]), textOf('native.ifc').replace('(1250.,0.10000000000000001,0.)', '(1250.,0.25)'));
  assert.equal(after('awkward.ifc', ['/#1/0', [1, 0.1, 3]]), textOf('awkward.ifc').replace('( 1.0 , 0.1 , -2.5E0 )', '(1.0,0.1,3.)'));
  assert.equal(after('awkward.ifc', ['/#8/2', ['a', 'b']]), textOf('awkward.ifc').replace("'None',$,()", "'None',$,('a','b')"));
});

test('a file from another author keeps every byte but the value written', () => {
  const text = textOf('awkward.ifc');
  assert.equal(after('awkward.ifc', ['/#1/0/0', 1], ['/#1/0/1', 0.1]), text); // 1.0 and 0.1 are another tool's spellings, and stay
  assert.equal(after('awkward.ifc', ['/#1/0/0', 2]), text.replace('( 1.0 ,', '( 2. ,'));
  assert.equal(after('awkward.ifc', ['/#4/2', 'Muro']), text.replace("'Muro; con ) dentro' /* its name */", "'Muro' /* its name */"));
  assert.equal(after('awkward.ifc', ['/#7/2/IFCLABEL', 'y']), text.replace("IFCLABEL ( 'x' )", "IFCLABEL ( 'y' )"));
  assert.equal(after('awkward.ifc', ['/#3/0/0', 0.5]), text.replace('#3=IFCDIRECTION((1.,', '#3=IFCDIRECTION((0.5,'));
  assert.equal(after('awkward.ifc', ['/#10/2/IFCINTEGER', 3n]), text); // +3 holds 3
});

test('the reading: instances with their spans, kinds and values', () => {
  const all = instances(bytesOf('awkward.ifc'));
  assert.deepEqual(all.map((i) => i.number), [1, 2, 3, 4, 5, 6, 7, 8, 10]);
  const wall = all[3];
  assert.equal(wall.keyword, 'IFCWALL');
  assert.deepEqual(wall.attributes.map((a) => a.kind), ['string', 'unset', 'string', 'string', 'unset', 'reference', 'unset', 'string', 'enumeration']);
  assert.deepEqual(wall.attributes.map((a) => a.value), ['0dvG5wTAbTIfnsSIIejNpf', null, 'Muro; con ) dentro', 'caffè e tè', null, '#1', null, 'W-01', 'SOLIDWALL']);
  assert.equal(all[4].keyword, undefined); // a complex instance: a span, and nothing to enter
  assert.equal(all[4].attributes, undefined);
  assert.deepEqual(all[5].attributes.map((a) => a.value), [2n, 2n, 3n, true, false, 'RGB', null, null, undefined]); // a list of binaries has no value
  assert.deepEqual(all[0].attributes[0].value, [1, 0.1, -2.5]);
  const text = textOf('awkward.ifc');
  for (const i of all) { assert.equal(text[i.from], '#'); assert.equal(text[i.to - 1], ';'); }
  const native = instances(bytesOf('native.ifc'));
  assert.equal(native.length, 30);
  assert.deepEqual(native[26].attributes[2].value, [new Map([['IFCLABEL', 'EXISTING']]), new Map([['IFCLABEL', 'NEW']])]);
  assert.equal(native[13].attributes[3].value, 'Il muro più lungo: 4,35 m');
});

test('what is located and not written, and what is refused', () => {
  const bytes = bytesOf('awkward.ifc'), doc = stepWriter().open(bytes).document, text = textOf('awkward.ifc');
  const span = (p) => { const r = doc.locate(p); return r.ok ? text.slice(r.start, r.end) : r.code; };
  assert.equal(span(''), text);
  assert.equal(span('/#3'), '#3=IFCDIRECTION((1.,0.,0.));');
  assert.equal(span('/#1'), '#1 = IFCCARTESIANPOINT ( ( 1.0 , 0.1 , -2.5E0 ) ) ;');
  assert.equal(span('/#5'), '#5=(IFCLENGTHMEASURE(1.)IFCPOSITIVELENGTHMEASURE(1.));');
  assert.equal(span('/#7/2'), "IFCLABEL ( 'x' )");
  assert.equal(span('/#5/0'), 'instance-complex');
  assert.equal(span('/#9'), 'edit-target-absent');
  assert.equal(span('/#03'), 'edit-target-absent');
  assert.equal(span('/#3/0/3'), 'edit-target-absent'); // past the end
  assert.equal(span('/#3/0/0/0'), 'edit-target-absent'); // below a scalar
  assert.equal(span('/#4/5/0'), 'edit-target-absent'); // a reference is a leaf
  assert.equal(code('awkward.ifc', '', null), 'edit-unrepresentable');
  assert.equal(code('awkward.ifc', '/#3', null), 'edit-unrepresentable');
  assert.equal(code('awkward.ifc', '/#4/5', '#2'), 'reference-fixed');
  assert.equal(code('awkward.ifc', '/#4/5', null), 'reference-fixed');
  assert.equal(after('awkward.ifc', ['/#4/5', '#1']), text); // its own value is no change
  assert.equal(code('native.ifc', '/#28/4', []), 'reference-fixed'); // a list that holds one
  assert.equal(code('native.ifc', '/#6/0', null), 'edit-unrepresentable'); // derived
  assert.equal(after('awkward.ifc', ['/#6/8', null]), text.replace('("0FF0","1A")', '$')); // a binary is not written, and may be written over
});

test('what open refuses', () => {
  const open = (text) => stepWriter().open(new TextEncoder().encode(text));
  assert.equal(open('ISO-10303-21;\nHEADER;\nENDSEC;\nEND-ISO-10303-21;\n').code, 'open-unreadable'); // no DATA; section
  assert.equal(open("DATA;\n#1=A('open);\nENDSEC;\n").code, 'open-unreadable');
  assert.equal(open('DATA;\n#1=A(1); /* open\nENDSEC;\n').code, 'open-unreadable');
  assert.equal(open('DATA;\n#1=A(1);\n#1=B(2);\nENDSEC;\n').code, 'open-unreadable');
  assert.equal(open('DATA;\n#1=A(1);\nENDSEC;\nDATA;\n#2=B(2);\nENDSEC;\n').code, 'open-unreadable');
  assert.equal(open('DATA;\n#1=A(1);\n').code, 'open-unreadable'); // cut short
  assert.equal(open('DATA;\nENDSEC;\n').ok, true);
  assert.ok(stepWriter().claims('model/merello82.IFC') && stepWriter().claims('a.stp') && stepWriter().claims('a.step') && stepWriter().claims('a.p21') && !stepWriter().claims('a.ifcx'));
});
