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
