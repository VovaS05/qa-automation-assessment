const { spawnSync } = require('node:child_process');
const { accessSync, constants, existsSync, readFileSync } = require('node:fs');
const { createServer } = require('node:http');
const { networkInterfaces } = require('node:os');

const output = '/tmp/qa-bonus-output';
const playwright = 'node_modules/@playwright/test/cli.js';
const testArgs = [playwright, 'test', '--config', 'playwright.config.ts'];

if (process.argv[2] === 'serve') {
  const assets = new Map(Object.entries(JSON.parse(readFileSync('snapshot/assets.json', 'utf8'))));
  createServer((req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    const type = assets.get(pathname);
    const route = pathname === '/' || /^\/[a-z-]+\.html$/.test(pathname);
    if (!type && !route) {
      res.writeHead(404).end();
      return;
    }
    const file = type ? `snapshot${pathname}` : 'snapshot/index.html';
    res.writeHead(200, {
      'Content-Type': type ?? 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'",
    }).end(readFileSync(file));
  }).listen(4173, '127.0.0.1');
} else {
  const result = {
    typecheck: 'not run',
    discovery: 'not run',
    execution: 'not run',
  };

  function run(args) {
    return spawnSync(process.execPath, args, {
      encoding: 'utf8', timeout: 45_000, maxBuffer: 2 * 1024 * 1024,
    });
  }

  function finish(code) {
    console.log(JSON.stringify(result));
    process.exitCode = code;
  }

  function testCount(suites) {
    return suites.reduce((sum, suite) => (
      sum + (suite.specs ?? []).reduce((count, spec) => count + spec.tests.length, 0) +
      testCount(suite.suites ?? [])
    ), 0);
  }

  function validateAndRun() {
    let suiteWritable = true;
    try {
      accessSync('/suite', constants.W_OK);
    } catch {
      suiteWritable = false;
    }
    result.isolation = {
      uid: process.getuid(),
      loopbackOnly: Object.values(networkInterfaces()).flat().every(address => address.internal),
      suiteWritable,
      gitPresent: existsSync('/suite/.git'),
      credentialVariables: Object.keys(process.env).filter(name => /token|api_key|password|secret/i.test(name)),
    };
    if (!result.isolation.uid || !result.isolation.loopbackOnly || suiteWritable ||
        result.isolation.gitPresent || result.isolation.credentialVariables.length) {
      result.diagnostics = 'The sandbox invariant check failed.';
      return finish(6);
    }

    const checked = run(['node_modules/typescript/bin/tsc', '-p', 'generated-tsconfig.json']);
    result.typecheck = checked.status === 0 ? 'passed' : 'failed';
    if (checked.status !== 0) {
      result.diagnostics = [checked.stdout, checked.stderr, checked.error?.message].filter(Boolean).join('\n');
      return finish(4);
    }

    const listed = run([...testArgs, '--list', '--reporter=json']);
    const count = listed.status === 0 ? testCount(JSON.parse(listed.stdout).suites) : 0;
    result.discovery = { expected: 1, actual: count };
    if (count !== 1) {
      result.diagnostics = [listed.stdout, listed.stderr, listed.error?.message].filter(Boolean).join('\n');
      return finish(4);
    }

    const executed = run(testArgs);
    const execution = { status: 'unverified', exitCode: executed.status };
    result.execution = execution;
    const reportFile = `${output}/playwright.json`;
    try {
      const { suites, stats } = JSON.parse(readFileSync(reportFile, 'utf8'));
      if (!Array.isArray(suites) || !stats ||
          !['expected', 'unexpected', 'flaky', 'skipped'].every(key => Number.isSafeInteger(stats[key]) && stats[key] >= 0)) {
        throw new Error('Expected Playwright suites and nonnegative integer test counts');
      }
      execution.stats = stats;
    } catch (error) {
      result.reportError = `Required Playwright JSON report is unavailable or invalid: ${error.message}`;
    }

    const diagnostics = [executed.stdout, executed.stderr, executed.error?.message].filter(Boolean).join('\n');
    if (executed.status === null || executed.error) {
      result.diagnostics = diagnostics || `Playwright process ended with signal ${executed.signal ?? 'unknown'}`;
      return finish(6);
    }
    if (executed.status === 0 && !execution.stats) return finish(6);

    const stats = execution.stats;
    const passed = executed.status === 0 && stats?.expected === 1 &&
      stats.unexpected === 0 && stats.flaky === 0 && stats.skipped === 0;
    execution.status = passed ? 'passed' : 'failed';
    if (!passed) {
      result.diagnostics = diagnostics || `Playwright ended with exit code ${executed.status} without one verified pass`;
    }
    finish(passed ? 0 : 5);
  }

  try {
    validateAndRun();
  } catch (error) {
    result.diagnostics = error.message;
    finish(6);
  }
}
