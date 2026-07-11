$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$currentState = Join-Path $root 'DOCS/CURRENT_STATE.md'
$decisions = Join-Path $root 'DOCS/DECISIONS.md'

$stateText = if (Test-Path -LiteralPath $currentState) {
    Get-Content -LiteralPath $currentState -Raw -Encoding UTF8
} else {
    'CURRENT_STATE.md is missing.'
}

$decisionHeadings = if (Test-Path -LiteralPath $decisions) {
    (Get-Content -LiteralPath $decisions -Encoding UTF8 |
        Where-Object { $_ -match '^## DEC-' }) -join "`n"
} else {
    'DECISIONS.md is missing.'
}

$context = @"
Before acting on this owner message, preserve zero Chinese whispers. The newest explicit owner correction has highest authority; update durable files when it changes the project.

Current state:
$stateText

Approved decision index:
$decisionHeadings
"@

@{ hookSpecificOutput = @{ additionalContext = $context } } |
    ConvertTo-Json -Depth 5 -Compress
