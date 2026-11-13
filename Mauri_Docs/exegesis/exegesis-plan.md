# Exegesis plan: Watched, not scripted

*A detailed plan for the DSDN 590 exegesis, written 13 November 2026. It takes the shape both assessments arrived at: direction 1 as the spine, direction 3's four moments as the development arc, direction 2 as one analytical section. Code sits in figures and sourcing in footnotes, on your word that neither counts toward 5,000 to 8,000 words.*

*This is a plan for your writing, not a draft of it. Section notes say what each part must do and what it needs. The sentences have to be yours.*

## Decisions this plan assumes

Check these before building on it.

| Assumption | Why it matters | Who settles it |
|---|---|---|
| Figures, captions, code and footnotes are outside the count | The whole structure depends on it. Ask specifically about captions and tables. | Supervisor, in writing |
| No cap on the number of figures | The plan uses twelve | Supervisor |
| Due date | The guide says both 5 Feb and 20 Feb | Supervisor |
| AI assistance may be used in making, and must be declared | Section 3 and the method note both depend on how | Programme policy |
| The exegesis may discuss an unreleased branch | The Clues sketches and *The Tops* are only on `origin/claude/pensive-archimedes-kyoqfi`, not on `main` | You: merge it, or cite it as work in progress |
| Spine is direction 1 | If you would sooner lead with honesty about a lost world, swap sections 6 and 7 and retitle | You |

## The contribution, pinned

Draft your own version of this and keep it above the manuscript.

> A story over a simulation can be authored as invitation and guarantee instead of as events. This exegesis names that pattern (invite, then force, and log which), shows it built twice against a scripted control in one game, and offers the share of unforced moments as a measure of how much of a lesson the world told.

Your blog's thesis statement (bottom-up tweaks that make key experiences predictable while the systems stay emergent) is the same idea stated about balance. Open with it.

## Structure and word budget

Target 7,000 words of body text. Moving code description into figures frees roughly 700 words compared with the earlier outline; they go to Context and Discussion.

| # | Section | Words | Figures | The field it must be in dialogue with |
|---|---|---|---|---|
| 1 | Introduction | 600 | 1 | Your own thesis statement; the control problem in interactive narrative |
| 2 | Context | 1,400 | 0 | Emergence and progression; the narrative paradox; curation; drama managers; guidance in learning |
| 3 | The project as a case | 500 | 2 | Deep-time Aotearoa; your named influences |
| 4 | A world that tells its own stories | 800 | 3 | Reynolds; Papert and Resnick; Lotka-Volterra |
| 5 | What the script cost | 900 | 2 | Juul; *Shelter*; the tutorial tradition |
| 6 | The same-rule test | 900 | 2 | Bogost; Frasca; reconstruction and speculation |
| 7 | Invite, then force | 1,000 | 2 | James Ryan; Riedl and Bulitko; directors and storytellers |
| 8 | The readable predator, and what the banner still says | 700 | 1 | Telegraphing in game design; the guidance debate |
| 9 | Discussion | 800 | 0 | All of the above, turned outward |
| 10 | Conclusion | 400 | 0 | Origins as the next test |
| | **Total** | **8,000 max; aim 7,000** | **13** | |

Sections 4 to 8 follow the four moments from direction 3 in order: the open simulation impresses and does not explain (4); the modules teach by replacing it (5, 6); the rebuild frames instead of scripting (7); the teaching turns out to be scripted still (8).

## Section notes

### 1. Introduction (600)

**Must do.** State the claim. Say why a teaching game sharpens the old conflict between authorial control and system freedom: a lesson needs a particular thing to happen in front of a particular learner. Give the limit in one plain sentence (people have played the classic levels; nobody outside the project has played the Chapters lessons). Map the essay.

**Needs.** Figure 1: one frame of the game with a hunting eagle, its "!" and a moa under a storm. The reader should see the thing before reading about it.

### 2. Context (1,400)

**Must do.** Set up three conversations the later sections return to. Do not survey.

- *Where story comes from in a simulation.* Juul on emergence and progression; Aylett and Louchart on the narrative paradox; James Ryan on curation.
- *Who steers.* Drama managers and experience managers (Riedl and Bulitko); the *Left 4 Dead* director; *RimWorld*'s storytellers. The point to draw out: these systems steer and mostly do not say when they did.
- *How much to tell a learner.* Papert's microworlds; Wilensky and Resnick on why emergent causes are hard to see; Kirschner, Sweller and Clark against minimal guidance; Kapur on productive failure.

**Research to do.** This is the heaviest reading load in the essay. See the reading plan below. Ryan's thesis is long; read the introduction and the curation chapters and take notes on where your pattern differs from his.

### 3. The project as a case (500)

**Must do.** Position the game briefly: glacial Kahurangi, a guardian with weather, food and cover, animals that run on their own rules. Name the two builds of the same three lessons. Declare how the code was made.

**Needs.** Figure 2: `SEASONS.winter` beside `SEASONS.summer`, captioned to the effect that no line says "migrate". Figure 3: a kawakawa row from `PLACEABLES` beside a frame of moa walking to a grove, captioned that a tool is an offer.

**Footnotes carry.** The palaeoecology (Worthy and Holdaway; Newnham et al. 2013; Bunce et al. 2009), and your named influences (*Bloons TD6*, *Terra Nil*, *Crab God*, *Age of Mythology*).

### 4. A world that tells its own stories (800)

**Must do.** Show, with three compact exhibits, that the open simulation produces events a viewer reads as story without anyone writing them. Then state the problem your playtests and the assessment found: many rules run at once and most are invisible.

**Needs.**
- Figure 4: `updateSecurity`. An eagle lowers births without a kill.
- Figure 5: `regulateEagles` beside the `pressure` lines of `_tryReproduce`. A controller against individuals.
- Figure 6: the starving-score comment in `findPlant`, or the hungry-separation comment in `applySeparation`. A story nobody wrote, and one that was false to the creature.

**Testing to do.** Regraph your five no-interaction and five interaction-heavy runs as one clean figure if you still have the CSVs. If not, rerun them with `tools/batch.js`. This is your own early evidence for the thesis statement and it predates the Chapters work.

**Check.** The ecological labels the teaching guide uses (landscape of fear, Allee effect) against the literature before you use either term.

### 5. What the script cost (900)

**Must do.** Analyse the Stories as a designed answer to the legibility problem, and count what it cost. Be fair to it: your assessment says the director's eagle is arguably the better design for a visible predator.

**Needs.**
- Figure 7: the one-line `lifeScript` hook at the top of `Moa.behave`, beside a frame of the scripted family on its walk.
- A footnote with the line counts: `mauri_module.js` 2,629, `mauri_module_patotara.js` 896, `mauri_module_freeplay.js` 1,812.

**Field.** Juul's progression structure; *Shelter* as a fully authored creature story with the same cast (parent, young, bird of prey); the tutorial momentum you took from *Bloons TD6*.

### 6. The same-rule test (900)

**Must do.** Argue that a lesson which states a rule the open simulation does not enforce says something false, and propose the test. Then apply it to your own game, including where it fails.

**Needs.**
- Figure 8: the base `Storm` row (`distractsEagles: true`) beside a Chapters level's override (`blocksEagleVision: true, distractsEagles: false`) and that lesson's `claim` line.
- Figure 9: `forestBandBySeason` and `_applyWinterEdibility`, captioned as two palaeoecological facts turned into two mechanics.

**Testing to do: a same-rule audit.** Make a table of every rule each lesson claims, and whether each level enforces it. The transcript says `tools/coverage.js` on the unmerged branch does part of this. Run it for every level and put the table in an appendix. The Endless level is known to fail on the storm.

**Iteration to decide.** Either port storm-as-cover to the Endless level before submission, or say plainly that it still fails and why. Either is defensible. Silence is not.

**Research to do.** Mark each Field Guide entry known, inferred or imagined. The kea raiding moa nests is the obvious "imagined". Your blog already works this way (the press-release disclaimer; "do not take dates as precise"; the divarication revision). Quote yourself.

### 7. Invite, then force (1,000)

**Must do.** This is the centre. Present the guaranteed beat as a formal device, analyse what it changes about authorship, and present natural-against-forced as a measure. Include the defect: a beat that waited on a sampled state missed a hunt that had happened, which taught the rule that happenings must be counted as events.

**Needs.**
- Figure 10: the `hunt_comes` beat from `levels/chapters_prototype.js`.
- Figure 11: the two tables `CHAPTER_SCRIPT_TOOLS` and `CHAPTER_ECOLOGY_TOOLS`, trimmed, captioned as the framework's central rule.
- A results table (see testing below).

**Testing to do. This is the most important work left.** The measure currently rests on three seeds per sketch, and your own assessment says win counts from three seeds should not be quoted.

1. Run each Chapters sketch across at least twenty seeds on one named machine and browser.
2. Report the share of first demonstrations that were natural, and the distribution of time to first hunt, as ranges.
3. Run the scripted Story of the same lesson for comparison. Its first attack arrives on the script's clock, so its spread should be near zero. That contrast is the figure.
4. Record the commit, machine and browser in a footnote, because seeds do not replay across machines.

**If the numbers disappoint.** If many beats need forcing, that is a finding, and the section argues that the invitation needs redesign. Do not tune until the numbers look good and then report only those.

### 8. The readable predator, and what the banner still says (700)

**Must do.** Two moves. First, the eagle's wind-up as narration by drawing: fairness chosen over realism so that an emergent event can be read in time. Second, the self-critique: the banner still names the tool and the target, so the player never has to read the eagle. End on the hint ladder as the response.

**Needs.** Figure 12: the wind-up condition in `HaastsEagle.hunt` beside a frame showing the "!" and the amber pulse. Figure 13: the stand-in table from the Clues work, if the branch is usable.

**Testing to do.** Rerun the stand-in ladder (careful, slower, late, covers never feeds, feeds never covers, does nothing) at twenty seeds. Present it as a method for testing a lesson before people play it.

**Iteration to decide.** Whether the player's actions are logged (storm moved, patch sprouted, which hint rung they acted on). Your assessment lists this as not built. Without it, a session with real players produces no record.

### 9. Discussion (800)

**Must do.** Turn outward. What can another maker take? The pattern; the measure; the same-rule test; the three-axis dial (what is guaranteed, how much is said, how hard the predator presses). What remains unknown: whether a learner reads the wind-up unprompted. Say what study would show it and that the build can record it.

### 10. Conclusion (400)

**Must do.** Restate the contribution. Close on *Origins*: the same pattern at a timescale where the protagonist is a lineage, as the next test.

## Figure register

Screenshot from the real source at a fixed commit, not from the teaching guide's excerpts, some of which are trimmed. Line numbers below are from commit `3f9927f` and will move.

| Fig | Source | Line | Pair with | Section |
|---|---|---|---|---|
| 1 | Game frame | n/a | n/a | 1 |
| 2 | `mauri_seasons.js`, `SEASONS.summer` and `.winter` | 7, 55 | n/a | 3 |
| 3 | `mauri_sketch.js`, `PLACEABLES.kawakawa`; `mauri_placeable.js`, `getAttractionStrength` | 571; 469 | Frame of moa at a grove | 3 |
| 4 | `mauri_moa.js`, `updateSecurity` | 1267 | n/a | 4 |
| 5 | `mauri_simulation.js`, `regulateEagles`; `mauri_eagle.js`, pressure lines | 2010; 849 | Population chart | 4 |
| 6 | `mauri_moa.js`, starving comment or hungry-separation comment | 1133 or 924 | n/a | 4 |
| 7 | `mauri_moa.js`, `lifeScript` hook | 312 | Frame of the family's walk | 5 |
| 8 | `mauri_sketch.js`, `Storm`; `levels/chapters_storms.js`, override and `claim` | 645; 127, 89 | n/a | 6 |
| 9 | `levels/level_02_glacial_kahurangi.js`, `forestBandBySeason`; `mauri_plant.js`, `_applyWinterEdibility` | 265; 392 | Winter frame | 6 |
| 10 | `levels/chapters_prototype.js`, `hunt_comes` | 108 | n/a | 7 |
| 11 | `mauri_chapters.js`, the two toolboxes | 146, 177 | n/a | 7 |
| 12 | `mauri_eagle.js`, wind-up condition | 561 | Frame of "!" and amber pulse | 8 |
| 13 | Stand-in ladder table | n/a | n/a | 8 |

**Rules for figures.** A dozen lines or fewer each. Every caption states a claim, not a description. Every figure is read in the body within a paragraph of where it appears. Where you can, pair code with a frame or a lens overlay: in a visual narrative programme, the picture of the consequence does more than the code alone.

## Work programme

### Research

| Task | For section | Effort | Note |
|---|---|---|---|
| Juul, "The Open and the Closed" | 2, 5 | Short | Verify the venue and year |
| Aylett; Louchart and Aylett on the narrative paradox | 2 | Short | Two papers |
| James Ryan, *Curating Simulated Storyworlds* | 2, 7 | Long | The closest prior argument; read for difference |
| Riedl and Bulitko on interactive narrative | 2, 7 | Medium | |
| Booth on the *Left 4 Dead* director; Sylvester on *RimWorld* | 2, 7 | Short | Practitioner talks |
| Bogost, *Persuasive Games*, the procedural rhetoric chapter | 6 | Medium | |
| Frasca, "Simulation versus Narrative" | 6 | Short | |
| Papert; Wilensky and Resnick | 2, 4 | Medium | |
| Kirschner, Sweller and Clark; Kapur | 2, 8 | Short | Read both sides |
| Chang, *Playing Nature* | 3, 9 | Medium | Check whether she treats scale and simulation toys |
| *All Yesterdays*; one piece on the *Walking with Dinosaurs* debate | 6 | Short | |
| Play or replay *Shelter*; revisit *Bloons TD6*'s tutorial | 5 | Short | Take frames and notes |
| Māori scholarship on mauri and kaitiakitanga | 3, footnote | Medium | You use both words; say where you stand even though the essay is not about them |

All sources are from my memory. Confirm each exists and says what I say before you cite it.

### Testing

| Task | Produces | Blocks |
|---|---|---|
| Merge or check out the Clues branch and confirm it runs | Access to Clues, *The Tops*, `coverage.js` | Sections 6 and 8 |
| Twenty-seed batches, each Chapters sketch | Natural share; time-to-first-hunt range | Section 7 |
| Same lessons as Stories, same count | The scripted control | Section 7 |
| Same-rule audit across all levels | Appendix table | Section 6 |
| Stand-in ladder at twenty seeds | Figure 13 | Section 8 |
| Regraph the five-against-five runs | A figure for section 4 | Nothing; nice to have |
| Find out who played the September runs in `tests/` | Possibly real-player evidence | Section 4 |
| Gather the playtest form responses | Quoted feedback | Sections 4 and 5 |

### Iteration on the game

In order of how much the argument needs each.

1. **Log the player's hand.** Without it no session with people yields evidence. Needed even if no study happens before submission, because section 9 claims the build can record one.
2. **Storm as cover in the Endless level**, or a written acknowledgement.
3. **Known, inferred, imagined** marks on the Field Guide, and the kea entry reworded.
4. **The family on the breeding calendar.** The five-years lesson claims every creature breeds in its season while the upland moa lay all year. Fix it or name it in section 6.
5. **Reduce Guided and Open to one difference at a time.** They differ in nine settings, so no difference in play can be attributed. Only needed if you compare them in the essay.

### A session with people, if you can get one

Not required. If you can sit even three or four adults in front of a Clues sketch after item 1 is built, you would have a first record of at which hint people act. Anything involving children needs your institution's ethics approval and guardian consent, and there is not time to seek it before February unless it is already under way. Say so in section 9 instead of implying a study is imminent.

### Writing order

1. Contribution sentence.
2. Sections 5, 6 and 7: the analysis you already know.
3. Section 4.
4. Section 2, once the reading is done.
5. Sections 8 and 9, once the batches are in.
6. Sections 1, 3 and 10 last.

A rough calendar, working back from the earlier due date: reading and the branch merge in November; batches, audit and iteration items 1 to 3 by mid-December; a full draft by mid-January; two weeks for a reader and revision.

## Risks to watch while drafting

- **Figures are not analysis.** If a section is mostly captions, it is under-argued.
- **The measure is thin until the batches run.** Draft section 7 with placeholders and do not write its conclusions first.
- **Field in every section.** Each analytical section above names its interlocutor. If one drops out, the section has become description.
- **The teaching guide is not a source for your prose.** I wrote it. Cite it as declared project documentation if you cite it at all, and write your own account of the systems.
- **Scope.** Thirteen figures and five analytical sections is the ceiling. If the draft runs long, cut section 4 to 500 words before touching 6 or 7.
