<#
  Sprite sheet slicer -> Phaser JSON-hash atlases.

  The asset pack's sheets are not uniform grids, so frames are detected
  automatically: every opaque pixel island is found, islands closer than
  `gap` pixels are merged into one sprite, and sprites are grouped into rows.
  Frames are then named using tools/sheets.json.

  Usage:
    powershell -ExecutionPolicy Bypass -File tools/slice-sprites.ps1          # write atlases
    powershell -ExecutionPolicy Bypass -File tools/slice-sprites.ps1 -Dump    # print detected rows only

  sheets.json, per sheet:
    key      texture key used in Phaser
    file     png inside assets/
    gap      merge distance in px for islands belonging to the same sprite (default 2)
    manual   optional { "frameName": [x,y,w,h], ... } for frames placed by hand
    groups   optional list of { region:[x,y,w,h], gap:int, rows:[...], uniform:bool, pad:int }
             - region  restricts the group to sprites whose center lies inside it
             - rows    one entry per detected row: either a prefix string
                       (frames become prefix_0, prefix_1, ...) or an array of
                       explicit names; null skips the row
             - uniform give every frame in a row the same (trimmed) source size,
                       centered on the sprite, so animations don't wobble
             - pad     transparent padding added around each frame
#>
param(
  [switch]$Dump,
  [string]$Config = (Join-Path $PSScriptRoot 'sheets.json'),
  [string]$OutDir = (Join-Path $PSScriptRoot '..\src\assets\atlases')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class SpriteSlicer {
  // Returns [x, y, w, h] for every sprite (merged opaque island) in the image.
  public static List<int[]> Find(string path, int gap, out int width, out int height) {
    using (var bmp = new Bitmap(path)) {
      int w = bmp.Width, h = bmp.Height;
      width = w; height = h;
      var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      var px = new byte[data.Stride * h];
      Marshal.Copy(data.Scan0, px, 0, px.Length);
      int stride = data.Stride;
      bmp.UnlockBits(data);

      var seen = new bool[w * h];
      var boxes = new List<int[]>(); // x1, y1, x2, y2 inclusive
      var stack = new Stack<int>();
      for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
        int i = y * w + x;
        if (seen[i] || px[y * stride + x * 4 + 3] == 0) continue;
        int x1 = x, y1 = y, x2 = x, y2 = y;
        seen[i] = true; stack.Push(i);
        while (stack.Count > 0) {
          int p = stack.Pop(), cx = p % w, cy = p / w;
          if (cx < x1) x1 = cx; if (cx > x2) x2 = cx;
          if (cy < y1) y1 = cy; if (cy > y2) y2 = cy;
          for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
            int nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            int n = ny * w + nx;
            if (seen[n] || px[ny * stride + nx * 4 + 3] == 0) continue;
            seen[n] = true; stack.Push(n);
          }
        }
        boxes.Add(new[] { x1, y1, x2, y2 });
      }

      // Merge boxes that are within `gap` px of each other until stable.
      bool changed = true;
      while (changed) {
        changed = false;
        for (int a = 0; a < boxes.Count && !changed; a++)
          for (int b = a + 1; b < boxes.Count; b++) {
            var A = boxes[a]; var B = boxes[b];
            if (A[0] - gap <= B[2] && B[0] - gap <= A[2] && A[1] - gap <= B[3] && B[1] - gap <= A[3]) {
              A[0] = Math.Min(A[0], B[0]); A[1] = Math.Min(A[1], B[1]);
              A[2] = Math.Max(A[2], B[2]); A[3] = Math.Max(A[3], B[3]);
              boxes.RemoveAt(b); changed = true; break;
            }
          }
      }

      var result = new List<int[]>();
      foreach (var b in boxes) result.Add(new[] { b[0], b[1], b[2] - b[0] + 1, b[3] - b[1] + 1 });
      return result;
    }
  }
}
'@

function Group-Rows($boxes) {
  # A sprite joins the current row when its vertical span overlaps the row's span.
  $rows = @()
  $current = $null
  foreach ($b in ($boxes | Sort-Object { $_[1] + $_[3] / 2 })) {
    $top = $b[1]; $bottom = $b[1] + $b[3]
    if ($current -and $top -lt $current.bottom -and $bottom -gt $current.top) {
      $current.items += , $b
      $current.top = [Math]::Min($current.top, $top)
      $current.bottom = [Math]::Max($current.bottom, $bottom)
    } else {
      $current = [pscustomobject]@{ top = $top; bottom = $bottom; items = @(, $b) }
      $rows += $current
    }
  }
  foreach ($r in $rows) { $r.items = @($r.items | Sort-Object { $_[0] }) }
  return $rows
}

$sheets = Get-Content $Config -Raw | ConvertFrom-Json
$assetsDir = Join-Path $PSScriptRoot '..\assets'
if (-not $Dump) { New-Item -ItemType Directory -Force $OutDir | Out-Null }

foreach ($sheet in $sheets) {
  $path = (Resolve-Path (Join-Path $assetsDir $sheet.file)).Path
  $sheetGap = 2; if ($null -ne $sheet.gap) { $sheetGap = [int]$sheet.gap }
  $iw = 0; $ih = 0
  $cache = @{}
  function Get-Sprites([int]$g) {
    if (-not $cache.ContainsKey($g)) {
      $w = 0; $h = 0
      $cache[$g] = [SpriteSlicer]::Find($path, $g, [ref]$w, [ref]$h)
      $script:iw = $w; $script:ih = $h
    }
    return $cache[$g]
  }
  $null = Get-Sprites $sheetGap

  $groups = $sheet.groups
  if (-not $groups) { $groups = @([pscustomobject]@{ region = @(0, 0, $iw, $ih) }) }

  $frames = [ordered]@{}
  $claimed = @{}
  $gi = 0
  foreach ($g in $groups) {
    $reg = $g.region; if (-not $reg) { $reg = @(0, 0, $iw, $ih) }
    $gap = $sheetGap; if ($null -ne $g.gap) { $gap = [int]$g.gap }
    $all = Get-Sprites $gap
    $mine = @($all | Where-Object {
        $cx = $_[0] + $_[2] / 2; $cy = $_[1] + $_[3] / 2
        -not $claimed.ContainsKey("$($_[0]),$($_[1])") -and
        $cx -ge $reg[0] -and $cx -lt $reg[0] + $reg[2] -and $cy -ge $reg[1] -and $cy -lt $reg[1] + $reg[3]
      })
    foreach ($b in $mine) { $claimed["$($b[0]),$($b[1])"] = $true }
    $rows = @(Group-Rows $mine)
    $pad = 0; if ($null -ne $g.pad) { $pad = [int]$g.pad }

    if ($Dump) {
      Write-Output "== $($sheet.key) group $gi  region [$($reg -join ',')]  ($($rows.Count) rows)"
      for ($r = 0; $r -lt $rows.Count; $r++) {
        $desc = ($rows[$r].items | ForEach-Object { "[$($_ -join ',')]" }) -join ' '
        Write-Output ("  row {0,2}: {1,2} sprites  {2}" -f $r, $rows[$r].items.Count, $desc)
      }
      $gi++
      continue
    }

    $names = @($g.rows)
    if ($names.Count -ne $rows.Count) {
      throw "$($sheet.key) group ${gi}: config names $($names.Count) rows but $($rows.Count) were detected. Run with -Dump."
    }
    for ($r = 0; $r -lt $rows.Count; $r++) {
      $spec = $names[$r]
      if ($null -eq $spec) { continue }
      $items = $rows[$r].items
      if ($spec -is [array] -and $spec.Count -ne $items.Count) {
        throw "$($sheet.key) group $gi row ${r}: $($spec.Count) names for $($items.Count) sprites."
      }
      $uw = ($items | ForEach-Object { $_[2] } | Measure-Object -Maximum).Maximum
      $uh = ($items | ForEach-Object { $_[3] } | Measure-Object -Maximum).Maximum
      for ($c = 0; $c -lt $items.Count; $c++) {
        $b = $items[$c]
        $x = $b[0] - $pad; $y = $b[1] - $pad; $w = $b[2] + 2 * $pad; $h = $b[3] + 2 * $pad
        # keep the frame inside the image
        $x = [Math]::Max(0, $x); $y = [Math]::Max(0, $y)
        $w = [Math]::Min($w, $iw - $x); $h = [Math]::Min($h, $ih - $y)
        # Uniform rows: the frame stays tight (so it never picks up pixels of the
        # neighbouring sprite) but is marked as trimmed out of a shared, centered
        # source size, so every frame of an animation has the same size and pivot.
        $sw = $w; $sh = $h; $ox = 0; $oy = 0
        if ($g.uniform) {
          $sw = $uw + 2 * $pad; $sh = $uh + 2 * $pad
          $ox = [Math]::Floor(($sw - $w) / 2); $oy = [Math]::Floor(($sh - $h) / 2)
        }
        if ($spec -is [array]) { $name = $spec[$c] } else { $name = "${spec}_$c" }
        if ($frames.Contains($name)) { throw "$($sheet.key): duplicate frame name $name" }
        $frames[$name] = [ordered]@{
          frame            = [ordered]@{ x = [int]$x; y = [int]$y; w = [int]$w; h = [int]$h }
          rotated          = $false
          trimmed          = [bool]$g.uniform
          spriteSourceSize = [ordered]@{ x = [int]$ox; y = [int]$oy; w = [int]$w; h = [int]$h }
          sourceSize       = [ordered]@{ w = [int]$sw; h = [int]$sh }
        }
      }
    }
    $gi++
  }

  # Hand-placed frames for sprites auto-detection can't separate (e.g. touching glyphs).
  if ($sheet.manual -and -not $Dump) {
    foreach ($p in $sheet.manual.PSObject.Properties) {
      $r = $p.Value
      if ($frames.Contains($p.Name)) { throw "$($sheet.key): duplicate frame name $($p.Name)" }
      $frames[$p.Name] = [ordered]@{
        frame            = [ordered]@{ x = [int]$r[0]; y = [int]$r[1]; w = [int]$r[2]; h = [int]$r[3] }
        rotated          = $false
        trimmed          = $false
        spriteSourceSize = [ordered]@{ x = 0; y = 0; w = [int]$r[2]; h = [int]$r[3] }
        sourceSize       = [ordered]@{ w = [int]$r[2]; h = [int]$r[3] }
      }
    }
  }

  if (-not $Dump) {
    $atlas = [ordered]@{
      frames = $frames
      meta   = [ordered]@{ image = $sheet.file; size = [ordered]@{ w = $iw; h = $ih }; scale = '1'; generator = 'tools/slice-sprites.ps1' }
    }
    $out = Join-Path $OutDir "$($sheet.key).json"
    $json = $atlas | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText($out, $json, (New-Object System.Text.UTF8Encoding $false))
    Write-Output ("{0,-10} {1,3} frames -> {2}" -f $sheet.key, $frames.Count, (Resolve-Path $out -Relative))
  }
}
