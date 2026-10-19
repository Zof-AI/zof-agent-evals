# Sandbox controls and privacy

Candidate code runs only inside the locally available pinned image:

`node@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c`

The image is the Node 22 slim reference used for this release candidate. Image availability must be arranged explicitly by an authorized operator. No automatic pull or remote Docker endpoint is accepted.

Controls: network none, read-only root filesystem, UID/GID 65534, all capabilities dropped, no-new-privileges, Docker's default seccomp profile, PID limit 32, memory/swap 128 MiB, CPU limit 0.5, Node heap 64 MiB, and a 16 MiB noexec/nosuid temporary filesystem. There are no published ports, privileged mode, host PID namespaces, production directories, credential mounts or Docker socket mounts. The only bind mount is the copied task staging directory, read-only.

The host staging parent has mode 0700; its mounted child permits the non-root container to read only the copied candidate, current input and fixed harness. The original source directory and expected values are not mounted. At most two evaluations may be active per process; additional calls are rejected. Each case gets a unique container name. A wall-clock timeout kills the Docker client and triggers forced container removal; bounded follow-up checks confirm absence. Cleanup uncertainty is reported as an error and stops further cases. Staging files are removed in finally blocks.

Candidate stdout/stderr share a 64 KiB limit. Stderr is discarded immediately. Stdout is parsed only as a JSON result, compared privately with expected output, and discarded. No raw outputs, logs, source, expected values, arbitrary environment or Docker diagnostics are returned. Only explicit agent metadata, outcomes and safe fixed codes are recorded. Known secret patterns are redacted in supplied labels; do not use production credentials in task data.

Docker shares a kernel with its Linux host and is not a complete defense against container-runtime/kernel vulnerabilities. This release demonstrates bounded local isolation for synthetic tasks, not multi-tenant hostile-code hosting. Do not expose it as a public compute service or run it with privileged options. There is no unsafe execution mode. Resource limits apply per process/container; an external service would additionally need server-side global quota/authentication/isolation controls and is not implemented.

Input file reads require a stable caller-controlled source root, reject symlinks/traversal and never fetch URLs. Local Docker daemon access is a prerequisite and is trusted. Windows engine behavior and hosted runner matrices have not been accepted in this local release candidate; measured container acceptance uses local Docker Desktop on macOS with Linux containers.
