$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$required = @(
    '.codex/config.toml',
    '.codex/hooks.json',
    '.gitignore',
    '.gitattributes',
    'AGENTS.md',
    'README.md',
    'START_HERE.md',
    'DOCS/INDEX.md',
    'DOCS/MACRO_GOAL.md',
    'DOCS/GOALS.md',
    'DOCS/CURRENT_STATE.md',
    'DOCS/HANDOVER_RUNBOOK.md',
    'DOCS/BUILD_TRACKER.md',
    'DOCS/REQUIREMENTS.md',
    'DOCS/DECISIONS.md',
    'DOCS/INTERFACE_PRINCIPLES.md',
    'DOCS/ANTI_DRIFT_PROTOCOL.md',
    'DOCS/CHANGE_POLICY.md',
    'DOCS/FAILURE_REGISTRY.md',
    'DOCS/AOCS_BLACKBOARD.md',
    'DOCS/DEFERRED_IDEAS.md',
    'DOCS/PROJECT_LOG.md',
    'DOCS/plans/2026-07-12-stage2-master-plan.md',
    'DOCS/plans/2026-07-12-g1-interface-renderer-spike.md',
    'hooks/inject_context.ps1',
    'hooks/log_user_message.ps1',
    'hooks/inject_on_prompt.ps1',
    'hooks/inject_decisions_preedit.ps1',
    'hooks/verify_governance.ps1'
)

$missing = @()
foreach ($relative in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relative))) {
        $missing += $relative
    }
}

if ($missing.Count -gt 0) {
    Write-Error "Missing required G0 files:`n$($missing -join "`n")"
}

$hooksPath = Join-Path $root '.codex/hooks.json'
try {
    Get-Content -LiteralPath $hooksPath -Raw -Encoding UTF8 |
        ConvertFrom-Json -ErrorAction Stop | Out-Null
} catch {
    Write-Error "Invalid .codex/hooks.json: $($_.Exception.Message)"
}

$config = Get-Content -LiteralPath (Join-Path $root '.codex/config.toml') -Raw -Encoding UTF8
if ($config -notmatch '(?m)^hooks\s*=\s*true\s*$') {
    Write-Error '.codex/config.toml does not enable hooks.'
}

$rawLog = Join-Path $root 'DOCS/_raw/user_messages.txt'
if (-not (Test-Path -LiteralPath $rawLog)) {
    New-Item -ItemType File -Path $rawLog -Force | Out-Null
}

Write-Output "PASS: all $($required.Count) required G0 files exist; hook JSON parses; hooks are enabled."
