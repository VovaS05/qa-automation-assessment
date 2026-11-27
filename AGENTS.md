# Repository instructions

This is a Playwright Test and strict TypeScript assessment for SauceDemo and Restful Booker. UI specs live in `tests/ui/`, screen interactions in `pages/`, and HTTP requests and booking fixtures in `tests/api/`. Use scenario IDs in descriptive test titles and write source and documentation in English.

- Keep business assertions in specs. Use built-in Playwright fixtures and focused page objects. Prefer SauceDemo's `data-test` IDs and accessible roles, and scope product actions to the named item.
- Use exact assertions for outcomes, including contents, prices and persisted state. Wait for observable UI changes with web-first assertions. Avoid fixed sleeps and test order dependencies.
- Start each UI test with a fresh context. Keep API tests browser-free and run them with one API worker. Never retry creation blindly.
- Mutate only bookings created by the current test. Track returned IDs before business assertions, verify ownership before mutating, and report teardown failures alongside any original failure. Never delete an ID reported as belonging to another booking.
- Use public demo credentials only in the checked-in defaults. Keep private credentials, authentication state, traces and generated reports out of Git. Changes targeting other deployments require an authorized test environment.
- Run `npm ci`, `npm run typecheck`, `npm run test:list`, and the affected suites before delivery. Check `git diff --check` and the staged changes. Verify the full suite and CI report for the delivered revision.
- Keep the README coverage and limitations current. Record real prompts, review findings and execution results in `AI_WORKLOG.md`. Report any unverified behavior.
