Observability demo (Prometheus, Grafana, Jaeger, Loki)

Overview
- This directory contains a small demo stack to collect metrics, traces, and logs locally.
- Files:
  - `docker-compose.monitoring.yml` : brings up Prometheus, Jaeger, Grafana, Loki
  - `prometheus.yml` : Prometheus scraping config (edit targets as needed)
  - `grafana/provisioning/datasources/datasources.yml` : automatic Grafana datasources
  - `loki-config.yaml` : Loki minimal config

Quick start (Windows PowerShell)
1) Start the observability stack
   docker compose -f docker-compose.monitoring.yml up -d

2) Update `observability/prometheus.yml` targets if your services run on different ports.
   - On Windows Docker Desktop, use `host.docker.internal:<port>` so containers can scrape services running on the host.

3) Start the backend services in non-test mode (so tracing and metrics are active). For example (PowerShell):
   cd D:\cnpm\Cloud-Native-Food-Ordering-Delivery-System-main\auth
   set NODE_ENV=development; npm start

   Repeat for other services (order, restaurant, payment, notification, admin).

4) Generate some traffic (curl or browser):
   curl http://localhost:5001/health
   curl http://localhost:5001/api/auth/login -d '{"email":"x","password":"y"}' -H "Content-Type: application/json"

5) Check the UIs:
   - Jaeger UI: http://localhost:16686 — search for service traces
   - Prometheus: http://localhost:9090 — query metrics (e.g., `http_request_duration_seconds_count`)
   - Grafana: http://localhost:3000 (admin/admin) — Prometheus & Jaeger datasources auto-provisioned
   - Loki: http://localhost:3100 (use Grafana Explore to query logs)

Notes & tips
- Prometheus scrapes the example list `host.docker.internal:5001` etc. If you run services in containers, change targets to container:port or add service discovery.
- To see `trace_id` in logs, ensure the services are logging structured JSON and include the trace id field (the shared logging module attempts to add this when tracing is active).
- If you prefer a lighter setup, you can run only Jaeger and Prometheus.

Next steps
- Create a Grafana dashboard to visualize key metrics (request rates, error rates, latency percentiles).
- Add Prometheus alerting rules for service down / high error rate / high latency.
- Add promtail or a log shipper to collect stdout logs into Loki automatically.
