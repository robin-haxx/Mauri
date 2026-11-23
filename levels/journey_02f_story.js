// ============================================================================
// THE JOURNEY, 2f's ENDING: the nest, the egg, the two Pouākai, the scatter
// ============================================================================
// The four years on the tops (levels/chapters_freeplay.js, the `journey` setting) end in this
// scene, told as the author wrote it (FULLGAMESCRIPT, 2f, 23 November 2026). Every line in
// quotation marks below is the author's, word for word but for one typo ("lokes"); the
// comments say what is staged around them.
//
// What the player does. In the fourth year the toolbar's pātōtara founds nests: two patches
// close together, with upland moa near (the open simulation's rule, Simulation._tryFoundNest).
// The first nest founded that year is Pukepuke and Koukou's home nest: they keep to it and to
// no other, and no other moa nests or lays there (NestingSite.heldBy, Moa._homeNest). The
// other upland moa have their own (the families' nests from year one, and any later ones).
//
// What is staged. After the fourth spring the clock holds and the story plays: the camera
// closes on the home nest, Pukepuke and Koukou come together there, and an egg is laid: Pipi.
// Two Pouākai talk at their lair (portraits facing each other), fly at the nest, and raid it.
// The raid is shown as every raid is (RAIDS: the odds, a countdown, and mana the player can
// give either side), but its outcome is the story's: the Pouākai win. One carries the egg off
// alive (HaastsEagle.carryOff: the record keeps Pipi as taken, not lost), the other lands on
// the nest. Pukepuke and Koukou scatter; the Pouākai drives Pukepuke off the land to the north
// (chaseOff: it cannot catch him); Koukou sends her parents south, calls the tribe, hears a
// voice in the dark, and leads them west off the land.
//
// Nothing here is a hunt. The eagles are on errands (holdOver, carryOff, landAt, chaseOff), out
// of the hunt, and no cover changes what they do, which is why it all comes after the four
// years are done, with the toolbar empty.
//
// PLACEHOLDERS: the voice's portrait (two eyes in the dark, Game._shadowSprite), the raid's
// odds and length (the dial below).
// ============================================================================

const JOURNEY_2F_DIAL = {
  years: 4,              // the years on the tops before the scene
  nestNudgeSec: 25,      // into the fourth summer with no nest yet: one word on how to make one
  raidSec: 6,            // the Pouākai raid's countdown
  raidOdds: 0.96,        // its odds before mana (with all the moa's mana, 0.72: the story decides it anyway)
  lairDist: 230          // how far from the nest the Pouākai talk, toward the north-west
};

const JOURNEY_2F = (() => {
  const D = JOURNEY_2F_DIAL, K = CHAPTERS_KIT;
  const PAIR = ['pukepuke', 'koukou'];
  const ent = (x, n) => { const e = x.runner.castEnts[n]; return e && e.alive ? e : null; };
  const home = (x) => x.runner.sites.homeNest || null;
  const homeSite = (x) => x.runner.vars._homeSite || null;
  const hold = { until: () => false, at: 0.92, maxSec: 900 };   // (the season waits while the story plays)

  // The camera eased onto a place (a site or a point), at `zoom`, over `sec`.
  const look = (where, zoom = 2.2, sec = 1.6) => (x) => {
    const p = typeof where === 'function' ? where(x) : x.runner.point(where);
    if (!p) return;
    x.game.cameraTo({ zoom, cx: p.x, cy: x.game._groundPaintY(p.x, p.y), ax: 0.5, ay: 0.5 }, sec * 60);
  };

  // ---- The home nest -----------------------------------------------------------------------
  // The nest is Pukepuke and Koukou's: only they nest or lay there, and they nowhere else.
  const claim = (x, site, forced) => {
    const r = x.runner, pk = ent(x, 'pukepuke'), kk = ent(x, 'koukou');
    site.heldBy = [pk, kk].filter(Boolean);
    for (const e of site.heldBy) e._homeNest = site;
    r.vars._homeSite = site;
    r.sites.homeNest = { x: site.pos.x, y: site.pos.y };
    r._log('beat', 'home_nest', forced ? 'forced' : 'founded');
  };
  // (If the fourth year ends with no nest, one is made for them where the old story put it.)
  const ensureHome = (x) => {
    if (homeSite(x)) return;
    const r = x.runner, p = r.point('nestC') || r.point('nestA');
    if (!p) return;
    const site = r.sim.addNestingSite(p.x, p.y, { radius: 40 });
    if (site) claim(x, site, true);
  };

  // ---- Who stands where --------------------------------------------------------------------
  // A named bird held to a spot (Moa._stayAt), `off` from a place, walking at `speed`.
  const stand = (name, where, off = { x: 0, y: 0 }, speed = 1.2) => (x) => {
    const e = ent(x, name), p = typeof where === 'function' ? where(x) : x.runner.point(where);
    if (e && p) e._stayAt = { x: p.x + off.x, y: p.y + off.y, speed };
  };
  const near = (name, where, d) => (x) => {
    const e = ent(x, name), p = typeof where === 'function' ? where(x) : x.runner.point(where);
    return !!(e && p && Math.hypot(e.pos.x - p.x, e.pos.y - p.y) <= d);
  };
  // Off the land at an edge, at `speed` (Moa.beginLeaving: the runner records it as walked on).
  const leave = (e, side, x, speed = 1.15) => {
    const edge = x.runner._findSite({ find: 'edge', side, near: { x: e.pos.x, y: e.pos.y } }) || x.game._nearestEdge(e.pos.x, e.pos.y);
    if (edge) e.beginLeaving(edge.x, edge.y, { speed });
  };

  // ---- The Pouākai ---------------------------------------------------------------------------
  // Their lair's direction: off toward the north-west from the nest, kept on the land.
  const lair = (x) => {
    const n = home(x), t = x.game.terrain, m = 70;
    if (!n) return null;
    const k = D.lairDist / Math.SQRT2;
    return { x: Math.max(m, Math.min(t.mapWidth - m, n.x - k)), y: Math.max(m, Math.min(t.mapHeight - m, n.y - k)) };
  };
  // The land's eagle is the first; a second flies in beside it. Both are held at the lair.
  const gatherPouakai = (x) => {
    const r = x.runner, sim = r.sim, L = lair(x);
    if (!L) return;
    let eagles = sim.eagles.filter(e => e.alive);
    if (eagles.length < 2 && sim.spawnEagle) { sim.spawnEagle(); eagles = sim.eagles.filter(e => e.alive); }
    const [e1, e2] = eagles;
    if (e1) { r.castEnts.pouakai1 = e1; e1.castName = 'pouakai1'; e1.pos.set(L.x - 18, L.y); e1.vel.mult(0); e1.holdOver(L.x - 14, L.y, 16); }
    if (e2) { r.castEnts.pouakai2 = e2; e2.castName = 'pouakai2'; e2.pos.set(L.x + 18, L.y + 4); e2.vel.mult(0); e2.holdOver(L.x + 14, L.y + 4, 16); }
    r.sites.lair = L;
    r._log('beat', 'pouakai', `${eagles.length} at the lair`);
  };
  const circleNest = (r1, r2, speed = 1.8) => (x) => {
    const n = home(x);
    if (!n) return;
    const e1 = ent(x, 'pouakai1'), e2 = ent(x, 'pouakai2');
    if (e1) e1.holdOver(n.x, n.y, r1, speed);
    if (e2) e2.holdOver(n.x, n.y, r2, speed);
  };
  const eaglesClose = (d) => (x) => {
    const n = home(x);
    return !!n && ['pouakai1', 'pouakai2'].every(k => { const e = ent(x, k); return !e || Math.hypot(e.pos.x - n.x, e.pos.y - n.y) <= d; });
  };

  // ---- The egg ---------------------------------------------------------------------------------
  const layPipi = (x) => {
    const r = x.runner, n = home(x), kk = ent(x, 'koukou'), pk = ent(x, 'pukepuke');
    if (!n) return;
    const egg = r.sim.addEggAt(n.x, n.y + 2, 'upland_moa', { incubationFrames: 60 * 60 * 60 });   // (it will not hatch here)
    egg._story = true;              // (no kea's to raid: Kea, nearestRaidableEgg)
    egg.forcedSex = 'female';       // (Pipi is a hen)
    egg.mother = kk; egg.father = pk;
    r.castEnts.baby = egg; egg.castName = 'baby';
    r._log('beat', 'pipi', 'laid');
  };
  const raidPipi = (x) => {
    const r = x.runner, n = home(x), egg = ent(x, 'baby');
    if (!n || !egg || typeof RAIDS === 'undefined') { r.flags.raided = true; return; }
    RAIDS.open(x.game, {
      key: 'pipi', at: { x: n.x, y: n.y }, radius: 70, sec: D.raidSec, attacker: 'haasts_eagle', defender: 'upland_moa', scale: 1,
      attackers: () => ['pouakai1', 'pouakai2'].filter(k => ent(x, k)).length,
      defenders: () => PAIR.filter(k => ent(x, k)).length,
      chance: () => D.raidOdds, forced: true,
      onRoll: () => { r.flags.raided = true; r._log('beat', 'raid', 'the Pouākai win'); }
    });
  };
  const grab = (x) => {
    const r = x.runner, n = home(x), egg = ent(x, 'baby'), e1 = ent(x, 'pouakai1'), e2 = ent(x, 'pouakai2');
    if (egg && e2) e2.carryOff(egg, { sides: ['north', 'west'] });
    else if (egg && e1) e1.carryOff(egg, { sides: ['north', 'west'] });
    if (e1 && e2 && n) e1.landAt(n.x, n.y);
    r._log('beat', 'grab', egg ? 'the egg is taken' : 'no egg');
  };

  // ---- The tribe ---------------------------------------------------------------------------------
  // Everyone who goes west with Koukou: her tribe as the kit names it (CHAPTERS_KIT.WEST), and
  // every unnamed upland moa on the land (they are counted for tile 3: rec.tribe).
  const southward = ['friendMama', 'friendPapa'];
  const tribeNamed = () => K.WEST.filter(n => n !== 'koukou' && !southward.includes(n));
  const gatherTribe = (x) => {
    const r = x.runner, kk = ent(x, 'koukou');
    if (!kk) return;
    const named = tribeNamed().map(n => ent(x, n)).filter(Boolean);
    const others = r.sim.moas.filter(m => m.alive && m.speciesKey === 'upland_moa' && !m.castName && !m._leaving);
    r.vars._tribe = others;
    [...named, ...others].forEach((m, i) => {
      const a = i * 2.4, d = 16 + 6 * (i % 3);
      m._tribe = true;
      m._stayAt = { x: kk.pos.x + Math.cos(a) * d, y: kk.pos.y + Math.sin(a) * d * 0.7, speed: 1.3 };
    });
    for (const n of southward) { const e = ent(x, n); if (e) leave(e, 'south', x); }
    r._log('beat', 'tribe', `${named.length} named, ${others.length} more`);
  };
  const goWest = (x) => {
    const r = x.runner, kk = ent(x, 'koukou');
    const all = [kk, ...tribeNamed().map(n => ent(x, n)), ...(r.vars._tribe || [])].filter(m => m && m.alive);
    for (const m of all) leave(m, 'west', x, 1.2);
  };

  // ---- Lines ---------------------------------------------------------------------------------------
  const P1 = (t) => ['pouakai1', t, { lit: ['pouakai1'] }];
  const P2 = (t) => ['pouakai2', t, { lit: ['pouakai2'], guideFlip: true }];
  const KK = (t) => ['koukou', t, { lit: ['koukou'] }];
  const PK = (t) => ['pukepuke', t, { lit: ['pukepuke'] }];
  const VOICE = (t, boom = false) => ['guide', t, Object.assign({ title: "???", guideSprite: 'shadow' }, boom ? { speaker: 'boom' } : {})];

  // ==========================================================================================
  return {
    years: D.years,

    cast: {
      pouakai1: { title: "Pouākai", species: 'haasts_eagle', manual: true },
      pouakai2: { title: "Pouākai", species: 'haasts_eagle', manual: true }
    },

    // The fourth year: pātōtara founds nests, and the first is the pair's home.
    reactions: [
      { id: 'nest_year', on: 'chapter_start', if: (x) => !!x.event && x.event.chapter === 'summer' && x.runner.yearNow() === D.years,
        do: [(x) => x.runner.setNesting({ species: 'upland_moa', plant: 'patotara' }),
             { notify: ["Pukepuke and Koukou are grown. Two PĀTŌTARA patches side by side, with them close by, make a nest.", 'success'] }] },
      { id: 'home_nest', on: 'nest_founded', if: (x) => !homeSite(x) && x.runner.yearNow() >= D.years && !!x.event && !!x.event.site,
        do: [(x) => claim(x, x.event.site, false), { notify: ["Pukepuke and Koukou have made a nest together!", 'success'] }] },
      { id: 'nest_nudge', when: (x) => x.runner.yearNow() === D.years && x.game.seasonManager.currentKey === 'summer' &&
                                       !homeSite(x) && x.runner.scopeTime() > D.nestNudgeSec * 60,
        notify: ["No nest yet for Pukepuke and Koukou: grow two PĀTŌTARA close together beside them.", 'info'] }
    ],

    // After the fourth spring. Each beat waits on what it shows (or a few seconds at most).
    chapters: [
      { id: 'egg', title: "", tools: [], holdSeason: hold,
        start: [
          { flag: 'story' },   // (from here the upland moa leaving the land is the story, not a loss)
          ensureHome,
          (x) => { for (const e of x.runner.sim.eagles) if (e.alive) { const L = lair(x); if (L) e.holdOver(L.x, L.y, 30); } },
          stand('pukepuke', home, { x: 7, y: 2 }), stand('koukou', home, { x: -7, y: 2 }),
          look(home, 2.4, 2)
        ],
        until: { any: [{ all: [near('pukepuke', home, 14), near('koukou', home, 14)] }, { after: 12 }] },
        next: 'laid' },

      { id: 'laid', title: "", tools: [], holdSeason: hold,
        start: [layPipi, { notify: ["Pukepuke and Koukou have laid an egg!", 'success'] }],
        until: { after: 2.5 },
        next: 'lair' },

      // The two Pouākai at their lair.
      { id: 'lair', title: "", tools: [], holdSeason: hold,
        start: [gatherPouakai, look(lair, 2.2, 1.4),
          { say: [
            P1("Those two moa keep slipping just out of our grasp…"),
            P1("Something feels out of balance, like the land is favouring those fluffy-legged fools."),
            P2("I reckon if we take their egg, that’d break up their nest!"),
            P1("Taking eggs?! What are we, Kea? Indeed, we’ve had to scavenge, but Pouākai can’t stoop to eating eggs!"),
            P2("Relax! We’ll wait until the little one has hatched."),
            P2("Maybe they’ll even settle a new nest closer to our lair…"),
            P1("It is indeed time for the forest to find a new order."),
            P2("And it is time to ensure Pouākai stays at its apex!")
          ] }],
        until: { after: 0.6 },
        next: 'swoop' },

      // They fly at the nest; the pair see them coming.
      { id: 'swoop', title: "", tools: [], holdSeason: hold,
        start: [circleNest(40, 58), look(home, 2.0, 1.6),
          { say: [
            KK("I hope baby Pipi likes pātōtara as much as you do, Pookie-poo!"),
            KK("…Hmm. That’s strange. Pouākai don’t normally fly together…"),
            PK("They’re headed right toward us, Kou!")
          ] }],
        until: { any: [eaglesClose(80), { after: 8 }] },
        next: 'threat' },

      { id: 'threat', title: "", tools: [], holdSeason: hold,
        start: [circleNest(22, 34, 1.2),
          { say: [
            P1("The winds have blown in your favour for too long, big-legs!"),
            P2("That hatchling is ours!")
          ] }],
        until: { after: 0.4 },
        next: 'raid' },

      // The raid: the odds, the count and the mana, as any raid; the Pouākai win it.
      { id: 'raid', title: "The Pouākai raid the nest", tools: [], holdSeason: hold,
        start: [raidPipi],
        until: { any: [(x) => !!x.runner.flags.raided, { after: D.raidSec + 6 }] },
        next: 'grab' },

      // One takes the egg, the other lands on the nest; the pair scatter.
      { id: 'grab', title: "", tools: [], holdSeason: hold,
        start: [grab,
          stand('pukepuke', home, { x: 0, y: -62 }, 1.8), stand('koukou', home, { x: -64, y: 6 }, 1.8),
          look(home, 1.8, 1.2)],
        until: { any: [K.isTaken('baby'), { after: 6 }] },
        next: 'scatter' },

      { id: 'scatter', title: "", tools: [], holdSeason: hold,
        start: [{ say: [
          KK("Pipi! My little egg!"),
          PK("Run away, Koukou! We can’t fight them!"),
          P1("You’ve learned to be fast, but you’ll be the last of your line…"),
          P1("We’ll make sure of that!"),
          PK("I’ll distract it, Koukou! You take the tribe into the dense forest!"),
          PK("Hey, bird brain! I’m not hiding from you any more!"),
          PK("I’ll make these mountains a safe place for a Moa hatchling if it’s the last thing I do!"),
          KK("Come back, Pukepuke!")
        ] }],
        until: { after: 0.3 },
        next: 'chase' },

      // The Pouākai drives Pukepuke off the land to the north. It cannot catch him.
      { id: 'chase', title: "", tools: [], holdSeason: hold,
        start: [
          (x) => {
            const pk = ent(x, 'pukepuke'), e1 = ent(x, 'pouakai1');
            if (pk) { pk._stayAt = null; leave(pk, 'north', x, 1.9); }
            if (pk && e1) e1.chaseOff(pk, { gap: 26 });
          },
          (x) => x.game.cameraTo({ zoom: 1 }, 90)
        ],
        until: { any: [(x) => !!(x.runner.walked && x.runner.walked.pukepuke), { after: 14 }] },
        next: 'tribe' },

      // Koukou, alone with the tribe.
      { id: 'tribe', title: "", tools: [], holdSeason: hold,
        start: [
          // (Fallbacks, each logged: Pukepuke off the land, and the egg gone with the Pouākai.)
          (x) => { const pk = ent(x, 'pukepuke'); if (pk) { pk.alive = false; pk.causeOfDeath = 'dispersed'; x.runner._log('beat', 'chase', 'forced'); } },
          K.makeTaken('baby'),
          look('koukou', 2.0, 1.4),
          { say: [
            KK("My Pipi… But he was right. I can still protect the tribe."),
            KK("I will wait for Pukepuke… Even if I do end up the last of my line."),
            KK("Uplanders! Emergency migration! Come West with me! Mother, father, head back South to our safe nest!"),
            ['mama', "Lead our tribe with strength, Kou! I believe in you!", { lit: ['mama', 'koukou'] }]
          ] }
        ],
        until: { after: 0.3 },
        next: 'split' },

      // Some head south, home; the rest gather round Koukou.
      { id: 'split', title: "", tools: [], holdSeason: hold,
        start: [gatherTribe],
        until: { after: 4 },
        next: 'voice' },

      // A voice in the dark.
      { id: 'voice', title: "", tools: [], holdSeason: hold,
        start: [{ say: [
          VOICE("*BOOM. BOOM.*", true),
          VOICE("The big birds draw near."),
          KK("Huh? Who’s there?"),
          VOICE("Old birds have no business with big birds."),
          VOICE("In the forest’s darkest nooks, one may hide from sharp-beaked chooks."),
          KK("We seek shelter in your forest, Booming-birds!"),
          VOICE("*BOOM. BOOM.*", true),
          VOICE("*chitter.*"),
          KK("(Atua, give me courage...)")
        ] }],
        until: { after: 0.3 },
        next: 'west' },

      // Koukou and the tribe leave the land to the west.
      { id: 'west', title: "West", tools: [], holdSeason: hold,
        start: [goWest, (x) => x.game.cameraTo({ zoom: 1 }, 120)],
        until: { after: 6 },
        next: 'win' }
    ],

    // How many unnamed upland moa went west with Koukou (on the land still, or walked off it).
    tribeCount: (r) => (r.vars._tribe || []).filter(m => m.alive || m.causeOfDeath === 'dispersed').length
  };
})();
