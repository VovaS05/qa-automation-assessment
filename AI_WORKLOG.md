# AI worklog

## Brief and initial decisions

The user supplied the Senior QA Automation Engineer assessment and production repository rules. This is the single initial prompt. The excerpts below are from that prompt.

| Prompt excerpt | Purpose and response |
| --- | --- |
| “Inspect SauceDemo directly using available browser tooling.” | Used a fresh Playwright CLI session to examine the public demo before writing selectors. |
| “Do not depend on existing booking records.” | Read the generated Restful Booker documentation and planned test-owned data with guarded teardown. |
| “After implementation, change perspective.” | Reserve a review pass for assertion sensitivity, booking ownership, reporting and delivery evidence. |

Implementation plan: confirm the browser flow and API contract, initialize one runner with two projects, implement and validate each suite, configure CI, then validate and review the combined suite before pushing.

The selected account was confirmed through the authenticated GitHub user endpoint. The local author uses the account's GitHub-provided noreply pattern. The existing Git settings were left intact outside this repository.

## Discovery and first UI milestone

- The user completed GitHub device authorization for the `workflow` scope. The agent rechecked the effective login and scopes. This was an authorization checkpoint.
- Direct browser inspection confirmed `data-test` IDs, accessible controls, scoped product actions and two distinct catalog products sharing a price. The sorting tests compare independently captured prices and the full product set without specifying a tie order.
- The official API documents token-cookie authorization, `200` for creation and `201` for deletion. The discovery request created one tagged booking and checked persistence, rejected writes and authorized changes. The final read returned `404` after cleanup. Invalid credentials returned `200` with `{"reason":"Bad credentials"}`.
- The authentication and inventory milestone passed all six tests in Chromium and strict type checking.

### Agent corrections identified during validation

1. **Reused an expired browser inspection reference.** After the price sort rerendered the header, the agent tried to use the previous combobox reference. The browser CLI rejected it and the agent refreshed the snapshot. The refreshed reference selected descending price and the DOM showed `49.99, 29.99, 15.99, 15.99, 9.99, 7.99`. The committed inventory page uses the combobox role and name so it resolves the live element on every action.
2. **Initialized locators before the page parameter property was assigned.** The initial `LoginPage` and `InventoryPage` field initializers read `this.page` under ES2022 class field semantics. The agent found the error through `npm run typecheck` (`TS2729`) and moved locator initialization into the constructors. Type checking and the six UI tests passed after the correction.

## Cart, checkout and API milestones

- Chose two named products at different prices and captured their prices before adding them. The checkout review checks quantities and compares displayed totals with an independently calculated subtotal plus the displayed tax.
- Rejected shared login state for this suite. The standard login is fast, and running it in each required context preserves independence and makes failures easier to reproduce.
- Rejected API retries and pre-existing public records. Each mutating case creates its own booking, checks persisted data and uses the documented authorization cookie only on its intended request. Teardown verifies ownership before deleting.
- The agent reproduced empty-cart order confirmation twice, including once in a fresh context. An exploratory test-owned API booking accepted reversed dates and was removed. The README records both outcomes and the difference in the certainty of their business expectations.

## Adversarial review

The agent reviewed the sources, configuration, dependency lock, CI and documentation for misleading assertions, test coupling, secret exposure, teardown failures and artifact handling. The user has provided authorization, with no implementation review feedback recorded at this point.

| Severity | Finding and impact | Root cause and correction | Verification |
| --- | --- | --- | --- |
| Medium | **Agent correction 3.** The parser in `tests/ui/money.ts:1` would reject valid whole-dollar display values, making a totals test vulnerable to catalog data changes. | The original expression required exactly two fractional digits. During the empty-cart exploration the agent observed `Item total: $0`. The parser now normalizes zero, one or two fractional digits to integer cents. | A focused check verified `$0`, `$7.9` and `$39.98` and rejected three malformed values. The live checkout passed again. |
| Medium | **Agent correction 4.** The fixture in `tests/api/booking.fixture.ts:47` could miss cleanup after a non-success response that still contained a usable ID for a created record. | The initial code asserted a success status before extracting the ID. The agent moved registration ahead of the status and content checks, keeping the ownership guard. | A local stub persisted a booking and returned `409` plus its ID. The earlier version failed without attempting cleanup. The corrected version still failed on the status, then issued `DELETE` and confirmed `404`. |
| Low | `tests/api/booking.fixture.ts:76` has a small race between checking a marker and deleting. An interrupted process or missing creation ID can also leave a booking behind. | The public API has no conditional deletion guarantee. The fixture keeps the marker check close to the mutation and reports cleanup failures. The README records the residual limitation. | A local stub returned another booking's ownership marker. Teardown reported the mismatch and made no DELETE request. |

No Critical or High findings remained in the reviewed implementation. An isolated UI test copy deliberately selected descending order in the ascending test. Its numerical order assertion failed and the report contained a screenshot and trace. A local API stub forced both a rejected-write status mismatch and a teardown HTTP error. The reporter preserved both errors and attached the test-owned booking marker. The deliberate failures ran outside the delivered suite.

## Local validation

| Check | Result |
| --- | --- |
| `npm ci` | Completed using the committed lock. npm's install audit reported zero vulnerabilities. |
| `npm run typecheck` and `npm run test:list` | Strict checking passed and discovered 14 tests in six specs. |
| Standalone UI and API runs | 10 UI passed and 4 API passed. |
| `npm test -- --fail-on-flaky-tests` | 14 passed in 7.7 seconds, with zero failed, skipped or flaky. |
| `npm test -- --repeat-each=2` | 28 passed in 14.8 seconds, with zero failed, skipped or flaky. |
| One-worker runs of UI-10 and API-04 | Both passed independently. |
| Reports and static workflow validation | HTML report generated. The deliberate UI failure produced a screenshot and trace. Workflow passed `actionlint 1.7.12`. |

The suite has no separate source linter. The repeat run is a short stability check against public demos. Browser installation and the suite were exercised on macOS before delivery.

## Human-review checkpoints

- Review the expected behavior and severity in the two exploratory findings. Confirm whether empty cart checkout and reverse booking dates should become gating requirements.
- Read API-03 and its teardown together. Review whether the persisted-state assertion and ownership marker address the shared-demo risk for this assignment.
- Compare the successful checkout case with the HTML report. Review the choice to validate tax consistency from the displayed amount while leaving the tax-rate rule outside scope.
