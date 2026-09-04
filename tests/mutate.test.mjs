// Guards for the mutation helper. tests/mutate.mjs.
//
// The helper edits source files on disk, so "it puts them back" is not a thing
// to take on trust -- a restore that failed would leave broken source in the
// working tree, and the next commit would carry it.
//
// Checked against throwaway fixtures in a temp directory rather than against
// this repository: a test that mutates js/generator.js to prove mutation works
// is one interrupted run away from committing a deliberate bug.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runMutant } from './mutate.mjs';

// A fixture pair: a source file with one number in it, and a test that pins
// that number. Mutating the number must break the test; mutating a comment
// must not.
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'gymbuddy-mutate-'));
  const sourcePath = join(dir, 'src.mjs');
  const testPath = join(dir, 'fix.test.mjs');
  writeFileSync(sourcePath,
    '// a comment nobody asserts on\nexport const answer = () => 42;\n');
  writeFileSync(testPath,
    "import { test } from 'node:test';\n" +
    "import assert from 'node:assert/strict';\n" +
    "import { answer } from './src.mjs';\n" +
    "test('answer is 42', () => { assert.equal(answer(), 42); });\n");
  return { dir, sourcePath, testPath };
}

test('a mutation that breaks the behaviour is reported killed', () => {
  const { dir, sourcePath, testPath } = fixture();
  try {
    const r = runMutant({
      sourcePath, testPath, target: '=> 42', replacement: '=> 43', label: 'answer changed'
    });
    assert.equal(r.status, 'killed');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a mutation nothing asserts on is reported survived', () => {
  const { dir, sourcePath, testPath } = fixture();
  try {
    const r = runMutant({
      sourcePath, testPath,
      target: 'a comment nobody asserts on',
      replacement: 'a different comment',
      label: 'comment changed'
    });
    assert.equal(r.status, 'survived');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Guard 1, the one sed got wrong. An absent target must be its own outcome --
// never a pass, and never a "survived", because both of those read as a
// statement about the tests when nothing was ever tested.
test('a target that is not in the file is not-applied, never survived', () => {
  const { dir, sourcePath, testPath } = fixture();
  try {
    const r = runMutant({
      sourcePath, testPath,
      target: 'text that does not appear anywhere',
      replacement: 'irrelevant',
      label: 'absent target'
    });
    assert.equal(r.status, 'not-applied');
    assert.notEqual(r.status, 'survived');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the source file is restored byte for byte', () => {
  const { dir, sourcePath, testPath } = fixture();
  try {
    const before = readFileSync(sourcePath);
    runMutant({ sourcePath, testPath, target: '=> 42', replacement: '=> 43', label: 'x' });
    assert.deepEqual(readFileSync(sourcePath), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The restore lives in a `finally`, so it has to survive the run THROWING --
// the case that would otherwise leave mutated source on disk and let the next
// commit carry a deliberate bug. Reached by injecting a runner that throws,
// which is why runMutant takes one.
test('the file is restored even when the test run itself blows up', () => {
  const { dir, sourcePath, testPath } = fixture();
  try {
    const before = readFileSync(sourcePath);
    assert.throws(() => runMutant({
      sourcePath, testPath, target: '=> 42', replacement: '=> 43', label: 'x',
      run: () => { throw new Error('spawn exploded'); }
    }), /spawn exploded/);
    assert.deepEqual(readFileSync(sourcePath), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The bug that made this helper's first run report every mutant as survived.
test('a nested run does not inherit the parent test context', () => {
  // This file IS a test process, so NODE_TEST_CONTEXT is set right now. If
  // runTests passed it down, the child would exit 0 on failure and the mutant
  // below would read as survived.
  assert.ok(process.env.NODE_TEST_CONTEXT !== undefined,
    'expected to be running inside node --test; this test proves nothing otherwise');
  const { dir, sourcePath, testPath } = fixture();
  try {
    const r = runMutant({
      sourcePath, testPath, target: '=> 42', replacement: '=> 43', label: 'nested'
    });
    assert.equal(r.status, 'killed');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('line endings survive the round trip', () => {
  // js/rules.js and js/generator.js are LF on disk while core.autocrlf is on.
  // A helper that rewrote them as CRLF would turn a one-line mutation into a
  // whole-file diff -- which has already cost this project a 2,500-line commit.
  const dir = mkdtempSync(join(tmpdir(), 'gymbuddy-mutate-crlf-'));
  const sourcePath = join(dir, 'src.mjs');
  const testPath = join(dir, 'fix.test.mjs');
  try {
    writeFileSync(sourcePath, 'export const answer = () => 42;\r\nexport const other = 1;\r\n');
    writeFileSync(testPath,
      "import { test } from 'node:test';\n" +
      "import assert from 'node:assert/strict';\n" +
      "import { answer } from './src.mjs';\n" +
      "test('answer is 42', () => { assert.equal(answer(), 42); });\n");
    const before = readFileSync(sourcePath);
    runMutant({ sourcePath, testPath, target: '=> 42', replacement: '=> 43', label: 'x' });
    assert.deepEqual(readFileSync(sourcePath), before);
    assert.ok(readFileSync(sourcePath, 'utf8').includes('\r\n'), 'CRLF was not preserved');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
