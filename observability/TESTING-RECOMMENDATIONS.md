# Code Assessment & Test-Case Recommendations

This document captures a concise code assessment and prioritized test-case recommendations for the FastFood Delivery project. The instructor emphasized that monitoring is the most important part; tests should complement observability and validate core flows.

## High-level assessment
- Languages & frameworks: Node.js (mix of ESM and CommonJS), Express, Mongoose, Kafka (kafkajs).
- Observability: Health/readiness, `/metrics` (prom-client) and tracing (OpenTelemetry) have been implemented across services.
- Tests: Unit tests exist for several services (Jest + Supertest). Integration smoke-tests exist in `observability/integration/`.
- CI: A GitHub Action workflow was added to start the monitoring stack, run unit tests per service, and run the integration smoke-tests. It includes caching and log upload on failure.

Key risks and gaps
- Inconsistent test scripts across services (ESM vs CommonJS). This was mitigated by using `node --experimental-vm-modules` where needed, but it's fragile.
- Some services skip heavy init in tests via `NODE_ENV=test` guards — good for unit tests but integration tests must run the full stack or use realistic mocks.
- Integration tests currently use `localhost` ports; CI may prefer compose service hostnames. Consider making the integration runner detect compose network or accept a `TARGET_HOST` override.
- Coverage: no repo-wide coverage measurement or thresholds exist yet.
- End-to-end flows: only best-effort functional checks exist (and are skipped when endpoints differ). Add canonical e2e scenarios for main user journeys.

## Prioritized testing roadmap (recommended order)
1. Stabilize and standardize unit testing across services (low effort, high value)
   - Add `test` script consistently (use `node --experimental-vm-modules ./node_modules/jest/bin/jest.js --runInBand` for ESM services or keep Jest config that supports ESM).
   - Add one or two canonical unit tests per service for core modules (controllers, service logic, data mappers, and error paths).
2. Add repo-level orchestrator for unit tests
   - Add top-level `package.json` scripts: `test:unit`, `test:ci`, `test:all` which run tests across all packages (serial or parallel matrix in CI).
3. Coverage & quality gates
   - Add `jest --coverage` run in CI and publish coverage reports (coveralls or codecov) and enforce a baseline (e.g., 60% branch, 70% line initially).
4. Strengthen integration tests
   - Expand `observability/integration/run-integration-tests.js` into a small test harness that can run composition scenarios (happy path: create user -> place order -> payment -> notification).
   - Use mocked external systems where appropriate (mongodb-memory-server, kafka test doubles, or lightweight in-memory stubs) for deterministic runs in CI.
5. End-to-end tests (selectively)
   - Add smoke E2E flows that require the full stack (run via Docker Compose in CI with a dedicated job). Use Docker networks and container hostnames to avoid host.docker.internal issues on GitHub runners.
6. Observability tests
   - Add tests asserting that `/metrics` returns expected metric names after performing operations (e.g., request counters increment).
   - Add a Grafana dashboard provisioning test in CI to ensure dashboards load (optional, low priority).

## Per-service recommended test cases (example list)

General guidance for each test: prefer unit tests for logic, integration tests for cross-service behavior, and e2e for full workflows.

- Auth service
  - Unit: validate token generation + validation logic (including expiry, malformed tokens).
  - Unit: input validation on login/register controllers (bad input => 400).
  - Integration: login flow returns session token; protected endpoint rejects missing token.

- Order service
  - Unit: pricing & validation logic for order creation (edge cases: empty items, invalid restaurantId).
  - Integration: create order -> order persisted -> `/health` includes DB status.
  - Integration: event emission to Kafka on order created (verify `shared-kafka` producer invoked or use test double).

- Payment service
  - Unit: payment processor adapter with mocked gateway responses (success, failure, timeout).
  - Integration: payment callback updates order status; emits notification event.

- Notification service
  - Unit: email/SMS payload generation, retry/backoff logic, and queue/consumer loop handling.
  - Integration: send notification endpoint triggers expected log entry and increments metric.

- Restaurant / Admin / Delivery services
  - Unit: route handlers and business logic; important validations.
  - Integration: main flows (e.g., restaurant accepts order, delivery assigned) using lightweight mocks.

- shared-kafka
  - Unit: verify producer/consumer code robustly handles network errors and message schema issues.

## Test patterns & utilities to add
- Use `mongodb-memory-server` for tests requiring MongoDB to avoid starting a full DB in unit test runs (already present in some devDeps).
- For Kafka, either:
  - Use a lightweight in-memory fake (mock the `shared-kafka` module) for unit/integration tests, or
  - Use Testcontainers (heavier) in CI for full integration tests.
- Add a `test-utils` library in repo (or `observability/test-utils`) to centralize:
  - Express app loader that initializes app without starting listeners.
  - Test doubles for `shared-tracing` and `shared-logging` so logs/traces don't blow up tests.
  - Helper to reset metrics registry between tests: `register.clear()`.

## CI test improvements (recommended)
- Add `actions/cache` per-service (we already added a repo-level cache). Fine-tune keys to avoid frequent cache misses.
- Add `jest-junit` in services and upload JUnit XML artifacts for test reporting in Actions.
- Add a `test:ci` script per-service that runs `jest --runInBand --reporters=default --reporters=jest-junit --outputFile=...` so CI collects reports.
- Make integration jobs use service hostnames and Docker Compose networks; avoid `host.docker.internal` in CI.

## Example unit test templates (Jest)

Auth controller example (tests/auth.controller.test.js):
```javascript
process.env.NODE_ENV = 'test';
import request from 'supertest';
import app from '../index.js';

test('POST /api/auth/login returns 400 for missing fields', async () => {
  const res = await request(app).post('/api/auth/login').send({});
  expect(res.status).toBe(400);
});
```

Order unit test (services/order.test.js):
```javascript
import { calculateTotal } from '../../order/services/pricing.js';

test('calculateTotal handles empty items', () => {
  expect(calculateTotal([])).toBe(0);
});
```

Integration smoke example (observability/integration): the repo already contains `run-integration-tests.js`. Extend it with stricter flows and set `INTEGRATION_STRICT=true` in CI once endpoints are stable.

## Coverage targets & thresholds
- Start with conservative thresholds and raise over time:
  - Lines: 65%
  - Functions: 60%
  - Branches: 50%
- Fail CI when coverage drops below thresholds; show detailed reports.

## Quick commands & runbook
- Run unit tests for all services locally (example):
```powershell
cd <repo-root>
cd admin-service; npm test
cd ../auth; npm test
# or a root script (to create) that runs them serially
```
- Run integration smoke tests locally:
```powershell
node observability/integration/run-integration-tests.js
```

## Next actionable items I can implement for you
1. Add a repo-level `package.json` with `test:all`, `test:ci`, and coverage scripts.
2. Add `jest-junit` and configure per-service `test:ci` and update CI to upload test reports.
3. Add coverage reporting (nyc/jest) and enforce thresholds in CI.
4. Implement one full E2E happy-path flow (auth -> create order -> payment -> notification) using test doubles or Docker Compose test environment.

Tell me which of the next actionable items you want me to implement first, and I'll add the required files and update CI accordingly.
