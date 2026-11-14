// A small probe for tuning a journey lesson's stage (loaded into the page beside standins.js):
//   await PROBE.go({ seconds, player, every })  ->  a report, with how often each named bird
// had other moa (or a flock) close by, sampled every `every` seconds, and where it stood.
'use strict';
window.PROBE = {
  async inject() {
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/tools/standins.js?' + Date.now(); s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    return STANDINS.load();
  },
  async go({ seconds = 180, player = 'none', every = 5, others = 'little_bush_moa', flock = 'kaka', logKinds = null } = {}) {
    const ch = game.chapters, sim = game.simulation, t = game.terrain;
    const tally = {}, n = Math.ceil(seconds / every);
    let out = null;
    for (let i = 0; i < n && game.state === GAME_STATE.PLAYING; i++) {
      out = await STANDINS.run({ seconds: every, player });
      const sk = game.seasonManager.currentKey;
      for (const name in ch.castEnts) {
        const e = ch.castEnts[name];
        if (!e || !e.alive) continue;
        const key = `${name}/${sk}`;
        const T = tally[key] || (tally[key] = { n: 0, moaNear: 0, flockNear: 0, hungry: 0, biome: {} });
        T.n++;
        if (sim.moas.some(m => m.alive && m.speciesKey === others && Math.hypot(m.pos.x - e.pos.x, m.pos.y - e.pos.y) < 50)) T.moaNear++;
        if ((sim.otherEntities[flock] || []).filter(b => b.alive && Math.hypot(b.pos.x - e.pos.x, b.pos.y - e.pos.y) < 90).length > 1) T.flockNear++;
        if (e.hunger > e.hungerThreshold + 15) T.hungry++;
        const b = t.getBiomeAt(e.pos.x, e.pos.y).key; T.biome[b] = (T.biome[b] || 0) + 1;
      }
    }
    out = out || STANDINS.report();
    out.near = Object.fromEntries(Object.entries(tally).map(([k, T]) => [k, `${T.moaNear}/${T.n} moa, ${T.flockNear}/${T.n} flock, hungry ${T.hungry}, ${Object.entries(T.biome).map(([b, c]) => b + ':' + c).join(' ')}`]));
    out.counters = Object.fromEntries(Object.entries(ch.counters).filter(([k]) => /crowded|stripped|placed|cases|solved|unaided|hatched|laid|raids|left|arrived/.test(k)));
    const kinds = logKinds || ['hint', 'case', 'missed', 'lost', 'won', 'issue', 'hold', 'beat', 'cast_lost', 'cast_left'];
    out.log = ch.log.filter(l => kinds.includes(l.kind)).map(l => `${l.t} ${l.kind} ${l.id} ${l.info}`);
    delete out.record;
    return out;
  }
};
