[CmdletBinding()]
param(
    [string]$ReplayRoot = 'C:\Users\Lenovo\Documents\InternalRepo_Replay_1984b4e',
    [string]$NodeCommand = 'C:\Program Files\nodejs\node.exe',
    [string]$CodexEntrypoint = 'C:\Users\Lenovo\AppData\Roaming\npm\node_modules\@openai\codex\bin\codex.js',
    [string]$ConnectorBootstrap = 'C:\Users\Lenovo\.codex\plugins\local\legacy-spec-agent\connector\bootstrap.mjs',
    [string]$Model = 'gpt-5.6-sol',
    [ValidateSet('low', 'medium', 'high', 'xhigh')]
    [string]$ReasoningEffort = 'medium',
    [switch]$SmokeConnector,
    [switch]$Resume,
    [switch]$Execute
)

$ErrorActionPreference = 'Stop'
$Utf8NoBom = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom
$PinnedRevision = '1984b4e324b9e4bec7fa2c7f48fc1b105737fbee'
$ControlRoot = Join-Path $ReplayRoot 'control'
$ConnectorRoot = Join-Path $ReplayRoot 'connector'
$ResultsRoot = Join-Path $ReplayRoot 'results'
$ManifestPath = Join-Path $PSScriptRoot 'manifest.json'
$LegacyPluginId = 'legacy-spec-agent@legacy-spec-agent-local'

function ConvertTo-TomlString([string]$Value) {
    return '"' + ($Value -replace '\\', '\\' -replace '"', '\"') + '"'
}

function Assert-Command([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Label not found: $Path"
    }
}

function Get-GitOutput([string]$Root, [string[]]$Arguments) {
    $output = & git -C $Root @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git -C $Root $($Arguments -join ' ') failed"
    }
    return ($output -join "`n").Trim()
}

function Assert-Worktree([string]$Root, [string]$Condition) {
    if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
        throw "$Condition worktree not found: $Root"
    }
    $head = Get-GitOutput $Root @('rev-parse', 'HEAD')
    if ($head -ne $PinnedRevision) {
        throw "$Condition HEAD is $head; expected $PinnedRevision"
    }
    $status = Get-GitOutput $Root @('status', '--short')
    if ($status) {
        throw "$Condition worktree is not clean before replay:`n$status"
    }
}

function Write-JsonFile([string]$Path, [object]$Value) {
    $Value | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding utf8
}

function Get-TraceMetrics([string]$TranscriptPath) {
    $events = [System.Collections.Generic.List[object]]::new()
    foreach ($line in Get-Content -LiteralPath $TranscriptPath) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try { $events.Add(($line | ConvertFrom-Json)) } catch { }
    }

    $turn = $events | Where-Object { $_.type -eq 'turn.completed' } | Select-Object -Last 1
    if (-not $turn) { throw "No turn.completed usage event in $TranscriptPath" }

    $connectorCalls = @($events | Where-Object {
        $_.type -eq 'item.completed' -and
        $_.item.type -eq 'mcp_tool_call' -and
        $_.item.server -in @('replay_connector', 'replay-connector')
    })
    $connectorBytes = 0L
    foreach ($event in $connectorCalls) {
        if ($null -ne $event.item.result) {
            $json = $event.item.result | ConvertTo-Json -Depth 40 -Compress
            $connectorBytes += [Text.Encoding]::UTF8.GetByteCount($json)
        }
    }

    $commandEvents = @($events | Where-Object {
        $_.type -eq 'item.completed' -and $_.item.type -eq 'command_execution'
    })
    $nodeReadEvents = @($events | Where-Object {
        $_.type -eq 'item.completed' -and
        $_.item.type -eq 'mcp_tool_call' -and
        $_.item.server -eq 'node_repl' -and
        (($_.item.arguments | ConvertTo-Json -Compress) -match 'readFile|readFileSync|readdir|Get-Content|Select-String|rg ')
    })

    return [ordered]@{
        provider_input_tokens = [long]$turn.usage.input_tokens
        provider_cached_input_tokens = [long]$turn.usage.cached_input_tokens
        provider_cache_write_input_tokens = [long]$turn.usage.cache_write_input_tokens
        provider_output_tokens = [long]$turn.usage.output_tokens
        provider_reasoning_output_tokens = [long]$turn.usage.reasoning_output_tokens
        provider_tool_tokens = 'not_separately_exposed'
        primary_metered_measure_name = 'provider_input_tokens'
        primary_metered_measure = [long]$turn.usage.input_tokens
        connector_calls = $connectorCalls.Count
        connector_response_bytes = $connectorBytes
        command_execution_events = $commandEvents.Count
        node_source_read_events = $nodeReadEvents.Count
        unique_source_reads = 'requires_trace_review'
        repeated_source_reads = 'requires_trace_review'
    }
}

Assert-Command $NodeCommand 'Node.js'
Assert-Command $CodexEntrypoint 'Codex CLI entrypoint'
Assert-Command $ConnectorBootstrap 'Legacy Spec connector bootstrap'
Assert-Command $ManifestPath 'Replay manifest'
Assert-Worktree $ControlRoot 'control'
Assert-Worktree $ConnectorRoot 'connector'

$codexVersion = ((& $NodeCommand $CodexEntrypoint --version) | Select-Object -First 1)
if ([string]::IsNullOrWhiteSpace($codexVersion)) {
    throw 'Unable to read Codex CLI version'
}
$codexVersion = $codexVersion.Trim()
$manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json

Write-Host "Preflight passed"
Write-Host "  Codex: $codexVersion"
Write-Host "  Model: $Model ($ReasoningEffort)"
Write-Host "  Control: $ControlRoot"
Write-Host "  Connector: $ConnectorRoot"
Write-Host "  Results: $ResultsRoot"
Write-Host "  Revision: $PinnedRevision"

if ($SmokeConnector) {
    $rawMcpConfig = @(
        '-c', 'mcp_servers.replay_connector.command="node"',
        '-c', ('mcp_servers.replay_connector.args=[' + (ConvertTo-TomlString $ConnectorBootstrap) + ']'),
        '-c', ('mcp_servers.replay_connector.cwd=' + (ConvertTo-TomlString $ConnectorRoot)),
        '-c', 'mcp_servers.replay_connector.default_tools_approval_mode="writes"',
        '-c', 'mcp_servers.replay_connector.required=true',
        '-c', 'mcp_servers.replay_connector.startup_timeout_sec=30'
    )
    Write-Host 'Resolved MCP configuration:'
    & $NodeCommand $CodexEntrypoint mcp list --json @rawMcpConfig
    if ($LASTEXITCODE -ne 0) { throw "MCP config inspection failed with exit code $LASTEXITCODE" }

    $smokeArgs = @(
        '-a', 'on-request',
        'exec', '--json', '--ephemeral',
        '--sandbox', 'read-only',
        '--model', $Model,
        '-c', "model_reasoning_effort=$(ConvertTo-TomlString $ReasoningEffort)",
        '-c', 'approvals_reviewer="auto_review"',
        '-c', "plugins.`"$LegacyPluginId`".enabled=false"
    )
    $smokeArgs += $rawMcpConfig
    $smokeArgs += @(
        '-C', $ConnectorRoot,
        'You must call the verify_citation tool from MCP server replay_connector exactly once for README.md line 1 with expected snippet # InternalRepo. Return the tool verdict and actual_source. If that tool is unavailable, reply exactly UNAVAILABLE. Do not answer from memory and do not call any other tool.'
    )
    & $NodeCommand $CodexEntrypoint @smokeArgs
    if ($LASTEXITCODE -ne 0) { throw "Connector smoke failed with exit code $LASTEXITCODE" }
    exit 0
}

if (-not $Execute) {
    Write-Host ''
    Write-Host 'Dry run only. Re-run from an ordinary PowerShell terminal with -Execute.'
    exit 0
}

New-Item -ItemType Directory -Force -Path $ResultsRoot | Out-Null
$runIndex = 0
foreach ($task in $manifest.runs) {
    foreach ($condition in $task.condition_order) {
        $runIndex++
        $worktree = if ($condition -eq 'control') { $ControlRoot } else { $ConnectorRoot }
        $runDir = Join-Path (Join-Path $ResultsRoot $task.task_id) $condition
        $recordPath = Join-Path $runDir 'run-record.json'
        if ($Resume -and (Test-Path -LiteralPath $recordPath -PathType Leaf)) {
            $existing = Get-Content -Raw -LiteralPath $recordPath | ConvertFrom-Json
            $treatmentOk = $condition -eq 'control' -or [int]$existing.connector_calls -gt 0
            if ([int]$existing.exit_code -eq 0 -and $treatmentOk) {
                Write-Host "[$runIndex/10] $($task.task_id) / $condition (resume: valid completed run)"
                continue
            }
        }

        Assert-Worktree $worktree $condition
        New-Item -ItemType Directory -Force -Path $runDir | Out-Null
        $transcriptPath = Join-Path $runDir 'transcript.jsonl'
        $stderrPath = Join-Path $runDir 'stderr.log'
        $resultPath = Join-Path $runDir 'result.md'

        $args = @(
            '-a', 'on-request',
            'exec', '--json', '--ephemeral',
            '--sandbox', 'workspace-write',
            '--model', $Model,
            '-c', "model_reasoning_effort=$(ConvertTo-TomlString $ReasoningEffort)",
            '-c', 'approvals_reviewer="auto_review"',
            '-c', "plugins.`"$LegacyPluginId`".enabled=false",
            '-C', $worktree,
            '-o', $resultPath
        )

        if ($condition -eq 'connector') {
            $args += @(
                '-c', 'mcp_servers.replay_connector.command="node"',
                '-c', ('mcp_servers.replay_connector.args=[' + (ConvertTo-TomlString $ConnectorBootstrap) + ']'),
                '-c', ('mcp_servers.replay_connector.cwd=' + (ConvertTo-TomlString $worktree)),
                '-c', 'mcp_servers.replay_connector.default_tools_approval_mode="writes"',
                '-c', 'mcp_servers.replay_connector.required=true',
                '-c', 'mcp_servers.replay_connector.startup_timeout_sec=30'
            )
        }
        $effectivePrompt = if ($condition -eq 'connector') {
            "Experimental condition: use at least one relevant tool from the replay_connector MCP server while completing the task. The run is invalid if no replay_connector call succeeds.`n`n$($task.prompt)"
        } else {
            [string]$task.prompt
        }
        $args += $effectivePrompt

        Write-Host "[$runIndex/10] $($task.task_id) / $condition"
        $stopwatch = [Diagnostics.Stopwatch]::StartNew()
        & $NodeCommand $CodexEntrypoint @args 1> $transcriptPath 2> $stderrPath
        $exitCode = $LASTEXITCODE
        $stopwatch.Stop()

        $metrics = Get-TraceMetrics $transcriptPath
        $metrics.task_id = $task.task_id
        $metrics.condition = $condition
        $metrics.model = $Model
        $metrics.model_reasoning_effort = $ReasoningEffort
        $metrics.codex_cli = $codexVersion
        $metrics.exit_code = $exitCode
        $metrics.elapsed_ms = $stopwatch.ElapsedMilliseconds
        $metrics.task_result = if ($exitCode -eq 0) { 'requires_quality_review' } else { 'fail' }
        $metrics.citation_result = 'requires_quality_review'
        $metrics.treatment_compliance = if ($condition -eq 'connector') {
            if ($metrics.connector_calls -gt 0) { 'pass' } else { 'fail_zero_connector_calls' }
        } else {
            'pass_no_connector_configured'
        }
        $metrics.transcript = $transcriptPath
        $metrics.final_result = $resultPath
        Write-JsonFile $recordPath $metrics

        if ($task.task_id -eq 'task05-change') {
            & git -C $worktree diff --binary | Set-Content -LiteralPath (Join-Path $runDir 'change.diff') -Encoding utf8
        } elseif (Get-GitOutput $worktree @('status', '--short')) {
            throw "$($task.task_id) / $condition mutated a read-only task worktree; pair is invalid"
        }

        if ($exitCode -ne 0) {
            throw "$($task.task_id) / $condition failed with exit code $exitCode"
        }
        if ($condition -eq 'connector' -and $metrics.connector_calls -eq 0) {
            throw "$($task.task_id) / connector made zero replay_connector calls; treatment is invalid"
        }
    }
}

Write-Host 'All 10 treatment-compliant runs completed. Review citations and trace read counts before making a decision.'
