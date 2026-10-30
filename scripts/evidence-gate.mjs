const expected = { step5:10,'step5-tray-failure':2,'step5-recovery':4,'step5-future':4,security: 19, clipboard: 5, network: 5, offline: 4 };
const offlineSkipped = new Set(['Chromium external sockets', 'Windows descendant process/TCP query']);
export function validateEvidence(suite, report) {
  if (!Object.hasOwn(expected, suite) || !Array.isArray(report?.results) || report.results.length !== expected[suite]) throw new Error('Incomplete evidence');
  const names = new Set();
  for (const result of report.results) {
    if (!result || typeof result.name !== 'string' || !result.name || names.has(result.name)) throw new Error('Invalid evidence entry');
    names.add(result.name);
    if (result.status !== 'passed' && !(suite === 'offline' && offlineSkipped.has(result.name) && result.status === 'not-executed')) throw new Error('Evidence did not pass');
  }
}
export function evidenceExitCode(code, timedOut, evidenceValid) {
  return code === 0 && !timedOut && evidenceValid ? 0 : 1;
}
