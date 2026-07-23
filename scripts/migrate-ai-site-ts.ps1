$ErrorActionPreference = 'Stop'

$old = 'D:\Code\project-mix\GoodJob\frontend\src\prototype-api.ts'
$new = 'D:\Code\project-mix\NewGoodJob\GoodJob-master\frontend\src\prototype-api.ts'
$oldLines = [System.IO.File]::ReadAllLines($old)
$text = [System.IO.File]::ReadAllText($new)

if ($text -notmatch 'interface AiSiteProject') {
  $typeStart = [Array]::FindIndex($oldLines, [Predicate[string]]{ param($line) $line -match '^interface AiSiteProject' })
  $typeEnd = [Array]::FindIndex($oldLines, [Predicate[string]]{ param($line) $line -match '^interface AiModelConfig' })
  if ($typeStart -lt 0 -or $typeEnd -lt 0 -or $typeEnd -le $typeStart) {
    throw "AI site type boundaries not found"
  }
  $types = ($oldLines[$typeStart..($typeEnd - 1)] -join "`r`n")
  $selectedRegion = @'

interface AiSiteSelectedRegion {
  sectionKey: string;
  selectorPath: string;
  tagName: string;
  id: string;
  className: string;
  text: string;
  html: string;
}
'@
  $text = $text.Replace('interface AiModelConfig {', "$types`r`n$selectedRegion`r`ninterface AiModelConfig {")
}

if ($text -notmatch 'aiSiteProjects: AiSiteProject\[\]') {
  $text = $text.Replace(
    '  pendingAiDeleteId: string | null;',
    '  pendingAiDeleteId: string | null;' + "`r`n" +
    '  aiSiteProjects: AiSiteProject[];' + "`r`n" +
    '  selectedAiSiteProjectId: string | null;' + "`r`n" +
    '  editingAiSiteProjectId: string | null;' + "`r`n" +
    '  selectedAiSiteSectionKey: string | null;' + "`r`n" +
    '  aiSitePreviewDesignSystem: AiSitePreviewDesignSystem | null;' + "`r`n" +
    '  aiSiteReferenceSites: AiSiteReferenceSitesState | null;' + "`r`n" +
    '  aiSiteRegionSelectEnabled: boolean;' + "`r`n" +
    '  aiSiteSelectedRegion: AiSiteSelectedRegion | null;'
  )
  $text = $text.Replace(
    '  pendingAiDeleteId: null,',
    '  pendingAiDeleteId: null,' + "`r`n" +
    '  aiSiteProjects: [],' + "`r`n" +
    '  selectedAiSiteProjectId: null,' + "`r`n" +
    '  editingAiSiteProjectId: null,' + "`r`n" +
    '  selectedAiSiteSectionKey: null,' + "`r`n" +
    '  aiSitePreviewDesignSystem: null,' + "`r`n" +
    '  aiSiteReferenceSites: null,' + "`r`n" +
    '  aiSiteRegionSelectEnabled: false,' + "`r`n" +
    '  aiSiteSelectedRegion: null,'
  )
}

if ($text -notmatch 'aiSiteGenerationInFlight') {
  $text = $text.Replace('let memoDirty = false;', 'const aiSiteGenerationInFlight = new Set<string>();' + "`r`n" + 'let memoDirty = false;')
}

if ($text -notmatch 'async function refreshAiSiteBuilderCapabilities') {
  $functionStart = [Array]::FindIndex($oldLines, [Predicate[string]]{ param($line) $line -match '^async function refreshAiSiteBuilderCapabilities' })
  $functionEnd = [Array]::FindIndex($oldLines, [Predicate[string]]{ param($line) $line -match '^async function loginWithPassword' })
  if ($functionStart -lt 0 -or $functionEnd -lt 0 -or $functionEnd -le $functionStart) {
    throw "AI site function boundaries not found"
  }
  $functions = ($oldLines[$functionStart..($functionEnd - 1)] -join "`r`n")
  $text = $text.Replace('async function loginWithPassword(email: string, password: string) {', "$functions`r`nasync function loginWithPassword(email: string, password: string) {")
}

$literal = ([char]0x60) + 'r' + ([char]0x60) + 'n'
$text = $text.Replace($literal, [Environment]::NewLine)
[System.IO.File]::WriteAllText($new, $text, [System.Text.UTF8Encoding]::new($false))
Write-Host 'patched frontend prototype api ai site types/functions'
