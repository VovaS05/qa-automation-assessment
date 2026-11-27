# Optional bonus: text to Playwright

Generate one executable SauceDemo UI spec from a text case and retain its original model output and run evidence. The mandatory Playwright configuration still discovers 14 tests and runs independently of this pipeline.

## Requirements and setup

- Node.js 24 and the repository's locked dependencies.
- Codex CLI with non-interactive structured output and an existing ChatGPT login that supports `gpt-6.2-sol`. Verified with CLI `0.171.0-alpha.13.2`.
- A local Docker Unix-socket context and the official Playwright image matching the installed Playwright version. Docker isolates the spec and Chromium from the host and external network. [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode) · [Playwright Docker image](https://playwright.dev/docs/docker)

```sh
npm ci
codex login status
docker pull mcr.microsoft.com/playwright:v1.65.1-noble
```

For a separate macOS Colima context, start a profile with host mounts disabled and pull the image there.

```sh
colima start qa-assessment-bonus --activate=false --mount none --vm-type vz --cpus 3 --memory 4 --disk 20 --runtime docker
export BONUS_DOCKER_CONTEXT=colima-qa-assessment-bonus
docker --context "$BONUS_DOCKER_CONTEXT" pull mcr.microsoft.com/playwright:v1.65.1-noble
```

## Generate and run

Provide a UTF-8 `.txt` file up to 8,000 bytes, with nonempty `Steps:` and `Expected:` sections on separate lines. Use public demo or synthetic data.

```sh
npm run bonus:generate -- bonus/examples/product-details/input.txt
npm run bonus:generate -- bonus/examples/checkout-recovery/input.txt
npm run bonus:generate -- bonus/examples/cart-sync/input.txt
npm run bonus:run -- bonus/examples/cart-sync/original.spec.ts
```

`generate` sends the prompt, input, `AGENTS.md` and the four UI Page Objects to headless Codex. It uses `codex -a never exec` with shell, hooks, image and web tools disabled, an empty working directory, a read-only agent sandbox, an explicit model and a structured `source` response. The exact invocation with run-local paths represented by `$RUN` is recorded in each result. The pipeline checks the Codex event stream for a completed response without tool calls. [Generation prompt](prompt.txt)

Both commands run the TypeScript AST policy, then stage the spec, Page Objects, runner and locked test dependencies in a disposable Docker container. Inside the container they run strict TypeScript checks, Playwright discovery for exactly one test, then Chromium. `run` replays a spec through the same validation and execution path using Docker alone. The stage layout resolves the `./pages/*` imports in preserved example files.

Each invocation prints its own evidence directory under `bonus/runs/`. It contains `result.json`, preserved `original.spec.ts` and diagnostics. Generation runs also retain their input, prompt and Codex response locally. Executed tests normally include `playwright-artifacts.tar` with the JSON and HTML reports and failure attachments.

```sh
run='bonus/runs/<printed-run-directory>'
report_dir=$(mktemp -d)
tar -xf "$run/playwright-artifacts.tar" -C "$report_dir"
npx playwright show-report "$report_dir/html"
```

| Exit | Meaning |
| --- | --- |
| 0 | Validated and executed one passing test with a report |
| 2 | Invalid arguments or input file |
| 3 | Codex invocation failed |
| 4 | Invalid model output, policy rejection, type error or unexpected discovery |
| 5 | The discovered test failed during execution |
| 6 | Sandbox or a required runtime resource or report failed |

## Examples and review

Each preserved spec was generated in one call to `gpt-6.2-sol` on 2026-11-27. Each passed the AST policy, strict TypeScript and one-test discovery. All three passed Chromium on the first execution with zero failures, skips or retries. The result files preserve source and input hashes, model invocation, runtime isolation checks and captured app hashes.

| Case | Input, original source and result | Execution and assertion review |
| --- | --- | --- |
| Product details and return | [Input](examples/product-details/input.txt) · [Spec](examples/product-details/original.spec.ts) · [Result](examples/product-details/result.json) | **1/1 in 1.43 s.** Captures the Fleece Jacket's name, price and description before opening details. Compares visible detail fields and verifies the original item and price after returning to the inventory. |
| Checkout recovery | [Input](examples/checkout-recovery/input.txt) · [Spec](examples/checkout-recovery/original.spec.ts) · [Result](examples/checkout-recovery/result.json) | **1/1 in 1.66 s.** Requires visible first-name feedback and the information URL. After resubmission, checks the overview contains the original item and price with quantity one. |
| Cart state from details | [Input](examples/cart-sync/input.txt) · [Spec](examples/cart-sync/original.spec.ts) · [Result](examples/cart-sync/result.json) | **1/1 in 1.44 s.** Removes the Bike Light from details and checks the updated controls, accessible cart name and empty rendered cart list. |

**Manual corrections required: zero.** The agent reviewed the originals against their inputs. The user authorized the bonus scope. The draft pull request is the human review checkpoint for adopting these tests. For future edits, save a separate `corrected.spec.ts` and run it with `bonus:run` so the original remains available.

### Controlled checks

- Invalid input returned `2`. A controlled model invocation failure returned `3`. The three examples used the real model.
- A filesystem import, `test.skip`, an external URL and a genuine TypeScript incompatibility returned `4`. A deliberate assertion failure returned `5` and retained a screenshot and trace. A missing Docker context returned `6`.
- Hiding checkout feedback in a local copy of the staged app caused the unedited generated checkout test to fail at `toBeVisible`.
- A controlled report-export error preserved the actual test outcome and added a separate export diagnostic, including when the assertion had already failed.

## Security and limits

The test runs as a non-root user in a container with `--network=none`, capability dropping, process and memory limits, and zero host mounts. The staged suite is read-only to that user. The container receives no host credentials, Docker socket or Git checkout. It is removed after collecting evidence. The AST allowlist restricts supported TypeScript expressions, module imports and browser actions. The Docker boundary applies during discovery and execution. A missing boundary stops the run. [Docker none network driver](https://docs.docker.com/engine/network/drivers/none/)

The trusted host captures SauceDemo's public entry HTML, directly referenced same-origin JavaScript and CSS. The browser only reaches the loopback snapshot. It covers the client-side standard-user flows in these examples. Remote integrations, independently loaded assets and live network behavior are outside this setup. Capture hashes help distinguish a new app deployment from a new generated result.

Compilation and a green run establish executability. Reviewers still need to compare the spec with the expected behavior and challenge assertions that could pass against broken state. The pipeline generates one candidate per invocation. It leaves repair and adoption decisions to review.
