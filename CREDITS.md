# Credits: sound

Where every sound in `audio/` comes from. Keep this file up to date when a sound is added or
replaced; `npm run build` copies it into `dist/` so it ships with the game.

## Touch sounds (the player's own interactions)

The 29 `audio/touch_*.wav` files: the short sounds that answer a press, a pick-up or a
set-down. They are cut, trimmed and levelled by `tools/make_touch_sounds.js` (run it again to
re-cut them); the cues that play them are `TOUCH_CUES` in `mauri_audio.js`.

**27 are cut from two sound packs by Kenney (Kenney Vleugels, <https://kenney.nl>), both
released under [Creative Commons Zero (CC0 1.0)](https://creativecommons.org/publicdomain/zero/1.0/):**

- **Impact Sounds** (1.0, 2019): <https://kenney.nl/assets/impact-sounds>
- **RPG Audio** (1.0, 2014): <https://kenney.nl/assets/rpg-audio>

CC0 asks for no credit; Kenney is credited here with thanks.

| File in `audio/` | Heard when | Source pack | Source file(s) |
| --- | --- | --- | --- |
| `touch_wood_1.wav` `_2` `_3` | any plain button; pitched down for back, close, cancel | Impact Sounds | `impactWood_light_000` `_002` `_004` |
| `touch_knock_1.wav` `_2` | buttons that begin something (start a level, restart, continue); pitched for pause and resume | Impact Sounds | `impactWood_medium_000` `_003` |
| `touch_thud_1.wav` `_2` | a refusal: can't place here, not enough mauri, a locked tool or level | Impact Sounds | `impactWood_heavy_001` `_004` |
| `touch_stone_1.wav` `_2` | small switches and steps: species highlight, zoom step, tip Next, settings, lens | Impact Sounds | `impactGeneric_light_001` `_004` |
| `touch_soil_1.wav` `_2` `_3` | planting, or setting a moved planting down; under the nest and seed sounds | Impact Sounds | `impactSoft_heavy_000` `_002` `_003` |
| `touch_leaf_1.wav` `_2` `_3` | taking a plant tool in hand; under the sprouting sound | Impact Sounds | `footstep_grass_001` `_002` `_004` |
| `touch_twig_1.wav` `_2` | taking up and setting down the nest | Impact Sounds | `footstep_snow_000` `_003` |
| `touch_seeds_1.wav` `_2` | seed and berry tools (Berry Cache, Forest Seed, Mast Year, Rimu Scramble); pātōtara sprouting | Impact Sounds | five or six `impactGeneric_light_000`–`004` hits, sped up and laid over one another |
| `touch_feather_1.wav` `_2` `_3` | choosing or releasing an animal, sending the kea, the Storm tool (slowed), fast-forward (sped up) | RPG Audio | `cloth1` `cloth2` `cloth3` |
| `touch_page_1.wav` `_2` | turning to an entry in the field guide | RPG Audio | `bookFlip2` `bookFlip3` |
| `touch_guide_open.wav` | opening the field guide | RPG Audio | `bookOpen` |
| `touch_guide_close.wav` | closing the field guide | RPG Audio | `bookClose` |
| `touch_creak_1.wav` | changing the view (fullscreen, 3D) | RPG Audio | `creak3` |

**2 are original to this game**, synthesised by `tools/make_touch_sounds.js` (no recording
used): a short burst of filtered noise and one to three decaying sine tones that rise in
pitch, the way a bubble rings under water.

| File in `audio/` | Heard when |
| --- | --- |
| `touch_water_1.wav` `_2` | taking up and setting down the Waterhole |

Some interactions answer with sounds the game already had rather than a new one: a tapped or
moved plant rustles (`plant_rustle_*`), a storm lifts with wind (`season_winter`) and lands
with thunder (`bolt_strike`), a highlighted species answers with its own call, a kea sent to
an egg answers with a snippet of `kea_song`, and a failed nest raid is met by the moa's call
(`moa_milestone`).

## Earlier sounds

These files were in the game before this file was written, and their sources were not
recorded in the repository. **To be filled in by the project owner.**

| File(s) in `audio/` | Used for | Source and licence |
| --- | --- | --- |
| `background.mp3` | the music | *to be filled in* |
| `tutorial_tip.mp3` | Te Whē's tip chime | *to be filled in* |
| `plant_rustle_1.mp3` – `_4` | plants rustling | *to be filled in* |
| `bolt_strike.mp3` | the storm's thunder | *to be filled in* |
| `mate_cheep.mp3` | pairing, chicks | *to be filled in* |
| `moa_milestone.mp3`, `moa_extended.mp3` | the moa's call and voice | *to be filled in* |
| `season_summer.mp3`, `season_autumn.mp3`, `season_winter.mp3`, `season_spring.mp3` | the turn of each season; the wind | *to be filled in* |
| `eagle_hunt.mp3`, `eagle_cry_1.mp3` – `_3`, `eagle_catch.mp3` | Haast's eagle | *to be filled in* |
| `win.mp3`, `loss.mp3` | the end of a level | *to be filled in* |
| `kea_song.mp3` | kea voice | *to be filled in* |
| `kaka_south_island.mp3` | kākā voice | *to be filled in* |
| `kokako_song.mp3`, `kokako_alarmed.mp3` | kōkako voice | *to be filled in* |
| `kakapo_female.mp3`, `kakapo_male_boom.mp3`, `kakapo_male_territorial.mp3` | kākāpō voice | *to be filled in* |
