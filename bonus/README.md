# Optional bonus: text to Playwright

Generate one executable SauceDemo UI spec from a text case and retain its original model output and run evidence. The mandatory Playwright configuration still discovers 14 tests and runs independently of this pipeline.

## Setup

Use Node.js 24, the system `tar` (macOS built-in or GNU tar on Linux), and a local Docker context with a `unix:///` endpoint. Install dependencies and pull the image matching the locked Playwright version in the context you will use for execution. [Playwright Docker image](https://playwright.dev/docs/docker)

```sh
npm ci
docker pull mcr.microsoft.com/playwright:v1.65.1-noble
```

For generation, install Codex CLI and sign in with a ChatGPT account that has access to `gpt-6.2-sol`. Run `codex login` once and complete sign-in in the browser. Use `codex login status` to check the session. The original examples used CLI `0.171.0-alpha.13.2`. The independent review also verified generation with stable CLI `0.172.0`. Replay uses the Docker setup above without Codex authentication. [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)

On macOS, Colima is an optional way to create a separate Docker context with host mounts disabled. Choose a fresh profile name if `qa-bonus` is in use.

```sh
colima start qa-bonus --activate=false --mount none --vm-type vz --cpus 3 --memory 4 --disk 20 --runtime docker
export BONUS_DOCKER_CONTEXT=colima-qa-bonus
docker --context "$BONUS_DOCKER_CONTEXT" pull mcr.microsoft.com/playwright:v1.65.1-noble
```

Generation and replay were verified on macOS arm64 with Colima. Linux arm64 replay was verified inside the audit VM. Linux generation, macOS Docker Desktop, and WSL2 were unverified. Native Windows Docker Desktop defaults to an `npipe://` endpoint, which the Unix-socket check rejects. [Docker daemon sockets](https://docs.docker.com/reference/cli/docker/#daemon-socket-option)

## Generate and run

Provide a UTF-8 `.txt` file up to 8,000 bytes, with nonempty `Steps:` and `Expected:` sections on separate lines. Use public demo or synthetic data.

```sh
npm run bonus:generate -- bonus/examples/product-details/input.txt
npm run bonus:generate -- bonus/examples/checkout-recovery/input.txt
npm run bonus:generate -- bonus/examples/cart-sync/input.txt
npm run bonus:run -- bonus/examples/product-details/original.spec.ts
npm run bonus:run -- bonus/examples/checkout-recovery/corrected.spec.ts
npm run bonus:run -- bonus/examples/cart-sync/corrected.spec.ts
```

`generate` sends the prompt, input, `AGENTS.md` and the four UI Page Objects to headless Codex. It uses `codex -a never exec` with shell, hooks, image and web tools disabled, an empty working directory, a read-only agent sandbox, an explicit model and a structured `source` response. The exact invocation with run-local paths represented by `$RUN` is recorded in each result. The pipeline checks the Codex event stream for a completed response without tool calls. [Generation prompt](prompt.txt)

Both commands run the TypeScript AST policy, then stage the spec, Page Objects, runner and locked test dependencies in a disposable Docker container. Inside the container they run strict TypeScript checks, Playwright discovery for exactly one test, then Chromium. The stage layout resolves the `./pages/*` imports in preserved example files.

After accepting an input, the command prints its evidence directory under `bonus/runs/`. It records `result.json`, available diagnostics and the preserved candidate source. Generation runs also retain their input, prompt and Codex response locally. When export succeeds, `playwright-artifacts.tar` contains the available reports and failure attachments.

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
| 5 | Playwright execution failed or a valid report did not show one clean pass |
| 6 | Sandbox, runtime, required report or archive export failed |

If Playwright exits with `0` and its JSON report is missing, invalid or unreadable, execution is recorded as `unverified` and the command exits with `6`. A failed run retains its process exit code and primary diagnostics. Report and archive export errors appear separately.

## Examples and review

Each original was generated in one call to `gpt-6.2-sol` on 2026-11-27 and passed its first Chromium run with zero retries or skips. The original inputs, specs and result files preserve that history. The independent review later identified two assertions that passed against controlled regressions. Separate corrected specs and results record those changes.

| Case | Original evidence | Review outcome |
| --- | --- | --- |
| Product details and return | [Input](examples/product-details/input.txt) · [Spec](examples/product-details/original.spec.ts) · [Result](examples/product-details/result.json) | The visible name, price and description match the catalog. Returning shows the same product and price. No correction required. |
| Checkout recovery | [Input](examples/checkout-recovery/input.txt) · [Spec](examples/checkout-recovery/original.spec.ts) · [Result](examples/checkout-recovery/result.json) | The corrected spec requires a visible Onesie row and fields after checkout recovery. [Corrected spec](examples/checkout-recovery/corrected.spec.ts) · [Verification](examples/checkout-recovery/corrected-result.json) |
| Cart state from details | [Input](examples/cart-sync/input.txt) · [Spec](examples/cart-sync/original.spec.ts) · [Result](examples/cart-sync/result.json) | The corrected spec re-adds the Bike Light, verifies the cart count and product control, then removes it and checks the empty cart. [Corrected spec](examples/cart-sync/corrected.spec.ts) · [Verification](examples/cart-sync/corrected-result.json) |

The worklog records the controlled mutations, runtime checks and an independent generation experiment. [Final bonus review](../AI_WORKLOG.md#final-independent-bonus-review)

## Security and limits

Discovery and execution run as UID `1000` with `--network=none`, dropped capabilities, `no-new-privileges`, resource limits and zero host mounts. Staged files are readable by that user and owned by root inside the container. The pipeline copies only the files the runner needs and forwards no host environment or Docker socket. The AST allowlist restricts TypeScript expressions, imports and browser actions. These controls rely on a trusted host, Codex CLI, Docker Engine and local image. [Docker none network driver](https://docs.docker.com/engine/network/drivers/none/)

The host downloads the public SauceDemo entry HTML and its directly referenced same-origin JavaScript and CSS for each run. The snapshot stays out of Git. Chromium uses only the loopback copy. In the audit, six product images returned `404` in the snapshot and CSP blocked an external font. The text, product and cart flows remained executable. Visual fidelity, remote integrations and live-service behavior are outside this setup. Exact reproduction depends on upstream availability and content. Run metadata records the captured hashes.

Compilation and a green run establish executability. Reviewers still need to compare the spec with the expected behavior and challenge assertions that could pass against broken state. The pipeline generates one candidate per invocation. It leaves repair and adoption decisions to review.
