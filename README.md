# Resort Booking API — Junior Developer Assessment

A REST API for booking a luxury resort room, built with **Next.js (App Router, JavaScript)**, **PostgreSQL**, and **JWT authentication**. The primary goal is to prevent overlapping reservations, including when many clients attempt to reserve the same room simultaneously.

**Assessment:** YES WEB DESIGN STUDIO — Junior Developer Coding Test  
**Date:** 20 October 2026  
**Repository:** https://github.com/minthantnaing1/yes-dev-junior-test

## 1. Implementation status

| Requirement                       | Status          | Implementation                                                                                                                              |
| --------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/login`                | Complete        | Verify seeded credentials using bcrypt and return a signed JWT                                                                              |
| `GET /rooms/:id/availability`     | Complete        | Check room inventory against overlapping confirmed bookings                                                                                 |
| `GET /pricing`                    | Complete        | Authenticated, server-calculated surcharge and loyalty pricing                                                                              |
| `POST /bookings`                  | Complete        | Transaction, row lock, availability check, database exclusion constraint                                                                    |
| `GET /bookings/summary`           | Partial         | Counts confirmed bookings and historical `rejected` rows, and sums confirmed revenue; current booking route does not persist new rejections |
| Input validation                  | Complete        | Room ID, date format, chronological dates, past dates                                                                                       |
| Pricing unit tests                | Complete        | Six Vitest cases                                                                                                                            |
| Overlap API test                  | Complete        | One Vitest case checking HTTP 409                                                                                                           |
| Concurrency test: same dates      | Passed          | 200 concurrent requests; exactly one success                                                                                                |
| Concurrency test: partial overlap | Passed          | 200 concurrent requests; exactly one success                                                                                                |
| Postman collection                | Complete        | Collection Format v2.1 in `/postman`                                                                                                        |
| Redis rate limiting               | Not implemented | Bonus                                                                                                                                       |
| WebSocket dashboard               | Not implemented | Bonus                                                                                                                                       |
| Redis distributed lock            | Not implemented | Bonus                                                                                                                                       |

## 2. Technology stack

- **Next.js App Router:** REST endpoints implemented as route handlers in `app/`.
- **JavaScript / Node.js:** API and business logic.
- **PostgreSQL 16:** Persistent data, transactions, row-level locks, and constraints.
- **`pg`:** PostgreSQL connection pooling and parameterized queries.
- **`bcryptjs`:** Password hash verification for the supplied seed users.
- **`jsonwebtoken`:** JWT generation and verification.
- **`pnpm`:** Dependency management.
- **Vitest:** Unit and API tests.
- **Postman:** Manual API testing and exported collection.
- **Docker Compose:** Local PostgreSQL and execution of the provided k6 test runner.
- **k6:** Concurrent booking load tests.

Redis is available in the starter environment but is **not used by the current API implementation**.

## 3. Repository structure

```text
yes-dev-junior-test/
├── app/                         # Next.js API routes
├── lib/                         # Authentication, database, validation, pricing
├── db/migrations/
│   └── 001_create_bookings.sql  # Added schema for bookings
├── tests/
│   ├── pricing.test.js
│   └── booking.test.js
├── postman/
│   └── Resort Booking API.postman_collection.json
├── package.json
├── pnpm-lock.yaml
└── README.md
```

The company-provided starter (`docker-compose.yml`, `db/init/`, and `load-test/booking-race.js`) is maintained separately and is not included in this repository. The project adds its own `db/migrations/001_create_bookings.sql` file. Other Next.js-generated files are omitted from this abbreviated tree.

## 4. Installation and local setup

### Prerequisites

- Node.js compatible with the version of Next.js in `package.json` (prefer the current Node.js LTS release).
- pnpm (install with `npm install -g pnpm`, or use Corepack if configured).
- Docker Desktop with Docker Compose, running on Windows with WSL 2 if applicable.
- Postman for importing and testing the API (optional).

### Step 1 — Clone the repository

```bash
git clone https://github.com/minthantnaing1/yes-dev-junior-test.git
cd yes-dev-junior-test
```

### Step 2 — Install dependencies

```bash
pnpm install
```

The project uses a lockfile, so `pnpm install` is the recommended reproducible installation command. The following are the principal dependencies and why they were added; **reviewers do not need to install them individually** because `pnpm install` installs everything declared in `package.json`:

```bash
# Database driver
pnpm add pg

# Authentication
pnpm add bcryptjs jsonwebtoken

# Automated testing
pnpm add -D vitest
```

The application itself was initialized as a Next.js App Router JavaScript project. Use the committed project rather than creating another Next.js application inside it.

### Step 3 — Configure environment variables

Create `.env` in the project root:

```dotenv
DATABASE_URL=postgresql://booking:booking@localhost:5432/booking
JWT_SECRET=replace-with-a-long-random-secret
```

The values above are for **local development only**. Never commit `.env`, JWTs, real credentials, or production secrets. Ensure `.env` is covered by `.gitignore`.

### Step 4 — Start the database

Use the **provided starter project's** `docker-compose.yml`:

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432`. The starter configuration also includes Redis, which is not required for the core implementation.

The starter initializes its database using `db/init/01-schema.sql` and `db/init/02-seed.sql` **only when the database volume is first created**. Those scripts create the `users` and `rooms` tables and insert sample records.

**Apply this project's migration before starting the API.** The starter does not create the `bookings` table. This repository includes `db/migrations/001_create_bookings.sql` with the `btree_gist` extension, table, constraints, and user ID index.

From the project root, with PostgreSQL already running, either use a locally installed PostgreSQL CLI:

```bash
psql "postgresql://booking:booking@localhost:5432/booking" -f db/migrations/001_create_bookings.sql
```

Or, from Windows CMD, run the migration through the starter's running PostgreSQL container (replace `<postgres-container-name>` with the actual name shown by `docker ps`):

```cmd
docker exec -i <postgres-container-name> psql -U booking -d booking < db\migrations\001_create_bookings.sql
```

The migration expects the starter's `users` and `rooms` tables to exist already. It uses `CREATE TABLE IF NOT EXISTS`; it does not reconcile an existing table with a different schema. The SQL is included in the submitted repository, not the company's starter.

### Step 5 — Run the API

```bash
pnpm dev
```

API base URL: `http://localhost:3000`.

### Step 6 — Run automated tests

Keep the API running in a separate terminal for the API integration test:

```bash
pnpm test
```

### Step 7 — Import Postman collection

In Postman, choose **Import** and select:

```text
postman/Resort Booking API.postman_collection.json
```

Set `baseUrl` to `http://localhost:3000`. Send **Login** first; its post-response script stores the JWT in the collection variable `token`. Protected requests use `Authorization: Bearer {{token}}` through collection-level authorization. Do not commit a real JWT into the collection.

## 5. Database design and booking safety

### Starter tables

- `users`: login credentials, name, and `completed_stays` for loyalty eligibility.
- `rooms`: room name, nightly base price, and number of units.

### Booking table

The implementation adds a `bookings` table with fields for the booking ID, user ID, room ID, check-in, check-out, booking status, total price, and timestamps. The local database currently permits `confirmed`, `rejected`, and `cancelled`. The final booking route creates **confirmed** rows only; older `rejected` rows may remain from testing an earlier implementation.

- `confirmed`: booking accepted and room reserved.
- `rejected`: a status used by an earlier implementation to log unavailable attempts; such rows do **not** reserve inventory or contribute to revenue. The final booking route does **not** insert these rows.
- `cancelled`: supported as a database status and excluded from inventory/revenue calculations; a cancellation API was not implemented.

The summary endpoint counts `confirmed` and `rejected` **rows** separately. **Known limitation:** the final, concurrency-tested `POST /bookings` returns `409` without inserting a rejected row. Consequently, `rejectedBookings` does **not** reflect new failed attempts, and any nonzero value comes from previously stored test records. This is incomplete relative to the assessment’s requested count of rejected bookings. A separate rejection-event table, or safe persistence of rejected attempts within the transaction, would be needed to satisfy it fully.

### Why simultaneous bookings do not double-book

The booking endpoint uses **two complementary protections**:

1. **Transaction and row lock:** `BEGIN`, then `SELECT * FROM rooms WHERE id = $1 FOR UPDATE`. Requests for the same room are serialized while availability is checked and the booking is inserted. The transaction is committed only after successful insertion.
2. **PostgreSQL exclusion constraint:** A GiST exclusion constraint prevents two `confirmed` bookings from having overlapping date ranges for the same `room_id`. This provides a database-level safety net even if application checks race or a future code path bypasses the lock.

The date range uses `[)` semantics: check-in is inclusive and check-out is exclusive. Therefore, a reservation ending on 12 December and another beginning on 12 December **do not** overlap.

Representative constraint:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings
ADD CONSTRAINT prevent_overlapping_bookings
EXCLUDE USING gist (
  room_id WITH =,
  daterange(check_in, check_out, '[)') WITH &&
)
WHERE (status = 'confirmed');
```

The API returns HTTP **409 Conflict** for unavailable dates and also handles PostgreSQL exclusion violations (`23P01`) as conflicts rather than HTTP 500 errors.

**Scope:** The supplied resort has exactly **one unit** of the room. The room/date exclusion constraint is appropriate for that assessment scenario. Supporting multiple interchangeable units per room would require an inventory model that assigns bookings to specific physical units (or an equivalent database-enforced capacity design).

### Reproducible schema migration

The submitted `db/migrations/001_create_bookings.sql` defines the additional `bookings` table, its date/status/price checks, GiST exclusion constraint, and user ID index. Apply it once after the starter initializes `users` and `rooms`, following Section 4. The final migration allows `confirmed` and `cancelled` statuses; the earlier local test database may additionally contain a `rejected` status and historical rejected rows. This difference does not affect the confirmed-booking concurrency tests but means the final summary does not count new 409 attempts.

## 6. Business rules and pricing

The server calculates pricing; the client cannot submit its own price.

1. Start with the room's `base_price_per_night` (seed: **20,000 THB**).
2. If only one unit remains available, multiply by **1.20**.
3. If the authenticated user has **4 or more** completed stays, multiply by **0.90**.
4. Multiply the resulting nightly price by the number of nights (`checkOut - checkIn`).

| Scenario                         | Price per night | Two-night total |
| -------------------------------- | --------------: | --------------: |
| Last unit, new guest (0 stays)   |      24,000 THB |      48,000 THB |
| Last unit, guest with 3 stays    |      24,000 THB |      48,000 THB |
| Last unit, loyal guest (4 stays) |      21,600 THB |      43,200 THB |

The surcharge is applied **before** the loyalty discount. Shared logic in `lib/pricing.js` is reused by the pricing and booking endpoints to avoid inconsistent totals.

## 7. API reference

All dates use `YYYY-MM-DD`. Use future dates that are not already booked. Protected endpoints require a JWT in the `Authorization: Bearer <token>` header.

### `POST /auth/login` — public

```http
POST /auth/login
Content-Type: application/json

{"email":"new.guest@example.com","password":"Passw0rd!"}
```

- `200`: login succeeds; response includes `token` and user details.
- `401`: invalid credentials.

### `GET /rooms/:id/availability` — public

```http
GET /rooms/1/availability?checkIn=2027-10-10&checkOut=2027-10-12
```

- `200`: includes `available` and `availableUnits`, with room and date details.
- `400`: invalid room ID or dates.
- `404`: room does not exist.

### `GET /pricing` — JWT required

```http
GET /pricing?roomId=1&checkIn=2027-10-10&checkOut=2027-10-12
Authorization: Bearer <token>
```

- `200`: nightly price, nights, total price, currency, surcharge and loyalty flags.
- `400`: invalid inputs.
- `401`: missing or invalid token.
- `404`: room does not exist.
- `409`: room unavailable.

### `POST /bookings` — JWT required

```http
POST /bookings
Authorization: Bearer <token>
Content-Type: application/json

{"roomId":1,"checkIn":"2027-10-10","checkOut":"2027-10-12"}
```

- `201`: booking successfully confirmed and returned.
- `400`: invalid input.
- `401`: missing or invalid token.
- `404`: room does not exist.
- `409`: unavailable/overlapping dates; **no rejected-attempt record is created by the final route**.

The user ID is obtained **only from the verified JWT**. The server calculates `total_price` itself.

### `GET /bookings/summary` — JWT required

```http
GET /bookings/summary
Authorization: Bearer <token>
```

Example response from **earlier local testing**, when rejected attempts were being stored (the final route does not increment `rejectedBookings`):

```json
{
  "successfulBookings": 3,
  "rejectedBookings": 1,
  "cancelledBookings": 0,
  "totalRevenue": 168000,
  "currency": "THB"
}
```

**Scope:** This implementation returns **global booking statistics**, not just statistics for the logged-in user. The endpoint requires authentication but does not implement an admin-only role. For production, summary access should be restricted to authorized resort staff.

## 8. Validation and security

- Validates positive integer room IDs.
- Validates actual calendar dates in `YYYY-MM-DD` format (not merely a matching string pattern).
- Requires check-out after check-in and rejects past check-in dates.
- Uses Bangkok local date to determine whether a check-in is in the past.
- Validates JWT on protected endpoints; uses token-derived identity.
- Verifies bcrypt password hashes instead of comparing plain-text passwords.
- Uses parameterized SQL queries to avoid string interpolation of user input.
- Calculates prices on the server rather than trusting client-provided totals.
- Rolls back transactions on errors.
- Does not commit `.env` or real secrets.

## 9. Automated test results

### Unit tests — Vitest

Run:

```bash
pnpm test
```

**Observed result: 2 test files passed, 7 tests passed.** These tests do not currently verify rejection-summary accounting.

Six pricing tests cover:

1. 20% surcharge for the last available unit.
2. 10% loyalty discount for four completed stays.
3. No loyalty discount for three completed stays.
4. Correct multiplication across multiple nights.
5. No surcharge when more than one unit remains.
6. Surcharge applied before loyalty discount.

The booking API test verifies that overlapping booking dates return **409 Conflict**.

The booking test requires a running API and seeded database; it is not a completely isolated unit test.

### Concurrency tests — provided k6 script

Start the API with `pnpm dev`, then run the following commands **from the company-provided starter directory** (where its `docker-compose.yml` is located):

```bash
# Same dates for all concurrent requests
docker compose --profile loadtest run --rm -e CHECK_IN=2026-12-20 k6

# Partially overlapping dates
docker compose --profile loadtest run --rm -e MODE=partial -e CHECK_IN=2027-01-10 k6
```

These commands were run during the assessment with the provided script. The figures below are from the previously verified runs; the final shared-helper refactor was also retested successfully with fresh dates. When reproducing the tests, use new future dates that are not already booked:

| Metric              | Same dates | Partial overlap |
| ------------------- | ---------: | --------------: |
| Concurrent requests |        200 |             200 |
| Successful bookings |      **1** |           **1** |
| HTTP 409 conflicts  |        199 |             199 |
| HTTP 5xx errors     |          0 |               0 |
| Outcome             |   **PASS** |        **PASS** |

The results above were observed during local testing. Screenshot files are not included in the documented repository structure; the commands above can be used to reproduce the checks using fresh future dates.

**Note:** The test inserts a successful booking, so rerunning it with an already-used date may produce 200 conflicts instead of one success. Select a new future `CHECK_IN` date when repeating the test.

## 10. Development process, decisions, and AI usage

AI assistance was **allowed by the assessment rules** and was used during implementation. This disclosure describes how it was used and what was reviewed or corrected rather than presenting AI-generated suggestions as automatically correct.

### Where AI helped

- Discussing the API architecture and organizing Next.js App Router route handlers.
- Explaining transaction boundaries, `SELECT ... FOR UPDATE`, overlapping date checks, and PostgreSQL exclusion constraints.
- Reviewing JWT authentication, input validation, and server-side pricing logic.
- Helping structure Vitest cases and interpret k6 output.
- Troubleshooting PostgreSQL errors, Postman authorization, and collection export.
- Assisting with documentation and reviewing implementation limitations.

### My development and verification work

- Configured the local Next.js/PostgreSQL environment and implemented the endpoints.
- Tested API requests manually with Postman and inspected HTTP responses.
- Ran the required same-date and partial-overlap concurrency tests.
- Added and executed automated pricing and overlap tests.
- Investigated failing requests and database constraints, corrected issues, and verified behavior again.
- Reviewed and adapted AI suggestions to match the supplied schema, actual error messages, and assessment requirements.

### Example of an AI suggestion that required correction

An AI-assisted change proposed persisting each unavailable booking attempt as a `rejected` row so that `/bookings/summary` could count rejections. The first version assumed the wrong PostgreSQL constraint name (`valid_booking_status` rather than the existing `valid_status`), causing a `23514` check-constraint error. After inspecting the database error, I corrected the constraint and confirmed the summary could count a rejected row.

A later refactor added a separate `pool.query()` insert **after** rolling back the booking transaction. During retesting, the k6 setup timed out; this did not prove the insert caused the timeout, because k6 had not yet begun the concurrent booking requests. Rather than submit an unverified change, I restored the previously working booking behavior and refactored only the shared validation/pricing logic. I reran the concurrency tests and confirmed they passed.

**Remaining limitation:** the final booking route does not persist new rejected attempts, so the summary rejection count is incomplete. This is documented rather than claimed as fully implemented. The experience reinforced the need to verify AI suggestions against the actual database schema and load-test behavior.

### Other decisions and adjustments

- Used a shared `calculatePrice()` function to ensure booking creation and price quotation follow identical rules.
- Used exclusive check-out boundaries to support back-to-back bookings.
- Added both application-level locking and a database-level exclusion constraint instead of relying on a single availability query.
- Fixed Postman collection-level Bearer token inheritance and used a login post-response script to populate `{{token}}`.
- Exported the Postman collection in v2.1 JSON format for reproducible manual testing.

## 11. Incomplete work and future improvements

**Required functionality not fully finished:** the summary endpoint counts stored `rejected` rows, but the final booking route does not record new failed booking attempts. A reviewer will see `409` without a corresponding increment in `rejectedBookings`. The reproducible bookings schema is included under `db/migrations/`.

The following **bonus** items were not implemented, because booking safety, pricing, endpoints, and tests were prioritized:

| Feature                | How I would implement it                                                                                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redis rate limiting    | Add per-user or per-IP counters with expiration; return HTTP 429 when the configured threshold is exceeded. Temporarily raise/disable the threshold during k6 assessment tests so it does not interfere with concurrency verification. |
| WebSocket dashboard    | Add a WebSocket server or compatible real-time service; publish booking-confirmed and booking-rejected events after their database writes succeed; broadcast to authorized dashboard clients.                                          |
| Redis distributed lock | Acquire a short-lived room/date lock with a unique owner token and safe release, while retaining the PostgreSQL transaction and exclusion constraint as the authoritative protection.                                                  |

Other improvements for a production deployment:

- **Admin authorization:** Restrict global booking summary data to resort staff.
- **Cancellation endpoint:** Add authenticated cancellation behavior and tests; the database already recognizes `cancelled` status.
- **Multiple room units:** Assign bookings to individual units or implement database-enforced capacity instead of the current single-unit exclusion design.
- **Complete rejection counting (required endpoint limitation):** Persist rejected booking attempts reliably, preferably in a dedicated audit/event table; record conflicts without introducing additional connection-pool pressure or weakening transaction safety. Add tests showing each `409` increases the rejected count.
- **Additional tests:** Add tests for malformed JSON, missing/expired JWT, invalid dates, adjacent date ranges, unknown rooms, and rejection-summary counts.
- **Operational concerns:** Structured logs, API rate limits, deployment configuration, secret management, and monitoring.

## 12. Submission checklist

- [x] Five API routes implemented (summary rejection counting has a documented limitation).
- [x] Six pricing tests and one overlap API test passed.
- [x] Both k6 concurrency modes passed in the company-provided starter environment.
- [x] Postman collection exported to `/postman`.
- [x] Added `db/migrations/001_create_bookings.sql` for fresh starter databases.
- [ ] Verify `.env` is ignored and no real credentials or JWTs are committed.
- [ ] Run `pnpm test` and `pnpm build` one final time.
- [ ] Commit and push all source code, tests, migration, Postman collection, and this README.
- [ ] Confirm the GitHub repository is public or the required reviewer has access.

---

**Implementation priority:** Correctness under concurrent requests, clear API responses, server-controlled pricing, and a reproducible review environment. Optional enhancements are documented rather than claimed as completed.
