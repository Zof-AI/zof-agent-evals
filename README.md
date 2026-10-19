# Zof Agent Evaluations

Evaluate a JavaScript candidate snapshot against explicit input/output tests in a constrained **local Docker container**. Candidate output is compared in the parent process; reports include test outcomes and fixed reason codes, never raw output or logs. Three public task definitions come from `@zof-ai/reliability-bench` and results use Evidence 1.0.0.

This is an unpublished 0.1.0 candidate. Dependencies must be staged from reviewed local tarballs until approved publication. The committed lock describes intended registry artifacts; public clean installation remains blocked until those dependencies are published. With a release-coordinator-seeded isolated cache, use `npm ci --offline --ignore-scripts`. After publication, use `npm ci --ignore-scripts`.

Requires Node.js 22 or newer, a local Docker engine and the pinned Node image documented in [sandbox controls](docs/SANDBOX.md). The evaluator never pulls images, installs candidate dependencies, or uses a remote Docker endpoint.

## Three examples

```sh
npm run build
node dist/cli.js evaluate correct.mjs --root examples --task deduplicate-payments
node dist/cli.js evaluate incorrect.mjs --root examples --task deduplicate-payments
node dist/cli.js evaluate profile.mjs --root examples --task compatible-profile
npm test
npm run test:container
```

Correct and profile exit 0; incorrect exits 1. Missing Docker, rejected input, timeouts or incomplete execution exit 2. Known candidate failures remain failed evidence. The explicit evaluate command authorizes running only the selected bounded `.mjs` file against the selected data-only task. It never executes the source on the host.

Candidates export `solve(input)` returning a JSON-compatible value, synchronously or asynchronously. Each case runs in a fresh container. Only one candidate file, one case input, and a fixed harness are copied into a fresh protected staging directory; the original directory is not mounted. Expected values remain outside the container.

`node dist/cli.js tasks` lists the actual public tasks. `--task-file task.json` loads an explicitly selected custom data-only task under the same root. `--timeout 500..10000` controls total per-case time including container startup. `--agent name` records a bounded, redacted user-provided label. No environment variables are copied into evidence.

Library: `evaluateCandidate({root, candidate, task: idOrTask, timeoutMs?, agent?: {name,version?}})` returns `{taskId,outcomes,evidence}`. `validateTask(value)` validates and copies the data-only task. `SANDBOX_IMAGE` exports the pinned image identifier. `sandboxArguments` exposes the constrained argument builder for auditing, without executing a command.

Read [task format](docs/TASKS.md), [sandbox and limitations](docs/SANDBOX.md), and [security reporting](SECURITY.md).
