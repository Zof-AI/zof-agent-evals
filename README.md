# Zof Agent Evaluations

Evaluate a JavaScript candidate snapshot against explicit input/output tests in a constrained **local Docker container**. Candidate output is compared in the parent process; reports include test outcomes and fixed reason codes, never raw output or logs. Three public task definitions come from `@zof-ai/reliability-bench` and results use Evidence 1.0.0.



Requires Node.js 22 or newer, a local Docker engine and the pinned Node image documented in [sandbox controls](docs/SANDBOX.md). The evaluator never pulls images, installs candidate dependencies, or uses a remote Docker endpoint.

<!-- ZOF_NPM_INSTALL_START -->
## Install from npm

Use Node.js 22 or 24 and npm. File-based operations require Linux or macOS with Python 3.10 or newer; Windows file operations fail closed. In a new project directory, install the version used by this guide:

```sh
npm install --ignore-scripts --save-exact @zof-ai/agent-evals@0.1.1
npx --no-install zof-agent-evals --help
```

The package includes compiled JavaScript, TypeScript declarations and its runtime dependencies. No source build, Zof account or repository upload is required. `--ignore-scripts` disables installation lifecycle scripts; `--no-install` keeps the example commands from downloading another package.

Confirm the public ESM entry point; this prints `function`:

```sh
node --input-type=module -e "import('@zof-ai/agent-evals').then(api => console.log(typeof api.evaluateCandidate))"
```

Run a packaged example from the same directory:

```sh
npx --no-install zof-agent-evals tasks
```

The command lists the three public evaluation tasks. Actual candidate evaluation additionally requires the explicitly provisioned local Docker image described in the sandbox guide.

Package: [@zof-ai/agent-evals](https://www.npmjs.com/package/@zof-ai/agent-evals). The source-checkout instructions and three additional workflows follow.
<!-- ZOF_NPM_INSTALL_END -->

<!-- ZOF_RELEASE_INSTALL_START -->
## Install from GitHub source

Requires Node.js 22 or 24, npm, and Git. Filesystem operations require Linux or macOS with Python 3.10 or newer; Windows file operations fail closed. Clone this repository and explicitly prepare its reviewed release dependencies:

```sh
git clone --branch v0.1.1 --depth 1 https://github.com/Zof-AI/zof-agent-evals.git
cd zof-agent-evals
node scripts/bootstrap.mjs --allow-network
npm ci --ignore-scripts --prefer-offline
npm run build
npm test
```

The bootstrap downloads only the exact versioned dependency assets from [GitHub Releases](https://github.com/Zof-AI/zof-agent-evals/releases), as listed in `scripts/release-dependencies.json`, verifies SHA256 and byte size, and adds them to the npm cache. It does not extract archives, run package scripts, collect application data, or send credentials. Downloads require the explicit flag and follow only HTTPS GitHub asset redirects. Installation then fetches ordinary third-party dependencies from npm. Use a writable npm cache; set `npm_config_cache` consistently for both commands if needed. An unavailable asset, changed hash, or oversized response stops installation.

<!-- ZOF_RELEASE_INSTALL_END -->

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
