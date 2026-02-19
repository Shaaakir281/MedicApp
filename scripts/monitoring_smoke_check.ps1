param(
    [string]$ResourceGroup = "medicapp-rg",
    [string]$AppInsights = "medicapp-appinsights",
    [int]$Days = 7
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-AppInsightsQuery {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Query
    )

    # Azure CLI (PowerShell) handles multiline KQL inconsistently.
    # Normalize to a single line to avoid truncated queries.
    $normalizedQuery = ($Query -replace "`r", " " -replace "`n", " ").Trim()

    $json = az monitor app-insights query `
        --app $AppInsights `
        --resource-group $ResourceGroup `
        --analytics-query $normalizedQuery `
        -o json

    if ($LASTEXITCODE -ne 0) {
        throw "Azure CLI query failed."
    }

    return ($json | ConvertFrom-Json)
}

function Get-ScalarCount {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Query
    )

    $result = Invoke-AppInsightsQuery -Query $Query
    if (-not $result.tables -or $result.tables.Count -eq 0) { return 0 }
    $table = $result.tables[0]
    $rows = $table.rows
    if (-not $rows -or $rows.Count -eq 0) { return 0 }

    $columns = $table.columns
    $preferredNames = @("value", "count_", "count")

    foreach ($name in $preferredNames) {
        $idx = -1
        for ($i = 0; $i -lt $columns.Count; $i++) {
            if ($columns[$i].name -eq $name) {
                $idx = $i
                break
            }
        }
        if ($idx -ge 0) {
            return [int][double]$rows[0][$idx]
        }
    }

    if ($rows.Count -gt 1) {
        throw "Scalar query returned multiple rows; expected an aggregate single row."
    }

    for ($i = 0; $i -lt $columns.Count; $i++) {
        if ($columns[$i].type -in @("long", "int", "real", "decimal")) {
            return [int][double]$rows[0][$i]
        }
    }

    # Last fallback: first parseable numeric cell in first row.
    foreach ($cell in $rows[0]) {
        try {
            return [int][double]$cell
        }
        catch {
            continue
        }
    }

    throw "No numeric scalar found for query: $Query"
}

Write-Host "MedicApp monitoring smoke check" -ForegroundColor Cyan
Write-Host "Resource group: $ResourceGroup"
Write-Host "Application Insights: $AppInsights"
Write-Host "Horizon: last $Days day(s)"
Write-Host ""

# Check account context early.
$account = az account show -o json | ConvertFrom-Json
Write-Host ("Azure account: {0} ({1})" -f $account.user.name, $account.name) -ForegroundColor DarkCyan
Write-Host ""

$metrics = @(
    @{
        Name = "patient_registered"
        Query = @"
traces
| where timestamp > ago(${Days}d)
| extend event_name=tostring(customDimensions.event_name)
| where event_name == 'patient_registered'
| summarize value=count()
"@
    },
    @{
        Name = "patient_dossier_completed"
        Query = @"
traces
| where timestamp > ago(${Days}d)
| extend event_name=tostring(customDimensions.event_name)
| where event_name == 'patient_dossier_completed'
| summarize value=count()
"@
    },
    @{
        Name = "appointment_booked"
        Query = @"
traces
| where timestamp > ago(${Days}d)
| extend event_name=tostring(customDimensions.event_name)
| where event_name == 'appointment_booked'
| summarize value=count()
"@
    },
    @{
        Name = "signature_all_completed"
        Query = @"
traces
| where timestamp > ago(${Days}d)
| extend event_name=tostring(customDimensions.event_name)
| where event_name == 'signature_all_completed'
| summarize value=count()
"@
    },
    @{
        Name = "patient_journey_transition"
        Query = @"
traces
| where timestamp > ago(${Days}d)
| extend event_name=tostring(customDimensions.event_name)
| where event_name == 'patient_journey_transition'
| summarize value=count()
"@
    },
    @{
        Name = "reflection_period_ended"
        Query = @"
traces
| where timestamp > ago(${Days}d)
| extend event_name=tostring(customDimensions.event_name)
| where event_name == 'reflection_period_ended'
| summarize value=count()
"@
    },
    @{
        Name = "patient_journey_abandoned"
        Query = @"
traces
| where timestamp > ago(${Days}d)
| extend event_name=tostring(customDimensions.event_name)
| where event_name == 'patient_journey_abandoned'
| summarize value=count()
"@
    },
    @{
        Name = "backend_5xx_requests"
        Query = @"
requests
| where timestamp > ago(${Days}d)
| where toint(resultCode) >= 500
| summarize value=count()
"@
    }
)

$summary = foreach ($metric in $metrics) {
    [pscustomobject]@{
        metric = $metric.Name
        value  = (Get-ScalarCount -Query $metric.Query)
    }
}

$summary | Format-Table -AutoSize

Write-Host ""
Write-Host "Top transitions (patient_journey_transition):" -ForegroundColor Cyan

$transitionQuery = @"
traces
| where timestamp > ago(${Days}d)
| extend event_name=tostring(customDimensions.event_name)
| where event_name == 'patient_journey_transition'
| extend from_step=tostring(customDimensions.from_step), to_step=tostring(customDimensions.to_step)
| where isnotempty(from_step) and isnotempty(to_step)
| summarize count() by from_step, to_step
| order by count_ desc
| take 20
"@

$transitionResult = Invoke-AppInsightsQuery -Query $transitionQuery
if (
    $transitionResult.tables -and
    $transitionResult.tables.Count -gt 0 -and
    $transitionResult.tables[0].rows -and
    $transitionResult.tables[0].rows.Count -gt 0
) {
    $table = $transitionResult.tables[0]
    $rows = $table.rows
    $columns = $table.columns

    $fromIdx = -1
    $toIdx = -1
    $countIdx = -1
    for ($i = 0; $i -lt $columns.Count; $i++) {
        $name = $columns[$i].name
        if ($name -eq "from_step") { $fromIdx = $i; continue }
        if ($name -eq "to_step") { $toIdx = $i; continue }
        if ($name -in @("count_", "count")) { $countIdx = $i; continue }
    }

    if ($fromIdx -lt 0 -or $toIdx -lt 0 -or $countIdx -lt 0) {
        throw "Unexpected transition query shape. Expected columns: from_step, to_step, count_."
    }

    $rows |
        ForEach-Object {
            [pscustomobject]@{
                from_step = $_[$fromIdx]
                to_step   = $_[$toIdx]
                count     = $_[$countIdx]
            }
        } |
        Format-Table -AutoSize
}
else {
    Write-Host "No transition rows found in the selected horizon." -ForegroundColor DarkYellow
}
