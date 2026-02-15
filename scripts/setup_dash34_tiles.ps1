param(
    [string]$ResourceGroup = "medicapp-rg",
    [string]$DashboardName = "medicapp-monitoring-dashboard",
    [string]$AppInsightsName = "medicapp-appinsights",
    [string]$Location = "westeurope",
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

function Get-InputByName {
    param(
        [Parameter(Mandatory = $true)]$Inputs,
        [Parameter(Mandatory = $true)][string]$Name
    )
    foreach ($input in $Inputs) {
        if ($input.name -eq $Name) {
            return $input
        }
    }
    return $null
}

function Set-InputValue {
    param(
        [Parameter(Mandatory = $true)]$Part,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $false)]$Value
    )
    $input = Get-InputByName -Inputs $Part.metadata.inputs -Name $Name
    if ($null -eq $input) {
        $newInput = [pscustomobject]@{
            isOptional = $true
            name = $Name
            value = $Value
        }
        $Part.metadata.inputs += $newInput
        return
    }
    $input.value = $Value
}

Write-Host "Fetching App Insights resource id..."
$appInsightsId = az resource show `
    -g $ResourceGroup `
    -n $AppInsightsName `
    --resource-type microsoft.insights/components `
    --query id -o tsv

if (-not $appInsightsId) {
    throw "Unable to resolve App Insights resource id."
}

Write-Host "Fetching dashboard JSON..."
$dashboard = az portal dashboard show `
    -g $ResourceGroup `
    -n $DashboardName `
    --only-show-errors `
    -o json | ConvertFrom-Json

if ($null -eq $dashboard.lenses.'0' -or $null -eq $dashboard.lenses.'0'.parts) {
    throw "Dashboard does not contain lens 0 / parts."
}

$parts = $dashboard.lenses.'0'.parts

$templatePart = $null
foreach ($prop in $parts.PSObject.Properties) {
    if ($prop.Value.metadata.type -eq "Extension/Microsoft_OperationsManagementSuite_Workspace/PartType/LogsDashboardPart") {
        $templatePart = $prop.Value
        break
    }
}

if ($null -eq $templatePart) {
    throw "No LogsDashboardPart template found. Pin at least one Logs tile first."
}

$existingTitles = @{}
foreach ($prop in $parts.PSObject.Properties) {
    $title = $null
    if ($null -ne $prop.Value.metadata.partHeader) {
        $title = $prop.Value.metadata.partHeader.title
    }
    if (-not $title -and $null -ne $prop.Value.metadata.settings -and $null -ne $prop.Value.metadata.settings.content) {
        $title = $prop.Value.metadata.settings.content.PartTitle
    }
    if ($title) {
        $existingTitles[$title] = $true
    }
}

$keys = @()
foreach ($name in $parts.PSObject.Properties.Name) {
    $keys += [int]$name
}
$nextKey = ((($keys | Measure-Object -Maximum).Maximum) + 1)

$maxBottom = 0
foreach ($prop in $parts.PSObject.Properties) {
    $position = $prop.Value.position
    if ($null -eq $position) {
        continue
    }
    $bottom = [int]$position.y + [int]$position.rowSpan
    if ($bottom -gt $maxBottom) {
        $maxBottom = $bottom
    }
}
$startY = $maxBottom + 1

$dash3Fill = @'
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where event_name == "appointment_slot_utilization"
| extend slot_date = todatetime(strcat(tostring(customDimensions.slot_date), "T00:00:00Z"))
| extend booked = todouble(customDimensions.measurement_slots_booked)
| extend total = todouble(customDimensions.measurement_slots_total)
| extend rate = todouble(customDimensions.measurement_utilization_rate) * 100.0
| summarize booked=max(booked), total=max(total), fill_rate_pct=max(rate) by slot_date
| order by slot_date asc
'@

$dash3ByType = @'
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where event_name == "appointment_booked"
| summarize rdv=count() by semaine=bin(timestamp, 7d), appointment_type=tostring(customDimensions.appointment_type)
| order by semaine asc
'@

$dash3Cancel = @'
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
let booked =
    events
    | where timestamp > ago(30d) and event_name == "appointment_booked"
    | summarize booked=count() by appointment_type=tostring(customDimensions.appointment_type);
let cancelled =
    events
    | where timestamp > ago(30d) and event_name == "appointment_cancelled"
    | summarize cancelled=count() by appointment_type=tostring(customDimensions.appointment_type);
booked
| join kind=fullouter cancelled on appointment_type
| extend booked=coalesce(booked, 0), cancelled=coalesce(cancelled, 0)
| extend cancellation_rate_pct = iff(booked == 0, real(null), round(cancelled * 100.0 / booked, 2))
| order by appointment_type asc
'@

$dash3Delay = @'
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
let registered =
    events
    | where event_name == "patient_registered"
    | summarize registered_at=min(timestamp) by patient_id=tostring(customDimensions.patient_id);
let first_booking =
    events
    | where event_name == "appointment_booked"
    | summarize first_booking_at=min(timestamp) by patient_id=tostring(customDimensions.patient_id);
registered
| join kind=inner first_booking on patient_id
| where first_booking_at >= registered_at
| extend delay_days = todouble(first_booking_at - registered_at) / 1d
| summarize avg_delay_days=round(avg(delay_days), 2), p50_days=round(percentile(delay_days, 50), 2), p90_days=round(percentile(delay_days, 90), 2)
'@

$dash4Failures = @'
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where event_name == "auth_login_failure"
| summarize attempts=count() by heure=bin(timestamp, 1h), ip=tostring(customDimensions.ip_address)
| order by heure asc
'@

$dash4Locked = @'
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where event_name == "auth_account_locked"
| where timestamp >= startofweek(now())
| summarize lockouts=count(), users=dcount(tostring(customDimensions.user_id))
'@

$dash4TopIp = @'
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
events
| where event_name == "auth_login_failure"
| where timestamp > ago(24h)
| summarize attempts=count() by ip=tostring(customDimensions.ip_address)
| top 10 by attempts desc
'@

$dash4Mfa = @'
let events = materialize(
    union isfuzzy=true
    (customEvents | extend event_name=tostring(name) | project timestamp, event_name, customDimensions),
    (traces | extend event_name=tostring(customDimensions.event_name) | extend event_name=iff(isempty(event_name), extract(@"^event:([A-Za-z0-9_\-]+)",1,message), event_name) | where isnotempty(event_name) | project timestamp, event_name, customDimensions)
);
let sent = toscalar(events | where timestamp > ago(30d) and event_name == "auth_mfa_sent" | summarize count());
let success = toscalar(events | where timestamp > ago(30d) and event_name == "auth_mfa_success" | summarize count());
let failure = toscalar(events | where timestamp > ago(30d) and event_name == "auth_mfa_failure" | summarize count());
print mfa_sent=sent, mfa_success=success, mfa_failure=failure
| extend mfa_success_rate_pct = iff(mfa_sent == 0, real(null), round(mfa_success * 100.0 / mfa_sent, 2))
'@

$tiles = @(
    @{ Title = "[RDV] Remplissage par jour"; Query = $dash3Fill },
    @{ Title = "[RDV] RDV par type (hebdo)"; Query = $dash3ByType },
    @{ Title = "[RDV] Taux annulation"; Query = $dash3Cancel },
    @{ Title = "[RDV] Delai inscription -> 1er RDV"; Query = $dash3Delay },
    @{ Title = "[Securite] Echecs login / heure"; Query = $dash4Failures },
    @{ Title = "[Securite] Comptes verrouilles (semaine)"; Query = $dash4Locked },
    @{ Title = "[Securite] Top 10 IP echecs (24h)"; Query = $dash4TopIp },
    @{ Title = "[Securite] Taux succes MFA"; Query = $dash4Mfa }
)

$added = 0
$tileIndex = 0
foreach ($tile in $tiles) {
    if ($existingTitles.ContainsKey($tile.Title)) {
        Write-Host "Skipping existing tile: $($tile.Title)"
        continue
    }

    $newPart = $templatePart | ConvertTo-Json -Depth 100 | ConvertFrom-Json

    if ($null -eq $newPart.metadata.partHeader) {
        $newPart.metadata | Add-Member -MemberType NoteProperty -Name partHeader -Value ([pscustomobject]@{ title = $tile.Title; subtitle = "" }) -Force
    } else {
        $newPart.metadata.partHeader.title = $tile.Title
        $newPart.metadata.partHeader.subtitle = ""
    }

    if ($null -eq $newPart.metadata.settings) {
        $newPart.metadata | Add-Member -MemberType NoteProperty -Name settings -Value (@{}) -Force
    }
    if ($null -eq $newPart.metadata.settings.content) {
        $newPart.metadata.settings | Add-Member -MemberType NoteProperty -Name content -Value (@{}) -Force
    }
    $newPart.metadata.settings.content.PartTitle = $tile.Title

    Set-InputValue -Part $newPart -Name "Scope" -Value ([pscustomobject]@{ resourceIds = @($appInsightsId) })
    Set-InputValue -Part $newPart -Name "Query" -Value ($tile.Query + "`n")
    Set-InputValue -Part $newPart -Name "PartId" -Value ([guid]::NewGuid().ToString())
    Set-InputValue -Part $newPart -Name "ControlType" -Value "AnalyticsGrid"
    Set-InputValue -Part $newPart -Name "PartTitle" -Value "Analytics"
    Set-InputValue -Part $newPart -Name "PartSubTitle" -Value $AppInsightsName
    Set-InputValue -Part $newPart -Name "IsQueryContainTimeRange" -Value $true

    $column = $tileIndex % 2
    $row = [math]::Floor($tileIndex / 2)

    $newPart.position.x = if ($column -eq 0) { 0 } else { 8 }
    $newPart.position.y = $startY + ($row * 2)
    $newPart.position.colSpan = 8
    $newPart.position.rowSpan = 2

    $parts | Add-Member -MemberType NoteProperty -Name "$nextKey" -Value $newPart -Force
    $existingTitles[$tile.Title] = $true
    $nextKey += 1
    $tileIndex += 1
    $added += 1
}

$outputPath = "docs/azure_dashboard_dash34_generated_properties.json"
$properties = [ordered]@{
    lenses = $dashboard.lenses
    metadata = $dashboard.metadata
}
$properties | ConvertTo-Json -Depth 100 | Out-File -FilePath $outputPath -Encoding utf8

Write-Host "Generated dashboard properties: $outputPath"
Write-Host "Tiles added: $added"

if ($Apply.IsPresent) {
    Write-Host "Applying dashboard update to Azure..."
    az portal dashboard create `
        -g $ResourceGroup `
        -n $DashboardName `
        -l $Location `
        --input-path $outputPath `
        --only-show-errors `
        -o table | Out-Null
    Write-Host "Dashboard updated successfully."
} else {
    Write-Host "Preview only. To apply, re-run with -Apply"
}

