// Creates placeholder coverage & test result artifacts for services without tests yet
// Usage: node scripts/create-empty-coverage.js
const fs = require('fs');
const path = require('path');

const services = [
  'auth', 'order', 'restaurant', 'payment-service', 'notification-service', 'admin-service', 'food-delivery-server'
];

services.forEach(svc => {
  const root = path.join(process.cwd(), svc);
  if (!fs.existsSync(root)) return;
  const covDir = path.join(root, 'coverage');
  const junitDir = path.join(process.cwd(), 'test-results', svc);
  const logsDir = path.join(process.cwd(), 'test-logs');
  fs.mkdirSync(covDir, { recursive: true });
  fs.mkdirSync(junitDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(path.join(covDir, 'coverage-summary.json'), JSON.stringify({ total: { lines: { pct: 0 }, statements: { pct: 0 }, functions: { pct: 0 }, branches: { pct: 0 } } }, null, 2));
  fs.writeFileSync(path.join(junitDir, 'junit.xml'), '<?xml version="1.0"?><testsuite name="'+svc+'" tests="0" failures="0" />');
  fs.writeFileSync(path.join(logsDir, `${svc}.txt`), `No tests for ${svc} yet`);
});

console.log('Placeholder coverage & test results created for services without tests.');