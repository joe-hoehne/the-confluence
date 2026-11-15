param(
    [switch]$Apply,
    [switch]$CodeOnly,
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'deploy.local.json'),
    [switch]$ValidateConfigOnly
)

$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
foreach ($field in @('subscriptionId', 'tenantId')) {
    $parsed = [guid]::Empty
    if (-not [guid]::TryParse($config.$field, [ref]$parsed) -or $parsed -eq [guid]::Empty) {
        throw "Local deployment configuration requires a valid $field."
    }
}
if ($config.expectedHostname -notmatch '^[a-z0-9][a-z0-9.-]+\.azurewebsites\.net$') {
    throw 'Local deployment configuration requires the exact approved Azure hostname.'
}
$subscription = $config.subscriptionId
$tenant = $config.tenantId
if ($ValidateConfigOnly) {
    Write-Output 'Local deployment configuration is valid. No Azure operations performed.'
    return
}
$group = 'rg-the-confluence-westus3'
$location = 'westus3'
$app = 'the-confluence'
$template = Join-Path $PSScriptRoot 'main.bicep'
$project = Split-Path $PSScriptRoot -Parent

function Invoke-Azure {
    param([string[]]$Arguments)
    $result = & az @Arguments --only-show-errors
    if ($LASTEXITCODE -ne 0) { throw "Azure CLI failed: az $($Arguments[0..1] -join ' ')" }
    return $result
}

Push-Location $project
try {
    $account = Invoke-Azure @('account', 'show', '--subscription', $subscription, '-o', 'json') | ConvertFrom-Json
    if ($account.tenantId -ne $tenant -or $account.state -ne 'Enabled') { throw 'The authorized Azure subscription is not available in the expected tenant.' }
    $creditPolicy = Invoke-Azure @('rest', '--method', 'get', '--url',
        "https://management.azure.com/subscriptions/$subscription`?api-version=2022-12-01",
        '--query', 'subscriptionPolicies', '-o', 'json') | ConvertFrom-Json
    if ($creditPolicy.spendingLimit -ne 'On' -or $creditPolicy.quotaId -ne 'MSDN_2014-09-01') {
        throw 'Deployment requires the approved MSDN credit subscription with its spending limit On. No billing settings were changed.'
    }
    if ($CodeOnly) {
        $existing = Invoke-Azure @('webapp', 'show', '--subscription', $subscription, '--resource-group', $group,
            '--name', $app, '--query', '{host:defaultHostName,location:location,plan:serverFarmId}', '-o', 'json') | ConvertFrom-Json
        $planId = "/subscriptions/$subscription/resourceGroups/$group/providers/Microsoft.Web/serverfarms/plan-the-confluence"
        $plan = Invoke-Azure @('rest', '--method', 'get', '--url', "https://management.azure.com$planId`?api-version=2026-08-01",
            '--query', '{location:location,linux:properties.reserved,sku:sku.name,capacity:sku.capacity}', '-o', 'json') | ConvertFrom-Json
        if ($existing.host -ne $config.expectedHostname -or
            $existing.plan -ne $planId -or $existing.location.Replace(' ', '').ToLowerInvariant() -ne $location -or
            $plan.location.Replace(' ', '').ToLowerInvariant() -ne $location -or
            $plan.linux -ne $true -or $plan.sku -ne 'B1' -or $plan.capacity -ne 1) {
            throw 'Code-only publishing requires the existing approved hostname and West US 3 single-worker Linux B1 plan. No infrastructure was changed.'
        }
        $url = "https://$($existing.host)"
        $portal = "https://portal.azure.com/#resource/subscriptions/$subscription/resourceGroups/$group/overview"
    }

    # A subscription-scoped preview includes the new group without creating it first.
    Invoke-Azure @('deployment', 'sub', 'what-if', '--name', 'confluence', '--location', $location,
        '--subscription', $subscription, '--template-file', $template, '--no-pretty-print') | Write-Output
    if (-not $Apply) {
        if ($CodeOnly) {
            Write-Output 'Preview only. To publish only the existing app bundle, rerun with -Apply -CodeOnly.'
        } else {
            Write-Output 'Preview only. To provision and publish the approved West US 3 B1 configuration, rerun with -Apply.'
        }
        return
    }
    if (-not $CodeOnly) {
        Invoke-Azure @('deployment', 'sub', 'validate', '--name', 'confluence', '--location', $location,
            '--subscription', $subscription, '--template-file', $template, '-o', 'none')
    }

    & npm test
    if ($LASTEXITCODE -ne 0) { throw 'Engine and constellation tests failed.' }
    & npm run test:server
    if ($LASTEXITCODE -ne 0) { throw 'Production server tests failed.' }
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Production build failed.' }
    & npm run test:production
    if ($LASTEXITCODE -ne 0) { throw 'Reduced-motion production browser check failed.' }
    & npm run lint
    if ($LASTEXITCODE -ne 0) { throw 'Lint failed.' }

    # Code-only publishing deliberately skips infrastructure create/update operations.
    if (-not $CodeOnly) {
        $deployment = Invoke-Azure @('deployment', 'sub', 'create', '--name', 'confluence', '--location', $location,
            '--subscription', $subscription, '--template-file', $template, '-o', 'json') | ConvertFrom-Json
        $url = $deployment.properties.outputs.appUrl.value
        $portal = $deployment.properties.outputs.resourceGroupPortalUrl.value
    }

    $temporary = Join-Path ([IO.Path]::GetTempPath()) "confluence-deploy-$([guid]::NewGuid().ToString('N'))"
    try {
        $staging = Join-Path $temporary 'app'
        New-Item -ItemType Directory -Path $staging | Out-Null
        Copy-Item -LiteralPath (Join-Path $project 'dist') -Destination $staging -Recurse
        Copy-Item -LiteralPath (Join-Path $project 'server.mjs') -Destination $staging
        # The production bundle needs no dependencies or build tools.
        @{ name = 'the-confluence'; private = $true; type = 'module'; scripts = @{ start = 'node server.mjs' }; engines = @{ node = '24.x' } } |
            ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $staging 'package.json') -Encoding utf8NoBOM
        $zip = Join-Path $temporary 'confluence.zip'
        Compress-Archive -LiteralPath (Join-Path $staging 'dist'), (Join-Path $staging 'server.mjs'), (Join-Path $staging 'package.json') -DestinationPath $zip
        Invoke-Azure @('webapp', 'deploy', '--subscription', $subscription, '--resource-group', $group, '--name', $app,
            '--type', 'zip', '--src-path', $zip, '--clean', 'true', '--restart', 'true', '--track-status', 'true', '--timeout', '600000', '-o', 'none')
    }
    finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
    }

    for ($attempt = 1; $attempt -le 12; $attempt++) {
        $health = Invoke-WebRequest -Uri "$url/healthz" -TimeoutSec 30 -SkipHttpErrorCheck
        if ($health.StatusCode -eq 200 -and $health.Content -eq 'ok') { break }
        if ($health.StatusCode -notin @(502, 503, 504) -or $attempt -eq 12) {
            throw "Hosted readiness failed: $url/healthz (HTTP $($health.StatusCode))."
        }
        Write-Output "Waiting for App Service startup: HTTP $($health.StatusCode), attempt $attempt/12."
        Start-Sleep -Seconds 10
    }
    Write-Output "Application: $url"
    Write-Output "Azure resources: $portal"
}
finally {
    Pop-Location
}
