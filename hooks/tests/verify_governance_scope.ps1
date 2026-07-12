$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$verifier = Join-Path $root 'hooks/verify_governance.ps1'
$ignoredSentinel = Join-Path $root 'node_modules/governance-ignored-sentinel.tmp'
$untrackedSentinel = Join-Path $root 'governance-untracked-sentinel.tmp'
$fakeSecret = 'OPENAI_' + 'API_KEY=not-a-real-secret'

function Invoke-Verifier {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $verifier 2>&1
        return [pscustomobject]@{
            ExitCode = $LASTEXITCODE
            Output = ($output -join [Environment]::NewLine)
        }
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

try {
    [System.IO.File]::WriteAllText($ignoredSentinel, $fakeSecret)
    $ignoredResult = Invoke-Verifier
    if ($ignoredResult.ExitCode -ne 0) {
        throw "Ignored dependency files must not enter governance scope:`n$($ignoredResult.Output)"
    }

    [System.IO.File]::WriteAllText($untrackedSentinel, $fakeSecret)
    $untrackedResult = Invoke-Verifier
    if ($untrackedResult.ExitCode -eq 0) {
        throw 'Untracked, non-ignored project files must enter governance scope.'
    }
    if ($untrackedResult.Output -notmatch 'governance-untracked-sentinel\.tmp') {
        throw "Governance failed without identifying the untracked sentinel:`n$($untrackedResult.Output)"
    }
}
finally {
    Remove-Item -LiteralPath $ignoredSentinel, $untrackedSentinel -Force -ErrorAction SilentlyContinue
}

Write-Output 'PASS: governance scans tracked and untracked project files while excluding ignored dependencies.'
