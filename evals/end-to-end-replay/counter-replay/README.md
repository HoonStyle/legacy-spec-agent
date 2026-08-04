# Counter-enabled InternalRepo replay

> **Anonymization note.** The replay target is a private company repository. Its
> real name is replaced with the placeholder `InternalRepo` throughout these
> records — prose, source paths, namespaces, harness defaults, and the smoke
> snippet. The pinned revision SHA, line numbers, and all measurements are
> unchanged.

The treatment-compliant 2026-08-04 run is evaluated in [DECISION.md](DECISION.md). Its final result is **Stop**: only one of five input-token pairs improved, the paired median worsened, and every connector run reopened the full symbol index.

The harness now adds a connector-condition instruction requiring at least one
relevant `replay_connector` call and stops immediately if the trace records zero
calls. Native-process output encoding is also fixed to UTF-8 for subsequent diff
captures. Use fresh clean worktrees for the next replay; the completed task05
worktrees contain the evaluated SPEC edits.

If an execution is interrupted before task05 mutates a worktree, pass `-Resume`
to retain completed, treatment-compliant run records and continue at the first
incomplete condition.

This harness repeats the preserved five InternalRepo task pairs with exact Codex CLI
provider counters and wall-clock timing. It does not estimate missing counters.

## Preflight findings

- Codex CLI `0.146.0` emits per-run `input_tokens`, `cached_input_tokens`,
  `cache_write_input_tokens`, `output_tokens`, and `reasoning_output_tokens` in
  the final `turn.completed` JSONL event.
- The CLI does not expose a separate tool-token field. The run record therefore
  stores `provider_tool_tokens: not_separately_exposed` and records connector
  response bytes separately.
- The harness invokes the npm package's `codex.js` through Node instead of the
  Windows `codex.cmd` shim. The shim strips the nested quotes required by TOML
  array overrides such as the raw MCP server's `args` value.
- The installed plugin's default MCP working directory resolves to the plugin
  checkout, not the target InternalRepo worktree. Connector runs therefore disable
  the plugin instance and launch the same `connector/bootstrap.mjs` as a raw MCP
  server with the connector worktree as `cwd`.
- The preserved pilot used `claude-opus-4-8[1m]`. The counter-enabled runner
  available here uses `gpt-5.6-sol` with medium reasoning. This is an explicit
  provider/model deviation; conditions inside every new pair remain identical.
- Codex CLI launched recursively from inside the Codex desktop agent cannot
  reliably spawn its Windows sandbox user for ordinary shell reads. Run the
  harness from a normal PowerShell or Windows Terminal session, not from the
  desktop agent's nested command runner.

## Prepared worktrees

The setup created two detached, clean worktrees at the pinned revision:

```text
C:\Users\Lenovo\Documents\InternalRepo_Replay_1984b4e\control
C:\Users\Lenovo\Documents\InternalRepo_Replay_1984b4e\connector
```

Raw results are written outside both worktrees:

```text
C:\Users\Lenovo\Documents\InternalRepo_Replay_1984b4e\results
```

## Run

Use PowerShell 7 (`pwsh`). Windows PowerShell 5 strips the nested quotes in the
TOML array override used to launch the raw connector.

First perform the non-mutating preflight from an ordinary terminal:

```powershell
pwsh -NoProfile -File "C:\Users\Lenovo\Documents\InternalRepo_Project\Doc\ReplayPilot\CounterReplay\run-replay.ps1"
```

Optionally verify that the raw connector resolves `README.md` from the InternalRepo
connector worktree rather than from the plugin checkout:

```powershell
pwsh -NoProfile -File "C:\Users\Lenovo\Documents\InternalRepo_Project\Doc\ReplayPilot\CounterReplay\run-replay.ps1" -SmokeConnector
```

Then run all ten executions from the same ordinary PowerShell session:

```powershell
pwsh -NoProfile -File "C:\Users\Lenovo\Documents\InternalRepo_Project\Doc\ReplayPilot\CounterReplay\run-replay.ps1" -Execute
```

The harness refuses to start if either worktree is dirty or not pinned to
`1984b4e324b9e4bec7fa2c7f48fc1b105737fbee`. It preserves each JSONL transcript,
stderr log, final response, elapsed time, provider usage, connector call count,
connector response bytes, and the Task 5 diff.

`unique_source_reads`, `repeated_source_reads`, task quality, and citation
accuracy intentionally remain `requires_trace_review` until the raw trace and
source citations have been reviewed. They are not inferred from bytes or token
counts.
