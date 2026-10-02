(function (root) {
  "use strict";

  var D = root.VoidData;

  function xpNeed(level) {
    return 500 * Math.pow(level, 1.5);
  }

  function clockMinutes(now) {
    var d = new Date(now);
    return d.getHours() * 60 + d.getMinutes();
  }

  function clockHour(now) {
    var d = new Date(now);
    return d.getHours() + d.getMinutes() / 60;
  }

  function volatilityFactor(now) {
    var m = clockMinutes(now);
    if (m >= 480 && m < 570) return 0.6;
    if (m >= 660 && m < 780) return 0.1;
    if (m >= 840 && m < 930) return 0.75;
    return 0;
  }

  function tickerPrice(base, now) {
    var hour = clockHour(now);
    var price = base * (1 + Math.sin(hour * Math.PI / 12) * 0.4 + Math.cos(hour * Math.PI / 4) * volatilityFactor(now));
    if (price < 1) price = 1;
    return price;
  }

  function hasRid(game, rid) {
    var list = game.crafted;
    var i;
    if (!list) return false;
    for (i = 0; i < list.length; i++) if (list[i].rid === rid) return true;
    return false;
  }

  function gradOn(game, id) {
    return !!(game.grad && game.grad[id]);
  }

  function resumeCap(game) {
    return gradOn(game, "ba") ? 5 : 4;
  }

  function offlineCapMs(game) {
    return hasRid(game, 124) ? 72 * 3600000 : 24 * 3600000;
  }

  function inSpan(now, startMin, endMin) {
    var m = clockMinutes(now);
    if (startMin <= endMin) return m >= startMin && m < endMin;
    return m >= startMin || m < endMin;
  }

  function schoolHours(now) {
    var m = clockMinutes(now);
    return m >= 480 && m < 900;
  }

  function campaignScale(game) {
    return hasRid(game, 115) ? 2 : 1;
  }

  function scoutVelocity(game, phase) {
    var mod = phase.scout * recomputeBonus(game).scout;
    if (hasRid(game, 111)) mod *= 1.5;
    if (hasRid(game, 132)) mod *= 1.4;
    if (gradOn(game, "pr")) mod *= 1.3;
    return mod;
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
        capital: 0,
        intelligence: 12,
        stress: 15,
        visibility: 8,
        shifts: 0,
        rp: 0,
        heat: 0,
        heldUntil: 0,
        skills: { work: 0, mind: 0, hustle: 0, clout: 0 }
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
      flags: { insight: false, shady: false, opened: false },
      shiftAt: 0,
      restAt: 0,
      pulse: 0,
      lastNet: 0,
      grad: {},
      space: 0,
      fx: {
        ghostUntil: 0,
        sugarUntil: 0,
        hypeUntil: 0,
        visLockUntil: 0,
        quantKey: "",
        foundryAt: 0,
        pennyAt: 0,
        rpAt: 0,
        synthAt: 0,
        gateLogged: false,
        hypeMark: -1
      }
    };
    game.mats.grease = 1;
    game.mats.neon = 1;
    game.mats.trainee = 1;
    game.mats.chalk = 1;
    game.mats.fryer = 1;
    pushLog(game, "Academic rank 1. Levels award 1 Void Point.");
    pushLog(game, "You're broke. Zero dollars. Pick a shift or a hobby.");
    return game;
  }

  function ensureLife(game) {
    var p = game.player;
    if (!p.skills) p.skills = { work: 0, mind: 0, hustle: 0, clout: 0 };
    if (p.heat == null) p.heat = 0;
    if (p.heldUntil == null) p.heldUntil = 0;
    if (!game.flags) game.flags = { insight: false, shady: false };
    if (game.flags.shady == null) game.flags.shady = !!(game.nodes && game.nodes.shady_open);
    if (game.nodes && game.nodes.shady_open) game.flags.shady = true;
    if (game.flags.opened == null) {
      game.flags.opened = (p.shifts || 0) > 0 || (p.capital || 0) > 0;
    }
  }

  function isHeld(game, now) {
    return !!(game.player.heldUntil && now < game.player.heldUntil);
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
    while (game.player.xp >= xpNeed(game.player.level) && guard < 80) {
      game.player.level += 1;
      game.player.vp += 1;
      leveled = true;
      if (game.player.level % 10 === 0) {
        if (hasRid(game, 129)) game.player.vp += 1;
        pushLog(game, "* Prestige mark at rank " + game.player.level + "." + (hasRid(game, 129) ? " Neural Ledger +1 VP." : ""));
      }
      pushLog(game, "* Rank " + game.player.level + ". +1 Void Point. Next XP threshold " + Math.round(xpNeed(game.player.level)) + ".");
      guard += 1;
    }
    return leveled;
  }

  function checkGrad(game) {
    if (!game.grad) game.grad = {};
    if (!D.GRADS) return;
    var i;
    for (i = 0; i < D.GRADS.length; i++) {
      var g = D.GRADS[i];
      if (!game.grad[g.id] && game.player.xp >= g.xp) {
        game.grad[g.id] = true;
        pushLog(game, "* Graduated: " + g.name + ". " + g.text);
      }
    }
  }

  function addXp(game, amount) {
    if (!(amount > 0)) return;
    game.player.xp += amount;
    maybeLevel(game);
    checkGrad(game);
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
    if (hasRid(game, 108)) sec /= 1.25;
    if (hasRid(game, 103)) sec /= 5;
    var floor = hasRid(game, 103) ? 0.2 : 0.45;
    if (sec < floor) sec = floor;
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

  function ghostCover(game, slot, now) {
    return !slot.employee && game.fx && now < game.fx.ghostUntil;
  }

  function resolveCycle(game, slot, phase, rng, now, quiet) {
    if (!now) now = game.lastReal || Date.now();
    slot.cycles += 1;
    if (!hasRid(game, 122) && (hasRid(game, 126) || (game.mats && game.mats.miner > 0)) && rng() < 0.04) {
      if (!quiet) pushLog(game, "! Server overheat. Slot " + (slot.id + 1) + " skipped a cycle.");
      return;
    }
    if (hasRid(game, 139) && !hasRid(game, 118) && rng() < 0.01) {
      if (!quiet) pushLog(game, "! Regulatory audit freeze on slot " + (slot.id + 1) + ".");
      return;
    }
    if (slot.stock <= 0) {
      if (!quiet && slot.cycles % 4 === 0) {
        pushLog(game, "Audit: slot " + (slot.id + 1) + " is out of stock.");
      }
      return;
    }
    var emp = slot.employee;
    var autoNight = hasRid(game, 102) && inSpan(now, 1320, 240);
    var theftChance = 0.22 / recomputeBonus(game).theft;
    if (hasRid(game, 107)) theftChance += 0.02;
    var steal = emp && hasTrait(emp, "fingers") && rng() < theftChance;
    slot.stock -= 1;
    if (steal) {
      var loss = Math.round((10 + jobBase(slot) * 0.3) * phase.revenue);
      game.player.capital = Math.max(0, game.player.capital - loss);
      if (slot.camera) {
        emp.caught = true;
        if (hasRid(game, 121)) {
          emp.salary = Math.max(1, Math.round(emp.salary * 0.75));
          if (!quiet) pushLog(game, "! Sentinel slashed " + emp.name + " to " + money(emp.salary) + ". Loss " + money(loss) + ".");
        } else if (!quiet) {
          pushLog(game, "! Camera slot " + (slot.id + 1) + ": " + emp.name + " caught lifting stock. Loss " + money(loss) + ".");
        }
      } else if (!quiet) {
        pushLog(game, "! Inventory discrepancy on slot " + (slot.id + 1) + ". Unexplained loss " + money(loss) + ". Stock -1.");
      }
      if (!hasRid(game, 118)) game.player.stress = clampStat(game.player.stress + 2);
      return;
    }
    var bonus = recomputeBonus(game);
    var rush = phase.revenue;
    if (phase.id === "lunch") rush *= bonus.lunch;
    if (phase.id === "night") rush *= bonus.night;
    if (inSpan(now, 690, 780) && hasRid(game, 101)) rush *= 4;
    var stressTax = 1;
    if (game.player.stress > 90) stressTax = 0.7;
    else if (game.player.stress > 70) stressTax = 0.85;
    var covered = ghostCover(game, slot, now) || autoNight;
    var gross = (9 + jobBase(slot) * 0.45) * rush * staffMult(emp || (covered ? { traits: [] } : null), phase) * bonus.revenue * stressTax;
    if (slot.jobId === "fast_food" && hasRid(game, 105)) gross *= 2;
    if (hasRid(game, 109)) gross *= 2;
    if (hasRid(game, 120)) gross *= 1.5;
    var wage = emp ? emp.salary / 20 : 0;
    wage /= bonus.wage;
    if (hasRid(game, 107)) wage *= 0.85;
    if (gradOn(game, "ba")) wage *= 0.9;
    var utility = gross * 0.02;
    if (hasRid(game, 128)) utility *= 0.6;
    var net = gross - wage - utility;
    game.player.capital += net;
    if (game.player.capital < 0) game.player.capital = 0;
    addXp(game, 1 * bonus.xp);
    var stressGain = emp && hasTrait(emp, "clock") ? 0.45 : 0.05;
    if (hasRid(game, 103)) stressGain *= 1.2;
    if (hasRid(game, 110)) stressGain *= 0.9;
    if (hasRid(game, 102) && inSpan(now, 1320, 240)) stressGain = 0;
    game.player.stress = clampStat(game.player.stress + stressGain);
    var vis = 0.04 * bonus.visibility;
    if (hasRid(game, 114) && schoolHours(now)) vis *= 1.15;
    game.player.visibility = clampStat(game.player.visibility + vis);
    if (game.fx && now < game.fx.visLockUntil) game.player.visibility = 100;
    if (!quiet) {
      var line = (net >= 0 ? "+ " : "! ") + "Slot " + (slot.id + 1) + " cycle " + money(net) + ". Stock " + slot.stock + ".";
      pushLog(game, line);
      markPulse(game, net);
    }
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
        mission.left -= dt * scoutVelocity(game, phase);
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

  function scoutPool(game, id) {
    if (hasRid(game, 135)) return ["hush", "broth", "static", "halo", "rack", "lens", "lunar", "relay", "parade", "warden", "library", "quant", "rocket", "shares"];
    if (id === "block") return ["chalk", "grease", "trainee", "fryer", "poster"];
    if (id === "city") return ["neon", "orbit", "jingle", "scooter", "kiosk", "closer", "beacon"];
    return ["hush", "broth", "static", "halo", "rack", "lens", "lunar", "relay", "parade", "warden"];
  }

  function grantScoutItem(game, itemId) {
    game.mats[itemId] = (game.mats[itemId] || 0) + 1;
    if (game.space == null) game.space = 0;
    if (game.space < 100) game.space = Math.min(100, game.space + 2);
  }

  function completeScout(game, index, phase) {
    var mission = game.scouts[index];
    game.scouts.splice(index, 1);
    var pool = scoutPool(game, mission.id);
    var itemId = pool[Math.floor(Math.random() * pool.length)];
    grantScoutItem(game, itemId);
    if (hasRid(game, 111)) grantScoutItem(game, pool[Math.floor(Math.random() * pool.length)]);
    if (hasRid(game, 133)) grantScoutItem(game, pool[Math.floor(Math.random() * pool.length)]);
    if (hasRid(game, 138) && Math.random() < 0.25) grantScoutItem(game, pool[Math.floor(Math.random() * pool.length)]);
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
    if (D.PAIRS) {
      for (i = 0; i < D.PAIRS.length; i++) {
        if (!bookHas(game, D.PAIRS[i].bookKey)) unknown.push(D.PAIRS[i]);
      }
    }
    if (!unknown.length) {
      pushLog(game, "Cookbook already holds every legendary recipe.");
      return false;
    }
    var rec = unknown[Math.floor(Math.random() * unknown.length)];
    game.book.push(rec.bookKey || rec.key);
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
    ensureLife(game);
    if (wall > 0) {
      applyWall(game, game.lastReal, now);
      if (game.flags.opened) {
        var biz = wall;
        var capMs = offlineCapMs(game);
        if (biz > capMs) biz = capMs;
        if (!game.booted && wall > 1500) {
          var hours = hasRid(game, 124) ? 72 : 24;
          pushLog(game, "Catch-up used the device clock (" + Math.round(wall / 1000) + "s). Business buffer is " + hours + "h.");
        }
        if (biz > 20000) bulkBusiness(game, now, biz, rng);
        else runBusiness(game, now, biz, rng);
        serviceEngines(game, now, wall);
      }
      game.lastReal = now;
    }
    var phase = phaseAt(now);
    if (game.flags.opened && (!game.booted || phase.id !== game.phaseId)) {
      pushLog(game, "Clock phase: " + phase.name + ". Revenue x" + phase.revenue.toFixed(2) + ".");
    }
    game.phaseId = phase.id;
    if (game.player.heat > 0 && now - (game.heatAt || 0) > 5000) {
      game.heatAt = now;
      game.player.heat = Math.max(0, game.player.heat - 1);
    }
    if (game.fx && now < game.fx.visLockUntil) game.player.visibility = 100;
    game.booted = true;
    return phase;
  }

  function bulkBusiness(game, now, ms, rng) {
    var phase = phaseAt(now);
    ensureSlots(game);
    var len = cycleSeconds(game);
    var cycles = Math.floor(ms / 1000 / len);
    if (cycles < 1) return;
    if (cycles > 8000) cycles = 8000;
    var i;
    var netSum = 0;
    for (i = 0; i < game.slots.length; i++) {
      var slot = game.slots[i];
      var ran = 0;
      var n;
      for (n = 0; n < cycles; n++) {
        var before = game.player.capital;
        resolveCycle(game, slot, phase, rng, now, true);
        netSum += game.player.capital - before;
        ran += 1;
        if (slot.stock <= 0) break;
      }
      pushLog(game, "Offline slot " + (slot.id + 1) + " ran " + ran + " cycles. Net " + money(netSum) + ".");
    }
  }

  function serviceEngines(game, now, wall) {
    var fx = game.fx;
    if (!fx) return;
    if (now < fx.visLockUntil) game.player.visibility = 100;
    if (hasRid(game, 126)) {
      var steps = Math.floor(wall / 5000);
      if (steps > 0) {
        if (steps > 4000) steps = 4000;
        game.player.capital += steps * 0.05;
        fx.pennyAt = now;
      }
    }
    if (now - fx.rpAt >= 60000) {
      var ticks = Math.floor((now - fx.rpAt) / 60000);
      if (ticks > 72 * 60) ticks = 72 * 60;
      if (fx.rpAt === 0) ticks = 1;
      var rp = ticks * (hasRid(game, 125) ? 1.5 : 1);
      game.player.rp = (game.player.rp || 0) + rp;
      fx.rpAt = now;
    }
    if (hasRid(game, 130) && (fx.foundryAt === 0 || now - fx.foundryAt >= 3600000)) {
      if (fx.foundryAt !== 0) {
        var tier = D.TIER1[Math.floor(Math.random() * D.TIER1.length)];
        game.mats[tier] = (game.mats[tier] || 0) + 1;
        var found = D.itemById[tier];
        pushLog(game, "* Foundry pressed " + (found ? found.name : tier) + ".");
      }
      fx.foundryAt = now;
    }
    if (now < fx.hypeUntil) {
      var mark = Math.floor(now / 60000);
      if (mark !== fx.hypeMark) {
        fx.hypeMark = mark;
        pushLog(game, "Hype Wave " + fmtMs(fx.hypeUntil - now) + " remaining.");
        if (game.settings.highFX) markPulse(game, 1);
      }
    }
    if (hasRid(game, 123)) quantTick(game, now);
    moonGate(game, now);
  }

  function quantTick(game, now) {
    var fx = game.fx;
    var m = clockMinutes(now);
    var windowId = "";
    if (m >= 480 && m < 570) windowId = "open";
    else if (m >= 840 && m < 930) windowId = "surge";
    else return;
    var d = new Date(now);
    var key = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate() + "-" + windowId;
    if (fx.quantKey === key) return;
    fx.quantKey = key;
    if (windowId === "open") {
      var best = null;
      var i;
      for (i = 0; i < D.ITEMS.length; i++) {
        var item = D.ITEMS[i];
        if (item.level > game.player.level) continue;
        var cost = marketCost(game, item);
        if (game.player.capital >= cost && (!best || cost < best.cost)) best = { item: item, cost: cost };
      }
      if (best) {
        game.player.capital -= best.cost;
        game.mats[best.item.id] = (game.mats[best.item.id] || 0) + 1;
        pushLog(game, "* Quant bot bought the morning dip: " + best.item.name + ".");
      }
      return;
    }
    var sell = null;
    var j;
    for (j = 0; j < D.ITEMS.length; j++) {
      var held = D.ITEMS[j];
      if ((game.mats[held.id] || 0) < 1) continue;
      var quote = marketCost(game, held);
      if (!sell || quote > sell.quote) sell = { item: held, quote: quote };
    }
    if (sell) {
      game.mats[sell.item.id] -= 1;
      game.player.capital += sell.quote;
      pushLog(game, "* Quant bot shorted the afternoon spike: " + sell.item.name + ".");
    }
  }

  function liquidationValue(game, now) {
    var value = game.player.capital;
    var i;
    for (i = 0; i < D.ITEMS.length; i++) {
      var item = D.ITEMS[i];
      var count = game.mats[item.id] || 0;
      if (!count) continue;
      var quote = tickerPrice(item.cost, now);
      if (item.cat === "asset" && hasRid(game, 139)) quote *= 3;
      value += quote * count;
    }
    if (hasRid(game, 131)) value *= 10;
    return value;
  }

  function moonGate(game, now) {
    var gate = D.MOON_GATE;
    if (hasRid(game, 136)) gate *= 0.7;
    var value = liquidationValue(game, now);
    game.liquidation = value;
    game.moonGate = gate;
    if (!game.fx.gateLogged && value >= gate) {
      game.fx.gateLogged = true;
      pushLog(game, "* Moon launch gate cleared. Valuation " + money(value) + ".");
    }
  }

  function workShift(game, now) {
    ensureLife(game);
    if (isHeld(game, now)) {
      pushLog(game, "! You're being held. Shifts wait.");
      return { ok: false, reason: "held" };
    }
    game.flags.opened = true;
    if (now - game.shiftAt < 350) return { ok: false, reason: "cooldown" };
    game.shiftAt = now;
    var phase = phaseAt(now);
    var bonus = recomputeBonus(game);
    var pay = Math.round((14 + game.player.level * 2) * phase.revenue * bonus.revenue);
    if (game.fx && now < game.fx.sugarUntil) pay *= 2;
    game.player.capital += pay;
    addXp(game, 22 * bonus.xp);
    game.player.stress = clampStat(game.player.stress + 4);
    game.player.intelligence = clampStat(game.player.intelligence + 0.4);
    game.player.shifts += 1;
    game.player.skills.work = Math.min(100, (game.player.skills.work || 0) + 1);
    var gotRaise = false;
    if (game.player.skills.work === 8 && !game.flags.raised) {
      game.flags.raised = true;
      gotRaise = true;
      game.player.capital += 2;
    }
    if (game.nodes && game.nodes.backroom) {
      var cut = Math.max(1, Math.round(pay * 0.15));
      game.player.capital += cut;
      game.player.heat = Math.min(100, game.player.heat + 2);
    }
    if (game.player.shifts % 3 === 0) {
      game.player.visibility = clampStat(game.player.visibility + 1.5 * bonus.visibility);
    }
    maybeLevel(game);
    pushLog(game, "+ Shift closed. Paid " + money(pay) + ". Academic XP rose.");
    if (gotRaise) pushLog(game, "+ The counter noticed. You got a raise.");
    game.rev += 1;
    markPulse(game, pay);
    return { ok: true, pay: pay };
  }

  function workHobby(game, now) {
    ensureLife(game);
    if (isHeld(game, now)) {
      pushLog(game, "! You're being held. Hobbies wait.");
      return { ok: false, reason: "held" };
    }
    game.flags.opened = true;
    if (now - (game.hobbyAt || 0) < 800) return { ok: false, reason: "cooldown" };
    game.hobbyAt = now;
    var skill = game.player.skills.mind || 0;
    var pay = 6 + Math.floor(skill / 2);
    game.player.capital += pay;
    game.player.skills.mind = Math.min(100, skill + 1);
    game.player.intelligence = clampStat(game.player.intelligence + 0.6);
    addXp(game, 8);
    maybeLevel(game);
    pushLog(game, "+ Hobby paid " + money(pay) + ". You know this a little better.");
    game.rev += 1;
    return { ok: true, pay: pay };
  }

  function skim(game, now, rng) {
    ensureLife(game);
    if (!rng) rng = Math.random;
    if (!game.nodes.skim) {
      pushLog(game, "Skim is still locked. It's on the shady tree.");
      return { ok: false, reason: "locked" };
    }
    if (isHeld(game, now)) {
      pushLog(game, "! You're being held. The drawer can wait.");
      return { ok: false, reason: "held" };
    }
    if (now - (game.skimAt || 0) < 800) return { ok: false, reason: "cooldown" };
    game.skimAt = now;
    var bust = 0.22 + game.player.heat / 220;
    if (rng() < bust) {
      game.player.heat = Math.min(100, game.player.heat + 16);
      var fine = 12 + Math.round(game.player.heat * 0.4);
      game.player.capital = Math.max(0, game.player.capital - fine);
      if (game.player.heat > 70) {
        game.player.heldUntil = now + 60000;
        pushLog(game, "! Busted. You're being held. Lost " + money(fine) + ".");
      } else {
        pushLog(game, "! A fine landed. Lost " + money(fine) + ". Heat climbed.");
      }
      game.rev += 1;
      return { ok: false, reason: "busted" };
    }
    var pay = 14 + Math.floor((game.player.skills.hustle || 0) / 2);
    game.player.capital += pay;
    game.player.skills.hustle = Math.min(100, (game.player.skills.hustle || 0) + 1);
    game.player.heat = Math.min(100, game.player.heat + 8);
    pushLog(game, "+ Skimmed " + money(pay) + ". Heat is watching.");
    game.rev += 1;
    return { ok: true, pay: pay };
  }

  function score(game, now, rng) {
    ensureLife(game);
    if (!rng) rng = Math.random;
    if (!game.nodes.score) {
      pushLog(game, "The big score is still locked on the shady tree.");
      return { ok: false, reason: "locked" };
    }
    if (isHeld(game, now)) {
      pushLog(game, "! You're being held. Scores wait.");
      return { ok: false, reason: "held" };
    }
    if (now - (game.scoreAt || 0) < 1500) return { ok: false, reason: "cooldown" };
    game.scoreAt = now;
    if (rng() < 0.42) {
      game.player.heat = Math.min(100, game.player.heat + 28);
      game.player.heldUntil = now + 90000;
      pushLog(game, "! The score failed. You're being held.");
      game.rev += 1;
      return { ok: false, reason: "busted" };
    }
    var pay = 70 + game.player.level * 8;
    game.player.capital += pay;
    game.player.heat = Math.min(100, game.player.heat + 18);
    game.player.skills.hustle = Math.min(100, (game.player.skills.hustle || 0) + 2);
    pushLog(game, "+ The score paid " + money(pay) + ". Heat spiked.");
    game.rev += 1;
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
    if (game.resumes.length >= resumeCap(game)) {
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
    var scoutCost = def.cost;
    if (hasRid(game, 116)) scoutCost = Math.round(scoutCost * 0.7);
    if (game.player.capital < scoutCost) {
      pushLog(game, "! Dispatch costs " + money(scoutCost) + ".");
      return { ok: false };
    }
    game.player.capital -= scoutCost;
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
    if (node.line === "shady") {
      ensureLife(game);
      game.flags.shady = true;
    }
    pushLog(game, "* Lab unlock: " + node.name + ". " + node.text);
    game.rev += 1;
    return { ok: true };
  }

  function combinationKey(idea, staff, marketing, asset) {
    return idea + "|" + staff + "|" + marketing + "|" + asset;
  }

  function pairNeed(game) {
    return game && hasRid(game, 134) ? 1 : 2;
  }

  function matchPair(ids, game) {
    if (!D.PAIRS) return null;
    var present = {};
    var i;
    for (i = 0; i < ids.length; i++) {
      if (ids[i]) present[ids[i]] = true;
    }
    var need = pairNeed(game);
    var best = null;
    for (i = 0; i < D.PAIRS.length; i++) {
      var rec = D.PAIRS[i];
      var hits = (present[rec.a] ? 1 : 0) + (present[rec.b] ? 1 : 0);
      if (rec.a === rec.b) hits = present[rec.a] ? 1 : 0;
      if (hits < need) continue;
      if (!best) {
        best = rec;
        continue;
      }
      var bestDone = game && craftedHas(game, best.bookKey);
      var recDone = game && craftedHas(game, rec.bookKey);
      if (bestDone && !recDone) best = rec;
      else if (!bestDone && recDone) continue;
      else if (rec.id < best.id) best = rec;
    }
    return best;
  }

  function pairSpend(rec, ids, game) {
    var need = pairNeed(game);
    var out = [];
    var i;
    var seen = {};
    for (i = 0; i < ids.length; i++) {
      if (!ids[i] || seen[ids[i]]) continue;
      if (ids[i] === rec.a || ids[i] === rec.b) {
        seen[ids[i]] = true;
        out.push(ids[i]);
      }
    }
    if (out.length > need) out.length = need;
    return out;
  }

  function combine(ideaId, staffId, marketingId, assetId, game) {
    var slots = [ideaId, staffId, marketingId, assetId];
    var pair = matchPair(slots, game);
    if (pair) {
      return {
        key: pair.bookKey,
        rid: pair.id,
        legendary: true,
        name: pair.name,
        tag: "pair",
        mult: 1,
        power: 1,
        synergy: 0,
        blurb: pair.blurb,
        spend: pairSpend(pair, slots, game)
      };
    }
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
        synergy: 0,
        spend: slots
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
      avg: avg,
      spend: slots
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

  function applyInstant(game, result) {
    var now = game.lastReal || Date.now();
    var scale = campaignScale(game);
    if (!game.fx) game.fx = {};
    var id = result.rid;
    if (id === 104) game.fx.ghostUntil = now + 30 * 60000 * scale;
    if (id === 106) game.fx.sugarUntil = now + 5 * 60000 * scale;
    if (id === 112) {
      game.fx.hypeUntil = now + 45 * 60000 * scale;
      pushLog(game, "* Hype Wave countdown: " + (45 * scale) + " minutes.");
    }
    if (id === 113) game.fx.visLockUntil = now + 3 * 3600000 * scale;
    if (id === 117) {
      var drop = Math.round(150 * game.player.level);
      game.player.capital += drop;
      pushLog(game, "* Influencer swarm wired " + money(drop) + ".");
    }
    if (id === 119) {
      if (!game.flags) game.flags = {};
      game.flags.exposeTraits = true;
    }
    if (id === 130 && !game.fx.foundryAt) game.fx.foundryAt = now;
    if (id === 140) {
      var space = game.space || 0;
      if (space < 95) space = 95;
      game.space = Math.min(100, space + 5);
      pushLog(game, "* Space research tree at " + game.space + "%.");
    }
  }

  function activateResult(game, result) {
    if (craftedHas(game, result.key)) {
      pushLog(game, result.name + " is already active. Materials kept.");
      return { ok: false, reason: "duplicate" };
    }
    if (!bookHas(game, result.key)) game.book.push(result.key);
    game.crafted.push({
      key: result.key,
      rid: result.rid || 0,
      name: result.name,
      tag: result.tag,
      mult: result.mult,
      legendary: result.legendary,
      blurb: result.blurb || ""
    });
    game.bonusRev = -1;
    if (result.rid) applyInstant(game, result);
    if (result.legendary && result.rid) {
      pushLog(game, "* Legendary blueprint: " + result.name + ". " + result.blurb);
    } else if (result.legendary) {
      pushLog(game, "* Legendary blueprint: " + result.name + ". " + result.tag + " x" + result.mult.toFixed(2) + ".");
    } else {
      pushLog(game, "Hybrid filed: " + result.name + ". Power " + result.power.toFixed(2) + " after 11.5% synergy.");
    }
    game.rev += 1;
    return { ok: true, result: result };
  }

  function synthCooldown(game) {
    return gradOn(game, "cs") ? 2000 : 4000;
  }

  function synthesize(game, idea, staff, marketing, asset) {
    var result = combine(idea, staff, marketing, asset, game);
    if (!result) {
      pushLog(game, "Synthesis needs a legendary pair or four baseline parts.");
      return { ok: false };
    }
    if (craftedHas(game, result.key)) {
      pushLog(game, result.name + " is already active. Materials kept.");
      return { ok: false, reason: "duplicate" };
    }
    var now = game.lastReal || Date.now();
    if (!game.fx) game.fx = {};
    if (game.fx.synthAt && now - game.fx.synthAt < synthCooldown(game)) {
      pushLog(game, "Synthesis cooling down.");
      return { ok: false, reason: "cooldown" };
    }
    var ids = result.spend || [idea, staff, marketing, asset];
    if (!spendMats(game, ids)) {
      pushLog(game, "Synthesis missing a baseline material.");
      return { ok: false, reason: "mats" };
    }
    game.fx.synthAt = now;
    return activateResult(game, result);
  }

  function craftFromBook(game, key) {
    if (craftedHas(game, key)) {
      pushLog(game, "That blueprint is already running.");
      return { ok: false, reason: "duplicate" };
    }
    if (key.indexOf("pair:") === 0) {
      var rid = Number(key.slice(5));
      var rec = D.pairById ? D.pairById[rid] : null;
      if (!rec) return { ok: false };
      if (!bookHas(game, key)) {
        pushLog(game, "Blueprint is not in the cookbook yet.");
        return { ok: false };
      }
      var owned = [];
      if ((game.mats[rec.a] || 0) >= 1) owned.push(rec.a);
      if (rec.b !== rec.a && (game.mats[rec.b] || 0) >= 1) owned.push(rec.b);
      var ids = pairSpend(rec, owned, game);
      var need = pairNeed(game);
      if (ids.length < need) {
        pushLog(game, "Auto-craft needs the baseline materials on hand.");
        return { ok: false, reason: "mats" };
      }
      if (!spendMats(game, ids)) {
        pushLog(game, "Auto-craft needs the baseline materials on hand.");
        return { ok: false, reason: "mats" };
      }
      return activateResult(game, {
        key: rec.bookKey,
        rid: rec.id,
        legendary: true,
        name: rec.name,
        tag: "pair",
        mult: 1,
        power: 1,
        synergy: 0,
        blurb: rec.blurb
      });
    }
    var legend = D.recipeByKey[key];
    var ids4;
    var result;
    if (legend) {
      ids4 = [legend.idea, legend.staff, legend.marketing, legend.asset];
      result = combine(legend.idea, legend.staff, legend.marketing, legend.asset);
    } else {
      ids4 = key.split("|");
      if (ids4.length !== 4) return { ok: false };
      result = combine(ids4[0], ids4[1], ids4[2], ids4[3]);
    }
    if (!result) return { ok: false };
    if (!bookHas(game, key) && !bookHas(game, result.key)) {
      pushLog(game, "Blueprint is not in the cookbook yet.");
      return { ok: false };
    }
    if (!spendMats(game, result.spend || ids4)) {
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
    var cost = marketCost(game, item);
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
    var now = game.lastReal || Date.now();
    var cost = tickerPrice(item.cost, now);
    if (hasRid(game, 137)) cost *= 0.85;
    if (hasRid(game, 116) && item.cat === "marketing") cost *= 0.7;
    if (hasRid(game, 127) && item.cat === "asset") cost *= 0.8;
    var vis = game.player.visibility;
    cost *= 1 - Math.min(0.25, vis * 0.002);
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
      restAt: game.restAt,
      fx: game.fx,
      grad: game.grad,
      space: game.space
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
    if (data.fx) {
      var fk;
      for (fk in data.fx) {
        if (Object.prototype.hasOwnProperty.call(data.fx, fk)) game.fx[fk] = data.fx[fk];
      }
    }
    game.grad = data.grad || {};
    game.space = data.space || 0;
    if (game.player.rp == null) game.player.rp = 0;
    ensureLife(game);
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
    workHobby: workHobby,
    skim: skim,
    score: score,
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
    tickerPrice: tickerPrice,
    volatilityFactor: volatilityFactor,
    liquidationValue: liquidationValue,
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
