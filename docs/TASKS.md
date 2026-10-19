# Task format 1.0.0

```json
{"version":"1.0.0","id":"double","description":"Double the supplied number","cases":[{"name":"positive","input":2,"expected":4},{"name":"zero","input":0,"expected":0}]}
```

Tasks contain only id, version, description and 1–32 cases. Each case contains a bounded name, JSON input and JSON expected value. Unknown properties are rejected. Cases cannot contain commands, imports, harness source, environment mappings or endpoint settings. A case is at most 32 KiB, with the shared evidence JSON depth and node bounds.

Candidate source is a single `.mjs` file of at most 128 KiB. It may use Node built-ins within the container, but has no installed third-party dependencies and cannot fetch them. Multi-file changes, arbitrary repository build scripts, package installation and non-JavaScript candidates are currently unsupported. Save the resulting self-contained module snapshot for evaluation; this tool does not apply patches to a repository.

The parent compares actual JSON output with the expected value using strict deep equality. It does not trust candidate-supplied pass labels. Extra logging causes invalid protocol output and cannot be used to forge a summary report. Public tasks can be overfit and are not hidden security tests. Test passing is a measured observation for these cases, not proof of general correctness.

Reasons are MATCH, MISMATCH, CANDIDATE_ERROR, TIMEOUT, OUTPUT_LIMIT, SANDBOX_UNAVAILABLE, or CLEANUP_UNCONFIRMED. No caught candidate exception text or output is included. Missing sandbox produces missing/unknown evidence. Candidate mismatches/errors produce failed tests. Timeout/output limit yields partial/fail; unconfirmed cleanup or infrastructure loss yields error/unknown and stops remaining cases.

The optional agent name/version is an explicit assertion supplied by the user. No agent identity is authenticated and no model ranking is claimed. Core evidence source repository/commit are unknown because only a selected file snapshot is loaded. Evaluation metadata records task version, pinned image and time limit. The outer environment field identifies the host runner runtime, not the container's untrusted self-report.
