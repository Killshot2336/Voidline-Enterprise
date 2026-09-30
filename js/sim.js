(function (root) {
  "use strict";

  var D = root.VoidData;

  function xpNeed(level) {
    return 20 + (level - 1) * 30;
  }

  function money(n) {
    var v = Math.round(n);
    var neg = v < 0;
    var s = String(Math.abs(v));
    var o = "";
    var i;
    for (i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) o += ",";
      o += s.charAt(i);
    }
    return (neg ? "-$" : "$") + o;
  }

  function phaseAt(now) {
    var d = new Date(now);
    var m = d.getHours() * 60 + d.getMinutes();
    if (m >= 420 && m < 570) return { id: "morning", name: "Morning Rush", revenue: 1.35, scout: 1.1, study: 1 };
    if (m >= 660 && m < 840) return { id: "lunch", name: "Lunch Hour", revenue: 1.7, scout: 0.9, study: 0.85 };
    if (m >= 1020 && m < 1200) return { id: "evening", name: "Evening Trade", revenue: 1.2, scout: 1, study: 1.05 };
    if (m < 300) return { id: "night", name: "Night Drift", revenue: 0.72, scout: 1.25, study: 1.15 };
    return { id: "standard", name: "Standard Watch", revenue: 1, scout: 1, study: 1 };
  }

  function clockLabel(now) {
    var d = new Date(now);
    var h = d.getHours();
    var min = d.getMinutes();
    return (h < 10 ? "0" : "") + h + ":" + (min < 10 ? "0" : "") + min;
  }

  function pushLog(game, text) {
    var cap = D.LOG_CAP;
    game.log[game.logHead] = text;
    game.logHead = (game.logHead + 1) % cap;
    if (game.logN < cap) game.logN += 1;
    game.rev += 1;
  }

  function logLine(game, oldestIndex) {
    var cap = D.LOG_CAP;
    var start = (game.logHead - game.logN + cap * 4) % cap;
    return game.log[(start + oldestIndex) % cap];
  }

  function logToArray(game) {
    var out = [];
    var i;
    for (i = 0; i < game.logN; i++) out.push(logLine(game, i));
    return out;
  }

  function makeSlot(id) {
    return {
      id: id,
      jobId: "fast_food",
      stock: id === 0 ? 8 : 0,
      camera: false,
      employee: null,
      bucket: 0,
      cycles: 0
    };
  }

  function blankMats() {
    var mats = {};
    var i;
    for (i = 0; i < D.ITEMS.length; i++) mats[D.ITEMS[i].id] = 0;
    return mats;
  }

  function fresh(now) {
    var game = {
      v: 1,
      rev: 1,
      lastReal: now,
      phaseId: "",
      booted: false,
      uid: 1,
      player: {
        level: 1,
        xp: 0,
        vp: 0,
        capital: 180,
        intelligence: 12,
        stress: 15,
        visibility: 8,
        shifts: 0
      },
      settings: { highFX: true, fpsCap: 60, performanceMode: false },
      log: new Array(D.LOG_CAP),
      logN: 0,
      logHead: 0,
      slots: [makeSlot(0)],
      resumes: [],
      mats: blankMats(),
      nodes: {},
      degrees: {},
      degree: null,
      scouts: [],
      book: [],
      crafted: [],
      bonus: null,
      bonusRev: -1,
      flags: { insight: false },
      shiftAt: 0,
      restAt: 0,
      pulse: 0,
      lastNet: 0
    };
    game.mats.grease = 1;
    game.mats.neon = 1;
    game.mats.trainee = 1;
    game.mats.chalk = 1;
    game.mats.fryer = 1;
    pushLog(game, "Voidline Enterprise ledger online.");
    pushLog(game, "Kiosk stocked. Open Occupation to run a shift.");
    pushLog(game, "Academic rank 1. Levels award 1 Void Point.");
    return game;
  }

  function slotCap(game) {
    if (game.degrees.bach || game.nodes.rack) return 2;
    return 1;
  }

  function stockCap(game) {
    return game.nodes.rack ? 30 : 20;
  }

  function ensureSlots(game) {
    var cap = slotCap(game);
    while (game.slots.length < cap) game.slots.push(makeSlot(game.slots.length));
  }

  function hasTrait(emp, id) {
    if (!emp) return false;
    var t = emp.traits;
    var i;
    for (i = 0; i < t.length; i++) if (t[i] === id) return true;
    return false;
  }

  function recomputeBonus(game) {
    if (game.bonus && game.bonusRev === game.rev) return game.bonus;
    var tags = ["revenue", "night", "lunch", "visibility", "xp", "theft", "stress", "scout", "cycle", "int", "wage"];
    var bonus = {};
    var i;
    for (i = 0; i < tags.length; i++) bonus[tags[i]] = 1;
    for (i = 0; i < game.crafted.length; i++) {
      var c = game.crafted[i];
      var tag = c.tag || "revenue";
      if (!bonus[tag]) bonus[tag] = 1;
      bonus[tag] *= c.mult;
    }
    if (game.nodes.brand) bonus.visibility *= 1.25;
    for (i = 0; i < tags.length; i++) {
      if (bonus[tags[i]] > D.MULT_CAP) bonus[tags[i]] = D.MULT_CAP;
    }
    game.bonus = bonus;
    game.bonusRev = game.rev;
    return bonus;
  }

  function maybeLevel(game) {
    var leveled = false;
    var guard = 0;
    while (game.player.xp >= xpNeed(game.player.level) && guard < 12) {
      game.player.xp -= xpNeed(game.player.level);
      game.player.level += 1;
      game.player.vp += 1;
      leveled = true;
      pushLog(game, "* Rank " + game.player.level + ". +1 Void Point.");
      guard += 1;
    }
    return leveled;
  }

  function jobUnlocked(game, job) {
    if (game.player.level < job.level) return false;
    if (job.node && !game.nodes[job.node]) return false;
    return true;
  }

  function cycleSeconds(game) {
    var bonus = recomputeBonus(game);
    var sec = 1.7;
    if (game.nodes.timer) sec *= 0.8;
    sec /= bonus.cycle;
    if (sec < 0.45) sec = 0.45;
    return sec;
  }

  function staffMult(emp, phase) {
    if (!emp) return 0.65;
    var m = 1;
    if (hasTrait(emp, "hyper")) m += 0.2;
    if (hasTrait(emp, "closer")) m += 0.12;
    if (hasTrait(emp, "owl")) m += phase.id === "night" ? 0.25 : -0.05;
    if (hasTrait(emp, "loyal")) m += 0.05;
    if (hasTrait(emp, "slacker")) m -= 0.25;
    if (m < 0.25) m = 0.25;
    return m;
  }

  function resolveCycle(game, slot, phase, rng) {
    slot.cycles += 1;
    if (slot.stock <= 0) {
      if (slot.cycles % 4 === 0) {
        pushLog(game, "Audit: slot " + (slot.id + 1) + " is out of stock.");
      }
      return;
    }
    var emp = slot.employee;
    var steal = emp && hasTrait(emp, "fingers") && rng() < (0.22 / recomputeBonus(game).theft);
    slot.stock -= 1;
    if (steal) {
      var loss = Math.round((10 + jobBase(slot) * 0.3) * phase.revenue);
      game.player.capital = Math.max(0, game.player.capital - loss);
      if (slot.camera) {
        emp.caught = true;
        pushLog(game, "! Camera slot " + (slot.id + 1) + ": " + emp.name + " caught lifting stock. Loss " + money(loss) + ".");
      } else {
        pushLog(game, "! Inventory discrepancy on slot " + (slot.id + 1) + ". Unexplained loss " + money(loss) + ". Stock -1.");
      }
      game.player.stress = clampStat(game.player.stress + 2);
      return;
    }
    var bonus = recomputeBonus(game);
    var rush = phase.revenue;
    if (phase.id === "lunch") rush *= bonus.lunch;
    if (phase.id === "night") rush *= bonus.night;
    if (phase.id === "morning") rush *= 1;
    var stressTax = 1;
    if (game.player.stress > 90) stressTax = 0.7;
    else if (game.player.stress > 70) stressTax = 0.85;
    var gross = (9 + jobBase(slot) * 0.45) * rush * staffMult(emp, phase) * bonus.revenue * stressTax;
    var wage = emp ? emp.salary / 20 : 0;
    wage /= bonus.wage;
    var net = gross - wage;
    game.player.capital += net;
    if (game.player.capital < 0) game.player.capital = 0;
    var xp = 1 * bonus.xp;
    game.player.xp += xp;
    if (emp && hasTrait(emp, "clock")) game.player.stress = clampStat(game.player.stress + 0.45);
    else game.player.stress = clampStat(game.player.stress + 0.05);
    game.player.visibility = clampStat(game.player.visibility + 0.04 * bonus.visibility);
    maybeLevel(game);
    var line = (net >= 0 ? "+ " : "! ") + "Slot " + (slot.id + 1) + " cycle " + money(net) + ". Stock " + slot.stock + ".";
    pushLog(game, line);
    markPulse(game, net);
  }

  function jobBase(slot) {
    var job = D.jobById[slot.jobId];
    return job ? job.base : 8;
  }

  function markPulse(game, net) {
    game.lastNet = net;
    game.pulse += 1;
  }

  function pushUnique(arr, id) {
    var i;
    for (i = 0; i < arr.length; i++) if (arr[i] === id) return;
    arr.push(id);
  }

  function fmtMs(ms) {
    if (ms < 0) ms = 0;
    var s = Math.ceil(ms / 1000);
    var m = Math.floor(s / 60);
    var r = s % 60;
    if (m <= 0) return s + "s";
    return m + "m " + (r < 10 ? "0" : "") + r + "s";
  }

  function clampStat(n) {
    if (n < 0) return 0;
    if (n > 100) return 100;
    return n;
  }

  function applyWall(game, from, to) {
    if (to < from) return;
    var t = from;
    var guard = 0;
    while (t < to && guard < 600) {
      var next = t + 15 * 60 * 1000;
      if (next > to) next = to;
      var dt = next - t;
      var phase = phaseAt(t);
      if (game.degree) {
        game.degree.left -= dt * phase.study;
        if (game.degree.left <= 0) completeDegree(game);
      }
      var s;
      for (s = game.scouts.length - 1; s >= 0; s--) {
        var mission = game.scouts[s];
        mission.left -= dt * phase.scout * recomputeBonus(game).scout;
        if (mission.left <= 0) completeScout(game, s, phase);
      }
      t = next;
      guard += 1;
    }
  }

  function completeDegree(game) {
    var deg = game.degree;
    if (!deg) return;
    var def = D.degreeById[deg.id];
    game.degrees[deg.id] = true;
    game.degree = null;
    if (deg.id === "cert") game.player.intelligence = clampStat(game.player.intelligence + 8);
    if (deg.id === "assoc") {
      game.player.visibility = clampStat(game.player.visibility + 8);
      game.player.intelligence = clampStat(game.player.intelligence + 6);
    }
    if (deg.id === "bach") {
      game.player.intelligence = clampStat(game.player.intelligence + 10);
      game.player.stress = clampStat(game.player.stress - 10);
      ensureSlots(game);
    }
    if (deg.id === "mba") {
      game.player.intelligence = clampStat(game.player.intelligence + 12);
      game.flags.insight = true;
    }
    if (deg.id === "doc") {
      game.player.intelligence = clampStat(game.player.intelligence + 15);
      game.player.stress = clampStat(game.player.stress - 20);
      game.player.vp += 1;
    }
    pushLog(game, "* Degree filed: " + (def ? def.name : deg.id) + ".");
    game.rev += 1;
  }

  function scoutPool(id) {
    if (id === "block") return ["chalk", "grease", "trainee", "fryer", "poster"];
    if (id === "city") return ["neon", "orbit", "jingle", "scooter", "kiosk", "closer", "beacon"];
    return ["hush", "broth", "static", "halo", "rack", "lens", "lunar", "relay", "parade", "warden"];
  }

  function completeScout(game, index, phase) {
    var mission = game.scouts[index];
    game.scouts.splice(index, 1);
    var pool = scoutPool(mission.id);
    var itemId = pool[Math.floor(Math.random() * pool.length)];
    game.mats[itemId] = (game.mats[itemId] || 0) + 1;
    var item = D.itemById[itemId];
    var vis = mission.id === "orbital" ? 6 : mission.id === "city" ? 3 : 1.5;
    game.player.visibility = clampStat(game.player.visibility + vis * recomputeBonus(game).visibility);
    var pay = mission.id === "orbital" ? 40 : mission.id === "city" ? 18 : 8;
    pay = Math.round(pay * phase.revenue);
    game.player.capital += pay;
    pushLog(game, "* Scout returned: " + (item ? item.name : itemId) + " and " + money(pay) + ".");
    if (mission.id === "orbital" && Math.random() < 0.35) revealRecipe(game, "survey");
    game.rev += 1;
  }

  function bookHas(game, key) {
    var i;
    for (i = 0; i < game.book.length; i++) if (game.book[i] === key) return true;
    return false;
  }

  function craftedHas(game, key) {
    var i;
    for (i = 0; i < game.crafted.length; i++) if (game.crafted[i].key === key) return true;
    return false;
  }

  function revealRecipe(game, via) {
    var unknown = [];
    var i;
    for (i = 0; i < D.RECIPES.length; i++) {
      if (!bookHas(game, D.RECIPES[i].key)) unknown.push(D.RECIPES[i]);
    }
    if (!unknown.length) {
      pushLog(game, "Cookbook already holds every legendary recipe.");
      return false;
    }
    var rec = unknown[Math.floor(Math.random() * unknown.length)];
    game.book.push(rec.key);
    pushLog(game, "* Blueprint researched (" + via + "): " + rec.name + ".");
    game.rev += 1;
    return true;
  }

  function runBusiness(game, now, ms, rng) {
    var phase = phaseAt(now);
    var i;
    ensureSlots(game);
    for (i = 0; i < game.slots.length; i++) {
      var slot = game.slots[i];
      slot.bucket += ms / 1000;
      var guard = 0;
      var len = cycleSeconds(game);
      while (slot.bucket >= len && guard < 40) {
        slot.bucket -= len;
        resolveCycle(game, slot, phase, rng);
        guard += 1;
        len = cycleSeconds(game);
      }
      if (slot.bucket > len) slot.bucket = len;
    }
  }

  function frame(game, now, rng) {
    if (!rng) rng = Math.random;
    if (now < game.lastReal) game.lastReal = now;
    var wall = now - game.lastReal;
    if (wall > 0) {
      applyWall(game, game.lastReal, now);
      var biz = wall;
      if (biz > 120000) biz = 120000;
      if (!game.booted && wall > 1500) {
        pushLog(game, "Catch-up used the device clock (" + Math.round(wall / 1000) + "s). Business sim capped at 120s.");
      }
      runBusiness(game, now, biz, rng);
      game.lastReal = now;
    }
    var phase = phaseAt(now);
    if (!game.booted || phase.id !== game.phaseId) {
      pushLog(game, "Clock phase: " + phase.name + ". Revenue x" + phase.revenue.toFixed(2) + ".");
    }
    game.phaseId = phase.id;
    game.booted = true;
    return phase;
  }

  function workShift(game, now) {
    if (now - game.shiftAt < 350) return { ok: false, reason: "cooldown" };
    game.shiftAt = now;
    var phase = phaseAt(now);
    var bonus = recomputeBonus(game);
    var pay = Math.round((14 + game.player.level * 2) * phase.revenue * bonus.revenue);
    game.player.capital += pay;
    game.player.xp += 22 * bonus.xp;
    game.player.stress = clampStat(game.player.stress + 4);
    game.player.intelligence = clampStat(game.player.intelligence + 0.4);
    game.player.shifts += 1;
    if (game.player.shifts % 3 === 0) {
      game.player.visibility = clampStat(game.player.visibility + 1.5 * bonus.visibility);
    }
    maybeLevel(game);
    pushLog(game, "+ Shift closed. Paid " + money(pay) + ". Academic XP rose.");
    game.rev += 1;
    markPulse(game, pay);
    return { ok: true, pay: pay };
  }

  function rest(game, now) {
    if (now - game.restAt < 2000) return { ok: false };
    game.restAt = now;
    game.player.stress = clampStat(game.player.stress - 12 * recomputeBonus(game).stress);
    pushLog(game, "Rest cycle. Stress eased.");
    game.rev += 1;
    return { ok: true };
  }

  function buyStock(game, slotIndex) {
    ensureSlots(game);
    var slot = game.slots[slotIndex];
    if (!slot) return { ok: false };
    var room = stockCap(game) - slot.stock;
    if (room <= 0) {
      pushLog(game, "Slot " + (slotIndex + 1) + " stock is at cap.");
      return { ok: false };
    }
    var n = D.STOCK_PACK;
    if (n > room) n = room;
    var cost = n * D.STOCK_PRICE;
    if (game.player.capital < cost) {
      pushLog(game, "! Not enough capital for stock.");
      return { ok: false };
    }
    game.player.capital -= cost;
    slot.stock += n;
    pushLog(game, "Stock audit in: +" + n + " on slot " + (slotIndex + 1) + " for " + money(cost) + ".");
    game.rev += 1;
    return { ok: true };
  }

  function rollResume(game, rng) {
    if (!rng) rng = Math.random;
    if (game.resumes.length >= 4) {
      pushLog(game, "Applicant board is full.");
      return null;
    }
    var name = D.FIRST[Math.floor(rng() * D.FIRST.length)] + " " + D.LAST[Math.floor(rng() * D.LAST.length)];
    var ask = 10 + Math.floor(rng() * 16) + game.player.level;
    var floorRatio = 0.62 + rng() * 0.25;
    if (rng() < 0.2) floorRatio -= 0.08;
    var floor = Math.max(6, Math.round(ask * floorRatio));
    if (floor > ask) floor = ask;
    var traits = [];
    var positives = ["hyper", "closer", "owl", "loyal"];
    pushUnique(traits, positives[Math.floor(rng() * positives.length)]);
    if (rng() < 0.35) pushUnique(traits, positives[Math.floor(rng() * positives.length)]);
    if (rng() < 0.48) {
      var negatives = ["fingers", "slacker", "clock"];
      pushUnique(traits, negatives[Math.floor(rng() * negatives.length)]);
    }
    var card = {
      id: game.uid++,
      name: name,
      ask: ask,
      floor: floor,
      traits: traits,
      strikes: 0,
      dying: false,
      slide: 0
    };
    game.resumes.push(card);
    pushLog(game, "Resume filed: " + name + " asks " + money(ask) + ".");
    game.rev += 1;
    return card;
  }

  function firstOpenSlot(game) {
    ensureSlots(game);
    var i;
    for (i = 0; i < game.slots.length; i++) if (!game.slots[i].employee) return game.slots[i];
    return null;
  }

  function acceptCard(game, card, salary) {
    var slot = firstOpenSlot(game);
    if (!slot) {
      pushLog(game, "No open venture seat. Fire someone first.");
      return { ok: false, reason: "filled" };
    }
    slot.employee = {
      name: card.name,
      salary: salary,
      traits: card.traits.slice(),
      caught: false
    };
    var idx = game.resumes.indexOf(card);
    if (idx >= 0) game.resumes.splice(idx, 1);
    pushLog(game, "* " + card.name + " locked into slot " + (slot.id + 1) + " at " + money(salary) + ".");
    game.rev += 1;
    return { ok: true, salary: salary, slot: slot.id };
  }

  function counterOffer(game, cardId, wage) {
    var card = null;
    var i;
    for (i = 0; i < game.resumes.length; i++) if (game.resumes[i].id === cardId) card = game.resumes[i];
    if (!card || card.dying) return { ok: false, reason: "no-card" };
    wage = Math.round(Number(wage));
    if (!(wage > 0)) {
      pushLog(game, "Enter a counter-wage.");
      return { ok: false, reason: "bad-wage" };
    }
    if (wage >= card.ask) return acceptCard(game, card, card.ask);
    if (wage >= card.floor) return acceptCard(game, card, wage);
    card.strikes += 1;
    if (card.strikes >= 3) {
      card.dying = true;
      card.slide = 0;
      pushLog(game, "! " + card.name + " rejected the third offer and is leaving.");
      game.rev += 1;
      return { ok: false, reason: "destroyed", strikes: 3 };
    }
    pushLog(game, card.name + " rejected " + money(wage) + ". Strike " + card.strikes + " of 3.");
    game.rev += 1;
    return { ok: false, reason: "reject", strikes: card.strikes };
  }

  function sweepDead(game) {
    var i;
    var removed = 0;
    for (i = game.resumes.length - 1; i >= 0; i--) {
      if (game.resumes[i].dying) {
        game.resumes.splice(i, 1);
        removed += 1;
      }
    }
    if (removed) game.rev += 1;
    return removed;
  }

  function advanceSlides(game, dtMs) {
    var i;
    var done = false;
    for (i = 0; i < game.resumes.length; i++) {
      var card = game.resumes[i];
      if (!card.dying) continue;
      card.slide += dtMs / 420;
      if (card.slide >= 1) done = true;
    }
    if (done) sweepDead(game);
  }

  function fire(game, slotIndex) {
    var slot = game.slots[slotIndex];
    if (!slot || !slot.employee) return { ok: false };
    pushLog(game, "Released " + slot.employee.name + " from slot " + (slotIndex + 1) + ".");
    slot.employee = null;
    game.rev += 1;
    return { ok: true };
  }

  function installCamera(game, slotIndex) {
    if (!game.nodes.camera) {
      pushLog(game, "Camera Schematic is still locked in the lab.");
      return { ok: false };
    }
    var slot = game.slots[slotIndex];
    if (!slot) return { ok: false };
    if (slot.camera) {
      pushLog(game, "Slot " + (slotIndex + 1) + " already has a live camera.");
      return { ok: false };
    }
    if (game.player.capital < D.CAM_COST) {
      pushLog(game, "! Security Camera Module costs " + money(D.CAM_COST) + ".");
      return { ok: false };
    }
    game.player.capital -= D.CAM_COST;
    slot.camera = true;
    pushLog(game, "* Security Camera Module socketed on slot " + (slotIndex + 1) + ".");
    game.rev += 1;
    return { ok: true };
  }

  function applyJob(game, slotIndex, jobId) {
    var job = D.jobById[jobId];
    var slot = game.slots[slotIndex];
    if (!job || !slot) return { ok: false };
    if (!jobUnlocked(game, job)) {
      pushLog(game, "Application refused: " + job.name + " is still sealed.");
      return { ok: false };
    }
    slot.jobId = job.id;
    pushLog(game, "* Career application accepted: " + job.name + " on slot " + (slotIndex + 1) + ".");
    game.rev += 1;
    return { ok: true };
  }

  function enroll(game, degreeId, now) {
    var def = D.degreeById[degreeId];
    if (!def) return { ok: false };
    if (game.degrees[degreeId]) {
      pushLog(game, def.name + " is already on the resume.");
      return { ok: false };
    }
    if (game.degree) {
      pushLog(game, "Already enrolled. One degree clock at a time.");
      return { ok: false };
    }
    if (game.player.level < def.level) {
      pushLog(game, "Rank " + def.level + " required for " + def.name + ".");
      return { ok: false };
    }
    if (game.player.capital < def.cost) {
      pushLog(game, "! Tuition is " + money(def.cost) + ".");
      return { ok: false };
    }
    game.player.capital -= def.cost;
    game.degree = { id: def.id, left: def.ms, total: def.ms };
    pushLog(game, "Enrolled: " + def.name + ". Progress follows the device clock.");
    game.rev += 1;
    return { ok: true };
  }

  function dispatchScout(game, scoutId) {
    if (!game.nodes.charter) {
      pushLog(game, "Scout Charter is locked. Spend Void Points in the lab.");
      return { ok: false };
    }
    var def = D.scoutById[scoutId];
    if (!def) return { ok: false };
    if (game.scouts.length >= 2) {
      pushLog(game, "Both scout channels are already out.");
      return { ok: false };
    }
    if (game.player.capital < def.cost) {
      pushLog(game, "! Dispatch costs " + money(def.cost) + ".");
      return { ok: false };
    }
    game.player.capital -= def.cost;
    game.scouts.push({ id: def.id, left: def.ms, total: def.ms });
    pushLog(game, "Scout dispatched: " + def.name + ". The clock is running.");
    game.rev += 1;
    return { ok: true };
  }

  function unlockNode(game, nodeId) {
    var node = D.nodeById[nodeId];
    if (!node) return { ok: false };
    if (game.nodes[nodeId]) return { ok: false, reason: "owned" };
    if (node.requires && !game.nodes[node.requires]) {
      pushLog(game, node.name + " needs the prior node on its line.");
      return { ok: false, reason: "prereq" };
    }
    if (game.player.vp < node.cost) {
      pushLog(game, "! " + node.name + " costs " + node.cost + " VP.");
      return { ok: false, reason: "vp" };
    }
    game.player.vp -= node.cost;
    game.nodes[nodeId] = true;
    if (nodeId === "rack") ensureSlots(game);
    pushLog(game, "* Lab unlock: " + node.name + ". " + node.text);
    game.rev += 1;
    return { ok: true };
  }

  function combinationKey(idea, staff, marketing, asset) {
    return idea + "|" + staff + "|" + marketing + "|" + asset;
  }

  function combine(ideaId, staffId, marketingId, assetId) {
    var idea = D.itemById[ideaId];
    var staff = D.itemById[staffId];
    var marketing = D.itemById[marketingId];
    var asset = D.itemById[assetId];
    if (!idea || !staff || !marketing || !asset) return null;
    var key = combinationKey(ideaId, staffId, marketingId, assetId);
    var legend = D.recipeByKey[key];
    if (legend) {
      return {
        key: key,
        legendary: true,
        name: legend.name,
        tag: legend.tag,
        mult: legend.mult,
        power: legend.mult,
        synergy: 0
      };
    }
    var avg = idea.power * D.W_IDEA + staff.power * D.W_STAFF + marketing.power * D.W_MKT + asset.power * D.W_ASSET;
    var power = avg + avg * D.SYNERGY;
    var name = idea.fragment + "-" + staff.fragment + " " + marketing.fragment + asset.fragment;
    return {
      key: key,
      legendary: false,
      name: name,
      tag: "revenue",
      mult: 1 + power / 250,
      power: power,
      synergy: avg * D.SYNERGY,
      avg: avg
    };
  }

  function spendMats(game, ids) {
    var i;
    for (i = 0; i < ids.length; i++) {
      if ((game.mats[ids[i]] || 0) < 1) return false;
    }
    for (i = 0; i < ids.length; i++) game.mats[ids[i]] -= 1;
    return true;
  }

  function activateResult(game, result) {
    if (craftedHas(game, result.key)) {
      pushLog(game, result.name + " is already active. Materials kept.");
      return { ok: false, reason: "duplicate" };
    }
    if (!bookHas(game, result.key)) game.book.push(result.key);
    game.crafted.push({
      key: result.key,
      name: result.name,
      tag: result.tag,
      mult: result.mult,
      legendary: result.legendary
    });
    game.bonusRev = -1;
    if (result.legendary) {
      pushLog(game, "* Legendary blueprint: " + result.name + ". " + result.tag + " x" + result.mult.toFixed(2) + ".");
    } else {
      pushLog(game, "Hybrid filed: " + result.name + ". Power " + result.power.toFixed(2) + " after 11.5% synergy.");
    }
    game.rev += 1;
    return { ok: true, result: result };
  }

  function synthesize(game, idea, staff, marketing, asset) {
    var result = combine(idea, staff, marketing, asset);
    if (!result) return { ok: false };
    var ids = [idea, staff, marketing, asset];
    if (!spendMats(game, ids)) {
      pushLog(game, "Synthesis missing a baseline material.");
      return { ok: false, reason: "mats" };
    }
    var act = activateResult(game, result);
    if (!act.ok && act.reason === "duplicate") {
      var k;
      for (k = 0; k < ids.length; k++) game.mats[ids[k]] += 1;
    }
    return act;
  }

  function craftFromBook(game, key) {
    if (craftedHas(game, key)) {
      pushLog(game, "That blueprint is already running.");
      return { ok: false, reason: "duplicate" };
    }
    var legend = D.recipeByKey[key];
    var ids;
    var result;
    if (legend) {
      ids = [legend.idea, legend.staff, legend.marketing, legend.asset];
      result = combine(legend.idea, legend.staff, legend.marketing, legend.asset);
    } else {
      ids = key.split("|");
      if (ids.length !== 4) return { ok: false };
      result = combine(ids[0], ids[1], ids[2], ids[3]);
    }
    if (!result) return { ok: false };
    if (!bookHas(game, key) && !bookHas(game, result.key)) {
      pushLog(game, "Blueprint is not in the cookbook yet.");
      return { ok: false };
    }
    if (!spendMats(game, ids)) {
      pushLog(game, "Auto-craft needs the baseline materials on hand.");
      return { ok: false, reason: "mats" };
    }
    return activateResult(game, result);
  }

  function research(game) {
    if (game.player.vp < 1) {
      pushLog(game, "! Research costs 1 Void Point.");
      return { ok: false };
    }
    var before = game.book.length;
    var ok = revealRecipe(game, "VP");
    if (!ok) return { ok: false };
    if (game.book.length === before) return { ok: false };
    game.player.vp -= 1;
    game.rev += 1;
    return { ok: true };
  }

  function buyItem(game, itemId) {
    var item = D.itemById[itemId];
    if (!item) return { ok: false };
    if (game.player.level < item.level) {
      pushLog(game, item.name + " lists at rank " + item.level + ".");
      return { ok: false };
    }
    var phase = phaseAt(game.lastReal || Date.now());
    var vis = game.player.visibility;
    var cost = item.cost * (phase.id === "lunch" ? 1.15 : 1) * (1 - Math.min(0.25, vis * 0.002));
    cost = Math.max(1, Math.round(cost));
    if (game.player.capital < cost) {
      pushLog(game, "! Market price is " + money(cost) + ".");
      return { ok: false };
    }
    game.player.capital -= cost;
    game.mats[itemId] = (game.mats[itemId] || 0) + 1;
    pushLog(game, "Market buy: " + item.name + " for " + money(cost) + ".");
    game.rev += 1;
    return { ok: true, cost: cost };
  }

  function marketCost(game, item) {
    var phase = phaseAt(game.lastReal || Date.now());
    var vis = game.player.visibility;
    var cost = item.cost * (phase.id === "lunch" ? 1.15 : 1) * (1 - Math.min(0.25, vis * 0.002));
    return Math.max(1, Math.round(cost));
  }

  function toJSON(game) {
    return {
      v: 1,
      lastReal: game.lastReal,
      uid: game.uid,
      player: game.player,
      settings: game.settings,
      log: logToArray(game),
      slots: game.slots,
      resumes: game.resumes.filter(function (c) { return !c.dying; }),
      mats: game.mats,
      nodes: game.nodes,
      degrees: game.degrees,
      degree: game.degree,
      scouts: game.scouts,
      book: game.book,
      crafted: game.crafted,
      flags: game.flags,
      shiftAt: game.shiftAt,
      restAt: game.restAt
    };
  }

  function fromJSON(data, now) {
    var game = fresh(now);
    if (!data || data.v !== 1) return game;
    game.log = new Array(D.LOG_CAP);
    game.logN = 0;
    game.logHead = 0;
    game.player = data.player;
    game.settings = data.settings || game.settings;
    game.slots = data.slots || game.slots;
    game.resumes = data.resumes || [];
    game.mats = blankMats();
    var k;
    if (data.mats) {
      for (k in data.mats) if (Object.prototype.hasOwnProperty.call(data.mats, k)) game.mats[k] = data.mats[k];
    }
    game.nodes = data.nodes || {};
    game.degrees = data.degrees || {};
    game.degree = data.degree || null;
    game.scouts = data.scouts || [];
    game.book = data.book || [];
    game.crafted = data.crafted || [];
    game.flags = data.flags || { insight: false };
    game.uid = data.uid || 1;
    game.shiftAt = data.shiftAt || 0;
    game.restAt = data.restAt || 0;
    game.lastReal = data.lastReal || now;
    var i;
    var lines = data.log || [];
    for (i = 0; i < lines.length; i++) pushLog(game, lines[i]);
    game.booted = false;
    game.bonusRev = -1;
    ensureSlots(game);
    return game;
  }

  function load(now, storage) {
    try {
      var raw = storage.getItem(D.SAVE_KEY);
      if (!raw) return fresh(now);
      return fromJSON(JSON.parse(raw), now);
    } catch (err) {
      return fresh(now);
    }
  }

  function save(game, storage) {
    storage.setItem(D.SAVE_KEY, JSON.stringify(toJSON(game)));
  }

  function reset(game, now) {
    var settings = {
      highFX: game.settings.highFX,
      fpsCap: game.settings.fpsCap,
      performanceMode: game.settings.performanceMode
    };
    var next = fresh(now);
    next.settings = settings;
    return next;
  }

  root.VoidSim = {
    xpNeed: xpNeed,
    money: money,
    phaseAt: phaseAt,
    clockLabel: clockLabel,
    fresh: fresh,
    frame: frame,
    workShift: workShift,
    rest: rest,
    buyStock: buyStock,
    rollResume: rollResume,
    counterOffer: counterOffer,
    sweepDead: sweepDead,
    advanceSlides: advanceSlides,
    fire: fire,
    installCamera: installCamera,
    applyJob: applyJob,
    enroll: enroll,
    dispatchScout: dispatchScout,
    unlockNode: unlockNode,
    combine: combine,
    synthesize: synthesize,
    craftFromBook: craftFromBook,
    research: research,
    buyItem: buyItem,
    marketCost: marketCost,
    jobUnlocked: jobUnlocked,
    hasTrait: hasTrait,
    recomputeBonus: recomputeBonus,
    slotCap: slotCap,
    stockCap: stockCap,
    logLine: logLine,
    pushLog: pushLog,
    fmtMs: fmtMs,
    load: load,
    save: save,
    reset: reset,
    toJSON: toJSON,
    bookHas: bookHas,
    ensureSlots: ensureSlots,
    resolveCycle: resolveCycle,
    runBusiness: runBusiness
  };
})(typeof window !== "undefined" ? window : globalThis);
