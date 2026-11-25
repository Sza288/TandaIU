$ErrorActionPreference = 'Stop'

function Get-JavaMajorVersion([string]$JavaExecutable) {
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $versionOutput = (& $JavaExecutable -version 2>&1 | Out-String)
  $ErrorActionPreference = $previousErrorAction
  if ($versionOutput -match 'version "(\d+)') {
    return [int]$Matches[1]
  }
  return 0
}

$javaCommand = Get-Command java -ErrorAction SilentlyContinue
$javaExecutable = if ($javaCommand) { $javaCommand.Source } else { $null }
$javaMajor = if ($javaExecutable) { Get-JavaMajorVersion $javaExecutable } else { 0 }

if ($javaMajor -lt 21) {
  $candidateRoots = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Eclipse Adoptium'),
    (Join-Path $env:ProgramFiles 'Eclipse Adoptium'),
    (Join-Path $env:ProgramFiles 'Microsoft')
  ) | Where-Object { Test-Path -LiteralPath $_ }

  $candidateJavas = foreach ($root in $candidateRoots) {
    Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue |
      ForEach-Object {
        $candidateJava = Join-Path $_.FullName 'bin\java.exe'
        if (Test-Path -LiteralPath $candidateJava) {
          $candidateMajor = Get-JavaMajorVersion $candidateJava
          if ($candidateMajor -ge 21) {
            [pscustomobject]@{
              JavaHome = $_.FullName
              JavaExecutable = $candidateJava
              Major = $candidateMajor
            }
          }
        }
      }
  }

  $selectedJava = $candidateJavas | Sort-Object Major -Descending | Select-Object -First 1
  if (-not $selectedJava) {
    throw 'Firebase Emulator membutuhkan Java 21+. Pasang atau pilih JDK 21+ lalu jalankan npm run emulators lagi.'
  }

  $env:JAVA_HOME = $selectedJava.JavaHome
  $env:Path = "$($selectedJava.JavaHome)\bin;$env:Path"
  $javaMajor = $selectedJava.Major
}

Write-Host "Using Java $javaMajor for Firebase Emulator."
Write-Host "Building Cloud Functions..."
$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
npm --prefix functions run build
$buildExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorAction
if ($buildExitCode -ne 0) { exit $buildExitCode }
$rootDir = Split-Path -Parent $PSScriptRoot
$emulator = Start-Process -FilePath 'npx.cmd' -ArgumentList @('--yes', 'firebase-tools@15.37.0', 'emulators:start', '--only', 'auth,firestore,functions', '--project', 'demo-tandaiu-rules') -WorkingDirectory $rootDir -NoNewWindow -Wait -PassThru
exit $emulator.ExitCode
