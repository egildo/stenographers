// The layer sweep: the stenographers import only each other and the Markdown parse's packages (mdast-util-*, micromark-*); nothing of ProseMirror, BelType, Provenance or any host. A host's own (its document, its schema, its files) is the caller's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '../src');
const allowed = (spec) => /^\.\/[\w-]+\.js$/.test(spec) || /^(mdast-util|micromark)-[\w-]+$/.test(spec);

test('every import in src/ is a sibling or a package of the Markdown parse', () => {
  const bad = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    for (const [, spec] of fs.readFileSync(path.join(dir, file), 'utf8').matchAll(/^\s*(?:import|export)\b[^'"]*?from\s+['"]([^'"]+)['"]/gm)) if (!allowed(spec)) bad.push(`${file}: ${spec}`);
  }
  assert.deepEqual(bad, []);
});
