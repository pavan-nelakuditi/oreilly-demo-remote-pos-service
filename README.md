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

- `SHARED_CONTRACTS_READ_TOKEN`: token with read access to `pavan-nelakuditi/oreilly-shared-contracts`
- `POSTMAN_API_KEY`: Postman API key for bootstrap and repo sync
- `POSTMAN_ACCESS_TOKEN`: Postman access token for governance and internal integration calls
- `SPECHUB_WRITE_TOKEN`: token with write access to `pavan-nelakuditi/Spechub` so the workflow can publish `dist/openapi.bundled.yaml` to `remote-pos/openapi.yaml`

GitHub automatically provides `GITHUB_TOKEN` for same-repo writes during the workflow run.
