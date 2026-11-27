# AI worklog

## Initial implementation

| Brief excerpt | Agent decision |
| --- | --- |
| “Inspect SauceDemo directly using available browser tooling.” | Confirmed the UI flow, accessible controls and equal-price products before choosing selectors. |
| “Do not depend on existing booking records.” | Used one tagged booking per mutation test, one API worker and zero API retries. |
| “After implementation, change perspective.” | Challenged assertion sensitivity, booking cleanup and failure reporting. |

The user completed GitHub device authorization for the `workflow` scope. The agent verified the effective account and used the repository-local `VovaS05` Git identity. Exploratory results and their classifications are in [README.md](README.md#exploratory-findings).

### Implementation mistakes found by the original agent

| Original problem | Correction and evidence |
| --- | --- |
| `LoginPage` and `InventoryPage` field initializers read `this.page` before assignment under ES2022. | `npm run typecheck` reported `TS2729`. Moved locator initialization into the constructors. Type checking and the six UI tests at that milestone passed. [eb94a4b](https://github.com/VovaS05/qa-automation-assessment/commit/eb94a4b) |
| The USD parser required two decimal digits. The empty-cart run displayed `Item total: $0`. | Accepted whole dollars and one or two decimal digits while keeping integer cents. A focused check accepted `$0`, `$7.9` and `$39.98` and rejected three malformed inputs. [4d411d0](https://github.com/VovaS05/qa-automation-assessment/commit/4d411d0) |
| The booking fixture asserted creation success before keeping the returned ID. | A local server persisted a booking and returned `409` with the ID. Registering the ID before asserting status preserved the original failure and enabled guarded cleanup with a final `404`. [4d411d0](https://github.com/VovaS05/qa-automation-assessment/commit/4d411d0) |

Initial delivery `b2c999f` passed all 14 tests in 13.2 seconds on GitHub Actions. [Run](https://github.com/VovaS05/qa-automation-assessment/actions/runs/45987848095) · [Report artifact](https://github.com/VovaS05/qa-automation-assessment/actions/runs/45987848095/artifacts/15191959209)

## Independent AI review and human approval

On 2026-11-27, an independent AI reviewer assessed `b2c999f` at 81/100 and identified nine findings. The reviewer reproduced false positives in UI feedback and cart cleanup, a false failure caused by initial sort order, and failures in API isolation and creation diagnostics. The review also examined the public API ownership race, workflow concurrency, catalog coverage wording and traceability.

The user reviewed the audit and approved the remediation plan for all nine findings. For H3, the user required keeping the public Restful Booker endpoint as the default and documenting the remaining race. The approval also authorized commits, a push to `main` and GitHub Actions verification.

| Finding | Before and after | Controlled verification |
| --- | --- | --- |
| H1 | UI-01 requires a visible catalog item. UI-08/09/10 require visible feedback with the exact text. Rejected sign-in checks that protected inventory redirects to sign-in. | UI-01 failed with a hidden catalog. UI-08/09/10 each failed on visibility with the expected text still present. [a398888](https://github.com/VovaS05/qa-automation-assessment/commit/a398888) |
| H2 | After confirmation, UI-07 opens the cart and checks its rendered product rows. | The empty indicator with two persisted products failed the zero-row assertion. [a398888](https://github.com/VovaS05/qa-automation-assessment/commit/a398888) |
| M1 | A catalog already in the target order is first put in the opposite order. Each poll reads product and price pairs together. | Both tests passed under ascending and descending defaults and reversed equal-price ties. The tests caught ignored actions in both directions. UI-03 caught a changed product-to-price mapping. [535a929](https://github.com/VovaS05/qa-automation-assessment/commit/535a929) |
| H3 | The same ownership check runs directly before each update or delete, including during teardown. Updates keep the marker. | Foreign markers blocked update, delete and teardown in separate scenarios. Reassignment after the preflight could still affect the synthetic foreign record. The public API provides no atomic ownership guarantee. [383dcc4](https://github.com/VovaS05/qa-automation-assessment/commit/383dcc4) |
| M2 | Negative calls get a fresh request context that is disposed after the test. | With `Set-Cookie` on setup, API-03 sent no auth header or cookie and API-04 sent only its invalid cookie. Both returned `403` and preserved the booking. [383dcc4](https://github.com/VovaS05/qa-automation-assessment/commit/383dcc4) |
| M3 | The fixture registers the marker before `POST` and attaches marker, status and ID when available. | `409` with ID failed on status and cleaned up. `502` and `200` without ID, non-JSON and a dropped connection preserved the error and diagnostic attachment. Each attempted one `POST`. [383dcc4](https://github.com/VovaS05/qa-automation-assessment/commit/383dcc4) |
| L1–L3 | Serialized workflow runs, scoped README catalog claims to displayed entries and linked validation to commits and reports. | A catalog missing an unrelated row still passed the integrity and sort tests, as the updated coverage describes. The workflow passed `actionlint`. [de21ac0](https://github.com/VovaS05/qa-automation-assessment/commit/de21ac0) · [Coverage](README.md#coverage) |

## Remediation validation

The checked-in implementation at `de21ac0` matches the tested snapshot. `npm ci`, Chromium installation, TypeScript checking, Playwright discovery, `actionlint 1.7.12` and `git diff --check` passed. Discovery found 14 tests in six specs.

| Run against the public defaults | Result |
| --- | --- |
| `npm run test:ui` | 10 passed in 12.8 seconds |
| `npm run test:api` | 4 passed in 5.2 seconds |
| `CI=1 npm test -- --fail-on-flaky-tests` | 14 passed in 8.0 seconds |
| UI-01/03/04/07/08/09/10, `--workers=1 --repeat-each=2` | 14 passed in 10.7 seconds |
| API-02 repeated twice | 2 passed in 1.4 seconds |
| API-03 and API-04, independently | 1 passed in 1.9 seconds per run |

Public runs had zero failures, skips and flaky tests. Controlled regressions ran outside the repository. The UI report retained the screenshot and trace. The API report retained both errors and the marker when the assertion and teardown failed together.

### GitHub Actions on `de21ac0`

| Trigger | Result | Evidence |
| --- | --- | --- |
| `push` | 14 passed in 9.2s | [Run](https://github.com/VovaS05/qa-automation-assessment/actions/runs/45993320535) · [Report artifact](https://github.com/VovaS05/qa-automation-assessment/actions/runs/45993320535/artifacts/15194807138) |
| `workflow_dispatch` | 14 passed in 9.7s | [Run](https://github.com/VovaS05/qa-automation-assessment/actions/runs/45993337049) · [Report artifact](https://github.com/VovaS05/qa-automation-assessment/actions/runs/45993337049/artifacts/15193909551) |

Both downloaded reports contained 14 passes and zero failures, skips or retries. The dispatch stayed pending while the push was active. Its job started three seconds after the push job finished. GitHub can replace the single pending run when a newer event arrives. [Concurrency semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency)

## Optional bonus

The user authorized an isolated text-to-Playwright pipeline and a reviewable feature branch. On 2026-11-27, Codex CLI `0.171.0-alpha.13.2` used the existing ChatGPT login and `gpt-6.2-sol` to generate three specs in separate headless calls. All three original specs passed TypeScript, one-test discovery and Chromium execution against the captured SauceDemo app.

The implementing agent reviewed the specs against their exact inputs. The review required zero manual spec corrections. A controlled hidden checkout error failed the generated visibility assertion. During pipeline review the agent corrected artifact export handling so it preserved the test outcome when copying the report failed. Controlled failing and passing tests retained their actual outcomes with a separate export diagnostic. [Bonus examples and review](bonus/README.md#examples-and-review)
