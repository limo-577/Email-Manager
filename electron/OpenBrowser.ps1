param(
    [Parameter(Mandatory=$true)]
    [string]$BrowserProfileUrl
)

$ErrorActionPreference = 'Stop'

# ============================================================
# Parse browserprofile:// URL
# ============================================================

$uri = [System.Uri]$BrowserProfileUrl

if ($uri.Scheme -ne 'browserprofile') {
    throw "Unsupported protocol: $($uri.Scheme)"
}

$query = @{}

$queryString = $uri.Query.TrimStart('?')

if (-not [string]::IsNullOrWhiteSpace($queryString)) {

    foreach ($pair in $queryString.Split('&')) {

        if ($pair -match '^([^=]+)=(.*)$') {

            $key = [Uri]::UnescapeDataString($matches[1])
            $value = [Uri]::UnescapeDataString($matches[2].Replace('+', ' '))

            $query[$key] = $value
        }
    }
}

$browser = $query['browser']
$profile = $query['profile']
$url = $query['url']


# ============================================================
# Check profile
# ============================================================

if ([string]::IsNullOrWhiteSpace($profile)) {
    throw 'Missing profile parameter.'
}

if ($profile -match '^\d+$') {
    $profile = "Profile $profile"
}


# ============================================================
# Browser selection
# ============================================================

if ([string]::IsNullOrWhiteSpace($browser)) {
    $browser = 'Chrome'
}

$browserLower = $browser.ToLower()

$browserPath = $null


# ============================================================
# Microsoft Edge
# ============================================================

if ($browserLower -match 'edge|microsoft') {

    $edgePaths = @(
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
    )

    $browserPath = $edgePaths |
        Where-Object {
            $_ -and (Test-Path $_)
        } |
        Select-Object -First 1

    if (-not $browserPath) {
        throw 'Microsoft Edge executable was not found.'
    }
}


# ============================================================
# Brave
# ============================================================

elseif ($browserLower -match 'brave') {

    $bravePaths = @(
        "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
        "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe",
        "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe"
    )

    $browserPath = $bravePaths |
        Where-Object {
            $_ -and (Test-Path $_)
        } |
        Select-Object -First 1

    if (-not $browserPath) {
        throw 'Brave executable was not found.'
    }
}


# ============================================================
# Google Chrome
# ============================================================

else {

    $chromePaths = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )

    $browserPath = $chromePaths |
        Where-Object {
            $_ -and (Test-Path $_)
        } |
        Select-Object -First 1

    if (-not $browserPath) {
        throw 'Google Chrome executable was not found.'
    }
}


# ============================================================
# Open requested profile
# ============================================================

$profileArgument = "--profile-directory=`"$profile`""

if ([string]::IsNullOrWhiteSpace($url)) {

    Start-Process `
        -FilePath $browserPath `
        -ArgumentList $profileArgument

}
else {

    Start-Process `
        -FilePath $browserPath `
        -ArgumentList $profileArgument, "`"$url`""
}


exit 0