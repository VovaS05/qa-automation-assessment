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
| UI-01 | Sign in and open the cart | Hidden catalog content or inaccessible cart after sign-in | Positive |
| UI-02 | Inspect catalog and Backpack details | Missing names, duplicate displayed products, invalid prices, mismatched Backpack details | Positive |
| UI-03 | Sort prices low to high | Incorrect numeric order, lost products, price drift | Positive |
| UI-04 | Sort prices high to low | Incorrect reverse order, lost products, price drift | Positive |
| UI-05 | Add two named products | Wrong product, price, quantity or badge | Positive |
| UI-06 | Remove one of two products | Wrong item removed, stale badge or inventory action | Positive |
| UI-07 | Finish checkout | Wrong order lines or amount, missing confirmation, uncleared cart | Positive |
| UI-08 | Enter an incorrect password | Access granted or rejection feedback missing or incorrect | Negative |
| UI-09 | Leave password empty | Access granted or required-field feedback missing or incorrect | Required-field boundary |
| UI-10 | Leave checkout postal code empty | Checkout progresses, feedback is missing, or cart contents are lost | Required-field boundary |
| API-01 | Authenticate, create, read, update and delete | Broken persistence, inconsistent update, record survives deletion | Positive |
| API-02 | Authenticate with invalid credentials | Token issued to invalid credentials or wrong error | Negative |
| API-03 | Update without authorization | Rejected request changes a test-owned booking | Negative |
| API-04 | Delete with an invalid token | Rejected request removes a test-owned booking | Negative |

Both rejected login cases check visible feedback and verify that opening the protected inventory returns to sign-in.

Catalog checks validate the displayed entries. The detail check compares the Backpack listing with its detail page. The full expected catalog is outside this coverage. Sorting checks preserve the product-to-price mapping. If the initial order already matches the target, the test first selects the opposite order. Equal-price products can appear in either order.

Checkout compares the subtotal in integer cents with the selected catalog prices, then adds the displayed tax to verify the total. After confirmation, the test opens the cart and checks that its product list is empty.

## Structure and isolation

- `pages/` contains focused screen and cart-list selectors. The test specs retain the business expectations.
- `tests/ui/` contains the Chromium specs, a shared cart assertion and USD conversion. Every test gets a fresh browser context and signs in through the UI as needed.
- `tests/api/` contains the HTTP client, typed booking payloads, the test-scoped cleanup fixture and API specs. Each mutating test creates a uniquely marked booking. The tests check the marker before each update or delete, including teardown. Negative requests use an independent request context.
- `playwright.config.ts` defines the UI and API projects. Three global workers keep the suite short, with one worker allocated to API scenarios. API tests use no automatic retries because a repeated workflow could create another booking after an ambiguous failure.

The assessment covers Chromium and the standard SauceDemo profile. Other browsers and profiles, inventory filters, PDF output, payment and fulfillment integrations, tax-rate rules, API filtering, PATCH, XML, schema fuzzing, accessibility conformance and load testing are outside scope.

Both environments are shared demos. UI deployments can change products or wording. Restful Booker can reset and reuse booking IDs between the ownership check and a write. The public API provides no atomic ownership check for updates or deletes. Use an isolated Restful Booker instance where strict ownership is required. An interrupted process or an ambiguous creation response without an ID can leave a tagged booking until the demo resets.

## CI and reports

GitHub Actions runs on pushes, pull requests and manual dispatch. A shared concurrency group permits one active run. A newer event can replace the pending run while the active one finishes. The job installs locked dependencies and Chromium, type-checks, then runs both projects. CI allows one UI retry and fails the job for any flaky classification. Generated HTML reports are uploaded on completed test runs and retained for 14 days.

Find **playwright-report** under the workflow run's **Artifacts**. Download and unpack it, then run `npx playwright show-report path/to/unpacked-report`. UI failures include a screenshot and trace. The report includes the test marker and any available booking ID for creation and cleanup failures.

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

The worklog records implementation decisions, independent AI review, human approval and verification evidence. [AI_WORKLOG.md](AI_WORKLOG.md) · [AGENTS.md](AGENTS.md)

## Optional bonus

The separate Codex-to-Playwright pipeline generates and runs one candidate UI test from a text case. The bonus documentation contains setup, three preserved examples and their execution results. [Bonus README](bonus/README.md)
