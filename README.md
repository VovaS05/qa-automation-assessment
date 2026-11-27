# QA automation assessment

Playwright Test and strict TypeScript cover the main purchase flow in SauceDemo and the booking lifecycle in Restful Booker. The suite contains 10 Chromium UI tests and four browser-free API tests.

## Run locally

Use Node.js 24 LTS and npm. An internet connection is required for the public demo targets and the initial install.

```sh
nvm use                  # If you manage Node.js with nvm
npm ci
npx playwright install chromium
npm test
```

On Linux, use `npx playwright install --with-deps chromium` if the browser's system libraries are missing. An API-only run needs `npm ci` and no browser installation.

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Check the full TypeScript project |
| `npm run test:list` | Discover and list both projects' tests |
| `npm test` | Run both projects |
| `npm run test:ui` | Run the Chromium UI project |
| `npm run test:api` | Run the browser-free API project |
| `npm run test:ui -- --grep UI-07` | Run the checkout workflow independently |
| `npm run test:ui -- --headed` | Run Chromium with a visible window |
| `npm run test:ui -- --ui` | Open Playwright UI mode for the browser project |
| `npm test -- --repeat-each=2` | Run each case twice |
| `npm run report` | Open the latest local HTML report |

| Optional environment variable | Default |
| --- | --- |
| `SAUCEDEMO_BASE_URL` | `https://www.saucedemo.com` |
| `BOOKER_BASE_URL` | `https://restful-booker.herokuapp.com` |

Set a URL only for a compatible test deployment you are authorized to use. Each URL points to the application origin. The defaults in the suite use only published demo credentials. Local reports and screenshots are Git-ignored.

## Coverage

| ID | Scenario | Risk checked | Type |
| --- | --- | --- | --- |
| UI-01 | Sign in and open the cart | Valid customer cannot access inventory or cart | Positive |
| UI-02 | Inspect catalog and Backpack details | Missing or duplicate products, invalid prices, mismatched details | Positive |
| UI-03 | Sort prices low to high | Incorrect numeric order, lost products, price drift | Positive |
| UI-04 | Sort prices high to low | Incorrect reverse order, lost products, price drift | Positive |
| UI-05 | Add two named products | Wrong product, price, quantity or badge | Positive |
| UI-06 | Remove one of two products | Wrong item removed, stale badge or inventory action | Positive |
| UI-07 | Finish checkout | Wrong order lines or amount, missing confirmation, uncleared cart | Positive |
| UI-08 | Enter incorrect credentials | Invalid credentials accepted or incorrect feedback | Negative |
| UI-09 | Leave password empty | Missing password accepted or incorrectly reported | Required-field boundary |
| UI-10 | Leave checkout postal code empty | Checkout progresses or loses cart contents | Required-field boundary |
| API-01 | Authenticate, create, read, update and delete | Broken persistence, inconsistent update, record survives deletion | Positive |
| API-02 | Authenticate with invalid credentials | Token issued to invalid credentials or wrong error | Negative |
| API-03 | Update without authorization | Rejected request changes a test-owned booking | Negative |
| API-04 | Delete with an invalid token | Rejected request removes a test-owned booking | Negative |

The required-field cases exercise the empty value where submission first becomes invalid. Credential checks partition valid, incorrect and missing values. The cart and booking tests assert state transitions, and positive checkout verifies the complete customer workflow.

The sorting tests record the inventory before sorting and require a real reorder for the seeded demo catalog. They also compare product identities and prices across the operation. Equal-price products can appear in either order. The checkout subtotal comes from the selected catalog prices, with one unit per line. The total is compared to that subtotal plus the displayed tax in integer cents. The calculation of the tax rate has no published contract in scope.

## Structure and isolation

- `pages/` contains focused screen and cart-list selectors. The test specs retain the business expectations.
- `tests/ui/` contains the Chromium specs, a shared cart assertion and USD conversion. Every test gets a fresh browser context and signs in through the UI as needed.
- `tests/api/` contains the HTTP client, typed booking payloads, the test-scoped cleanup fixture and API specs. Each mutating test creates a uniquely marked booking and verifies its contents before writing. Teardown checks the marker before deleting and surfaces failures in the report.
- `playwright.config.ts` defines the UI and API projects. Three global workers keep the suite short, with one worker allocated to API scenarios. API tests use no automatic retries because a repeated workflow could create another booking after an ambiguous failure.

The repository uses one runner and a small set of abstractions around repeated interactions. Chromium gives the four-hour assessment a reproducible browser baseline. Broader browser coverage, additional SauceDemo profiles, inventory filters and PDF output, payment and fulfillment integrations, API filtering, PATCH, XML, schema fuzzing, accessibility conformance and load testing are outside this scope.

Both environments are shared demos. UI deployments can change products or wording. Restful Booker can reset or reuse booking IDs. The ownership check prevents teardown from acting on an ID that already resolves to another booking. The service provides no atomic compare-and-delete guarantee. An interrupted process or a creation response with no usable ID can leave a tagged booking until the demo resets. In a production suite, prefer a dedicated deployment with controlled seed data, per-run data namespaces and a cleanup mechanism that identifies resources after interrupted runs.

## CI and reports

GitHub Actions runs on pushes, pull requests and manual dispatch. The job installs locked dependencies and Chromium, type-checks, then runs both projects. CI allows one UI retry for diagnostics and fails the job for any flaky classification. A generated HTML report uploads on failed as well as successful test runs and is retained for 14 days.

Find **playwright-report** under the workflow run's **Artifacts**. Download and unpack it, then run `npx playwright show-report path/to/unpacked-report`. A failed UI test links to its screenshot and trace from the report. API failures include operation steps and status assertions. Cleanup errors add the booking ID and test marker. Compare the first failure with any retry, and check whether the target was available before classifying an infrastructure incident.

## Exploratory findings

Explored on 2026-11-27 in a fresh Chromium context with `standard_user` and on the published Restful Booker endpoint. Also checked duplicate-price ordering, changing cart contents, missing-password and missing-postal-code feedback, a valid checkout, invalid API credentials, rejected writes and persistence after writes.

### SD-01 — An empty cart can reach order confirmation

- **Environment** Public SauceDemo, Chromium, `standard_user`.
- **Precondition** A fresh session with an empty cart.
- **Steps** Sign in. Open the cart without adding anything. Select **Checkout**, supply valid sample customer information, select **Continue**, then select **Finish**.
- **Expected** Checkout requires at least one product and gives the customer a way to return to the catalog. This expectation follows the purchase workflow's business semantics.
- **Actual** The overview shows zero rows, `Item total: $0` and `Total: $0.00`. Selecting **Finish** reaches `/checkout-complete.html` and displays “Thank you for your order!”.
- **Severity** Medium in the demo. The UI reports a successful purchase with no items. External order creation was outside the scope of this check.
- **Reproducibility** 2 of 2 attempts, after a successful checkout cleared the cart and in a separate fresh session.

### RB-01 — Booking update accepts dates in reverse order

- **Environment** Public Restful Booker JSON API and an authenticated, test-owned booking.
- **Steps** Create a booking with check-in on 2027-01-09 and checkout on 2027-01-12. Use `PUT` with check-in on 2027-01-12 and checkout on 2027-01-09. Read the booking again. Delete the test record.
- **Expected** If the product requires a chronological stay, reject the update and preserve the original dates.
- **Actual** `PUT` returned `200` and a following `GET` returned both reversed dates. Cleanup returned `201` and a final read returned `404`.
- **Classification** Confirmed observation from one controlled attempt. The published fields describe two dates. The required order needs product clarification before treating this as a contract defect.

Official API examples define `200` for booking creation and `201` for deletion. The live demo also returns `200` with a reason for invalid credentials. The API tests account for these distinctions. [Restful Booker API documentation](https://restful-booker.herokuapp.com/apidoc/)

## AI collaboration

The agent implemented the assessment from the supplied brief and checked its initial assumptions against the live demos, strict TypeScript and targeted failure cases. The review history and human checkpoints are in [AI_WORKLOG.md](AI_WORKLOG.md). Repository conventions are in [AGENTS.md](AGENTS.md).
