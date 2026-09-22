# Phase 0 — API hardening gate

Flutter development starts only after this gate is green on an isolated staging database.

## Contract decisions

- Errors use `{ code, message, details }`. The deprecated `error` alias remains during the web-client migration.
- Monetary fields are integer VND. Gold weight and purity fields are decimal strings (maximum six decimal places) at the mobile boundary.
- Lists use `limit` (default 50, max 200) and `offset`, and return `pagination` metadata.
- Every response includes `X-Request-ID`. Outbound calls must use a 10-second timeout; clients retry only safe GET requests and idempotent writes.
- New order/payment clients send `Idempotency-Key` (8–128 characters). A repeated key with a different payload is a conflict.
- Order status changes use `PATCH /api/orders/:id/status`; draft invoice edits use `PUT /api/orders/:id/draft`. The old combined PUT is deprecated.
- Backup/import and API-token management are **admin web only** for mobile MVP. Mobile consumes neither permission.

## Release gate

- [x] Restore the 29-table `public` baseline and pin its SHA-256 checksum in the migration manifest.
- [ ] Apply `scripts/migrate_mobile_sessions.sql` to an isolated staging database.
- [ ] Complete idempotency persistence and atomic transactions for order/payment/inventory.
- [ ] Enforce named permissions on every route (initial enforcement is present on core mobile resources).
- [ ] Finish per-operation OpenAPI request/response schemas for remaining admin endpoints.
- [ ] Add tenant-isolation, concurrent-stock, payment and debt integration suites.
- [ ] Run `npm test`, `npm run check`, and `BASE_URL=... npm run test:smoke` successfully.

The missing baseline is a hard blocker: do not label the API beta-ready until it is restored from the authoritative schema or exported from a known-good database and reviewed.
