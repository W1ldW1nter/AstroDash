# AstroDash — Requirements & Milestones

Top-down, vertical-scrolling retro bullet-hell shooter built with **Phaser 3 + TypeScript + Vite**.

## Decisions so far

| Topic | Decision |
|---|---|
| Tooling | Vite + TypeScript, Phaser 3 |
| Resolution | 504×672 internal (3:4 vertical), pixel-art scaling (integer when the window allows ≥2×). Raised from 360×480 because ships felt too big; sprites stay at 1:1 pixels, never scaled down |
| Game mode | **Endless survival** — escalating waves, boss every N waves |
| Ships | **2 classes**: Fighter (fast, focused shots) and Gunship (slower, wide spread). 6 colours each as cosmetic skins |
| Art | Existing pack in `assets/` sliced into atlases by `tools/slice-sprites.ps1` |
| Movement | Snappy, no inertia; diagonals normalized; Shift = focus (slower, hitbox shown, tighter volley) |
| Controls | WASD/arrows move, Z/Space fire, Shift focus, X bomb (M6) |
| Ship stats | Tunable in `src/data/ships.ts` |
| Enemy bullets | Mostly pink/red/white (player shots are blue/yellow). Hitboxes ~60-70% of the art. Drawn above enemies, below the player |
| Bullet engine | Fixed pool of 3000, swap-remove active list; patterns are data (`src/data/patterns.ts`). Measured: ~1450 bullets at 2.3 ms/frame avg (budget 16.7 ms) |
| Flow | Boot (waits for font) → Preload → Title → Ship Select → Game. Pause: Esc/P, auto on window blur (Resume / Restart / Quit). Game over panel: score, best, wave, kills, grazes, time + Retry / Change ship / Title |
| UI style | "Press Start 2P" pixel font, bundled via @fontsource (no runtime CDN). Sizes in multiples of 8, 1px hard shadow. Shared styles in `src/ui/theme.ts`; reusable keyboard/mouse `Menu` |
| Ship select | Stat bars derived from `ships.ts`, colour swatches, remembers last ship/colour in the browser |
| Dev tools | **Dev builds only** (`npm run dev`); stripped from `npm run build`. Keys: 1/2 ship, C colour, F3 debug overlay, V sprite viewer, L bullet lab (attacks, stress test, hitbox view), B next boss. `window.game` console handle |
| Survivability | Gunship: 5 lives, no shield. Fighter: 3 lives + shield that absorbs 1 hit and recharges (5 s). 2.5 s invulnerability after respawn, 0.8 s after a shield break |
| Damage | Both ships deal 1 damage per bullet, so enemy HP = bullets to kill |
| Enemy HP | small 1 (most common, fodder), medium 3, large 15, heavy/miniboss 150 with health bar |
| Pacing | Fast ramp (~5 min runs). Waves ~20 s; budget 28 + 12/wave; enemy bullet speed +6%/wave, fire rate +8%/wave (capped). Enemy HP never scales. Tuning in `src/data/waves.ts` |
| Wave pattern | Miniboss every 2nd wave, boss every 6th. While a miniboss/boss is alive, regular spawns run at 70% |
| Boss | One design, re-fought each cycle in the next colour (red → orange → pink, then repeats as MK II...). HP 600 +300/cycle; +25% bullets and -10% gaps per cycle. 3 phases at 66%/33% HP with a 1.6 s invulnerable, bullet-clearing transition; final phase uses the dark sprite. Boss death destroys all enemies; upgrade screen 1.6 s later (`src/data/bosses.ts`) |
| Gunship balance | 1.2 damage per bullet, shots 20% bigger (visual and hit circle) |
| Pickups | Heals and temporary boosts only, dropped by enemies (small 2.5%, medium 10%, large 35%, miniboss 2, boss 3): +1 life, barrier (absorbs 1 hit, 10 s), +1 bomb, rapid fire (x1.6, 8 s), 2x score (10 s). Wasted ones (full lives / max bombs) aren't dropped, or give 2000 pts (`src/data/pickups.ts`) |
| Bombs | X key. Start with 2, +1 per pickup, max 5, topped up to 2 on respawn. Erases bullets for 1 s, 20 damage to all on-screen enemies, 1.5 s invulnerability |
| Scoring | Kill chain (2 s window) raises the multiplier up to x3; 2x pickup doubles it. Graze (bullet within 14 px of the hitbox) = 20 pts. Wave clear bonus 250 x wave, doubled with no hit. High score per ship saved in the browser |
| Upgrades | Pick 1 of 3 after each boss: rapid fire, damage, wide guns, thrusters, bullet speed, +1 life, shield. Per-run, capped per upgrade (`src/data/upgrades.ts`) |
| Audio | Everything synthesized with WebAudio, no audio files. SFX in `src/audio/sfx.ts` (rate-limited per effect). Chiptune music as step-sequencer data in `src/audio/tracks.ts`: title, game, boss and a game-over jingle. Music ducks on pause/upgrade screen; all sound freezes on window blur. M toggles sound (remembered) |
| Juice | Hit-stop (50–220 ms) on shield break, death, bomb, miniboss/boss kills and boss phase changes; impact sparks on enemy hits; camera shake and flashes scaled to the event |

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
| 1 ✅ | Player & world | Both ship classes move (with focus mode) and shoot; exhaust; parallax; screen bounds |
| 2 ✅ | Bullet engine | Pooled bullets, pattern system, debug overlay (FPS, bullet count); 1000 bullets @ 60 FPS |
| 3 ✅ | Enemies & combat | Enemy types on paths firing patterns; collisions, damage, explosions, lives, i-frames |
| 4 ✅ | Wave director | Template-based endless waves with a rising difficulty budget; playable loop |
| 5 ✅ | Boss rotation | Multi-phase boss every N waves, health bar, difficulty tier increase |
| 6 ✅ | Scoring, pickups & bombs | All pickups, bomb, multiplier, graze, saved high scores |
| 7 ✅ | Ship select, flow & UI | Title, ship/colour select, pause, game over, pixel-font HUD |
| 8 ✅ | Juice & audio | Shake, hit-stop, flashes, SFX, music |
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
