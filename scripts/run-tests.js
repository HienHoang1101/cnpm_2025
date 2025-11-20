#!/usr/bin/env node
// Small orchestrator to run tests across services
// Usage: node scripts/run-tests.js --mode=parallel|serial [--ci]

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const services = [
  'admin-service',
  'auth',
  'order',
  'payment-service',
  'notification-service',
  'restaurant',
  'food-delivery-server'
];

const argv = require('minimist')(process.argv.slice(2));
// Ensure minimist is present: if not, provide a tiny fallback
try {
  require.resolve('minimist');
} catch (e) {
  console.warn('minimist not installed in root; using simple parser');
}
const mode = argv.mode || 'serial';
const isCI = argv.ci || false;

function runCmd(cmd, cwd) {
  return new Promise((resolve) => {
    const p = exec(cmd, { cwd }, (err, stdout, stderr) => {
      resolve({ err, stdout, stderr });
    });
    p.stdout && p.stdout.pipe(process.stdout);
    p.stderr && p.stderr.pipe(process.stderr);
  });
}

(async function main() {
  console.log('Running tests mode=', mode, 'ci=', isCI);
  if (mode === 'parallel') {
    const proms = services.map((s) => {
      const full = path.join(process.cwd(), s);
      if (!fs.existsSync(full) || !fs.existsSync(path.join(full, 'package.json'))) {
        console.log('Skipping', s, '- no package.json');
        return Promise.resolve({ service: s, skipped: true });
      }
      const cmd = isCI ? 'npm run test:ci' : 'npm test';
      console.log('Starting', s, cmd);
      return runCmd(cmd, full).then((res) => ({ service: s, res }));
    });
    const results = await Promise.all(proms);
    let failed = 0;
    results.forEach((r) => {
      if (r.skipped) return;
      if (r.res.err) {
        console.error('Service failed:', r.service);
        failed++;
      }
    });
    process.exit(failed > 0 ? 1 : 0);
  }

  // serial
  for (const s of services) {
    const full = path.join(process.cwd(), s);
    if (!fs.existsSync(full) || !fs.existsSync(path.join(full, 'package.json'))) {
      console.log('Skipping', s, '- no package.json');
      continue;
    }
    const cmd = isCI ? 'npm run test:ci' : 'npm test';
    console.log('\n== Running', s, cmd, '==');
    // eslint-disable-next-line no-await-in-loop
    const res = await runCmd(cmd, full);
    if (res.err) {
      console.error('Tests failed for', s);
      process.exit(1);
    }
  }
  process.exit(0);
})();
