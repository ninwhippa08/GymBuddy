// Mutation testing, for guards that pass and prove nothing.
//
// WHY THIS EXISTS. This project keeps writing tests that pass for the wrong
// reason, and the pattern is always the same: the fixture cannot tell the rule
// under test from a WRONG rule that happens to agree with it on that input.
// Four of the seven tasks in plan-09 shipped a test like that, and each was
// found the same way -- break the rule on purpose and see whether anything
// notices. If nothing does, the test is decoration.
//
// It is a script, not a test. Run it by hand while writing a guard; nothing in
// `node --test tests/*.test.mjs` invokes it. That is deliberate -- it edits
// source files, and a suite that rewrites the code it is testing is a suite
// nobody can trust.
//
// TWO GUARDS THE SHELL VERSION TAUGHT US, both of which produced a false
// "survived" before they existed:
//
//   1. THE MUTATION MUST ACTUALLY APPLY. `sed` silently failed on braces in a
//      destructuring filter and reported the run as a pass -- which reads
//      exactly like a surviving mutant, and sent us looking for a missing test
//      that was never missing. A mutation that did not apply proves nothing,
//      so an absent target is an error, never a result.
//   2. THE CONTROL MUST BE GREEN FIRST. If the suite is already failing, every
//      mutant "dies" for a reason that has nothing to do with the mutation,
//      and the whole run is noise that looks like success.
//
// The verdict reads node's EXIT CODE, not its summary line: the summary is
// printed with a non-ASCII marker that does not survive subprocess capture on
// Windows, and a mangled parse is indistinguishable from a surviving mutant.
//
// USAGE
//
//   One mutant:
//     node tests/mutate.mjs <source> <testfile> <target> <replacement> [label]
//
//   Several against one file, with the control run once:
//     node tests/mutate.mjs <manifest.json>
//
//   where the manifest is
//     { "source": "js/generator.js",
//       "test":   "tests/superset.test.mjs",
//       "mutants": [ { "label": "...", "target": "...", "replacement": "..." } ] }
//
//   Multi-line targets are why the manifest form exists: shell quoting mangles
//   them, JSON does not.
//
// Exits 0 when every mutant was killed, 1 when any survived, 2 when the run
// itself was invalid (target absent, control red, bad arguments) -- so a
// broken run can never be mistaken for a clean one.

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const KILLED = 'KILLED';
const SURVIVED = '*** SURVIVED ***';

function runTests(testPath) {
  // NODE_TEST_CONTEXT MUST BE STRIPPED. When `node --test` is spawned from
  // inside a test process it inherits this variable, decides it is a child of
  // a running test run, reports its results over IPC to the parent -- and
  // EXITS 0 whether or not anything failed. Inherited, every mutant reads as
  // survived, which is the precise false negative this whole script exists to
  // prevent. Found by the helper's own tests, which are of course themselves a
  // test process.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;

  // stdio ignored on purpose: a killed mutant prints a wall of assertion
  // failures that are expected and say nothing. The exit code is the result.
  return spawnSync(process.execPath, ['--test', testPath], { stdio: 'ignore', env }).status;
}

// Apply one mutation, run the tests, and put the file back whatever happens.
// The restore is in `finally` because leaving mutated source on disk is the
// one failure mode of this script that could reach a commit.
export function runMutant({ sourcePath, testPath, target, replacement, label,
                            run = runTests }) {
  const original = readFileSync(sourcePath);
  const text = original.toString('utf8');

  if (!text.includes(target)) {
    return { label, status: 'not-applied' };
  }
  const occurrences = text.split(target).length - 1;

  try {
    writeFileSync(sourcePath, Buffer.from(text.replace(target, replacement), 'utf8'));
    const code = run(testPath);
    return {
      label,
      status: code === 0 ? 'survived' : 'killed',
      occurrences
    };
  } finally {
    writeFileSync(sourcePath, original);
  }
}

function report(r) {
  if (r.status === 'not-applied') {
    console.log(`MUTANT ${String(r.label).padEnd(50)} -> DID NOT APPLY (target text absent)`);
    return;
  }
  const verdict = r.status === 'killed' ? KILLED : SURVIVED;
  const note = r.occurrences > 1 ? `  (matched ${r.occurrences}x, mutated the first)` : '';
  console.log(`MUTANT ${String(r.label).padEnd(50)} -> ${verdict}${note}`);
}

function main(argv) {
  let source, testPath, mutants;

  if (argv.length === 1 && argv[0].endsWith('.json')) {
    const manifest = JSON.parse(readFileSync(argv[0], 'utf8'));
    ({ source, test: testPath, mutants } = manifest);
    if (!source || !testPath || !Array.isArray(mutants) || !mutants.length) {
      console.error('manifest needs "source", "test" and a non-empty "mutants" array');
      return 2;
    }
  } else if (argv.length >= 4) {
    const [src, tst, target, replacement, label] = argv;
    source = src;
    testPath = tst;
    mutants = [{ target, replacement, label: label || target.slice(0, 40) }];
  } else {
    console.error('usage: node tests/mutate.mjs <source> <test> <target> <replacement> [label]');
    console.error('   or: node tests/mutate.mjs <manifest.json>');
    return 2;
  }

  // Guard 2. Without this every mutant dies for the wrong reason and the run
  // looks like a clean sweep.
  const control = runTests(testPath);
  if (control !== 0) {
    console.error(`CONTROL FAILED: ${testPath} does not pass unmutated (exit ${control}).`);
    console.error('Every mutant would "die" for a reason unrelated to the mutation.');
    return 2;
  }
  console.log(`control: ${testPath} passes clean\n`);

  let survived = 0;
  let notApplied = 0;
  for (const m of mutants) {
    const r = runMutant({ sourcePath: source, testPath, ...m });
    report(r);
    if (r.status === 'survived') survived++;
    if (r.status === 'not-applied') notApplied++;
  }

  console.log('');
  if (notApplied) {
    console.error(`${notApplied} mutant(s) never applied -- those rules are UNTESTED, not passing.`);
    return 2;
  }
  if (survived) {
    console.error(`${survived} mutant(s) survived. Suspect the FIXTURE before the rule: `
      + 'it probably cannot tell the real rule from the broken one.');
    return 1;
  }
  console.log(`all ${mutants.length} mutant(s) killed`);
  return 0;
}

// Only when run directly, never on import -- the tests import runMutant.
if (process.argv[1] && process.argv[1].endsWith('mutate.mjs')) {
  process.exit(main(process.argv.slice(2)));
}
