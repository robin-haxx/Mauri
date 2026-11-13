# Exegesis directions for Avian Age: Mauri

*Six draft directions for the DSDN 590 Critical Exegesis (5,000 to 8,000 words), written 13 November 2026. They are starting points for you to argue with. The claim, the reading and the writing have to be yours.*

## What these are built from, and what they are not

**Read:** the exegesis guide; the Claude Code transcript you attached; the game's source; and the repository's own documents, above all `ENGINE_ASSESSMENT.md` (especially section 16), `CHAPTERS_MODULES.md`, `DEVBLOG_systems.md`, `FREEPLAY_PLAN.md`, `YEARS_PLAN.md`, `MODULE_ENGINE_PLAN.md` and `MISTAKES.md`.

**The blog, read on the second pass.** I couldn't open the Patreon posts myself, so the first draft of this file ignored them. You then pasted six: three research posts (the land bridge and the Waitomo fossils; the moa family tree; habitats, divarication and glacial change) and three development posts (Mauri and Origins as two games; the playtest round with your "official thesis statement"; the alpha 1.2 notes). This version is revised against them. The section "What the blog changed" below lists what moved.

**Sources are from memory.** Every author, title and date below needs checking before you cite it. I've marked the ones I'm less sure of.

**Two things to confirm with your programme.** The guide gives two due dates (20 Feb in the header, 5 Feb under Grade Criteria). And it says the exegesis must be completed individually, so check how the school wants AI assistance declared, both in making the game and in preparing the exegesis.

## What the guide rewards

Three formats: argument-led (defend a claim), process-led (extract knowledge from practice), context-led (position the work in a field). Marks: Culture & Context 40%, Critical Analysis & Reflection 40%, Clarity & Structure 20%.

Four tests from the guide's last page, which I've applied to each direction:

1. Could a reader who has never seen the game still learn something about visual narrative practice?
2. Does the field shape the analysis throughout, not only the introduction and conclusion?
3. Is it analysis, not a walk-through of what was made?
4. Can the contribution be said in a sentence or two?

The first test matters most for this project. The exegesis sits in a *visual narrative* programme, and most of your design documents talk about simulation and teaching. Each direction below therefore says how it is about narrative.

## The evidence the project already holds

This is unusual and worth building on, whichever direction you choose.

- **The same three lessons exist twice.** "Stories" are scripted: a director moves the family and times the eagle. "Chapters" are the same lessons over the free-running simulation. Few practice-based projects contain their own comparison.
- **A record of how much authorship each lesson needed.** Every guaranteed event is logged as *natural* or *forced*. In all eighteen stand-in runs the first demonstration came naturally.
- **A written self-critique.** Section 16 of `ENGINE_ASSESSMENT.md` finds that Chapters "made the world emergent and left the teaching scripted", that "the answer is always on screen", that three rulebooks now exist, and that the family's biology contradicts the lesson it appears in.
- **A catalogue of failures with their causes** (`MISTAKES.md`).
- **Eighteen Free Play run exports** in `tests/`, dated 17 to 19 September 2026, with year-by-year tool use. If these came from people playing at NZGDC or elsewhere, they are the only records of real players in the project. I don't know who played them. You do.
- **Ecology grounding with its own candour.** `FREEPLAY_PLAN.md`: "the two headline mechanics are the two headline facts". `DEVBLOG_systems.md` calls the aggregation mechanic "engineered rather than emergent".

- **Rounds of real playtesting on the classic levels.** The blog records feedback from players (a list of eight things they wanted, plus notes from colour-blind and dyslexic testers), a feedback form, and a public itch.io build, with an NZGDC showing planned. If you kept the form responses, they are evidence.
- **Your own experimental habit.** Five no-interaction runs against five interaction-heavy runs, graphed from a CSV. Your finding: interaction raises the ceiling and the variation; after tuning, no-interaction runs varied less.
- **A thesis statement you already wrote.** "Organic, bottom-up tweaks can be built into procedural game mechanics; to support key parts of the game experience to be 'predictable' for a player, while retaining the generative, emergent nature of the interacting systems."
- **A second game.** *Origins* (3D, Godot, early Pleistocene, hundreds of years per second) beside *Mauri* (2D, one glacial cycle, season to season).

**The limit that applies to every direction.** People have played and commented on the classic levels. Nobody outside the project has played the Chapters lessons, and no child has played anything. Every Chapters result comes from a scripted stand-in on three seeds per sketch. So no direction can claim that emergent design *teaches better*. Each can claim something about design, narrative form or method, and can say exactly what a learner study would need to show. Stating that limit plainly will earn marks under Critical Analysis. Hiding it would lose them.

## What the blog changed

- **Direction 1 gets your own sentence as its claim.** Your thesis statement is about making an emergent game predictable from the bottom up. The guaranteed beat is that idea applied to story. The blog also gives a counter-example worth analysing: the top-down eagle "fudge" (delay hunting in winter) that you found "somewhat unnecessary" once the bottom-up hunger and security changes were in.
- **Direction 2 becomes much stronger.** The blog already practises the care it would argue for: a disclaimer that a flight claim came from a press release and not the paper; "do not take dates as precise figures"; dropping bone-count species ratios because preservation confounds them; revising the moa-divarication story after Maurin, Smissen and Lusk (2022). That is a science-communication ethic, in your voice, with dates.
- **Direction 5 now has real content**, and a sharper question about deep time.
- **Direction 6 has your own words to work with**: resisting the "God's eye view"; "it's a challenge for me not to give the player too much agency"; mauri as "the 'energy budget' cup overflowing, letting you tilt chance things".
- **A seventh direction appears**: the two games at two timescales.
- **Influences you actually named** replace some of my guesses: *Bloons TD6* (its tutorial momentum, and a game from Aotearoa), *Age of Mythology*, *Terra Nil*, *Crab God* (ecology in the mechanics plus an encyclopedia), your own earlier *Spirit Feathers*, and Worthy and Holdaway throughout. The guide says citations should be what "genuinely shaped the direction of the work". These did.
- **The AI thread has a concrete case**: the level 1 tutorial text was first written by AI from loose notes, then rewritten by you after a writing workshop, and "the improvement was clear".

---

## 1. Watched, not scripted

**Format:** argument-led.

**The claim.** In a simulation game, a story can be authored as *attention and guarantee* instead of as events. A named creature becomes a lens on a free-running system, and the author's hand shrinks to three acts: set the stage, invite the moment, and force it only at a deadline, recording which happened. The share of moments that arrive without forcing is then a measure of how much of the story the world told.

**In your words.** This is your blog's thesis statement (bottom-up tweaks that make key experiences predictable while the systems stay emergent) carried from balance into narrative. The exegesis could open with that sentence and show it tested three times: on population balance (the playtest round), on predation (the eagle fudge that proved unnecessary), and on story (the guaranteed beat).

**Why this project can argue it.** You built both sides. In the Stories, a moa with a `lifeScript` never runs its own behaviour, and the modules' free play grew into what your own assessment calls a second simulation. In the Chapters, the runner "never steers an animal or stages an outcome", and the guaranteed beat (`invite`, `until`, `by`, `force`) makes the difference between an authored event and an emergent one into a logged fact.

**How it is about visual narrative.** It is a position on the oldest problem in interactive narrative: authorial control against player and system freedom. It also has a visual argument inside it. An emergent event only becomes story if the player can *read* it, and the eagle's wind-up, its "!", and the amber pulse on its hunger bar are narration done by drawing instead of by text.

**Field to argue with.**
- Jesper Juul on games of emergence and games of progression ("The Open and the Closed", 2002; *Half-Real*, 2005).
- Ruth Aylett, and Sandy Louchart with Aylett, on emergent narrative and the "narrative paradox" (1999, 2004).
- James Ryan, *Curating Simulated Storyworlds* (PhD thesis, UC Santa Cruz, 2018): that emergent narrative needs curation to become story. This is the closest prior argument to yours.
- Mark Riedl and Vadim Bulitko, "Interactive Narrative: An Intelligent Systems Approach" (2013), on drama and experience managers.
- Practice precedents: the AI Director in *Left 4 Dead*; the storytellers in *RimWorld* and Tynan Sylvester's writing on story generation; *Dwarf Fortress*; *Shelter* (a mother, her young, and a bird of prey, fully authored) as the scripted counterpart.
- Henry Jenkins, "Game Design as Narrative Architecture" (2004), for emergent and environmental narrative.

**Shape (about 7,000 words).**

| Section | Words | Does |
|---|---|---|
| Introduction | 600 | The claim; why a teaching game makes the control problem acute |
| Context | 1,200 | Emergence and progression; the narrative paradox; curation; directors and storytellers |
| Project framing | 500 | One game, the same lessons built twice |
| Analysis 1: what the script cost | 1,200 | The `lifeScript` hook; the second simulation; a rule taught that the open game contradicts |
| Analysis 2: the guaranteed beat | 1,300 | Invite, force, log; natural against forced as a measure; the polled-state defect as a lesson about events and states |
| Analysis 3: the readable predator | 1,000 | Telegraphing as visual narration; and the finding that the banner still tells the player the answer |
| Discussion | 800 | What other makers can take; what a learner study must still show |
| Conclusion | 400 | Contribution; next steps |

**Contribution in a sentence.** A named pattern for authoring story over a simulation (invite, then force, and log which), with a measure of authorship that other designers can adopt or dispute.

**Risks.** The measure rests on stand-in runs and three seeds. The honest version presents it as an instrument and a design argument, not a result. Section 16's finding that the teaching stayed scripted is an asset here: Analysis 3 can end on it.

---

## 2. The same-rule test

**Format:** argument-led.

**The claim.** A game that teaches about nature makes claims through its rules as well as its words. When a lesson states a rule that the simulation does not enforce, the game says something false, however accurate its text. A teaching simulation should therefore pass a *same-rule test*: every rule a lesson teaches must hold in the open simulation with the lesson removed. For a game about an extinct ecosystem, a second obligation follows: mark what is known, what is inferred, and what is imagined.

**Why this project can argue it.** The test is yours. It appears in `ENGINE_ASSESSMENT.md` and was first applied to the storm, which hid moa in the scripted lesson and stunned eagles in the open game. Your documents list further cases: protected species that cannot die out ("floors teach the wrong lesson"), kea raiding moa nests presented as fact when it is speculation, and a family whose breeding contradicts the calendar the lesson describes. On the other side sits `FREEPLAY_PLAN.md`'s care in deriving two mechanics from two palaeoecological facts.

**How it is about visual narrative.** A lesson is a narrated claim. The argument is about when a simulation's story is truthful, which is the question documentary and reconstruction media have always faced.

**Field to argue with.**
- Ian Bogost, *Persuasive Games* (2007): procedural rhetoric, the idea that rules make arguments.
- Gonzalo Frasca, "Simulation versus Narrative" (2003).
- Clint Hocking's "ludonarrative dissonance" (2007). You could extend it to the gap between a taught rule and a simulated one. Any new term for that gap would be your coinage.
- Critiques of what simulations assume: Paolo Pedercini's "SimCities and SimCrises" (2017); Chaim Gingold, *Building SimCity* (MIT Press, 2024, check details).
- Alenda Chang, *Playing Nature: Ecology in Video Games* (2019).
- Speculation in reconstruction: Conway, Kosemen and Naish, *All Yesterdays* (2012); the debate over *Walking with Dinosaurs* and *Prehistoric Planet* presenting inference as observation.
- Practice precedents that claim scientific grounding: *WolfQuest*, *Saurian*.
- For the moa themselves: Worthy and Holdaway, *The Lost World of the Moa* (2002), already in your devblog.

**Shape.** Introduction; context (rules as claims; truth in reconstruction); project framing; three analyses (the storm and the two rulebooks; the kea raid and unmarked speculation; floors, calendars and the "engineered, not emergent" admission); discussion (the test and the three-way marking as practices for other makers); conclusion.

**Contribution in a sentence.** A test and a labelling practice that makers of ecological and palaeontological games can apply to their own work.

**Risks.** It can drift from narrative toward epistemology, so keep returning to how the claim is *told*. It also commits you to fixing or openly acknowledging the cases where your own game fails the test, since the Endless mode still plays by the old storm rule.

---

## 3. One rule, one lever, one visible consequence

**Format:** process-led.

**The question.** What did making this game reveal about turning an emergent system into something a twelve-year-old can learn from?

**Why this project can answer it.** The process contains four moments where the answer changed, and your documents recorded each.

1. **Free Play impresses and does not explain.** Many rules run at once and most are invisible (habitat stress, forest competition, the difficulty small herds have finding mates).
2. **The modules teach by replacing the simulation.** They isolate one rule, give one tool and show one consequence, and to do that they script the animals.
3. **The rebuild finds the teaching was still scripted.** The world became emergent and the banner still said "Move a STORM over it". Word counts did not fall (the Pātōtara lesson's rose).
4. **Clues and the stand-in ladder.** Say nothing, then ask a question, then give the instruction, and record the rung at which the player acted. Scripted stand-in players (careful, slow, late, covers but never feeds, feeds but never covers, does nothing) separate cleanly on that record.

**How it is about visual narrative.** It is about how much a designer must *say* against how much a player can *see*: the balance of text and image in a playable story.

**Field to argue with.**
- Seymour Papert, *Mindstorms* (1980), and Mitchel Resnick, *Turtles, Termites, and Traffic Jams* (1994): microworlds and learning from decentralised systems.
- Uri Wilensky and Resnick, "Thinking in Levels" (1999): why emergent causes are hard for learners to see.
- The guidance debate: Kirschner, Sweller and Clark (2006) against minimal guidance; Manu Kapur on productive failure (2008); Wood, Bruner and Ross (1976) on scaffolding.
- James Paul Gee (2003) and Kurt Squire on learning in games.
- Hunicke, LeBlanc and Zubek's MDA framework (2004), for why the designer and the player see a system from opposite ends.
- Game postmortems as a genre of practitioner knowledge.

**Shape.** Introduction (practice as inquiry); precedent (microworlds; the guidance debate; tutorials in commercial games); the four moments, about 1,000 words each; synthesis (the dial has three axes: what is guaranteed, how much is said, how hard the predator presses); transferability (a checklist other makers of teaching simulations could use); conclusion.

**Contribution in a sentence.** A set of constraints and a three-axis dial for making an emergent simulation teachable, with a way to record at which hint a player acted.

**Risks.** Without learners, "teachable" means "designed to be legible". Present the stand-ins as a solo designer's method for testing a lesson before people play it, which is a contribution in itself, and do not present their results as learning outcomes. If the September exports are from real players, moment 1 gains real evidence.

---

## 4. When the simulation tells the wrong story

**Format:** process-led.

**The question.** What kinds of failure does an emergent system produce, and what did finding them teach about designing one?

**Why this project can answer it.** `MISTAKES.md` records each failure with its cause and the rule it produced. Read as narrative, each is a story the system told that nobody wrote: a chick starving an arm's length from food because its parent's personal space held it off; a moa walking past the tussock at its feet toward a richer tree and dying on the slope; forest birds starving in a small window because every steering constant had been tuned for a large map. The fixes share a few principles (check progress and give up; let one force yield to a growing need; roll dice once, at the moment of decision).

**How it is about visual narrative.** Players read simulated animals as characters, and a bug is a break in character. The argument is that in emergent work, debugging is editing: the designer's craft is noticing which unplanned stories are false to the creature and removing their causes.

**Field to argue with.**
- Donald Schön, *The Reflective Practitioner* (1983): design as a conversation with a material that talks back.
- Salen and Zimmerman, *Rules of Play* (2004): game design as second-order design.
- Craig Reynolds (1987, 1999), and Daniel Shiffman's *The Nature of Code*, for the tradition the agents come from.
- *Dwarf Fortress* and its well-known emergent bugs told as stories; *Rain World* and its creature AI; Sylvester on players reading intention into simple systems.
- Eric Zimmerman, "Play as Research: The Iterative Design Process" (2003).

**Shape.** Introduction; precedent (emergent bugs as folklore in simulation games; reflective practice); three or four failures analysed closely, each tied to a principle; synthesis (a short taxonomy: deadlock, unreachable goal, hidden assumption of scale, frame dependence, runaway loop, flicker); transferability (methods: follow one individual, make the invisible visible, fix the random seed, run many seeds); conclusion.

**Contribution in a sentence.** A taxonomy of how emergent creature simulations fail as stories, with diagnostic methods a solo maker can use.

**Risks.** This is the direction most likely to read as a production diary or a technical report. Keep every failure tied to the outside field and to what it means for narrative. It also overlaps heavily with Chapter 13 of the teaching guide in this folder, which I wrote; the exegesis would need to be your own analysis in your own words.

---

## 5. A playable refugium

**Format:** context-led.

**The question.** Media about the non-human world have several ways of making it narratable. Where does a game set in glacial Kahurangi, about an ecosystem that no longer exists, sit among them?

**The three traditions to compare, each by two or three works.**
- **Simulation toys:** *SimEarth*, *SimLife*, *Equilinox*, *Ecosystem*. The world as a system to tend, with little attachment to any one creature.
- **Creature stories:** *Shelter*, *Endling: Extinction is Forever*, *Alba: A Wildlife Adventure*. Attachment to named animals, on authored rails.
- **Reconstructions of lost worlds:** *Saurian*, *Prehistoric Planet*, museum reconstruction and palaeoart. Evidentiary care, and the problem of showing inference as fact.

**The comparison criteria** (the guide insists on these): who the player or viewer is in relation to the animals; where the story comes from (author, system, or evidence); and how each handles what is not known.

**Why this project fits.** It borrows from all three: the systems of the first, the named family of the second, and the evidentiary grounding of the third (Kahurangi as a forest refugium; an evergreen flora, so winter takes food and not plants). It also lands in a live local conversation, given the moa de-extinction announcement of 2025 and the public attention that followed.

**Field to argue with.** Alenda Chang, *Playing Nature* (2019); Benjamin Abraham, *Digital Games After Climate Change* (2022); the *Ecogames* collection (Amsterdam University Press, 2024, check details); Worthy and Holdaway (2002); *All Yesterdays* (2012); writing on de-extinction and on how Aotearoa remembers the moa.

**Shape.** Introduction (question, criteria, rationale); field overview; three short case studies; project positioning; implications; conclusion.

**Contribution in a sentence.** A map of three ways of narrating the non-human world, with a place-specific deep-time game positioned as a hybrid that borrows a different strength from each.

**What the blog adds.** The three research posts are this direction's raw material: the land bridge, the four parent moa families becoming nine species, the eagle growing with its prey, and the Waitomo find showing that whole species vanished through natural causes. They also sharpen the question. A documentary can narrate deep time with a voice-over. A game has to decide what the player *does* across a million years. Your answers (plant to lead a family into new habitat and provoke speciation; extinction as an "unavoidable outcome" of a level) are design responses to a problem the other traditions don't face. *Terra Nil* and *Crab God*, which you name as influences, belong among the case studies.

**Risks.** Context-led essays slide into reviews. The criteria have to do the work. It also uses less of the project's most distinctive evidence, the two builds.

---

## 6. Guardian, not god

**Format:** argument-led, with a strong context strand.

**The claim.** The god-game tradition gives the player sovereignty over a world. This game gives the player only weather, food and cover, and never a command over an animal. That is a different player position, stewardship among agents, and the same stance recurs at three scales in the project: the player over the animals (tools that tilt the land), the lesson over the simulation (invite before forcing), and the designer over the system (dials on causes such as a predator-to-prey ratio, never on outcomes such as a predator count).

**Why this project can argue it.** The pattern is already in your principles: "Prefer emergent couplings over scripted outcomes, then expose a lever" (`YEARS_PLAN.md`); "Build a knob, not a world" (`FREEPLAY_PLAN.md`); "The stewardship, not the safety net, is the point" (`DEVBLOG_systems.md`).

**How it is about visual narrative.** It asks who the player is in the story, and argues that a role (kaitiaki) can be expressed through what the interface permits instead of through dialogue.

**Field to argue with.**
- God games and their critics: *Populous*, *Black & White*, *SimCity*; Pedercini; Gingold.
- Indirect control: Jesse Schell, *The Art of Game Design* (the chapter on indirect control); Brian Eno on the composer as gardener (2011 talk, check details).
- Kaitiakitanga and mauri: Merata Kawharu, "Kaitiakitanga: A Maori Anthropological Perspective" (2000); Māori Marsden, *The Woven Universe* (2003); Te Ahukaramū Charles Royal. Check each.
- Indigenous game design: Elizabeth LaPensée's work; *Never Alone*; games from Aotearoa such as *Umurangi Generation* and *Guardian Maia*.

**The critical question it must face.** The game makes mauri a number that is earned and spent, and casts the player as kaitiaki. Is that a fair use of those concepts, a thin one, or a distortion? An exegesis on this theme has to take that on directly, state your own standing in relation to te ao Māori, and say what guidance or consultation shaped the choices. I don't know your whakapapa or what conversations you have had, so I can't judge how this lands. Handled with care it is the strongest direction for Culture & Context. Handled lightly it is the riskiest.

**Contribution in a sentence.** A vocabulary of stewardship mechanics, and a critical account of what is gained and risked when a systems game borrows concepts from te ao Māori.

**What the blog adds.** Three passages are evidence for the claim. On the camera: "it's very easy to stray into just giving you a zoomed-out, God's eye view", and the decision to start close on one moa. On agency: "it's a challenge for me not to give the player too much agency, and create something totally unlike the natural ebb and flow of the indigenous ecosystem". On the currency: mauri as the "'energy budget' cup overflowing, letting you tilt chance things like storms, seeds dispersing, and sheltered areas naturally forming". That last one is your own gloss on mauri, and the exegesis should test it against Māori scholarship on the concept instead of taking it as settled. The eagle framed as "antagonist" and also "part of what made the native ecosystem thrive" belongs here too.

---

## 7. A tale of two timescales

**Format:** process-led, or context-led if you compare outward.

**The question.** The same ecosystem was designed twice, at two scales of time: *Mauri*, where a season is a minute and a moa is an individual, and *Origins*, where hundreds of years pass each second and one moa stands for hundreds. What does the timescale do to the kind of story a simulation can tell, and to what the player can be?

**Why this project can answer it.** Your development post sets the two side by side and already names the differences: an individual's hunger against a lineage's speciation; food that becomes inedible for a season against forest that dies and regrows; a fixed view against a camera that has to be restrained; a named family against populations led to new habitat. You also say why you went back to the smaller scale to get something playable.

**How it is about visual narrative.** Scale decides the protagonist. At a season's pace the story is a creature's. At a glacial cycle's pace it is a lineage's or a landscape's, and attachment has to be built another way. That is a question animation, comics and documentary all face when they show deep time.

**Field to argue with.** *Spore* and *SimEarth* for games that change scale; *Dwarf Fortress* for history generated before play; documentary deep-time conventions; Chang (2019) on scale in ecological games (check that she treats it; I believe a chapter does); Worthy and Holdaway and Bunce et al. (2009) for the lineage itself.

**Contribution in a sentence.** An account of how temporal scale selects the narrative unit in an ecological game, drawn from building the same world at two scales.

**Risks.** *Origins* is unfinished, so half the comparison is intention. This works only if the exegesis may cover the portfolio and not only the main work (the guide allows that), and if you have enough of Origins to show.

---

## A thread that could run through any of them: making with a machine collaborator

Much of the game's code and documentation was written with an AI coding agent, and you have since said you want to take the making back into your own hands. That is a real question in creative practice now: what authorship means when the designer specifies, tests and judges, and a machine writes much of the implementation.

Your project has material for it. The "ownership rule" you adopted for the simulation (which layer owns the state) is also a way of keeping design intent when someone else writes the code. Stand-in players and headless runs are how you verified work you did not type. And there is a symmetry you could use: the designer directing an agent is in the kaitiaki's position, shaping conditions and judging outcomes, not placing every piece.

I'd treat this as a section or a declared limitation within another direction, not as the whole exegesis, unless your supervisor welcomes it. It needs your programme's position on AI use before you commit to it. Schön's "conversation with the materials" is the natural frame.

---

## How they compare

| | Format | Uses the two builds | Narrative fit | Evidence in hand | Main risk |
|---|---|---|---|---|---|
| 1. Watched, not scripted | Argument | Fully | Direct | Strong | Stand-ins only |
| 2. The same-rule test | Argument | Fully | Indirect | Strong | Drifts to epistemology |
| 3. One rule, one lever | Process | Fully | Moderate | Strong on design, none on learners | Overclaiming "teaches" |
| 4. The wrong story | Process | Partly | Moderate | Strong | Reads as a diary |
| 5. A playable refugium | Context | Little | Direct | Needs the blog | Reads as reviews |
| 6. Guardian, not god | Argument + context | Partly | Direct | Needs cultural grounding | Cultural responsibility |
| 7. Two timescales | Process or context | No | Direct | Half is unbuilt | Origins is unfinished |

After the blog, directions 2 and 5 move from "needs material" to "has it", and direction 5's row above should now read "Strong on research, light on the two builds".

## My recommendation

**Direction 1 as the spine, opened with your own thesis statement, with direction 2 as one analytical section and direction 3's dial in the discussion.**

The blog didn't change the recommendation. It changed how I'd frame it. You wrote the claim yourself in the playtest post, about balance. Direction 1 extends it to story, so the exegesis shows one idea growing through the project instead of arriving at the end.

The blog did raise direction 2 to a close second. If the part of this work you care most about is being honest about what is known of a lost world, direction 2 is the better spine and direction 1 becomes its section on scripted lessons.

Reasons for direction 1:

- It is the argument you were already making in the transcript and the blog: story-led teaching and emergent behaviour, reconciled.
- It uses the asset no other project has, the same lessons built both ways.
- It answers the guide's "visual narrative" test most directly, and a reader who never plays the game still leaves with a pattern they can use.
- Its strongest critical material is already written in your own project's voice: the finding that the teaching stayed scripted after the world became emergent.

The research posts need not be lost under either choice. A short version of direction 5's framing can supply part of the Context section, and the Origins material can close the essay as the future direction the guide asks for.

Direction 6 is the one I'd most want you to consider seriously and least want you to choose casually.

## Whichever you choose

- **Put the limit on the page.** No learners yet; stand-in players; three seeds. Say what would count as evidence and how the build already records it.
- **Say where you stand** in relation to the te reo Māori and te ao Māori concepts the game uses, even if the exegesis is not about them.
- **Declare the AI assistance** in the making, in whatever form your programme asks.
- **Let the field into every section.** For each analytical part, name the one outside work or idea it is in dialogue with before you draft it.
- **Write the contribution sentence first** and pin it above the draft. If a section doesn't serve it, cut the section.

## What I'd need to sharpen these

1. The playtest feedback itself: the form responses, and the graphs from the five-against-five runs.
2. Who played the eighteen September Free Play runs in `tests/`, and what happened at NZGDC.
3. Anything from ARTS403 or MDDN401 (case studies, process journals) that the guide suggests reusing.
4. Whether your supervisor has a view on format, and on the AI question.
