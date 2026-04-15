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
```

