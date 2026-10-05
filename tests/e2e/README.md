# End-to-end tests

Playwright (Chromium) against the **real stack**: Postgres + authservice + API (`Seed__Demo=true`) + web.
No mocks — registration, sign-in, tokens and the tracker/employer APIs are the real services.

## Run

```bash
# from the repo root: bring the stack up (compose file: tests/e2e/docker-compose.yml)
scripts/dev-stack.sh up          # web :3000, authservice :8080, api :8081
pnpm install --frozen-lockfile
pnpm --filter e2e test           # E2E_BASE_URL defaults to http://localhost:3000
pnpm --filter e2e exec playwright show-report   # HTML report (playwright-report/)
scripts/dev-stack.sh e2e         # one-shot: up, run, down
```

* `E2E_BASE_URL` — where the web app listens.
* Browser: CI installs the pinned Chromium. In a sandbox with a preinstalled browser set
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and (optionally) `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; otherwise
  `/opt/pw-browsers/chromium-*/chrome-linux*/chrome` is discovered. The suite never runs `playwright install`.

## Shape and rules

| File | Journey |
|---|---|
| `01-anonymous` | search by keyword / minimum salary, empty state, job page JSON-LD, apply redirect (`Location` asserted, not followed), benchmark median and "za mało danych", MCP page, `/healthz`, `/api/config`, sitemap, legal banners |
| `02-employer` | register -> company (NIP checksum) -> publish without salary (API field error) -> publish B2B+UoP job -> shows on `/pracodawca` and in anonymous search |
| `03-candidate` | second user: save job, move to `applied`, note, reload persistence, remove, data export download |
| `04-auth-guard` | `/konto` redirect with `?redirect=`, generic wrong-password message, forged cookie rejected and cleared, logout deletes cookies |

* Files run **in order with one worker**: authservice rate-limits its auth endpoints to 20/min per IP and the
  web container is a single IP; `03` and `04` read what `02`/`03` saved under `.state/` (gitignored).
  The whole suite makes about 8 authservice calls. Do not raise `workers` or add per-test logins.
* Users are unique per run (`e2e-<label>-<random>@example.com`); the stack is ephemeral, so no cleanup is needed.
* Locators are role / label based. Every test asserts visible state; there are no sleeps and no
  `if (visible)` guards. A step whose precondition is missing fails loudly rather than skipping.
