#!/usr/bin/env bash
set -euo pipefail

if ! command -v detect-secrets >/dev/null 2>&1; then
  echo "detect-secrets not found. Install with: pip install detect-secrets"
  exit 2
fi

if [ "${1:-}" = "--update" ]; then
  detect-secrets scan --update .secrets.baseline
else
  detect-secrets scan --baseline .secrets.baseline > scan-output.txt || true
  if grep -q "Potential secrets" scan-output.txt || [ -s scan-output.txt ]; then
    echo "Potential secrets found. Inspect scan-output.txt and update .secrets.baseline if intentional." >&2
    exit 1
  fi
fi
