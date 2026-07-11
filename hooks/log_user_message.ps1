$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$logPath = Join-Path $root 'DOCS/_raw/user_messages.txt'
$inputText = [Console]::In.ReadToEnd()

if ([string]::IsNullOrWhiteSpace($inputText)) {
    exit 0
}

try {
    $payload = $inputText | ConvertFrom-Json -ErrorAction Stop
} catch {
    exit 0
}

$prompt = $null
foreach ($name in @('prompt', 'user_prompt', 'message', 'content')) {
    $property = $payload.PSObject.Properties[$name]
    if ($null -ne $property -and -not [string]::IsNullOrWhiteSpace([string]$property.Value)) {
        $prompt = [string]$property.Value
        break
    }
}

if ([string]::IsNullOrWhiteSpace($prompt)) {
    exit 0
}

$directory = Split-Path -Parent $logPath
if (-not (Test-Path -LiteralPath $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

$timestamp = (Get-Date).ToString('o')
$entry = "`n--- $timestamp ---`n$prompt`n"
[System.IO.File]::AppendAllText($logPath, $entry, [System.Text.UTF8Encoding]::new($false))
