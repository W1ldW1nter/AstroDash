# AstroDash — Requirements & Milestones

Top-down, vertical-scrolling retro bullet-hell shooter built with **Phaser 3 + TypeScript + Vite**.

## Decisions so far

| Topic | Decision |
|---|---|
| Tooling | Vite + TypeScript, Phaser 3 |
| Resolution | 360×480 internal (3:4 vertical), pixel-art scaling (integer when the window allows ≥2×) |
| Game mode | **Endless survival** — escalating waves, boss every N waves |
| Ships | **2 classes**: Fighter (fast, focused shots) and Gunship (slower, wide spread). 6 colours each as cosmetic skins |
| Art | Existing pack in `assets/` sliced into atlases by `tools/slice-sprites.ps1` |

### Open questions (to settle before Milestone 4)
- Run pacing: fast ramp (~5 min runs) or slow ramp (20+ min)?
- Between bosses: pickups only, or a "pick 1 of 3 upgrades" screen?
- Survivability: classic lives, or one life + shield bar?
- Audio source: no SFX/music in the pack yet.

## Functional requirements

**Player**
- 8-direction movement; **focus mode** (hold Shift) slows movement and shows the hitbox
- Hitbox a few pixels wide at the ship's center, far smaller than the sprite
- Hold-to-fire primary weapon, power level raised by pickups
- **Bomb**: limited stock, clears enemy bullets, brief invulnerability
- Lives / damage, i-frames after a hit, respawn
- Animated engine exhaust

**Enemies & bullets**
- Enemy archetypes matching the art: small (fodder), medium, large, heavy
- Data-driven movement paths (lines, sine, swoops, curves) and bullet patterns (aimed, ring, spiral, fan, spread, beam)
- All bullets come from an **object pool**; hundreds can be on screen
- Hazards: mines, asteroids
- Bosses: multi-phase, health bar, a pattern change per phase

**Endless progression**
- Wave director picks wave templates using a difficulty budget that grows over time
- Boss every N waves; each boss cycle raises the difficulty tier

**Scoring & pickups**
- Pickups: health, shield, bomb, rapid fire, 2× score
- Score multiplier/chain, graze bonus for near misses, survival-time bonus
- Local high score per ship class

**Flow & UI**
- Scenes: Boot → Preload → Title → Ship Select → Game → Pause → Game Over
- HUD: score, high score, lives, bombs, power level, wave number, boss health

**Feel**
- Parallax background (space, 2× nebula, small stars, stars)
- Explosions, hit flash, screen shake, hit-stop
- SFX + music

## Non-functional requirements
- 60 FPS with 500+ active bullets on a mid-range laptop
- Pixel-perfect rendering (`pixelArt: true`, `roundPixels`)
- Keyboard first; gamepad later
- Ships as a static site (`npm run build` → `dist/`)
- Game content (waves, patterns, enemy stats) in data files, separate from engine code

## Milestones

| # | Milestone | Done when |
|---|---|---|
| **0** ✅ | **Setup & asset pipeline** | Vite+TS+Phaser runs; sheets sliced into named atlases; sprite viewer shows every frame & animation |
| 1 | Player & world | Both ship classes move (with focus mode) and shoot; exhaust; parallax; screen bounds |
| 2 | Bullet engine | Pooled bullets, pattern system, debug overlay (FPS, bullet count); 1000 bullets @ 60 FPS |
| 3 | Enemies & combat | Enemy types on paths firing patterns; collisions, damage, explosions, lives, i-frames |
| 4 | Wave director | Template-based endless waves with a rising difficulty budget; playable loop |
| 5 | Boss rotation | Multi-phase boss every N waves, health bar, difficulty tier increase |
| 6 | Scoring, pickups & bombs | All pickups, bomb, multiplier, graze, saved high scores |
| 7 | Ship select, flow & UI | Title, ship/colour select, pause, game over, sprite-based HUD |
| 8 | Juice & audio | Shake, hit-stop, flashes, SFX, music |
| 9 | Polish & deploy | Tuning, settings, gamepad, local leaderboard, static deploy |

## Asset pipeline

The sprite sheets are not uniform grids. `tools/slice-sprites.ps1` finds each
sprite's opaque pixels, merges nearby pixel islands, groups sprites into rows
and names them from `tools/sheets.json`. The output is Phaser JSON-hash atlases
in `src/assets/atlases/`.

```
npm run atlas                                                        # regenerate atlases
powershell -ExecutionPolicy Bypass -File tools/slice-sprites.ps1 -Dump   # inspect detected rows
```

Frame naming, by atlas:
- `player`: `fighter_<colour>`, `gunship_<colour>` (silver, green, blue, orange, dark, red)
- `enemy`: `<heavy|large|medium|small>_<a|b|c>`
- `boss`: `red`, `red_dark`, `orange`, `orange_dark`, `pink`, `pink_dark`, `flame_0..3`
- `bullets`: `<colour>_<orb|capsule|dart>_<l|m|s>` (blue, green, red, yellow, pink, white), plus `beam_charge_n`, `beam_head_n`, `beam_body_n`
- `bonuses`: `<health|shield|bomb|rapid|double>_0..4`
- `explosion`: `<orange|teal|pink|red>_0..6`
- `exhaust`: `red_l_0..3`, `red_m_0..3`, `red_s_0..7`, `blue_l_0..3`
- `mine`: `<red|orange|pink>_<s|l>_0..3`
- `asteroids`: `<brown|grey>_<s|m|l>`
- `barrier`: `green`, `cyan`, `pink`, `red`
- `ui`: `panel_score`, `panel`, `digit_0..9`, `heart_full`, `heart_empty`, `clock`, `skull`, `bar_fill`, `bar_empty`, `icon_<pickup>`
