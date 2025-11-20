**Contributing & Secret Hygiene**

Please follow these rules to keep the repository free of secrets:

- Do not commit API keys, private keys, passwords or any secrets.
- Use environment variables or secret managers (GitHub Secrets, Vault, etc.) for runtime secrets.
- Before committing, install and enable the pre-commit hooks described below.

Local setup (recommended):

1. Install `pre-commit` and `detect-secrets`:

```powershell
pip install pre-commit detect-secrets
pre-commit install
```

2. Initialize detect-secrets baseline (only once):

```powershell
detect-secrets scan > .secrets.baseline
git add .secrets.baseline
git commit -m "chore(secrets): add detect-secrets baseline"
```

3. To run a scan manually:

```powershell
./scripts/run-secret-scan.ps1
# or on Unix
./scripts/run-secret-scan.sh
```

If `detect-secrets` reports a true positive, update the baseline only after review:

```powershell
detect-secrets scan --update .secrets.baseline
git add .secrets.baseline && git commit -m "chore(secrets): update baseline"
```

CI note
- The repository uses GitHub Actions to scan / run monitoring tests. Keep secrets in GitHub Actions secrets or other secret stores.
