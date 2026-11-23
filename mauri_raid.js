// ============================================================================
// RAIDS: a raid on a nest, played out in the open (the standoff)
// ============================================================================
// A raid is not decided the moment the raiders arrive. They gather at the nest and a countdown
// runs, in big figures over the nest beside the odds, and only when it reaches nought is the
// raid rolled. While it counts, the player can tap either side's picture to give that side
// MANA: a little mauri spent to swing the odds its way, up to `max` taps a side. So a raid on
// the player's own nest can be leaned against, and one the player aimed at a rival herd's nest
// (berries set beside it) can be leaned into.
//
// Used by the kea (Kea._raidStep, where mechanics.keaRaid.rollSec is above 0) and by a story's
// raid (the two Pouākai at the end of 2f, whose outcome is `forced`: the odds are still shown
// and can still be leaned on, but the story decides). The roll belongs to whoever opened the
// raid: onRoll(success, chance) is called once, at nought.
//
//   RAIDS.open(game, spec) -> raid
//     spec: { key, at: {x, y}, radius, sec, attacker: 'kea' | 'haasts_eagle', defender (a moa
//             species), attackers() and defenders() (how many on each side, for the figures),
//             chance() (0..1 that the raiders win, before mana), forced (true / false / null),
//             onRoll(success, chance), alive() (false cancels the raid), onCancel(),
//             mana: { cost, swing, max } (RAID_MANA by default), quiet (no first-raid notice:
//             a level that teaches the raid itself), hold() (true: the count waits) }
//   RAIDS.find(key)                  the raid open under `key` (the kea use the egg), or null
//   RAIDS.update(game, dt)           counts down and rolls (Game.update, while in play)
//   RAIDS.render(game)               the odds, the countdown and the mana taps (world pass)
//   RAIDS.click(game, mx, my)        a tap on a side's picture (Game.handleClick)
//   RAIDS.reset()                    a new level
// ============================================================================

const RAID_MANA = { cost: 10, swing: 0.08, max: 3 };

const RAIDS = {
  list: [],
  _hits: [],
  _told: false,   // (the first raid of a session says how to give mana)

  // lessonDone: a level that teaches raids (keaRaid.teach) has given its lesson; until then
  // its first raid's count is held (Kea._joinStandoff). Per level.
  reset() { this.list = []; this._hits = []; this.lessonDone = false; },

  find(key) { return this.list.find(r => r.key === key && !r.done) || null; },

  open(game, spec) {
    const r = Object.assign({ t: 0, sec: 4, done: false, radius: 90, attacker: 'kea', defender: 'upland_moa', forced: null }, spec);
    r.manaCfg = Object.assign({}, RAID_MANA, spec.mana || {});
    r.mana = { att: 0, def: 0 };
    this.list.push(r);
    if (!this._told && !r.quiet && game && game.addNotification) {
      this._told = true;
      game.addNotification(`A raid! Before the count runs out, tap the moa or the ${this._kindName(game, r.attacker)} to give that side mana (${r.manaCfg.cost} mauri).`, 'info');
    }
    return r;
  },

  // The chance the raiders win, with the mana given to each side.
  chance(r) {
    const base = r.chance ? r.chance() : 0.5;
    const swing = r.manaCfg.swing * (r.mana.att - r.mana.def);
    return Math.max(0.02, Math.min(0.98, base + swing));
  },

  secLeft(r) { return Math.max(0, Math.ceil(r.sec - r.t / 60)); },

  update(game, dt = 1) {
    if (!this.list.length) return;
    for (const r of this.list) {
      if (r.done) continue;
      if (r.alive && !r.alive()) { r.done = true; if (r.onCancel) r.onCancel(); continue; }
      if (r.hold && r.hold()) continue;   // (a lesson holds the count while it teaches)
      r.t += dt;
      if (r.t < r.sec * 60) continue;
      r.done = true;
      const p = this.chance(r);
      // (A story's raid is decided by the story: no roll, so nothing else's dice move.)
      r.result = r.forced != null ? !!r.forced : random() < p;
      if (r.onRoll) r.onRoll(r.result, p);
    }
    this.list = this.list.filter(r => !r.done);
  },

  render(game) {
    this._hits = [];
    for (const r of this.list) {
      if (r.done) continue;
      game._drawRaidOdds(r.at, r.radius, this.chance(r), r.attackers ? r.attackers() : 1, r.defenders ? r.defenders() : 0,
        r.defender, r.scale || 0.75, { countdown: this.secLeft(r), attacker: r.attacker, raid: r });
    }
  },

  // A tap within reach of a side's picture gives that side one mana, if there is mauri for it.
  click(game, mx, my) {
    for (const h of this._hits) {
      if ((mx - h.x) ** 2 + (my - h.y) ** 2 > h.r * h.r) continue;
      const r = h.raid, side = h.side, cfg = r.manaCfg;
      if (r.done) return true;
      if (r.mana[side] >= cfg.max) { if (typeof touchSound === 'function') touchSound('refuse'); return true; }
      if (!game.mauri || game.mauri.mauri < cfg.cost) {
        if (typeof touchSound === 'function') touchSound('refuse');
        game.addNotification(`Mana costs ${cfg.cost} mauri.`, 'error');
        return true;
      }
      game.mauri.spend(cfg.cost);
      r.mana[side]++;
      if (typeof touchSound === 'function') touchSound('press');
      const who = side === 'def' ? 'the moa' : this._kindName(game, r.attacker);
      if (game.mauri.floatingTexts) game.mauri.floatingTexts.push({ text: `mana to ${who}`, x: r.at.x, y: r.at.y + 6, life: 70, maxLife: 70 });
      return true;
    }
    return false;
  },

  // (Called from Game._drawRaidOdds as it draws a raid's two pictures: where each is on the
  // screen, and how far round it a tap still counts.)
  _hit(raid, side, x, y, r) { this._hits.push({ raid, side, x, y, r }); },

  _kindName(game, kind) {
    if (kind === 'haasts_eagle') return 'Pouākai';
    const n = game && game._freeplaySpeciesName ? game._freeplaySpeciesName(kind) : kind;
    return (n || kind).toLowerCase();
  }
};
