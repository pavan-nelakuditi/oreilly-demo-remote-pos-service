# OReilly Remote POS Service

This repo contains the standalone remote POS service for the OReilly workshop
model.

## Layout

- `api/openapi.yaml` service-owned source contract
- `baselines/openapi.yaml` approved baseline for breaking-change checks
- `src/` service implementation
- `tests/` service tests
- `shared-contracts/` CI-populated shared dependency directory

## Commands

```bash
npm install
npm run validate:specs
npm run typecheck
npm test
npm run check:breaking
npm run build
npm run start
```

## Lightweight Multi-Service Run

Use Docker Compose to run `remote-pos-service` with live calls to
`customers-service` and `order-notifications-service`:

```bash
docker compose -f docker-compose.yml up --build
```

## Required Secrets

Set these repository secrets before running CI or Postman onboarding:

- `POSTMAN_API_KEY`: Postman API key for bootstrap and repo sync
- `POSTMAN_ACCESS_TOKEN`: Postman access token for governance and internal integration calls
- `GITHUB_TOKEN`: used by GitHub Actions to write `dist/openapi.bundled.yaml` back to `api/openapi.bundled.yaml` in this repo

GitHub automatically provides `GITHUB_TOKEN` for same-repo writes during the workflow run.
