$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()

function Require-Match {
    param(
        [string]$RelativePath,
        [string]$Pattern,
        [string]$Description
    )

    $path = Join-Path $root $RelativePath
    if (-not (Test-Path -LiteralPath $path)) {
        $failures.Add("Missing $RelativePath")
        return
    }

    $text = Get-Content -LiteralPath $path -Raw -Encoding UTF8
    if ($text -notmatch $Pattern) {
        $failures.Add("$RelativePath does not state $Description")
    }
}

Require-Match 'DOCS/MACRO_GOAL.md' 'in minutes' 'the minutes-not-hours outcome'
Require-Match 'DOCS/REQUIREMENTS.md' 'REQ-005' 'the production-grade architecture requirement'
Require-Match 'DOCS/REQUIREMENTS.md' 'REQ-006' 'the black-and-white interface requirement'
Require-Match 'DOCS/DECISIONS.md' 'AI control plane over a deterministic edit engine' 'the AI trust boundary'
Require-Match 'DOCS/DECISIONS.md' 'Modular monolith' 'the initial architecture decision'
Require-Match 'DOCS/GOALS.md' 'G1 Interface design and renderer spike' 'the next goal'
Require-Match 'DOCS/CURRENT_STATE.md' 'Product capability remains \*\*E0' 'the honest evidence level'
Require-Match 'AGENTS.md' 'Chinese whispers' 'the intent-preservation rule'
Require-Match '.gitignore' 'DOCS/_raw/user_messages\.txt' 'private raw message exclusion'

$trackedSecretPatterns = @(
    '(?i)OPENAI_API_KEY\s*=\s*[^<\s]',
    '(?i)NVIDIA_API_KEY\s*=\s*[^<\s]',
    '(?i)OPENCODE_API_KEY\s*=\s*[^<\s]',
    '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
)

$relativeCandidates = & git -C $root ls-files --cached --others --exclude-standard
if ($LASTEXITCODE -ne 0) {
    throw 'Could not determine governance scope from Git.'
}

$candidateFiles = foreach ($relativePath in $relativeCandidates) {
    if ($relativePath -eq 'DOCS/_raw/user_messages.txt') {
        continue
    }

    $absolutePath = Join-Path $root $relativePath
    if (Test-Path -LiteralPath $absolutePath -PathType Leaf) {
        Get-Item -LiteralPath $absolutePath
    }
}

foreach ($file in $candidateFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction SilentlyContinue
    foreach ($pattern in $trackedSecretPatterns) {
        if ($content -match $pattern) {
            $failures.Add("Possible secret in $($file.FullName.Substring($root.Length + 1))")
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Error "Governance verification failed:`n$($failures -join "`n")"
}

Write-Output 'PASS: macro goal, architecture boundary, UX direction, evidence honesty, continuity rules, and secret guards are present.'
