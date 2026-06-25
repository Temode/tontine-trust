# E2E — Famille Alice

End-to-end tests against a real Supabase project, using deterministic fixtures
so every run is reproducible.

## Files

- `fixtures/famille-alice.ts` — idempotent seed (3 users, 1 group, 1 announcement)
- `famille-alice.spec.ts` — Playwright spec (5 tests, tagged `@audit`,
  `@notifications`, `@rls`, `@dashboard`, `@rotation`)

## Required environment / GitHub secrets

| Name | Purpose |
|---|---|
| `E2E_SUPABASE_URL` | Supabase project URL |
| `E2E_SUPABASE_ANON_KEY` | Publishable / anon key (client + REST probes) |
| `E2E_SUPABASE_SERVICE_ROLE` | **Secret** — used only by the seed script to upsert users/profiles/groups |
| `E2E_BASE_URL` *(optional)* | Defaults to `http://localhost:8080` |

> Use a dedicated **staging** Supabase project. Never point E2E at production.

## Run locally

```bash
export E2E_SUPABASE_URL=...
export E2E_SUPABASE_ANON_KEY=...
export E2E_SUPABASE_SERVICE_ROLE=...

bun install
bun run tests/e2e/fixtures/famille-alice.ts    # seed
bun run dev &                                  # serve at :8080
bunx playwright test tests/e2e                 # run E2E
```

## CI gating

`.github/workflows/e2e.yml` runs on every PR to `main`. The job fails — and
therefore blocks merge once branch protection is enabled — when any spec
fails. To enforce the rule:

1. GitHub → **Settings → Branches → Branch protection rules** for `main`
2. Require the status check **`E2E (audit / notifications / RLS gating)`**
3. Enable **Require branches to be up to date before merging**

The three security-critical specs are tagged `@audit`, `@notifications`,
`@rls` so they surface first in the JUnit report and in PR check summaries.