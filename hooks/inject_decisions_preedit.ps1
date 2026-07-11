$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$requirementsPath = Join-Path $root 'DOCS/REQUIREMENTS.md'
$decisionsPath = Join-Path $root 'DOCS/DECISIONS.md'

$requirements = if (Test-Path -LiteralPath $requirementsPath) {
    (Get-Content -LiteralPath $requirementsPath -Encoding UTF8 |
        Where-Object { $_ -match '^### REQ-' }) -join "`n"
} else {
    'Requirements file missing.'
}

$decisions = if (Test-Path -LiteralPath $decisionsPath) {
    (Get-Content -LiteralPath $decisionsPath -Encoding UTF8 |
        Where-Object { $_ -match '^## DEC-' }) -join "`n"
} else {
    'Decisions file missing.'
}

$context = @"
Pre-edit quality gate:
- Link the edit to an approved requirement and decision.
- Keep domain logic independent of UI, AI provider, renderer, and storage adapters.
- Preserve immutable source media, validation, history, undo, and safe failure.
- For production behavior, confirm the failing test and acceptance criterion first.
- Update state/tracker/log with meaningful changes.

Requirement index:
$requirements

Decision index:
$decisions
"@

@{ hookSpecificOutput = @{ additionalContext = $context } } |
    ConvertTo-Json -Depth 5 -Compress
