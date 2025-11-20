Observability Troubleshooting

This companion file documents common Loki and observability issues seen on Windows/dev machines and quick fixes.

1) Loki: "invalid schema config: boltdb-shipper works best with 24h periodic index config"
   - Fix: set `schema_config:
       index:
         period: 24h` in `loki-config.yaml` and restart Loki.

2) Loki: WAL / compactor permission errors (e.g., `mkdir wal: permission denied`)
   - Cause: host bind mounts on Windows can cause permissions/ownership mismatch.
   - Fix: use named Docker volumes (`loki-data`, `loki-wal`) as configured in `docker-compose.dev.yml` and run the included `reset-loki.ps1` to recreate volumes and expected directories.

3) Loki: ring kvstore errors (trying to contact Consul on localhost:8500)
   - Cause: default ring config points to a KV store.
   - Fix: for single-node local dev enable `memberlist` in `loki-config.yaml` under the ingester lifecycler ring configuration.

Reset helper
 - `observability/reset-loki.ps1` — PowerShell script that brings down the dev compose stack, removes Loki volumes, and brings the stack up again.

CI
 - A minimal GitHub Actions workflow was added at `.github/workflows/observability-ci.yml` to start the stack and run the integration smoke tests. Note: adapt `host.docker.internal` networking if runner cannot reach host services.

If you want me to apply these changes directly into the main `observability/README.md` (replace or merge), tell me and I'll attempt the patch again.
