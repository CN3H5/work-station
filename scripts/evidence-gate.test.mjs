import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEvidence, evidenceExitCode } from './evidence-gate.mjs';
const report = () => ({ results: Array.from({length: 5}, (_, i) => ({name: `check ${i}`, status: 'passed'})) });
test('missing, empty and truncated evidence cannot pass', () => {
  for (const value of [undefined, {}, {results: []}, {results: report().results.slice(1)}]) assert.throws(() => validateEvidence('clipboard', value));
  assert.equal(evidenceExitCode(0, false, false), 1);
});
test('failed, unknown and duplicate result entries cannot pass', () => {
  for (const status of ['failed', 'not-executed', 'unknown']) {
    const value = report(); value.results[0].status = status;
    assert.throws(() => validateEvidence('clipboard', value));
  }
  const duplicate = report(); duplicate.results[1].name = duplicate.results[0].name;
  assert.throws(() => validateEvidence('clipboard', duplicate));
});
test('offline skips are limited to declared network observations', () => {
  const value = {results: [{name:'interface',status:'passed'}, {name:'node',status:'passed'}, ...['Chromium external sockets','Windows descendant process/TCP query'].map(name=>({name,status:'not-executed'}))]};
  validateEvidence('offline', value);
  value.results[0].status = 'not-executed';
  assert.throws(() => validateEvidence('offline', value));
});
test('timeout or abnormal exit cannot be overwritten by successful evidence', () => {
  validateEvidence('clipboard', report());
  assert.equal(evidenceExitCode(0, false, true), 0);
  for (const code of [null, 1]) assert.equal(evidenceExitCode(code, false, true), 1);
  assert.equal(evidenceExitCode(0, true, true), 1);
});
