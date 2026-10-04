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
      settings: { highFX: true, fpsCap: 60, performanceMode: false, muted: false, clock: 1 },
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
      flags: { insight: false, shady: false, opened: false, chosen: false },
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
    pushLog(game, "Year one. The drawer is empty.");
    pushLog(game, "You're broke. Zero dollars. Pick a shift or a hobby.");
    return game;
  }

  function moneyIn(text) {
    var m = String(text || "").match(/-?\$[\d,]+/);
    if (!m) return null;
    var n = Number(m[0].replace(/[$,]/g, ""));
    if (isNaN(n)) return null;
    return n;
  }

  function dayVoice(text) {
    var raw = String(text || "");
    var low = raw.toLowerCase();
    var body = raw.replace(/^[+!*]\s*/, "");
    if (low.indexOf("academic rank") >= 0) return "Year one. The drawer is empty.";
    if (low.indexOf("you're broke") >= 0 || low.indexOf("zero dollars") >= 0) return "Zero dollars. A shift pays, or a hobby does.";
    if (low.indexOf("clock phase:") >= 0) {
      return body.replace(/Clock phase:\s*/i, "").replace(/\.\s*Revenue x[\d.]+/i, ".").replace(/\s{2,}/g, " ").trim();
    }
    if (low.indexOf("shift closed") >= 0 || low.indexOf("the shift paid") >= 0) {
      var paid = body.match(/\$[\d,]+/);
      return paid ? ("The shift paid " + paid[0] + ".") : "The shift paid.";
    }
    if (low.indexOf("stock audit") >= 0 || low.indexOf("pack landed") >= 0) {
      var cost = body.match(/\$[\d,]+/);
      return cost ? ("A pack landed on the shelf. " + cost[0] + ".") : "A pack landed on the shelf.";
    }
    if (low.indexOf("next xp threshold") >= 0 || low.indexOf("academic xp") >= 0) return "The year turned.";
    if (low.indexOf("life:") >= 0) return "";
    if (low.indexOf("offline slot") >= 0) {
      var net = body.match(/-?\$[\d,]+/);
      return net ? ("The shop ran while you were out. " + net[0] + ".") : "The shop ran while you were out.";
    }
    if (low.indexOf("revenue x") >= 0) return body.replace(/\s*Revenue x[\d.]+/ig, "").replace(/\s{2,}/g, " ").trim();
    if (low.indexOf("city note:") >= 0) return body.replace(/City note:\s*/i, "");
    if (low.indexOf("audit: slot") >= 0) return "The shelf is empty.";
    if (low.indexOf("catch-up") >= 0) {
      var named = body.match(/[A-Z][a-z]+ [A-Z][a-z]+/);
      return named ? (named[0] + " covered the quiet hours.") : "You were gone. The shop waited.";
    }
    return body;
  }

  function phaseVoice(game, phase) {
    if (game) ensureLife(game);
    var open = !!(game && game.flags && game.flags.opened) && shopOpen(game);
    var id = phase && phase.id;
    var line = "";
    if (id === "morning") line = open ? "Morning Rush. The street is already hungry." : "Morning Rush. The shop is still dark.";
    else if (id === "lunch") line = open ? "Lunch Hour. Plates are moving." : "Lunch Hour. The counter is quiet.";
    else if (id === "evening") line = open ? "Evening Trade. People are killing time." : "Evening Trade. The door is shut.";
    else if (id === "night") line = open ? "Night Drift. Regulars and weirdos." : "Night Drift. The street is quiet.";
    else line = open ? "Standard Watch. The shop can wait." : "Standard Watch. Nothing is selling.";
    var named = game && game.slots && game.slots[0] && game.slots[0].name;
    if (named) line = line.replace(/\s+$/, "").replace(/\.$/, "") + ". " + named + ".";
    return line;
  }

  function describeLine(text, game) {
    var voice = dayVoice(text);
    var low = (String(text || "") + " " + voice).toLowerCase();
    var phase = "";
    var art = "";
    if (low.indexOf("morning rush") >= 0) { phase = "morning"; art = "shopMorning"; }
    else if (low.indexOf("lunch hour") >= 0) { phase = "lunch"; art = "shopNoon"; }
    else if (low.indexOf("evening trade") >= 0) { phase = "evening"; art = "shopEvening"; }
    else if (low.indexOf("night drift") >= 0) { phase = "night"; art = "shopNight"; }
    else if (low.indexOf("standard watch") >= 0) { phase = "standard"; art = "shopNoon"; }
    if (low.indexOf("still dark") >= 0 || low.indexOf("door is shut") >= 0 || low.indexOf("shop is closed") >= 0 || low.indexOf("nothing is selling") >= 0 || low.indexOf("counter is quiet") >= 0 || low.indexOf("street is quiet") >= 0) {
      art = "shopClosed";
    }
    if (!art && (low.indexOf("while you were out") >= 0 || low.indexOf("covered the quiet") >= 0 || low.indexOf("catch-up") >= 0)) {
      var openArt = !!(game && game.flags && game.flags.opened) && shopOpen(game);
      var pid = (game && game.phaseId) || "";
      if (!openArt) art = "shopClosed";
      else if (pid === "morning") art = "shopMorning";
      else if (pid === "evening") art = "shopEvening";
      else if (pid === "night") art = "shopNight";
      else art = "shopNoon";
    }
    var portrait = "";
    var object = "";
    if (!art) {
      if (/\bsera\b/.test(low)) portrait = "sera";
      else if (low.indexOf("landlord") >= 0) portrait = "landlord";
      else if (low.indexOf("juniper") >= 0) portrait = "juniper";
      else if (low.indexOf("register") >= 0 || low.indexOf("resume") >= 0 || low.indexOf("busted") >= 0) portrait = "hire";
    }
    if (low.indexOf("cooler") >= 0) object = "cooler";
    else if (low.indexOf("safe") >= 0) object = "safe";
    else if (low.indexOf("speaker") >= 0) object = "speaker";
    else if (low.indexOf("plant") >= 0) object = "plant";
    else if (low.indexOf("warm lights") >= 0 || low.indexOf("bulb") >= 0) object = "bulb";
    else if (low.indexOf("pack") >= 0 || low.indexOf("shelf") >= 0 || low.indexOf("stock") >= 0) object = "stock";
    if (low.indexOf("register is empty") >= 0) portrait = "";
    if (!art && !portrait && !object && low.indexOf("took in") >= 0) object = "stock";
    if (low.indexOf("in the drawer") >= 0 && low.indexOf("on the shelf") >= 0) {
      art = "";
      object = "";
      portrait = "";
    }
    var stamp = "";
    var sentence = voice;
    if (phase && voice.indexOf(". ") > 0) {
      stamp = voice.split(". ")[0];
      sentence = voice.slice(stamp.length + 2);
    }
    if (portrait && game) sentence = attachMemory(sentence, game);
    var tags = [];
    var notebook = low.indexOf("night class") >= 0 || low.indexOf("degree") >= 0 || low.indexOf("certificate") >= 0 || low.indexOf("hobby paid") >= 0 || low.indexOf("tutor") >= 0;
    var crate = low.indexOf("scout") >= 0;
    var bust = low.indexOf("busted") >= 0;
    var hire = low.indexOf("register") >= 0;
    var packs = (low.indexOf("shift paid") >= 0) ? 4 : 0;
    if (portrait || crate || low.indexOf("resume") >= 0 || bust || /\bregular\b/.test(low)) tags.push("people");
    if (object && !packs) tags.push("stuff");
    if (notebook) tags.push("class");
    if (art || packs || low.indexOf("shift") >= 0 || low.indexOf("shop") >= 0 || low.indexOf("shelf") >= 0 || low.indexOf("took in") >= 0 || hire) tags.push("shop");
    if (!tags.length) tags.push("day");
    var money = moneyIn(sentence);
    if (money == null) money = moneyIn(voice);
    if (money == null) money = moneyIn(text);
    var heatHigh = !!(game && game.player && (game.player.heat || 0) >= 45);
    var lock = low.indexOf("not enough") >= 0 || low.indexOf("drawer is light") >= 0 || low.indexOf("still locked") >= 0;
    var mark = "";
    if (lock) mark = "lock";
    else if ((low.indexOf("heat") >= 0 || bust) && heatHigh) mark = "heat";
    else if (money != null) mark = "coin";
    else if (phase === "morning") mark = "sun";
    else if (phase === "lunch") mark = "noon";
    else if (phase === "night") mark = "moon";
    else if (phase === "evening" || phase === "standard") mark = "lamp";
    var ring = null;
    if (notebook) ring = 1;
    return {
      text: sentence,
      voice: voice,
      stamp: stamp,
      phase: phase,
      art: art,
      portrait: portrait,
      object: object,
      tags: tags,
      money: money,
      mark: mark,
      packs: packs,
      notebook: notebook,
      crate: crate,
      bust: bust,
      hire: hire,
      ring: ring,
      slot2: !!(art && game && game.slots && game.slots.length > 1)
    };
  }

  function noteDay(game, now, snap) {
    ensureLife(game);
    var phase = phaseAt(now || game.lastReal || 0);
    var w = game.world;
    if (!w.dayNote) w.dayNote = {};
    var note = w.dayNote;
    if (snap && snap.phaseChanged && note.phase !== phase.id) {
      note.phase = phase.id;
      pushLog(game, phaseVoice(game, phase));
    }
    if (!snap) return note;
    var slot = game.slots && game.slots[0];
    var open = !!(game.flags && game.flags.opened) && shopOpen(game);
    if (open && slot && snap.stock != null) {
      var sold = snap.stock - slot.stock;
      var earned = (game.player.capital || 0) - (snap.capital || 0);
      if (sold > 0 && earned > 0 && note.earn !== phase.id) {
        note.earn = phase.id;
        pushLog(game, "The shop took in " + money(Math.round(earned)) + ".");
      }
      if (slot.stock > 0 && slot.stock <= 2 && note.thin !== phase.id) {
        note.thin = phase.id;
        pushLog(game, "The shelf is getting thin.");
      }
    }
    if (hireAtRegister(game) && note.cover !== phase.id) {
      note.cover = phase.id;
      pushLog(game, hireName(game) + " has the register.");
    }
    if (open && !registerCovered(game) && note.empty !== phase.id) {
      note.empty = phase.id;
      pushLog(game, "The register is empty.");
    }
    return note;
  }

  var SEASONS = ["winter", "spring", "summer", "fall"];

  function seasonOf(level) {
    var n = (level || 0) % 4;
    if (n < 0) n += 4;
    return SEASONS[n];
  }

  function ensureLife(game) {
    var p = game.player;
    if (!game.settings) game.settings = { highFX: true, fpsCap: 60, performanceMode: false, muted: false };
    if (game.settings.muted == null) game.settings.muted = false;
    if (game.settings.clock !== 0 && game.settings.clock !== 1 && game.settings.clock !== 2) game.settings.clock = 1;
    if (!p.skills) p.skills = { work: 0, mind: 0, hustle: 0, clout: 0 };
    if (p.heat == null) p.heat = 0;
    if (p.heldUntil == null) p.heldUntil = 0;
    if (p.shop == null) p.shop = "";
    if (!game.flags) game.flags = { insight: false, shady: false };
    if (game.flags.shady == null) game.flags.shady = !!(game.nodes && game.nodes.shady_open);
    if (game.nodes && game.nodes.shady_open) game.flags.shady = true;
    if (game.flags.opened == null) {
      game.flags.opened = (p.shifts || 0) > 0;
    }
    if (game.flags.chosen == null) {
      game.flags.chosen = !!game.flags.opened || (p.skills && p.skills.mind > 0) || (p.capital || 0) > 0;
    }
    if (!p.place) p.place = {};
    var place = p.place;
    if (place.owned == null) place.owned = false;
    if (place.lights == null) place.lights = 0;
    if (place.sign == null) place.sign = 0;
    if (place.counter == null) place.counter = 0;
    if (place.cooler == null) place.cooler = 0;
    if (place.safe == null) place.safe = 0;
    if (place.speaker == null) place.speaker = 0;
    if (place.plant == null) place.plant = 0;
    if (place.neon == null) place.neon = 0;
    if (place.shut == null) place.shut = false;
    if (!game.world) game.world = {};
    var w = game.world;
    if (w.rentDue == null) w.rentDue = 0;
    if (w.floor == null) w.floor = 0;
    if (w.behind == null) w.behind = 0;
    if (w.regular === undefined) w.regular = null;
    if (w.regularDue == null) w.regularDue = false;
    if (w.rival == null) w.rival = "";
    if (w.showing == null) w.showing = "";
    if (!w.seen) w.seen = {};
    if (w.welcomed == null) w.welcomed = false;
    if (w.locked == null) w.locked = 0;
    if (w.upstairs == null) w.upstairs = "none";
    if (w.deed == null) w.deed = place.owned ? "renting" : "";
    if (w.rentPays == null) w.rentPays = 0;
    if (w.tenantPaid == null) w.tenantPaid = 0;
    if (w.tenantPhase == null) w.tenantPhase = "";
    if (!w.regulars) w.regulars = [];
    if (w.regular && w.regulars.length === 0) w.regulars.push(w.regular);
    if (w.rivalSign == null) w.rivalSign = false;
    if (w.truce == null) w.truce = false;
    if (w.promoted == null) w.promoted = false;
    if (w.hobbyShop == null) w.hobbyShop = "";
    if (!w.goals) w.goals = { hundred: false, hire: false, floor: false };
    if (w.goals.hundred == null) w.goals.hundred = false;
    if (w.goals.hire == null) w.goals.hire = false;
    if (w.goals.floor == null) w.goals.floor = false;
    if (w.loan == null) w.loan = 0;
    if (!w.album) w.album = [];
    if (!w.milestones) w.milestones = { regular: false, raise: false, floor: false };
    if (w.milestones.regular == null) w.milestones.regular = false;
    if (w.milestones.raise == null) w.milestones.raise = false;
    if (w.milestones.floor == null) w.milestones.floor = false;
    if (w.retired == null) w.retired = false;
    if (w.notePhase == null) w.notePhase = "";
    if (!w.district) w.district = "downtown";
    if (w.deliverPhase == null) w.deliverPhase = "";
    if (w.catered == null) w.catered = false;
    if (!w.menu) w.menu = { price: 1 };
    if (w.menu.price == null) w.menu.price = 1;
    if (w.insured == null) w.insured = false;
    if (w.bill == null) w.bill = 0;
    if (w.biggestBill == null) w.biggestBill = 0;
    if (w.quietRoom == null) w.quietRoom = false;
    if (w.partner == null) w.partner = false;
    if (w.favorYear == null) w.favorYear = 0;
    if (w.classYear == null) w.classYear = 0;
    if (w.signMuted == null) w.signMuted = 0;
    if (w.secondLot == null) w.secondLot = false;
    if (w.nightMarket == null) w.nightMarket = false;
    if (w.scoutJust == null) w.scoutJust = false;
    if (w.shopPage == null) w.shopPage = 0;
    if (w.craftShiftLogged == null) w.craftShiftLogged = false;
    if (w.catchNamed == null) w.catchNamed = false;
    if (w.councilYear == null) w.councilYear = 0;
    if (!w.spine) w.spine = [];
    if (w.landlordMood == null) w.landlordMood = 2;
    if (w.rivalMemory == null) w.rivalMemory = "";
    if (w.hours == null) w.hours = "";
    if (!w.chapterTold) w.chapterTold = {};
    if (w.hoursHold == null) w.hoursHold = false;
    if (w.hoursPhase == null) w.hoursPhase = "";
    if (w.upstairsStaff == null) w.upstairsStaff = "";
    if (w.tutorPhase == null) w.tutorPhase = "";
    if (w.rivalFlip == null) w.rivalFlip = false;
    if (!w.wants) w.wants = {};
    if (!w.wants.sera) w.wants.sera = "lights";
    if (!w.wants.juniper) w.wants.juniper = "lunch";
    if (!w.wants.landlord) w.wants.landlord = "building";
    if (!w.block) w.block = {};
    w.block.juniper = ensureShopBook(w.block.juniper, "open", 1, 12);
    w.block.campus = ensureShopBook(w.block.campus, "open", 1, 8);
    w.block.night = ensureShopBook(w.block.night, "closed", 1, 10);
    if (w.spot !== "register" && w.spot !== "door" && w.spot !== "upstairs") w.spot = "register";
    if (w.lastSlip === undefined) w.lastSlip = null;
    if (w.thin === undefined) w.thin = null;
    if (w.wallAward === undefined) w.wallAward = null;
    w.season = seasonOf(p.level);
    ensureEmployees(game);
    ensureShopNames(game);
  }

  function defaultShopName(index) {
    if (index === 0) return "The Corner";
    if (index === 1) return "Second Chair";
    return "Shop " + (index + 1);
  }

  function shopNameList() {
    var names = ["The Corner"];
    var shops = D.SHOPS || [];
    var i;
    for (i = 0; i < shops.length; i++) names.push(shops[i]);
    return names;
  }

  function ensureShopNames(game) {
    var slots = game.slots || [];
    var place = game.player && game.player.place;
    var i;
    for (i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (!slot) continue;
      var current = slot.name == null ? "" : String(slot.name).replace(/\s+/g, " ").trim();
      if (!current) {
        if (i === 0 && game.player && game.player.shop) current = String(game.player.shop).trim();
        else if (i === 0 && place && place.name) current = String(place.name).replace(/\s+/g, " ").trim();
        if (!current) current = defaultShopName(i);
      }
      if (current.length > 22) current = current.slice(0, 22).trim();
      slot.name = current;
    }
    if (place && slots[0] && (place.name == null || String(place.name).trim() === "")) {
      place.name = slots[0].name;
    }
  }

  function shopIndex(game) {
    var shops = D.SHOPS || [];
    var n = shops.length || 1;
    var i = game.world && game.world.shopPage || 0;
    if (i < 0) i = 0;
    return i % n;
  }

  function crewLine(game) {
    var list = game.world && game.world.regulars;
    var i;
    var names = [];
    if (list && list.length) {
      for (i = 0; i < list.length; i++) if (list[i].name) names.push(list[i].name);
    } else if (game.world && game.world.regular && game.world.regular.name) {
      names.push(game.world.regular.name);
    }
    return names.length ? names.join(", ") : "Regulars";
  }

  function fillLife(text, game) {
    if (!text) return "";
    var w = game.world || {};
    var reg = w.regular || {};
    var shops = D.SHOPS || [];
    var pick = shops[shopIndex(game)] || "the corner";
    var rest = [];
    var i;
    for (i = 0; i < shops.length; i++) if (shops[i] !== pick) rest.push(shops[i]);
    return text
      .replace(/\{rent\}/g, money(w.rentDue || 0))
      .replace(/\{heat\}/g, String(Math.round(game.player.heat || 0)))
      .replace(/\{rival\}/g, w.rival || "Someone")
      .replace(/\{name\}/g, reg.name || "A regular")
      .replace(/\{visits\}/g, String(reg.visits || 1))
      .replace(/\{floor\}/g, money(D.ROOM.floor))
      .replace(/\{year\}/g, String(game.player.level))
      .replace(/\{shop\}/g, game.player.shop || "the corner")
      .replace(/\{season\}/g, w.season || seasonOf(game.player.level))
      .replace(/\{shopPick\}/g, pick)
      .replace(/\{shopRest\}/g, rest.join(" and ") || pick)
      .replace(/\{shopA\}/g, shops[0] || "Greasefire")
      .replace(/\{shopB\}/g, shops[1] || "Neon Nook")
      .replace(/\{shopC\}/g, shops[2] || "Orbit Counter")
      .replace(/\{crew\}/g, crewLine(game))
      .replace(/\{bill\}/g, money(w.bill || 0))
      .replace(/\{cooler\}/g, money(D.ROOM.cooler || 0))
      .replace(/\{safe\}/g, money(D.ROOM.safe || 0))
      .replace(/\{speaker\}/g, money(D.ROOM.speaker || 0))
      .replace(/\{plant\}/g, money(D.ROOM.plant || 0))
      .replace(/\{neon\}/g, money(D.ROOM.neon || 0))
      .replace(/\{insure\}/g, money(30))
      .replace(/\{landlord\}/g, landlordTone(w))
      .replace(/\{hire\}/g, hireName(game))
      .replace(/\{want\}/g, hireWant(game))
      .replace(/\{hireMood\}/g, String(hireMood(game)));
  }

  function landlordTone(w) {
    var m = w.landlordMood == null ? 2 : w.landlordMood;
    if (m <= 1) return "The landlord is done waiting.";
    if (m >= 4) return "The landlord likes the building.";
    return "The landlord is in the doorway.";
  }

  function slotEmployee(game) {
    var slot = game.slots && game.slots[0];
    return slot && slot.employee ? slot.employee : null;
  }

  function hireName(game) {
    var emp = slotEmployee(game);
    return emp && emp.name ? emp.name : "Your hire";
  }

  function hireWant(game) {
    var emp = slotEmployee(game);
    if (!emp) return "shift";
    return emp.want || emp.pref || "shift";
  }

  function hireMood(game) {
    var emp = slotEmployee(game);
    if (!emp || emp.mood == null) return 2;
    return emp.mood;
  }

  function templateOk(game, card) {
    var skills = game.player.skills || {};
    var place = game.player.place || {};
    var w = game.world;
    if (card.workMin && (skills.work || 0) < card.workMin) return false;
    if (card.mindMin && (skills.mind || 0) < card.mindMin) return false;
    if (card.sign && !place.sign) return false;
    if (card.rival && !w.rival) return false;
    if (card.floor && !w.floor) return false;
    if (card.shady && !(game.flags && game.flags.shady)) return false;
    if (card.part && (!place.owned || place[card.part])) return false;
    if (card.upstairs && !(w.floor && (!w.upstairs || w.upstairs === "none"))) return false;
    if (card.crew && !(w.regulars && w.regulars.length >= 2)) return false;
    if (card.teach && w.classYear === game.player.level) return false;
    if (card.council && w.councilYear === game.player.level) return false;
    if (card.truce && w.truce) return false;
    if (card.loan && w.loan) return false;
    if (card.insure && w.insured) return false;
    if (card.cater && w.catered) return false;
    if (card.partner && w.partner) return false;
    if (card.quiet && (!(game.flags && game.flags.shady) || !place.owned || w.quietRoom)) return false;
    if (card.favor && (!(w.regular && (w.regular.mood || 0) >= 3) || w.favorYear === game.player.level)) return false;
    if (card.favor && !(game.player.place && game.player.place.lights)) return false;
    if (card.market && ((game.player.visibility || 0) < 40 || w.nightMarket)) return false;
    if (card.lot && (!game.degrees || !game.degrees.bach || w.secondLot)) return false;
    if (card.retire && w.retired) return false;
    return true;
  }

  function templateId(game, now) {
    var phase = phaseAt(now).id;
    var pool = [];
    var i;
    if (!D.LIFE) return null;
    for (i = 0; i < D.LIFE.length; i++) {
      var card = D.LIFE[i];
      if (!card.when) continue;
      if (card.when !== "any" && card.when !== phase) continue;
      if (!templateOk(game, card)) continue;
      if (card.once && game.world.seen[card.id] === game.player.level) continue;
      pool.push(card);
    }
    if (!pool.length) return null;
    var n = (game.player.level * 13 + phase.charCodeAt(0)) % pool.length;
    return pool[n].id;
  }

  function seraWantId(game) {
    ensureLife(game);
    var reg = game.world.regular;
    if (!reg) return "";
    var lights = !!(game.player.place && game.player.place.lights);
    if (!lights) return "sera_dark";
    if ((reg.mood || 0) >= 3 && game.world.favorYear !== game.player.level) return "favor_card";
    return "";
  }

  function personCard(game) {
    var w = game.world;
    var place = game.player.place || {};
    var lights = !!place.lights;
    if (w.regular && !lights && (w.regularDue || place.owned)) return "sera_dark";
    if (seraWantId(game) === "favor_card") return "favor_card";
    if (w.rival && place.owned && !place.sign) return "rival";
    if (w.rivalFlip) return "rival_flip";
    var emp = slotEmployee(game);
    if (emp && (emp.mood || 0) <= 1) return "hire_want";
    return "";
  }

  function hourCard(game, now) {
    var phase = phaseAt(now).id;
    var map = { morning: "morn_line", lunch: "lunch_line", evening: "eve_line", night: "night_line", standard: "slow_line" };
    var id = map[phase] || "";
    var card = id && D.lifeById[id];
    if (card && !(card.once && game.world.seen[id] === game.player.level)) return id;
    if (game.world.seen.year_open !== game.player.level) return "year_open";
    return "";
  }

  function pushSpine(list, id) {
    if (id && list.indexOf(id) < 0) list.push(id);
  }

  function fillYearSpine(game, now) {
    ensureLife(game);
    var w = game.world;
    var list = [];
    if (w.rentDue > 0) pushSpine(list, "landlord");
    if (w.bill > 0) pushSpine(list, "bill");
    pushSpine(list, personCard(game));
    pushSpine(list, hourCard(game, now));
    w.spine = list;
  }

  function enqueuePhaseDue(game, now) {
    ensureLife(game);
    var w = game.world;
    if (!w.spine) w.spine = [];
    if (w.spine.length) return;
    var id = "";
    if (w.rentDue > 0) id = "landlord";
    else if (w.bill > 0) id = "bill";
    else id = personCard(game) || "";
    if (id) w.spine.push(id);
  }

  function spineOpen(game) {
    var w = game.world;
    return !!(w && w.spine && w.spine.length && w.showing === w.spine[0]);
  }

  function actionResolves(cardId, actionId) {
    var card = D.lifeById[cardId];
    if (!card || !actionId) return false;
    return card.a === actionId || card.b === actionId;
  }

  function finishCard(game, actionId) {
    var w = game.world;
    if (!w) return;
    var front = w.spine && w.spine[0];
    if (front && actionResolves(front, actionId)) {
      w.spine.shift();
      if (w.showing === front) w.showing = "";
      if (front === "rival_flip") w.rivalFlip = false;
      return;
    }
    if (w.showing && actionResolves(w.showing, actionId)) {
      if (w.showing === "rival_flip") w.rivalFlip = false;
      w.showing = "";
    }
  }

  function currentLifeId(game, now) {
    ensureLife(game);
    var w = game.world;
    var place = game.player.place || {};
    if (w.spine && w.spine.length) return w.spine[0];
    if (w.rentDue > 0) return "landlord";
    if (game.flags && game.flags.shady && (game.player.heat || 0) >= 45) return "heat";
    if (w.rival && place.owned && !place.sign) return "rival";
    if (w.regular && w.regularDue) {
      if (place.owned && !place.lights) return "sera_dark";
      return "regular";
    }
    if (w.rivalFlip) return "rival_flip";
    if (place.owned && !w.floor && game.player.capital >= D.ROOM.floor) return "floor";
    var slot = game.slots && game.slots[0];
    if (slot && slot.stock > 0 && slot.stock <= 2) return "thin";
    if (inspectionDue(game)) return "inspect";
    if (w.scoutJust) return "scout_back";
    if (w.bill > 0) return "bill";
    if (!game.player.shop && game.player.shifts >= 1) return "shopname";
    return templateId(game, now);
  }

  function offerLife(game, now) {
    ensureLife(game);
    if (!game.flags || !game.flags.opened) return false;
    if (spineOpen(game)) return false;
    tenantTick(game, phaseAt(now).id);
    var id = currentLifeId(game, now);
    if (!id || id === game.world.showing) return false;
    var card = D.lifeById[id];
    game.world.showing = id;
    if (id === "scout_back") game.world.scoutJust = false;
    if (card && card.once) game.world.seen[id] = game.player.level;
    pushLog(game, "* Life: " + id);
    return true;
  }

  function lifeBeat(game, id) {
    ensureLife(game);
    var card = D.lifeById[id];
    if (!card) return null;
    var line = fillLife(card.line, game);
    if (id === "regular" || id === "landlord" || id === "rival" || id === "rival_flip" || id === "sera_dark") {
      var spoken = grammarLine(game, id);
      if (spoken) line = spoken;
    }
    line = attachMemory(line, game);
    return {
      line: line,
      rail: card.rail,
      action: card.a,
      label: fillLife(card.aLabel, game),
      alt: card.b || null,
      altLabel: card.b ? fillLife(card.bLabel, game) : null,
      stamp: card.kicker
    };
  }

  function ensureShopBook(book, hours, busy, money) {
    if (!book) book = {};
    if (book.hours !== "open" && book.hours !== "closed") book.hours = hours;
    if (book.busy == null || isNaN(book.busy)) book.busy = busy;
    if (book.money == null || isNaN(book.money)) book.money = money;
    return book;
  }

  function grammarLine(game, id) {
    ensureLife(game);
    var w = game.world;
    var place = game.player.place || {};
    var phase = game.phaseId || w.hoursPhase || "";
    var night = phase === "night";
    var signOn = !!place.sign;
    var lightsOn = !!place.lights;
    var heat = Math.round(game.player.heat || 0);
    var reg = w.regular || {};
    var rain = night ? "rain on the glass" : "";
    if (id === "sera_dark") {
      var who = reg.name || "Sera";
      var beside = rain || (signOn ? "the sign is on" : "the sign is off");
      return who + " almost didn't come. " + beside + ", and the lights were off.";
    }
    if (id === "regular") {
      var bits = [(reg.name || "Sera") + " came back", "visit " + (reg.visits || 1)];
      if (rain) bits.push(rain);
      bits.push(signOn ? "the sign is on" : "the sign is off");
      if (heat >= 20) bits.push("heat is " + heat);
      bits.push(lightsOn ? "the lights are warm" : "the lights were off");
      if (w.hours === "open") bits.push("you stayed open");
      if (w.hours === "closed") bits.push("you closed");
      if (w.rivalMemory) bits.push("she remembers " + w.rivalMemory);
      return bits[0] + ". " + bits.slice(1, 4).join(", ") + ".";
    }
    if (id === "landlord") {
      var second = (w.behind || 0) > 0 ? ("rent is " + w.behind + " behind") : (rain || (signOn ? "the sign is on" : "the sign is off"));
      if (heat >= 45) second = "heat is " + heat;
      return landlordTone(w) + " " + second + ", and rent is " + money(w.rentDue || 0) + ".";
    }
    if (id === "rival" || id === "rival_flip") {
      var rival = w.rival || "Juniper";
      var lead = id === "rival_flip" ? (rival + " copied the sign") : (rival + " opened across the street");
      var signBit = signOn ? "the sign is on" : "the sign is off";
      var second = w.rivalMemory ? ("she remembers " + w.rivalMemory) : (rain || "lunch is thinner");
      if (!w.rivalMemory && w.hours === "open") second = "you stayed open";
      if (!w.rivalMemory && w.hours === "closed") second = "you closed";
      return lead + ". " + signBit + ", and " + second + ".";
    }
    return "";
  }

  function personPlace(game, who) {
    ensureLife(game);
    var w = game.world;
    var open = !!(game.flags && game.flags.opened) && shopOpen(game);
    if (who === "sera") {
      if (!w.regular || !w.regularDue || !open) return "gone";
      return "counter";
    }
    if (who === "landlord") return w.rentDue > 0 ? "door" : "gone";
    if (who === "juniper") return w.rival ? "across" : "gone";
    if (who === "hire") {
      if (w.upstairsStaff) return "upstairs";
      if (slotEmployee(game) && open) return "counter";
      return "gone";
    }
    return "gone";
  }

  function stand(game, spot) {
    ensureLife(game);
    if (spot !== "register" && spot !== "door" && spot !== "upstairs") return { ok: false, reason: "spot" };
    if (spot === "upstairs" && !game.world.floor) return { ok: false, reason: "floor" };
    game.world.spot = spot;
    game.rev += 1;
    return { ok: true, spot: spot };
  }

  function juniperWinning(game) {
    ensureLife(game);
    var w = game.world;
    if (!w.rival || w.truce) return false;
    if (!game.player.place) return false;
    return true;
  }

  function tickBlock(game) {
    ensureLife(game);
    var w = game.world;
    var j = w.block.juniper;
    var c = w.block.campus;
    var n = w.block.night;
    if (juniperWinning(game)) {
      j.hours = "open";
      j.busy = Math.min(8, (j.busy || 0) + 1);
      j.money = Math.round((j.money || 0) + 6);
    } else if (w.rival && w.truce) {
      j.busy = Math.max(0, (j.busy || 0) - 1);
      j.hours = j.busy > 0 ? "open" : "closed";
    }
    if (w.district === "campus") {
      c.hours = "open";
      c.busy = Math.min(6, (c.busy || 0) + 1);
      c.money = Math.round((c.money || 0) + 4);
    } else {
      c.hours = "closed";
      if ((c.busy || 0) > 0) c.busy -= 1;
    }
    if (w.district === "night") {
      n.hours = "open";
      n.busy = Math.min(6, (n.busy || 0) + 1);
      n.money = Math.round((n.money || 0) + 4);
    } else if ((game.phaseId || "") === "night") {
      n.hours = "open";
    } else {
      n.hours = "closed";
    }
    return w.block;
  }

  function heatQuote(game, kind) {
    ensureLife(game);
    if (kind === "skim") return game.world && game.world.quietRoom ? 10 : 8;
    if (kind === "score") return 18;
    return 0;
  }

  function hireAtRegister(game) {
    var w = game.world;
    if (!w || w.upstairsStaff) return false;
    if (!shopOpen(game)) return false;
    return !!slotEmployee(game);
  }

  function registerCovered(game) {
    ensureLife(game);
    if (game.world.spot !== "upstairs") return true;
    return hireAtRegister(game);
  }

  function writeBooksSlip(game, start) {
    var left = game.player.capital;
    var rent = 0;
    var bill = 0;
    var came = left - start + rent + bill;
    var slip = {
      came: came,
      rent: rent,
      bill: bill,
      left: left,
      text: "Came in " + money(came) + ". Rent took " + money(rent) + ". The bill took " + money(bill) + ". Left " + money(left) + "."
    };
    game.world.lastSlip = slip;
    return slip;
  }

  function noteThin(game) {
    ensureLife(game);
    var w = game.world;
    if (!w.rival || w.truce) {
      w.thin = null;
      return null;
    }
    var place = game.player.place || {};
    var noSign = !place.sign;
    var copied = w.rivalMemory === "copied";
    if (!noSign && !copied && w.rivalMemory !== "thin") {
      w.thin = null;
      return null;
    }
    var cause = noSign ? "No sign" : (copied ? "Juniper copied the sign" : "Lunch went thin");
    w.thin = { cause: cause, line: cause + ", and people crossed." };
    return w.thin;
  }

  function builtBit(game) {
    var place = game.player.place || {};
    if (game.world && game.world.floor) return "the floor";
    if (place.sign) return "the sign";
    if (place.lights) return "the lights";
    if (place.counter) return "the counter";
    if (place.owned) return "the corner";
    return "nothing yet";
  }

  function addRegular(game, person) {
    var list = game.world.regulars;
    var i;
    for (i = 0; i < list.length; i++) if (list[i].name === person.name) return list[i];
    list.push(person);
    return person;
  }

  function markLightRegulars(game) {
    var list = game.world.regulars;
    var lights = game.player.place && game.player.place.lights;
    var i;
    for (i = 0; i < list.length; i++) {
      if (!list[i].needsLights) continue;
      list[i].due = !!lights;
    }
  }

  function meetPeople(game, now) {
    ensureLife(game);
    var w = game.world;
    var shifts = game.player.shifts;
    if (shifts === 2 && !w.regular) {
      w.regular = { name: D.FIRST[2] + " " + D.LAST[1], visits: 1, mood: 1 };
      w.regularDue = true;
      addRegular(game, w.regular);
      if (!w.milestones.regular) {
        w.milestones.regular = true;
        pushLog(game, "* Milestone: first regular.");
      }
    } else if (w.regular && shifts > 0 && shifts % 4 === 0) {
      w.regularDue = true;
    }
    if (shifts === 4) addRegular(game, { name: D.FIRST[3] + " " + D.LAST[2], visits: 1, mood: 1 });
    if (shifts === 8) addRegular(game, { name: D.FIRST[7] + " " + D.LAST[6], visits: 1, mood: 1, needsLights: true });
    if (shifts > 0 && shifts % 4 === 0) markLightRegulars(game);
    if (shifts === 6 && game.player.place && game.player.place.owned && !w.rival) {
      w.rival = "Juniper Pike";
      if (!w.rivalMemory) w.rivalMemory = "thin";
      syncRivalSign(game);
    }
    offerLife(game, now);
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
    ensureShopNames(game);
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
      ensureLife(game);
      if (game.world.album.length < 12) game.world.album.push("Y" + game.player.level);
      pushLog(game, awardsLine(game));
      game.world.wallAward = {
        who: bestRegularName(game),
        built: builtBit(game),
        award: "Y" + game.player.level
      };
      guard += 1;
    }
    if (leveled) {
      ensureLife(game);
      if (game.player.place && game.player.place.owned) game.world.rentDue = rentAmount(game);
      fillYearSpine(game, game.lastReal || 0);
      if (game.player.place && game.player.place.owned) {
        game.world.showing = "";
        offerLife(game, game.lastReal || 0);
      }
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
    if (!job) return false;
    if (game.player.level < job.level) return false;
    if (job.node && !game.nodes[job.node]) return false;
    if (job.skill) {
      ensureLife(game);
      var have = game.player.skills[job.skill] || 0;
      if (have < (job.skillNeed || 1)) return false;
    }
    return true;
  }

  function hobbyOpen(game, hobby) {
    if (!hobby) return false;
    ensureLife(game);
    var key = hobby.needSkill || hobby.skill;
    return (game.player.skills[key] || 0) >= (hobby.need || 0);
  }

  function noteUnlocks(game) {
    ensureLife(game);
    var i;
    if (D.HOBBIES) {
      for (i = 0; i < D.HOBBIES.length; i++) {
        var hobby = D.HOBBIES[i];
        if (!(hobby.need > 0) || !hobbyOpen(game, hobby)) continue;
        var hkey = "hob_" + hobby.id;
        if (game.flags[hkey]) continue;
        game.flags[hkey] = true;
        pushLog(game, "+ Hobby open: " + hobby.id + ". " + hobby.name + ".");
      }
    }
    for (i = 0; i < D.JOBS.length; i++) {
      var job = D.JOBS[i];
      if (!job.skill || !jobUnlocked(game, job)) continue;
      var jkey = "job_" + job.id;
      if (game.flags[jkey]) continue;
      game.flags[jkey] = true;
      pushLog(game, "+ Job open: " + job.id + ". " + job.name + " will take you.");
    }
  }

  function cycleSeconds(game) {
    var bonus = recomputeBonus(game);
    var sec = 4.2;
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
      if (game.player.place && game.player.place.safe) loss = Math.max(1, Math.round(loss * 0.85));
      game.player.capital = Math.max(0, game.player.capital - loss);
      if (slot.camera) {
        emp.caught = true;
        if (hasRid(game, 121)) {
          emp.salary = Math.max(1, Math.round(emp.salary * 0.75));
          if (!quiet) pushLog(game, "! Sentinel slashed " + emp.name + " to " + money(emp.salary) + ". Loss " + money(loss) + ".");
        } else if (!quiet) {
          pushLog(game, "! Camera slot " + (slot.id + 1) + ": " + emp.name + " caught lifting stock. Loss " + money(loss) + ". The lens kept the name.");
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
    if (game.player.place && game.player.place.owned) {
      var room = 1;
      if (game.player.place.lights) room += 0.06;
      room += signLift(game);
      if (game.player.place.counter) room += 0.07;
      gross *= room;
    }
    if (game.world && game.world.floor) gross *= 1.08;
    if (phase.id === "lunch") {
      gross *= districtLunchMult(game);
      gross *= rivalLunchMult(game);
    }
    gross *= menuGrossMult(game);
    gross *= nightBump(game, phase.id);
    if (slot.jobId === "fast_food" && hasRid(game, 105)) gross *= 2;
    if (hasRid(game, 109)) gross *= 2;
    if (hasRid(game, 120)) gross *= 1.5;
    var wage = emp ? emp.salary / 20 : 0;
    if (emp && emp.pref) wage *= wagePrefMult(emp, phase.id);
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
    if (!quiet && (slot.stock <= 1 || net < 0)) {
      var line = (net >= 0 ? "+ " : "! ") + "Slot " + (slot.id + 1) + " cycle " + money(net) + ". Stock " + slot.stock + ".";
      pushLog(game, line);
    }
    if (!quiet) markPulse(game, net);
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
    ensureLife(game);
    game.world.scoutJust = true;
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

  function upstairsTick(game, now) {
    var w = game.world;
    if (!w || !w.floor || w.upstairs !== "tutor") return 0;
    if (w.hours === "closed") return 0;
    var phase = phaseAt(now || game.lastReal || 0).id;
    if (w.tutorPhase === phase) return 0;
    w.tutorPhase = phase;
    var pay = 4;
    game.player.capital += pay;
    return pay;
  }

  function runBusiness(game, now, ms, rng, quiet) {
    var phase = phaseAt(now);
    var i;
    ensureSlots(game);
    upstairsTick(game, now);
    for (i = 0; i < game.slots.length; i++) {
      var slot = game.slots[i];
      slot.bucket += ms / 1000;
      var guard = 0;
      var len = cycleSeconds(game);
      while (slot.bucket >= len && guard < 40) {
        slot.bucket -= len;
        resolveCycle(game, slot, phase, rng, now, !!quiet);
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
    var phase = phaseAt(now);
    var phaseChanged = !game.booted || phase.id !== game.phaseId;
    if (phaseChanged) syncHours(game, phase.id);
    var daySnap = {
      stock: game.slots && game.slots[0] ? game.slots[0].stock : 0,
      capital: game.player.capital,
      phaseChanged: phaseChanged
    };
    if (wall > 0) {
      applyWall(game, game.lastReal, now);
      if (game.flags.opened) {
        var biz = wall;
        var capMs = offlineCapMs(game);
        if (biz > capMs) biz = capMs;
        if (!game.booted && wall > 1500) {
          var hours = hasRid(game, 124) ? 72 : 24;
          var catchLine = "Catch-up used the device clock (" + Math.round(wall / 1000) + "s). Business buffer is " + hours + "h.";
          if (game.world.regular && game.world.regular.name && !game.world.catchNamed) {
            catchLine += " " + game.world.regular.name + " covered the quiet hours.";
            game.world.catchNamed = true;
          }
          pushLog(game, catchLine);
        }
        if (shopOpen(game)) {
          if (!registerCovered(game)) {
            /* upstairs, and nobody is on the register this tick */
          } else if (biz > 20000) bulkBusiness(game, now, biz, rng);
          else runBusiness(game, now, biz, rng, true);
        }
        serviceEngines(game, now, wall);
      }
      game.lastReal = now;
    }
    if (game.flags.opened && !game.world.welcomed) {
      game.world.welcomed = true;
      offerLife(game, now);
    }
    if (game.flags.opened && phaseChanged) {
      tickBlock(game);
      if (phase.id === "lunch") noteThin(game);
      var blocked = spineOpen(game);
      if (!blocked && game.world.rival && game.world.notePhase !== phase.id) {
        game.world.notePhase = phase.id;
        pushLog(game, "City note: " + game.world.rival + " is still across the street.");
      }
      tenantTick(game, phase.id);
      enqueuePhaseDue(game, now);
      if (!blocked) offerLife(game, now);
    }
    game.phaseId = phase.id;
    tickHireMood(game, phase.id);
    spoilTick(game, now);
    checkQuits(game);
    checkHints(game);
    checkGoals(game);
    if (game.player.heat > 0 && now - (game.heatAt || 0) > 5000) {
      game.heatAt = now;
      game.player.heat = Math.max(0, game.player.heat - 1);
    }
    if (game.fx && now < game.fx.visLockUntil) game.player.visibility = 100;
    game.booted = true;
    noteDay(game, now, daySnap);
    noteChapter(game);
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
    if (game.world.locked >= 3 && game.world.rentDue > 0) {
      pushLog(game, "! The night is locked. Pay the rent first.");
      return { ok: false, reason: "locked" };
    }
    game.flags.opened = true;
    game.flags.chosen = true;
    if (now - game.shiftAt < 350) return { ok: false, reason: "cooldown" };
    game.shiftAt = now;
    var slipStart = game.player.capital;
    var phase = phaseAt(now);
    var bonus = recomputeBonus(game);
    var pay = Math.round((14 + game.player.level * 2) * phase.revenue * bonus.revenue);
    if (game.fx && now < game.fx.sugarUntil) pay *= 2;
    if ((game.player.skills.work || 0) + 1 >= 8) pay += 2;
    if (game.world.upstairs === "office" && game.world.floor) {
      pay += 3;
      if (game.world.upstairsStaff) pay += 2;
    }
    game.player.capital += pay;
    if (game.world.partner) {
      var split = Math.max(1, Math.round(pay * 0.1));
      game.player.capital = Math.max(0, game.player.capital - split);
    }
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
      if (!game.world.milestones.raise) {
        game.world.milestones.raise = true;
        pushLog(game, "* Milestone: first raise.");
      }
    }
    if (game.player.skills.work >= 8) game.world.promoted = true;
    if (game.nodes && game.nodes.backroom) {
      var cut = Math.max(1, Math.round(pay * 0.15));
      game.player.capital += cut;
      game.player.heat = Math.min(100, game.player.heat + 2);
    }
    if (game.player.shifts % 3 === 0) {
      game.player.visibility = clampStat(game.player.visibility + 1.5 * bonus.visibility);
    }
    var place = game.player.place;
    if (place && place.speaker) game.player.visibility = clampStat(game.player.visibility + 0.3);
    if (place && place.plant) game.player.stress = clampStat(game.player.stress - 1);
    if (place && place.neon) game.player.visibility = clampStat(game.player.visibility + 0.4);
    if (game.player.shifts % 4 === 0) postBill(game);
    finishCard(game, "shift");
    if (game.crafted && game.crafted.length && !game.world.craftShiftLogged) {
      game.world.craftShiftLogged = true;
      pushLog(game, "A crafted plate is on the counter.");
    }
    maybeLevel(game);
    pushLog(game, "+ The shift paid " + money(pay) + ".");
    if (gotRaise) pushLog(game, "+ The counter noticed. You got a raise.");
    noteUnlocks(game);
    checkGoals(game);
    meetPeople(game, now);
    noteThin(game);
    writeBooksSlip(game, slipStart);
    game.rev += 1;
    markPulse(game, pay);
    return { ok: true, pay: pay };
  }

  function workHobby(game, now, hobbyId) {
    ensureLife(game);
    if (isHeld(game, now)) {
      pushLog(game, "! You're being held. Hobbies wait.");
      return { ok: false, reason: "held" };
    }
    var hobby = D.hobbyById[hobbyId || "tutor"];
    if (!hobby) return { ok: false, reason: "missing" };
    if (!hobbyOpen(game, hobby)) {
      pushLog(game, hobby.name + " needs more " + (hobby.needSkill || hobby.skill) + ".");
      return { ok: false, reason: "locked" };
    }
    game.flags.chosen = true;
    if (now - (game.hobbyAt || 0) < 800) return { ok: false, reason: "cooldown" };
    game.hobbyAt = now;
    var key = hobby.skill;
    var skill = game.player.skills[key] || 0;
    var pay = hobby.pay + Math.floor(skill / 3);
    if (game.world.upstairs === "tutor" && game.world.floor) pay += 3;
    game.player.capital += pay;
    game.player.skills[key] = Math.min(100, skill + 1);
    if (game.player.skills[key] >= 5 && !game.world.hobbyShop) {
      game.world.hobbyShop = hobby.id;
      pushLog(game, "+ Hobby shop: " + hobby.name + ".");
    }
    if (key === "mind") game.player.intelligence = clampStat(game.player.intelligence + 0.6);
    if (key === "clout") game.player.visibility = clampStat(game.player.visibility + 0.8);
    addXp(game, hobby.xp || 8);
    maybeLevel(game);
    pushLog(game, "+ Hobby paid " + money(pay) + ". You know this a little better.");
    noteUnlocks(game);
    checkGoals(game);
    game.rev += 1;
    return { ok: true, pay: pay };
  }

  function buyRoom(game) {
    ensureLife(game);
    if (game.player.place.owned) return { ok: false, reason: "owned" };
    var cost = D.ROOM.rent;
    if (game.player.capital < cost) {
      pushLog(game, "! The corner wants " + money(cost) + ". The drawer is light.");
      return { ok: false, reason: "capital" };
    }
    game.player.capital -= cost;
    game.player.place.owned = true;
    if (!game.world.deed || game.world.deed === "") game.world.deed = "renting";
    pushLog(game, "+ You rented the corner. " + money(cost) + ".");
    game.rev += 1;
    return { ok: true };
  }

  function upgradeRoom(game, part) {
    ensureLife(game);
    if (!game.player.place.owned) {
      pushLog(game, "Rent the corner before you change it.");
      return { ok: false, reason: "rent" };
    }
    if (part !== "lights" && part !== "sign" && part !== "counter" && part !== "cooler" && part !== "safe" && part !== "speaker" && part !== "plant" && part !== "neon") return { ok: false };
    if (game.player.place[part]) return { ok: false, reason: "owned" };
    var cost = D.ROOM[part];
    if (!(cost > 0) || game.player.capital < cost) {
      pushLog(game, "! That change costs " + money(cost || 0) + ".");
      return { ok: false, reason: "capital" };
    }
    game.player.capital -= cost;
    game.player.place[part] = 1;
    if (part === "lights") pushLog(game, "+ Warm lights. The corner looks like a shop. " + money(cost) + ".");
    else if (part === "sign") {
      pushLog(game, "+ A sign. People can find you. " + money(cost) + ".");
      syncRivalSign(game);
    } else if (part === "counter") pushLog(game, "+ A real counter. The folding table is gone. " + money(cost) + ".");
    else if (part === "cooler") pushLog(game, "+ A cooler. The shelf keeps longer. " + money(cost) + ".");
    else if (part === "safe") pushLog(game, "+ A safe. Losses land a little softer. " + money(cost) + ".");
    else if (part === "speaker") pushLog(game, "+ A speaker. The room has a little more clout. " + money(cost) + ".");
    else if (part === "plant") pushLog(game, "+ A plant. The shift feels less sharp. " + money(cost) + ".");
    else pushLog(game, "+ Neon. Mostly for show. " + money(cost) + ".");
    finishCard(game, "upgrade:" + part);
    game.rev += 1;
    return { ok: true };
  }

  function payRent(game) {
    ensureLife(game);
    var due = game.world.rentDue;
    if (!(due > 0)) return { ok: false, reason: "none" };
    if (game.player.capital < due) {
      pushLog(game, "! Rent is " + money(due) + ". The drawer is light.");
      return { ok: false, reason: "capital" };
    }
    game.player.capital -= due;
    game.world.rentDue = 0;
    game.world.behind = 0;
    game.world.locked = 0;
    game.world.landlordMood = Math.min(5, (game.world.landlordMood == null ? 2 : game.world.landlordMood) + 1);
    finishCard(game, "rentpay");
    game.world.showing = "";
    advanceLease(game, "rent");
    pushLog(game, "+ You paid the landlord " + money(due) + ". The year is yours.");
    game.rev += 1;
    return { ok: true };
  }

  function stallRent(game) {
    ensureLife(game);
    if (!(game.world.rentDue > 0)) return { ok: false, reason: "none" };
    game.world.behind += 1;
    game.player.stress = clampStat(game.player.stress + 8);
    game.world.landlordMood = Math.max(0, (game.world.landlordMood == null ? 2 : game.world.landlordMood) - 1);
    finishCard(game, "rentstall");
    game.world.showing = "";
    if (game.world.behind >= 3 && game.player.place) {
      game.player.place.lights = 0;
      game.world.locked = game.world.behind;
      pushLog(game, "! You stalled too long. The landlord took the lights.");
    } else {
      pushLog(game, "! You stalled. Rent is still " + money(game.world.rentDue) + ".");
    }
    game.rev += 1;
    return { ok: true };
  }

  function buyFloor(game) {
    ensureLife(game);
    if (!game.player.place || !game.player.place.owned) {
      pushLog(game, "Rent the corner before you buy the floor.");
      return { ok: false, reason: "rent" };
    }
    if (game.world.floor) return { ok: false, reason: "owned" };
    var cost = D.ROOM.floor;
    if (game.player.capital < cost) {
      pushLog(game, "! The floor costs " + money(cost) + ".");
      return { ok: false, reason: "capital" };
    }
    game.player.capital -= cost;
    game.world.floor = 1;
    game.world.upstairs = "none";
    game.world.upstairsStaff = "";
    if (!game.world.spine) game.world.spine = [];
    if (game.world.rentDue > 0) {
      if (game.world.spine.indexOf("upstairs_pick") < 0) game.world.spine.push("upstairs_pick");
    } else game.world.spine = ["upstairs_pick"];
    game.world.showing = "";
    advanceLease(game, "floor");
    if (!game.world.milestones.floor) {
      game.world.milestones.floor = true;
      pushLog(game, "* Milestone: the floor.");
    }
    checkGoals(game);
    pushLog(game, "+ The floor above is yours. The building got taller.");
    game.rev += 1;
    return { ok: true };
  }

  function compRegular(game) {
    ensureLife(game);
    var reg = game.world.regular;
    if (!reg) return { ok: false, reason: "none" };
    if (game.player.capital < 4) {
      pushLog(game, "! A comp costs $4.");
      return { ok: false, reason: "capital" };
    }
    game.player.capital -= 4;
    reg.mood = Math.min(5, (reg.mood || 0) + 1);
    reg.visits = (reg.visits || 1) + 1;
    game.world.regularDue = false;
    finishCard(game, "comp");
    game.world.showing = "";
    pushLog(game, "+ " + reg.name + " grins. You comped the meal. $4.");
    game.rev += 1;
    return { ok: true };
  }

  function greetRegular(game) {
    ensureLife(game);
    var reg = game.world.regular;
    if (!reg) return { ok: false, reason: "none" };
    reg.visits = (reg.visits || 1) + 1;
    reg.mood = Math.max(0, (reg.mood || 0) - 1);
    game.world.regularDue = false;
    finishCard(game, "greet");
    game.world.showing = "";
    game.player.capital += 3;
    pushLog(game, "+ " + reg.name + " paid full price. $3.");
    game.rev += 1;
    return { ok: true };
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
      if (game.world.insured) fine = Math.max(1, Math.round(fine * 0.5));
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
    var heatGain = 8;
    if (game.world.quietRoom) {
      pay += 4;
      heatGain += 2;
    }
    game.player.capital += pay;
    game.player.skills.hustle = Math.min(100, (game.player.skills.hustle || 0) + 1);
    game.player.heat = Math.min(100, game.player.heat + heatGain);
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
    pushLog(game, "+ A pack landed on the shelf. " + money(cost) + ".");
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
      caught: false,
      pref: prefFor(card.name),
      want: prefFor(card.name),
      mood: 2
    };
    checkGoals(game);
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

  function prefFor(name) {
    var prefs = ["morning", "lunch", "night"];
    var h = 0;
    var i;
    name = name || "A";
    for (i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % 997;
    return prefs[h % 3];
  }

  function ensureEmployees(game) {
    var slots = game.slots || [];
    var i;
    for (i = 0; i < slots.length; i++) {
      var emp = slots[i].employee;
      if (emp && !emp.pref) emp.pref = prefFor(emp.name);
    if (emp && !emp.want) emp.want = emp.pref;
    if (emp && emp.mood == null) emp.mood = 2;
    }
  }

  function wagePrefMult(emp, phaseId) {
    if (!emp || !emp.pref) return 1;
    if (emp.pref === phaseId) return 1;
    return 1.08;
  }

  function rentAmount(game) {
    var level = game.player.level || 1;
    var due = 18 + level * 6;
    var place = game.player.place;
    if (place && place.lights) due += 4;
    if (place && place.sign) due += 4;
    if (place && place.counter) due += 4;
    if (game.world && game.world.floor) due += 6;
    return due;
  }

  function signLift(game) {
    var place = game.player.place;
    if (!place || !place.sign) return 0;
    var w = game.world;
    if (w && w.signMuted > (game.player.shifts || 0)) return 0;
    return 0.08;
  }

  function districtLunchMult(game) {
    var d = game.world && game.world.district;
    if (d === "campus") return 0.9;
    if (d === "night") return 1.08;
    return 1;
  }

  function noteRivalMemory(game) {
    var w = game.world;
    var place = game.player.place;
    if (!w || !w.rival || w.truce) return;
    if (place && place.sign) {
      if (w.rivalMemory !== "copied") {
        if (w.rivalMemory === "thin") w.rivalFlip = true;
        w.rivalMemory = "copied";
      }
      w.rivalSign = true;
    } else if (!w.rivalMemory) w.rivalMemory = "thin";
  }

  function syncRivalSign(game) {
    noteRivalMemory(game);
  }

  function rivalLunchMult(game) {
    var w = game.world;
    if (!w || !w.rival || w.truce) return 1;
    var place = game.player.place;
    if (place && place.sign) {
      noteRivalMemory(game);
      return 0.93;
    }
    if (place && !place.sign) {
      noteRivalMemory(game);
      return 0.82;
    }
    return 1;
  }

  function menuGrossMult(game) {
    var price = game.world && game.world.menu && game.world.menu.price;
    if (price >= 3) return 0.84;
    if (price === 2) return 0.92;
    return 1;
  }

  function nightBump(game, phaseId) {
    if (phaseId !== "night" || !game.world || !game.world.nightMarket) return 1;
    return 1.06;
  }

  function anyCamera(game) {
    var slots = game.slots || [];
    var i;
    for (i = 0; i < slots.length; i++) if (slots[i].camera) return true;
    return false;
  }

  function stockSum(game) {
    var slots = game.slots || [];
    var n = 0;
    var i;
    for (i = 0; i < slots.length; i++) n += slots[i].stock || 0;
    return n;
  }

  function inspectionDue(game) {
    if (anyCamera(game)) return false;
    if (stockSum(game) <= 0) return false;
    if (game.world && game.world.seen && game.world.seen.inspect === game.player.level) return false;
    return true;
  }

  function tenantTick(game, phaseId) {
    var w = game.world;
    if (!w || w.deed !== "owned" || !w.floor) return;
    if (w.tenantPhase === phaseId) return;
    w.tenantPhase = phaseId;
    w.tenant = true;
    if ((w.tenantPaid || 0) >= 36) return;
    var cut = 3;
    if (w.tenantPaid + cut > 36) cut = 36 - w.tenantPaid;
    if (!(cut > 0)) return;
    w.tenantPaid += cut;
    game.player.capital += cut;
    pushLog(game, "+ A tenant left " + money(cut) + ".");
  }

  function bestRegularName(game) {
    var best = "";
    var score = -1;
    function consider(person) {
      if (!person || !person.name) return;
      var s = (person.mood || 0) * 10 + (person.visits || 0);
      if (s > score) {
        score = s;
        best = person.name;
      }
    }
    if (game.world) {
      consider(game.world.regular);
      var list = game.world.regulars;
      var i;
      if (list) for (i = 0; i < list.length; i++) consider(list[i]);
    }
    return best || "none";
  }

  function awardsLine(game) {
    var bill = 0;
    if (game.world) bill = game.world.biggestBill || game.world.bill || 0;
    var floor = game.world && game.world.floor ? "floor up" : "no floor";
    return "* Awards: " + bestRegularName(game) + ", bill " + money(bill) + ", " + floor + ".";
  }

  function postBill(game) {
    var wages = 0;
    var i;
    for (i = 0; i < game.slots.length; i++) {
      var emp = game.slots[i].employee;
      if (emp) wages += emp.salary || 0;
    }
    var power = 4;
    var place = game.player.place;
    if (place && place.lights) power += 2;
    if (place && place.sign) power += 1;
    var bill = power + Math.round(wages * 0.15);
    if (bill < 4) bill = 4;
    game.world.bill = bill;
    if (bill > (game.world.biggestBill || 0)) game.world.biggestBill = bill;
  }

  function advanceLease(game, how) {
    var w = game.world;
    if (!w.deed) w.deed = "renting";
    if (how === "floor") {
      w.deed = "owned";
      return;
    }
    w.rentPays = (w.rentPays || 0) + 1;
    if (w.deed === "renting" && w.rentPays >= 3) {
      w.deed = "mortgage";
      pushLog(game, "+ Lease: mortgage.");
    } else if (w.deed === "mortgage" && w.rentPays >= 6) {
      w.deed = "owned";
      pushLog(game, "+ Lease: owned.");
    }
  }

  function spoilTick(game, now) {
    var place = game.player.place;
    var slot = game.slots && game.slots[0];
    if (!place || place.cooler || !slot || !(slot.stock > 12)) return;
    if (now - (game.spoilAt || 0) < 12000) return;
    game.spoilAt = now;
    slot.stock -= 1;
    pushLog(game, "! A little stock turned. No cooler.");
  }

  function checkQuits(game) {
    if ((game.player.stress || 0) <= 90) return;
    var i;
    for (i = 0; i < game.slots.length; i++) {
      var emp = game.slots[i].employee;
      if (!emp || !emp.traits) continue;
      if (!hasTrait(emp, "clock")) continue;
      var name = emp.name;
      game.slots[i].employee = null;
      pushLog(game, "! " + name + " quit. The clock was enough.");
    }
  }

  function checkHints(game) {
    var i;
    var t;
    for (i = 0; i < game.slots.length; i++) {
      var slot = game.slots[i];
      var emp = slot.employee;
      if (!emp || !slot.camera || emp.hinted || !emp.traits) continue;
      var bad = false;
      for (t = 0; t < emp.traits.length; t++) {
        var def = D.TRAITS[emp.traits[t]];
        if (def && def.hidden && !def.positive) bad = true;
      }
      if (!bad) continue;
      emp.hinted = true;
      pushLog(game, "The camera caught a tell on slot " + (slot.id + 1) + ".");
    }
  }

  function cheapestResume(game) {
    var list = game.resumes || [];
    var best = null;
    var i;
    for (i = 0; i < list.length; i++) {
      var card = list[i];
      if (!card || card.dying) continue;
      var cost = card.floor > 0 ? card.floor : card.ask;
      if (!(cost > 0)) continue;
      if (!best || cost < best.cost) best = { name: card.name || "A hire", cost: cost };
    }
    return best;
  }

  function spendGoal(id, label, cost, fill, price) {
    var c = cost > 0 ? cost : 0;
    var f = fill == null ? (c > 0 ? 0 : 1) : fill;
    if (f < 0) f = 0;
    if (f > 1) f = 1;
    return { id: id, label: label, cost: c, fill: f, price: price || "" };
  }

  function nextSpend(game) {
    ensureLife(game);
    var place = game.player.place;
    var cap = game.player.capital || 0;
    function moneyGoal(id, label, cost) {
      var f = cost > 0 ? cap / cost : 1;
      return spendGoal(id, label, cost, f, money(cost));
    }
    if (game.flags.opened) {
      var slot = game.slots && game.slots[0];
      var stock = slot ? (slot.stock || 0) : 0;
      if (slot && stock <= 0) {
        var n = D.STOCK_PACK;
        var room = stockCap(game) - stock;
        if (n > room) n = room;
        if (n > 0) return moneyGoal("stock", "Restock", n * D.STOCK_PRICE);
      } else if (slot && stock <= 2 && currentLifeId(game, game.lastReal || 0) === "thin") {
        var n2 = D.STOCK_PACK;
        var room2 = stockCap(game) - stock;
        if (n2 > room2) n2 = room2;
        if (n2 > 0) return moneyGoal("stock", "Restock", n2 * D.STOCK_PRICE);
      }
      if (game.world.spot === "upstairs" && shopOpen(game) && !slotEmployee(game)) {
        var hire = cheapestResume(game);
        if (hire) return moneyGoal("hire", "Hire " + hire.name, hire.cost);
      }
    }
    if (!place.owned) return moneyGoal("room", "Rent the corner", D.ROOM.rent);
    if (!place.lights) return moneyGoal("lights", "Warm lights", D.ROOM.lights);
    if (!place.sign) return moneyGoal("sign", "Paint a sign", D.ROOM.sign);
    if (!place.counter) return moneyGoal("counter", "Real counter", D.ROOM.counter);
    var extras = [["plant", "Plant"], ["speaker", "Speaker"], ["neon", "Neon"], ["cooler", "Cooler"], ["safe", "Safe"]];
    var best = null;
    var i;
    for (i = 0; i < extras.length; i++) {
      var part = extras[i][0];
      if (place[part]) continue;
      var partCost = D.ROOM[part];
      if (!best || partCost < best.cost) best = { id: part, label: extras[i][1], cost: partCost };
    }
    if (best) return moneyGoal(best.id, best.label, best.cost);
    if (!game.world.floor) return moneyGoal("floor", "Buy the floor", D.ROOM.floor);
    var ready = null;
    var later = null;
    for (i = 0; i < D.DEGREES.length; i++) {
      var deg = D.DEGREES[i];
      if (game.degrees[deg.id]) continue;
      if (game.degree && game.degree.id === deg.id) continue;
      if (!later) later = deg;
      if (game.player.level >= deg.level) { ready = deg; break; }
    }
    if (ready) return moneyGoal("deg:" + ready.id, ready.name, ready.cost);
    for (i = 0; i < D.JOBS.length; i++) {
      var job = D.JOBS[i];
      if (jobUnlocked(game, job)) continue;
      var fill = 1;
      var price = "";
      if (game.player.level < job.level) {
        fill = job.level > 0 ? (game.player.level || 0) / job.level : 0;
        price = "Year " + job.level;
      } else if (job.skill) {
        var have = (game.player.skills && game.player.skills[job.skill]) || 0;
        var need = job.skillNeed || 1;
        fill = need > 0 ? have / need : 1;
        price = need + " " + job.skill;
      } else if (job.node && D.nodeById[job.node]) {
        var vpCost = D.nodeById[job.node].cost || 1;
        fill = (game.player.vp || 0) / vpCost;
        price = vpCost + " VP";
      }
      return spendGoal("job:" + job.id, job.name, 0, fill, price);
    }
    if (later) return moneyGoal("deg:" + later.id, later.name, later.cost);
    return spendGoal("clear", "The corner is set", 0, 1, "");
  }

  function checkGoals(game) {
    ensureLife(game);
    var g = game.world.goals;
    var i;
    if (!g.hundred && game.player.capital >= 100) {
      g.hundred = true;
      pushLog(game, "* Goal: hundred in the drawer.");
    }
    if (!g.hire) {
      for (i = 0; i < game.slots.length; i++) {
        if (game.slots[i].employee) {
          g.hire = true;
          pushLog(game, "* Goal: someone else is on the clock.");
          break;
        }
      }
    }
    if (!g.floor && game.world.floor) {
      g.floor = true;
      pushLog(game, "* Goal: the floor is yours.");
    }
  }

  function calendarLine(game) {
    ensureLife(game);
    var bits = [];
    if (game.world.rentDue > 0) bits.push("rent");
    if (game.degree) bits.push("exam");
    if (game.world.season === "summer") bits.push("festival");
    if (!bits.length) return "clear";
    return bits.join(", ");
  }

  function setShop(game, index) {
    ensureLife(game);
    var shops = D.SHOPS || [];
    index = Number(index);
    if (!shops[index]) return { ok: false, reason: "name" };
    game.player.shop = shops[index];
    if (game.slots && game.slots[0]) game.slots[0].name = shops[index];
    if (game.player.place) game.player.place.name = shops[index];
    game.world.showing = "";
    pushLog(game, "+ The shop is " + game.player.shop + ".");
    game.rev += 1;
    return { ok: true, shop: game.player.shop };
  }

  function renameShop(game, slotIndex, pick) {
    ensureLife(game);
    ensureSlots(game);
    var slot = game.slots[slotIndex];
    if (!slot) return { ok: false, reason: "slot" };
    var names = shopNameList();
    var next = "";
    if (pick != null && names[Number(pick)]) next = names[Number(pick)];
    else {
      var at = names.indexOf(slot.name);
      if (at < 0) at = 0;
      next = names[(at + 1) % names.length];
    }
    next = String(next || "").replace(/\s+/g, " ").trim();
    if (!next || next === slot.name) return { ok: false, reason: "same" };
    if (next.length > 22) next = next.slice(0, 22).trim();
    slot.name = next;
    if (slotIndex === 0) {
      if (game.player.place) game.player.place.name = next;
      if ((D.SHOPS || []).indexOf(next) >= 0) game.player.shop = next;
      else if (next === "The Corner") game.player.shop = "";
    }
    pushLog(game, "+ The shop is " + next + ".");
    return { ok: true, name: next };
  }

  function cycleShop(game) {
    ensureLife(game);
    var n = (D.SHOPS && D.SHOPS.length) || 1;
    game.world.shopPage = ((game.world.shopPage || 0) + 1) % n;
    game.world.showing = "shopname";
    game.rev += 1;
    return { ok: true, page: game.world.shopPage, name: D.SHOPS[game.world.shopPage] };
  }

  function setUpstairs(game, kind) {
    ensureLife(game);
    if (!game.world.floor) return { ok: false, reason: "floor" };
    if (kind !== "tutor" && kind !== "office") return { ok: false, reason: "kind" };
    game.world.upstairs = kind;
    if (kind !== "office") game.world.upstairsStaff = "";
    finishCard(game, "up:" + kind);
    game.world.showing = "";
    pushLog(game, "+ Upstairs is a " + kind + ".");
    game.rev += 1;
    return { ok: true };
  }

  function sendUpstairs(game) {
    ensureLife(game);
    if (!game.world.floor || game.world.upstairs !== "office") return { ok: false, reason: "office" };
    var emp = slotEmployee(game);
    if (!emp) return { ok: false, reason: "hire" };
    game.world.upstairsStaff = emp.name;
    finishCard(game, "sendup");
    game.world.showing = "";
    pushLog(game, "+ " + emp.name + " went upstairs.");
    game.rev += 1;
    return { ok: true, name: emp.name };
  }

  function setHours(game, mode, now) {
    ensureLife(game);
    if (mode !== "open" && mode !== "closed") return { ok: false, reason: "mode" };
    var phase = phaseAt(now || game.lastReal || 0).id;
    game.world.hours = mode;
    game.world.hoursHold = true;
    game.world.hoursPhase = phase;
    if (mode === "open" && game.player.place) game.player.place.shut = false;
    finishCard(game, mode === "open" ? "hours:open" : "hours:close");
    game.world.showing = "";
    var shopName = (game.slots && game.slots[0] && game.slots[0].name) || "The shop";
    pushLog(game, mode === "open" ? ("+ You opened the door. " + shopName + ".") : ("+ You closed the door. " + shopName + "."));
    game.rev += 1;
    return { ok: true, hours: mode };
  }

  function syncHours(game, phaseId) {
    var w = game.world;
    if (!w) return;
    if (w.hoursHold) {
      if (w.hoursPhase && w.hoursPhase !== phaseId) w.hoursHold = false;
      else {
        w.hoursPhase = w.hoursPhase || phaseId;
        if (w.hours !== "open" && w.hours !== "closed") w.hours = "open";
        return;
      }
    }
    w.hoursPhase = phaseId;
    w.hours = (phaseId === "night" || phaseId === "standard") ? "closed" : "open";
  }

  function shopOpen(game) {
    if (game && game.player && game.player.place && game.player.place.shut) return false;
    return !game.world || game.world.hours !== "closed";
  }

  function tickHireMood(game, phaseId) {
    var slots = game.slots || [];
    var i;
    for (i = 0; i < slots.length; i++) {
      var emp = slots[i].employee;
      if (!emp) continue;
      if (!emp.pref) emp.pref = prefFor(emp.name);
      if (!emp.want) emp.want = emp.pref;
      if (emp.mood == null) emp.mood = 2;
      if (emp.moodPhase === phaseId) continue;
      emp.moodPhase = phaseId;
      if (emp.pref === phaseId) emp.mood = Math.min(5, emp.mood + 1);
      else emp.mood = Math.max(0, emp.mood - 1);
    }
  }

  function makeTruce(game) {
    ensureLife(game);
    if (!game.world.rival) return { ok: false, reason: "none" };
    game.world.truce = true;
    game.world.rivalFlip = false;
    finishCard(game, "truce");
    game.world.showing = "";
    pushLog(game, "+ A truce. Lunch is just lunch.");
    game.rev += 1;
    return { ok: true };
  }

  function takeClass(game) {
    ensureLife(game);
    if (game.world.classYear === game.player.level) return { ok: false, reason: "year" };
    if (game.player.capital < 10) {
      pushLog(game, "! Class costs $10.");
      return { ok: false, reason: "capital" };
    }
    game.player.capital -= 10;
    game.player.intelligence = clampStat(game.player.intelligence + 2);
    game.world.classYear = game.player.level;
    game.world.showing = "";
    pushLog(game, "+ Night class. $10. Intelligence ticked up.");
    game.rev += 1;
    return { ok: true };
  }

  function claimLot(game) {
    ensureLife(game);
    if (!game.degrees || !game.degrees.bach) return { ok: false, reason: "degree" };
    if (game.world.secondLot) return { ok: false, reason: "owned" };
    game.world.secondLot = true;
    game.world.showing = "";
    pushLog(game, "+ A second lot is marked. This corner still runs.");
    game.rev += 1;
    return { ok: true };
  }

  function payBill(game) {
    ensureLife(game);
    var due = game.world.bill;
    if (!(due > 0)) return { ok: false, reason: "none" };
    if (game.player.capital < due) return { ok: false, reason: "capital" };
    game.player.capital -= due;
    game.world.bill = 0;
    finishCard(game, "billpay");
    game.world.showing = "";
    pushLog(game, "+ Weekly bill paid. " + money(due) + ".");
    game.rev += 1;
    return { ok: true };
  }

  function buyInsurance(game) {
    ensureLife(game);
    if (game.world.insured) return { ok: false, reason: "owned" };
    if (game.player.capital < 30) return { ok: false, reason: "capital" };
    game.player.capital -= 30;
    game.world.insured = true;
    game.world.showing = "";
    pushLog(game, "+ Insured. Fines land softer.");
    game.rev += 1;
    return { ok: true };
  }

  function takeLoan(game) {
    ensureLife(game);
    if (game.world.loan > 0) return { ok: false, reason: "open" };
    game.player.capital += 80;
    game.world.loan = 100;
    game.world.showing = "";
    pushLog(game, "+ Loan opened. $80 in, $100 on the book.");
    game.rev += 1;
    return { ok: true };
  }

  function payLoan(game) {
    ensureLife(game);
    var due = game.world.loan;
    if (!(due > 0)) return { ok: false, reason: "none" };
    if (game.player.capital < due) return { ok: false, reason: "capital" };
    game.player.capital -= due;
    game.world.loan = 0;
    pushLog(game, "+ Loan cleared.");
    game.rev += 1;
    return { ok: true };
  }

  function deliver(game, now) {
    ensureLife(game);
    var phase = phaseAt(now).id;
    if (game.world.deliverPhase === phase) return { ok: false, reason: "phase" };
    game.world.deliverPhase = phase;
    game.player.capital += 6;
    game.player.stress = clampStat(game.player.stress + 3);
    pushLog(game, "+ Delivery dropped. A little cash, a little stress.");
    game.rev += 1;
    return { ok: true };
  }

  function cater(game) {
    ensureLife(game);
    if (game.world.catered) return { ok: false, reason: "once" };
    if (game.player.capital < 20) return { ok: false, reason: "capital" };
    game.player.capital -= 20;
    game.player.capital += 48;
    game.world.catered = true;
    game.world.showing = "";
    pushLog(game, "+ Catering contract paid out.");
    game.rev += 1;
    return { ok: true };
  }

  function setMenu(game, level) {
    ensureLife(game);
    level = Number(level);
    if (level < 1 || level > 3) return { ok: false, reason: "level" };
    game.world.menu.price = level;
    pushLog(game, "+ Menu price is " + level + ".");
    game.rev += 1;
    return { ok: true, price: level };
  }

  function layLow(game, now) {
    ensureLife(game);
    if (!game.flags || !game.flags.shady) return { ok: false, reason: "shady" };
    if (now - (game.layAt || 0) < 3000) return { ok: false, reason: "cooldown" };
    game.layAt = now;
    game.player.heat = Math.max(0, (game.player.heat || 0) - 8);
    game.player.stress = clampStat(game.player.stress - 4);
    game.world.showing = "";
    pushLog(game, "You laid low. Heat eased.");
    game.rev += 1;
    return { ok: true, heat: game.player.heat };
  }

  function payFine(game) {
    ensureLife(game);
    if (!(game.player.heat > 0)) return { ok: false, reason: "none" };
    if (game.player.capital < 10) return { ok: false, reason: "capital" };
    game.player.capital -= 10;
    game.player.heat = Math.max(0, game.player.heat - 12);
    game.world.showing = "";
    pushLog(game, "+ Fine paid. Heat dropped.");
    game.rev += 1;
    return { ok: true, heat: game.player.heat };
  }

  function buyQuiet(game) {
    ensureLife(game);
    if (!game.flags || !game.flags.shady || !game.player.place.owned) return { ok: false, reason: "locked" };
    if (game.world.quietRoom) return { ok: false, reason: "owned" };
    if (game.player.capital < 28) return { ok: false, reason: "capital" };
    game.player.capital -= 28;
    game.world.quietRoom = true;
    game.world.showing = "";
    pushLog(game, "+ The quiet room is on the books.");
    game.rev += 1;
    return { ok: true };
  }

  function takePartner(game) {
    ensureLife(game);
    if (game.world.partner) return { ok: false, reason: "active" };
    game.world.partner = true;
    game.world.showing = "";
    pushLog(game, "+ A partner is in. They take a cut of the shift.");
    game.rev += 1;
    return { ok: true };
  }

  function betrayPartner(game, rng) {
    ensureLife(game);
    if (!game.world.partner) return { ok: false, reason: "none" };
    var roll = rng ? rng() : 1;
    if (roll < 0.2) {
      game.world.partner = false;
      game.player.capital = Math.max(0, game.player.capital - 10);
      pushLog(game, "! Your partner walked off with a cut.");
      game.rev += 1;
      return { ok: true, betrayed: true };
    }
    return { ok: true, betrayed: false };
  }

  function seraFavor(game) {
    ensureLife(game);
    var reg = game.world.regular;
    if (!reg || (reg.mood || 0) < 3) return { ok: false, reason: "mood" };
    if (game.world.favorYear === game.player.level) return { ok: false, reason: "year" };
    game.world.favorYear = game.player.level;
    game.player.capital += 8;
    game.world.showing = "";
    pushLog(game, "+ " + reg.name + " did you a favor.");
    game.rev += 1;
    return { ok: true };
  }

  function councilPay(game) {
    ensureLife(game);
    if (game.player.capital < 15) return { ok: false, reason: "capital" };
    game.player.capital -= 15;
    game.world.signMuted = 0;
    game.world.councilYear = game.player.level;
    game.world.showing = "";
    pushLog(game, "+ Council fee paid. The sign stays loud.");
    game.rev += 1;
    return { ok: true };
  }

  function councilMute(game) {
    ensureLife(game);
    game.world.signMuted = (game.player.shifts || 0) + 5;
    game.world.councilYear = game.player.level;
    game.world.showing = "";
    pushLog(game, "+ The sign goes quiet for a while.");
    game.rev += 1;
    return { ok: true };
  }

  function payInspect(game) {
    ensureLife(game);
    var fine = game.world.insured ? 4 : 8;
    if (game.player.capital < fine) return { ok: false, reason: "capital" };
    game.player.capital -= fine;
    game.world.seen.inspect = game.player.level;
    game.world.showing = "";
    pushLog(game, "+ Inspection fine paid. " + money(fine) + ".");
    game.rev += 1;
    return { ok: true };
  }

  function openNightMarket(game) {
    ensureLife(game);
    if ((game.player.visibility || 0) < 40) return { ok: false, reason: "visibility" };
    if (game.world.nightMarket) return { ok: false, reason: "open" };
    game.world.nightMarket = true;
    game.world.showing = "";
    pushLog(game, "+ Night market is open.");
    game.rev += 1;
    return { ok: true };
  }

  function moveDistrict(game, id) {
    ensureLife(game);
    if (id !== "campus" && id !== "downtown" && id !== "night") return { ok: false, reason: "district" };
    if (game.world.district === id) return { ok: false, reason: "same" };
    if (game.player.capital < 15) return { ok: false, reason: "capital" };
    game.player.capital -= 15;
    game.world.district = id;
    game.world.showing = "";
    pushLog(game, "+ The corner sits in " + id + ".");
    game.rev += 1;
    return { ok: true };
  }

  function retire(game) {
    ensureLife(game);
    game.world.retired = true;
    game.world.showing = "";
    pushLog(game, "* Retired. The save stays where it is.");
    game.rev += 1;
    return { ok: true, retired: true };
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
      world: game.world,
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
    if (data.world) game.world = data.world;
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

  function slotKey(slot) {
    if (slot === 1 || slot === "b" || slot === "B") return D.SAVE_KEY + ".b";
    return D.SAVE_KEY;
  }

  function saveSlot(game, storage, slot) {
    storage.setItem(slotKey(slot), JSON.stringify(toJSON(game)));
  }

  function loadSlot(now, storage, slot) {
    try {
      var raw = storage.getItem(slotKey(slot));
      if (!raw) return fresh(now);
      return fromJSON(JSON.parse(raw), now);
    } catch (err) {
      return fresh(now);
    }
  }

  function reset(game, now) {
    var settings = {
      highFX: game.settings.highFX,
      fpsCap: game.settings.fpsCap,
      performanceMode: game.settings.performanceMode,
      muted: !!game.settings.muted,
      clock: game.settings.clock === 0 || game.settings.clock === 2 ? game.settings.clock : 1
    };
    var next = fresh(now);
    next.settings = settings;
    return next;
  }

  function memoryClause(game) {
    if (!game) return "";
    ensureLife(game);
    var w = game.world || {};
    var reg = w.regular;
    if (reg && (reg.visits || 0) > 0) return "Visit " + reg.visits;
    var emp = slotEmployee(game);
    if (emp && emp.mood != null) return "Mood " + emp.mood;
    if ((w.behind || 0) > 0) return "Rent is " + w.behind + " behind";
    if (w.rival) return w.rival + " is across the street";
    return "";
  }

  function attachMemory(line, game) {
    var clause = memoryClause(game);
    if (!clause || !line) return line || "";
    var low = String(line).toLowerCase();
    var bit = clause.toLowerCase();
    if (low.indexOf(bit) >= 0) return line;
    if (bit.indexOf("visit") === 0 && low.indexOf("visit") >= 0) return line;
    if (bit.indexOf("mood") === 0 && low.indexOf("mood") >= 0) return line;
    if (bit.indexOf("rent is") === 0 && (low.indexOf("behind") >= 0 || low.indexOf("rent is") >= 0)) return line;
    if (bit.indexOf("across the street") >= 0 && low.indexOf("across") >= 0) return line;
    var base = String(line).replace(/\s+$/, "");
    if (base.charAt(base.length - 1) === ".") return base + " " + clause + ".";
    return base + ". " + clause + ".";
  }

  function cleanShopName(text) {
    var s = String(text == null ? "" : text).replace(/[\u0000-\u001F\u007F]/g, "");
    s = s.replace(/\s+/g, " ").trim();
    if (s.length > 22) s = s.slice(0, 22).trim();
    return s;
  }

  function setShopName(game, slotIndex, text) {
    ensureLife(game);
    ensureSlots(game);
    var index = slotIndex == null ? 0 : Number(slotIndex);
    var slot = game.slots[index];
    if (!slot) return { ok: false, reason: "slot" };
    var next = cleanShopName(text);
    if (!next) return { ok: false, reason: "empty" };
    if (next === slot.name) return { ok: true, name: next, same: true };
    slot.name = next;
    if (index === 0) {
      if (game.player.place) game.player.place.name = next;
      game.player.shop = next === "The Corner" ? "" : next;
    }
    pushLog(game, "+ The shop is " + next + ".");
    game.rev += 1;
    return { ok: true, name: next };
  }

  function setDoor(game, open, now) {
    ensureLife(game);
    var shut = !open;
    var hours = game.world.hours;
    if (!!game.player.place.shut === shut && ((open && hours === "open") || (!open && hours === "closed"))) {
      return { ok: false, reason: "same" };
    }
    var res = setHours(game, open ? "open" : "closed", now || game.lastReal || 0);
    game.player.place.shut = shut;
    if (!res || res.ok === false) return res;
    return { ok: true, shut: shut, hours: game.world.hours };
  }

  function sleepLine(game, phase) {
    ensureLife(game);
    var open = !!(game.flags && game.flags.opened) && shopOpen(game);
    var slot = game.slots && game.slots[0];
    var stock = slot ? (slot.stock || 0) : 0;
    var name = (slot && slot.name) || "The shop";
    var bits = [(phase && phase.name) || "Watch"];
    bits[0] += ".";
    bits.push(open ? "The shop is open." : "The shop is closed.");
    bits.push(money(game.player.capital || 0) + " in the drawer.");
    bits.push(stock + " on the shelf.");
    if (slot && slot.employee && slot.employee.name) bits.push(slot.employee.name + " is hired.");
    bits.push(name + ".");
    return bits.join(" ");
  }

  function anchorMorning(ms) {
    var d = new Date(ms);
    d.setHours(7, 0, 0, 0);
    return d.getTime();
  }

  function sleepPlan(fromMs) {
    var skipped = [];
    var cursor = fromMs || 0;
    var last = phaseAt(cursor).id;
    var startMorning = last === "morning";
    var moved = false;
    var guard = 0;
    var land = anchorMorning(cursor + (startMorning ? 20 * 3600000 : 0));
    while (guard < 160) {
      cursor += 15 * 60000;
      guard += 1;
      var ph = phaseAt(cursor);
      if (ph.id === last) continue;
      if (ph.id === "morning" && (moved || !startMorning)) {
        land = anchorMorning(cursor);
        break;
      }
      last = ph.id;
      moved = true;
      if (ph.id !== "morning") skipped.push({ id: ph.id, name: ph.name });
    }
    return { skipped: skipped, land: land };
  }

  function sleepToMorning(game, fromMs) {
    ensureLife(game);
    var before = game.player.capital;
    var plan = sleepPlan(fromMs || game.lastReal || 0);
    var i;
    for (i = 0; i < plan.skipped.length; i++) pushLog(game, sleepLine(game, plan.skipped[i]));
    return {
      ok: true,
      land: plan.land,
      skipped: plan.skipped.length,
      capital: game.player.capital,
      same: game.player.capital === before
    };
  }

  function dayLedger(game) {
    ensureLife(game);
    var inn = 0;
    var out = 0;
    var i;
    for (i = 0; i < (game.logN || 0); i++) {
      var text = String(logLine(game, i) || "");
      var amt = moneyIn(text);
      if (amt == null) continue;
      var n = Math.abs(Math.round(amt));
      if (!n) continue;
      var low = text.toLowerCase();
      var incoming = low.indexOf("took in") >= 0 || low.indexOf("shift paid") >= 0 || low.indexOf("hobby paid") >= 0 || low.indexOf("scout returned") >= 0 || low.indexOf("got a raise") >= 0;
      var outgoing = low.indexOf("rented the corner") >= 0 || low.indexOf("paid the landlord") >= 0 || low.indexOf("night class") >= 0 || low.indexOf("costs") >= 0 || low.indexOf("unexplained loss") >= 0 || low.indexOf("loss ") >= 0;
      if (incoming && !outgoing) inn += n;
      else if (outgoing && !incoming) out += n;
    }
    return { inn: inn, out: out, left: Math.round(game.player.capital || 0), from: "log" };
  }

  function chapterNow(game) {
    ensureLife(game);
    var hired = false;
    var i;
    var slots = game.slots || [];
    for (i = 0; i < slots.length; i++) if (slots[i] && slots[i].employee) hired = true;
    if (game.world.floor) return { id: "floor", label: "Floor owned" };
    if (game.world.rival) return { id: "rival", label: "Rival on the block" };
    if (hired) return { id: "hire", label: "First hire" };
    if (game.flags && game.flags.opened) return { id: "shift", label: "First shift" };
    return { id: "bare", label: "Bare corner" };
  }

  function noteChapter(game) {
    var ch = chapterNow(game);
    if (!game.world.chapterTold) game.world.chapterTold = {};
    if (ch.id === "bare" || game.world.chapterTold[ch.id]) return ch;
    game.world.chapterTold[ch.id] = true;
    pushLog(game, ch.label + ".");
    return ch;
  }

  function rushCrowd(phase) {
    if (!phase) return 0;
    if (phase.id !== "morning" && phase.id !== "lunch" && phase.id !== "evening") return 0;
    var r = phase.revenue || 0;
    if (r >= 1.6) return 3;
    if (r >= 1.2) return 2;
    return 1;
  }

  function registerWatch(game) {
    ensureLife(game);
    if (hireAtRegister(game)) {
      var emp = slotEmployee(game);
      return { id: "hire", name: emp && emp.name ? emp.name : "Hire" };
    }
    if (!registerCovered(game)) return { id: "nobody", name: "Nobody" };
    return { id: "you", name: "You" };
  }

  root.VoidSim = {
    xpNeed: xpNeed,
    money: money,
    phaseAt: phaseAt,
    clockLabel: clockLabel,
    dayVoice: dayVoice,
    phaseVoice: phaseVoice,
    describeLine: describeLine,
    noteDay: noteDay,
    moneyIn: moneyIn,
    fresh: fresh,
    frame: frame,
    workShift: workShift,
    workHobby: workHobby,
    hobbyOpen: hobbyOpen,
    buyRoom: buyRoom,
    upgradeRoom: upgradeRoom,
    payRent: payRent,
    stallRent: stallRent,
    buyFloor: buyFloor,
    compRegular: compRegular,
    greetRegular: greetRegular,
    currentLifeId: currentLifeId,
    nextSpend: nextSpend,
    seraWantId: seraWantId,
    lifeBeat: lifeBeat,
    heatQuote: heatQuote,
    hireAtRegister: hireAtRegister,
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
    saveSlot: saveSlot,
    loadSlot: loadSlot,
    reset: reset,
    setShop: setShop,
    renameShop: renameShop,
    cycleShop: cycleShop,
    setUpstairs: setUpstairs,
    sendUpstairs: sendUpstairs,
    setHours: setHours,
    makeTruce: makeTruce,
    takeClass: takeClass,
    claimLot: claimLot,
    payBill: payBill,
    buyInsurance: buyInsurance,
    takeLoan: takeLoan,
    payLoan: payLoan,
    deliver: deliver,
    cater: cater,
    setMenu: setMenu,
    layLow: layLow,
    payFine: payFine,
    buyQuiet: buyQuiet,
    takePartner: takePartner,
    betrayPartner: betrayPartner,
    seraFavor: seraFavor,
    councilPay: councilPay,
    councilMute: councilMute,
    payInspect: payInspect,
    openNightMarket: openNightMarket,
    moveDistrict: moveDistrict,
    retire: retire,
    calendarLine: calendarLine,
    rentAmount: rentAmount,
    rivalLunchMult: rivalLunchMult,
    districtLunchMult: districtLunchMult,
    menuGrossMult: menuGrossMult,
    nightBump: nightBump,
    wagePrefMult: wagePrefMult,
    signLift: signLift,
    toJSON: toJSON,
    bookHas: bookHas,
    ensureSlots: ensureSlots,
    resolveCycle: resolveCycle,
    runBusiness: runBusiness,
    tickBlock: tickBlock,
    personPlace: personPlace,
    stand: stand,
    grammarLine: grammarLine,
    juniperWinning: juniperWinning,
    registerCovered: registerCovered,
    shopOpen: shopOpen,
    cleanShopName: cleanShopName,
    setShopName: setShopName,
    setDoor: setDoor,
    sleepToMorning: sleepToMorning,
    sleepPlan: sleepPlan,
    dayLedger: dayLedger,
    chapterNow: chapterNow,
    rushCrowd: rushCrowd,
    registerWatch: registerWatch,
    memoryClause: memoryClause
  };
})(typeof window !== "undefined" ? window : globalThis);
