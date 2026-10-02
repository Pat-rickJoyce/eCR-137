# Looks up the preferred display of every (system, code) in codes.json on tx.fhir.org (CodeSystem/$lookup).
# Development tool only; the app never calls a terminology server.
# Usage: pwsh tools/fhir/lookup-displays.ps1 -In build/codes.json -Out tools/fhir/terminology/tx-lookup.json
param([string]$In = 'build/codes.json', [string]$Out = 'tools/fhir/terminology/tx-lookup.json')
$ProgressPreference = 'SilentlyContinue'
$usSnomed = 'http://snomed.info/sct/731000124108'
$result = foreach ($c in (Get-Content $In -Raw | ConvertFrom-Json)) {
  $u = "https://tx.fhir.org/r4/CodeSystem/`$lookup?system=" + [uri]::EscapeDataString($c.system) + "&code=" + [uri]::EscapeDataString($c.code)
  $row = [pscustomobject]@{ system = $c.system; code = $c.code; display = $null; status = 'unknown' }
  foreach ($v in @('', $usSnomed)) {
    if ($v -and $c.system -ne 'http://snomed.info/sct') { continue }
    try {
      $q = if ($v) { "$u&version=" + [uri]::EscapeDataString($v) } else { $u }
      $r = Invoke-RestMethod -Uri $q -Headers @{ Accept = 'application/fhir+json' } -TimeoutSec 30
      $row.display = ($r.parameter | Where-Object { $_.name -eq 'display' }).valueString; $row.status = 'ok'; break
    } catch { }
  }
  $row
}
$result | ConvertTo-Json -Depth 3 | Set-Content $Out -Encoding UTF8
