$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$files = @(
    'START_HERE.md',
    'DOCS/CURRENT_STATE.md',
    'DOCS/BUILD_TRACKER.md'
)

$parts = @()
foreach ($relative in $files) {
    $path = Join-Path $root $relative
    if (Test-Path -LiteralPath $path) {
        $content = Get-Content -LiteralPath $path -Raw -Encoding UTF8
        $parts += "--- $relative ---`n$content"
    }
}

$context = @"
Stage 2 continuity context follows. Treat committed project files as operational truth and reconcile them with the owner's newest explicit correction.

$($parts -join "`n")
"@

@{ hookSpecificOutput = @{ additionalContext = $context } } |
    ConvertTo-Json -Depth 5 -Compress
