"use strict";

var fs = require("fs");
var path = require("path");

global.window = global;
eval(fs.readFileSync(path.join(__dirname, "../js/data.js"), "utf8"));
eval(fs.readFileSync(path.join(__dirname, "../js/pairs.js"), "utf8"));
eval(fs.readFileSync(path.join(__dirname, "../js/sim.js"), "utf8"));

var D = global.VoidData;
var S = global.VoidSim;
var fails = 0;
var ok = 0;

function assert(cond, msg) {
  if (!cond) {
    fails += 1;
    console.error("FAIL " + msg);
  } else {
    ok += 1;
  }
}

function lastLog(game) {
  return S.logLine(game, game.logN - 1);
}

(function recipes() {
  assert(D.RECIPES.length === 40, "expected 40 recipes, got " + D.RECIPES.length);
  var seen = {};
  var i;
  for (i = 0; i < D.RECIPES.length; i++) {
    var rec = D.RECIPES[i];
    assert(!seen[rec.key], "duplicate recipe " + rec.key);
    seen[rec.key] = true;
    assert(D.itemById[rec.idea].cat === "idea", rec.key + " idea");
    assert(D.itemById[rec.staff].cat === "staff", rec.key + " staff");
    assert(D.itemById[rec.marketing].cat === "marketing", rec.key + " marketing");
    assert(D.itemById[rec.asset].cat === "asset", rec.key + " asset");
  }
})();

(function phases() {
  var d = new Date();
  d.setHours(8, 0, 0, 0);
  assert(S.phaseAt(d.getTime()).id === "morning", "morning");
  d.setHours(12, 30, 0, 0);
  assert(S.phaseAt(d.getTime()).id === "lunch", "lunch");
  assert(S.phaseAt(d.getTime()).revenue === 1.7, "lunch revenue");
  d.setHours(2, 0, 0, 0);
  assert(S.phaseAt(d.getTime()).id === "night", "night");
})();

(function hybrid() {
  var legend = S.combine("grease", "trainee", "chalk", "fryer");
  assert(legend.legendary && legend.name === "Corner Dynasty", "legendary name");
  var mix = S.combine("grease", "trainee", "chalk", "kiosk");
  assert(!mix.legendary, "mismatch is hybrid");
  var avg = D.itemById.grease.power * D.W_IDEA
    + D.itemById.trainee.power * D.W_STAFF
    + D.itemById.chalk.power * D.W_MKT
    + D.itemById.kiosk.power * D.W_ASSET;
  assert(Math.abs(mix.power - (avg + avg * D.SYNERGY)) < 1e-9, "11.5% synergy power");
  assert(Math.abs(D.SYNERGY - 0.115) < 1e-12, "synergy constant");
  assert(mix.name === "Greasefire-Trainee ChalkKiosk", "concat name " + mix.name);
})();

(function levelAndBargain() {
  var now = Date.now();
  var game = S.fresh(now);
  var vp = game.player.vp;
  game.player.xp = S.xpNeed(1) - 1;
  var shift = S.workShift(game, now);
  assert(shift.ok, "shift");
  assert(game.player.level === 2, "leveled");
  assert(game.player.vp === vp + 1, "one void point");

  var zero = function () { return 0; };
  var card = S.rollResume(game, zero);
  assert(card.traits.indexOf("fingers") >= 0, "hidden trait rolled");
  assert(card.ask > card.floor, "floor below ask");
  var a = S.counterOffer(game, card.id, 1);
  var b = S.counterOffer(game, card.id, 1);
  var c = S.counterOffer(game, card.id, 1);
  assert(a.reason === "reject" && a.strikes === 1, "strike 1");
  assert(b.strikes === 2, "strike 2");
  assert(c.reason === "destroyed" && card.dying, "third rejection destroys");
  assert(S.sweepDead(game) === 1, "card leaves the array");
  assert(game.resumes.length === 0, "resume array empty");

  var card2 = S.rollResume(game, zero);
  var hired = S.counterOffer(game, card2.id, card2.floor);
  assert(hired.ok, "floor wage accepted");
  assert(game.slots[0].employee.salary === card2.floor, "locked salary");
  assert(game.resumes.length === 0, "accepted card removed");
})();

(function theft() {
  var now = Date.now();
  var game = S.fresh(now);
  var slot = game.slots[0];
  slot.employee = { name: "Pix Sticky", salary: 12, traits: ["fingers"], caught: false };
  slot.stock = 5;
  slot.camera = false;
  game.player.capital = 180;
  var capital = game.player.capital;
  S.resolveCycle(game, slot, S.phaseAt(now), function () { return 0; });
  assert(slot.stock === 4, "theft consumed stock");
  assert(game.player.capital < capital, "cash loss");
  var text = lastLog(game);
  assert(text.indexOf("discrepancy") >= 0, "discrepancy log");
  assert(text.indexOf("Pix Sticky") < 0, "name hidden without camera");

  slot.camera = true;
  slot.stock = 4;
  S.resolveCycle(game, slot, S.phaseAt(now), function () { return 0; });
  text = lastLog(game);
  assert(text.indexOf("Pix Sticky") >= 0, "camera names the thief");
  assert(slot.employee.caught, "flagged");
})();

(function labAndBook() {
  var now = Date.now();
  var game = S.fresh(now);
  assert(S.jobUnlocked(game, D.jobById.fast_food), "fast food open");
  assert(!S.jobUnlocked(game, D.jobById.marketing), "marketing sealed");
  game.player.vp = 10;
  game.player.level = 6;
  assert(S.unlockNode(game, "poster").ok, "poster");
  assert(S.jobUnlocked(game, D.jobById.marketing), "marketing unlocked");
  assert(!S.unlockNode(game, "charter").ok === false || game.nodes.charter, "charter");
  assert(S.unlockNode(game, "timer").ok, "timer");
  assert(S.unlockNode(game, "camera").ok, "camera node");
  game.player.capital = 20;
  assert(!S.installCamera(game, 0).ok, "camera too expensive at low capital");
  game.player.capital = 400;
  assert(S.installCamera(game, 0).ok && game.slots[0].camera, "camera socketed");
  assert(game.slots.length === 1, "one slot before rack");
  assert(S.unlockNode(game, "rack").ok, "rack");
  assert(game.slots.length === 2, "second slot");

  var made = S.synthesize(game, "grease", "trainee", "chalk", "fryer");
  assert(made.ok, "synthesize legend");
  assert(game.mats.grease === 0, "material consumed");
  assert(S.bookHas(game, "grease|trainee|chalk|fryer"), "cookbook entry");
  game.mats.grease = 1;
  game.mats.trainee = 1;
  game.mats.chalk = 1;
  game.mats.fryer = 1;
  var again = S.synthesize(game, "grease", "trainee", "chalk", "fryer");
  assert(!again.ok, "duplicate refused");
  assert(game.mats.grease === 1, "materials refunded");

  var other = S.fresh(now);
  other.mats.kiosk = 1;
  other.book.push("grease|trainee|chalk|kiosk");
  var crafted = S.craftFromBook(other, "grease|trainee|chalk|kiosk");
  assert(crafted.ok, "cookbook craft");
  assert(other.mats.kiosk === 0, "kiosk consumed");
  assert(!crafted.result.legendary, "hybrid craft");

  var vp = game.player.vp;
  var books = game.book.length;
  assert(S.research(game).ok, "research");
  assert(game.player.vp === vp - 1, "vp spent");
  assert(game.book.length === books + 1, "recipe documented");
})();

(function clockAndSave() {
  var now = 1_700_000_000_000;
  var game = S.fresh(now);
  game.player.capital = 500;
  assert(S.enroll(game, "cert", now).ok, "enroll");
  var left = game.degree.left;
  S.frame(game, now + 10000);
  assert(game.degree && game.degree.left < left, "degree follows device clock");
  game.slots[0].stock = 6;
  game.slots[0].employee = null;
  S.runBusiness(game, now, 5000, function () { return 0.99; });
  assert(game.slots[0].stock < 6, "cycles consume stock");

  var mem = {};
  var storage = {
    getItem: function (k) { return mem[k] || null; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; }
  };
  game.player.capital = 321;
  game.settings.fpsCap = 30;
  game.settings.performanceMode = true;
  S.save(game, storage);
  var loaded = S.load(now + 5000, storage);
  assert(Math.round(loaded.player.capital) === 321, "capital saved");
  assert(loaded.settings.fpsCap === 30, "fps saved");
  assert(loaded.settings.performanceMode === true, "perf saved");
  assert(loaded.degree && loaded.degree.id === "cert", "degree saved");
  loaded.grad = { ba: true };
  loaded.space = 40;
  loaded.fx.sugarUntil = 99;
  S.save(loaded, storage);
  var again = S.load(now + 8000, storage);
  assert(again.grad.ba === true, "grad saved");
  assert(again.space === 40, "space saved");
  assert(again.fx.sugarUntil === 99, "fx saved");
  assert(again.player.rp != null, "rp restored");
})();

(function engines() {
  assert(D.PAIRS.length === 40, "40 pair recipes");
  var seen = {};
  var i;
  for (i = 101; i <= 140; i++) seen[i] = false;
  for (i = 0; i < D.PAIRS.length; i++) {
    assert(seen[D.PAIRS[i].id] === false, "duplicate pair " + D.PAIRS[i].id);
    seen[D.PAIRS[i].id] = true;
  }
  for (i = 101; i <= 140; i++) assert(seen[i], "missing pair " + i);
  assert(S.xpNeed(1) === 500, "xp curve level 1");
  assert(Math.abs(S.xpNeed(2) - 500 * Math.pow(2, 1.5)) < 1e-9, "xp curve level 2");

  var now = Date.now();
  var game = S.fresh(now);
  var xp = S.xpNeed(1) - 1;
  game.player.xp = xp;
  assert(S.workShift(game, now).ok, "shift into level");
  assert(game.player.level === 2, "level incremented");
  assert(game.player.xp === xp + 22, "lifetime xp kept");
  var dumped = "";
  for (i = 0; i < game.logN; i++) dumped += S.logLine(game, i);
  assert(dumped.indexOf("Next XP threshold") >= 0, "threshold logged");

  var ba = S.fresh(now);
  ba.player.xp = 5000 - 22;
  S.workShift(ba, now);
  assert(ba.grad.ba, "business administration");
  assert(!ba.grad.pr, "pr still sealed at 5000");
  var rolls = 0;
  while (S.rollResume(ba, function () { return 0; }) && rolls < 8) rolls += 1;
  assert(ba.resumes.length === 5, "resume board is 5");

  var pr = S.fresh(now);
  pr.player.xp = 6000 - 22;
  S.workShift(pr, now);
  assert(pr.grad.pr, "public relations");
  var cs = S.fresh(now);
  cs.player.xp = 7500 - 22;
  S.workShift(cs, now);
  assert(cs.grad.cs && cs.grad.ba && cs.grad.pr, "computer science");

  var clock = new Date();
  clock.setHours(8, 0, 0, 0);
  var at8 = clock.getTime();
  var hour = 8;
  var expect = 10 * (1 + Math.sin(hour * Math.PI / 12) * 0.4 + Math.cos(hour * Math.PI / 4) * 0.6);
  assert(S.volatilityFactor(at8) === 0.6, "opening volatility");
  assert(Math.abs(S.tickerPrice(10, at8) - Math.max(1, expect)) < 1e-9, "ticker equation");
  clock.setHours(12, 0, 0, 0);
  assert(S.volatilityFactor(clock.getTime()) === 0.1, "lunch volatility");
  clock.setHours(14, 30, 0, 0);
  assert(S.volatilityFactor(clock.getTime()) === 0.75, "afternoon volatility");
  clock.setHours(16, 0, 0, 0);
  assert(S.volatilityFactor(clock.getTime()) === 0, "off-window volatility");

  var hijack = S.combine("blueprint", "viral", "chalk", "fryer");
  assert(hijack && hijack.rid === 101 && hijack.name === "Lunchtime Hijack", "pair 101");
  assert(hijack.spend.length === 2 && hijack.spend.indexOf("chalk") < 0, "pair ignores fillers");
  var still = S.combine("grease", "trainee", "chalk", "fryer");
  assert(still.legendary && still.name === "Corner Dynasty", "legacy recipe kept");

  var lab = S.fresh(now);
  lab.mats.blueprint = 1;
  lab.mats.viral = 1;
  var made = S.synthesize(lab, "blueprint", "viral", null, null);
  assert(made.ok && made.result.rid === 101, "synthesize pair");
  assert(lab.mats.blueprint === 0 && lab.mats.viral === 0 && lab.mats.chalk === 1, "only pair parts spent");
  lab.mats.temp = 1;
  lab.mats.license = 1;
  lab.lastReal = now + 5000;
  var deal = S.synthesize(lab, "temp", "license", null, null);
  assert(deal.ok && deal.result.rid === 107, "under-counter before smuggling");
  lab.mats.temp = 1;
  lab.mats.license = 1;
  lab.lastReal = now + 12000;
  var smug = S.synthesize(lab, "temp", "license", null, null);
  assert(smug.ok && smug.result.rid === 139, "smuggling grid second");
  lab.mats.temp = 1;
  lab.mats.license = 1;
  var third = S.synthesize(lab, "temp", "license", null, null);
  assert(!third.ok && third.reason === "duplicate", "both pair ids filed");
  assert(lab.mats.temp === 1, "duplicate kept materials");
})();

(function lifeStart() {
  var now = Date.now();
  var game = S.fresh(now);
  assert(game.player.capital === 0, "start broke");
  assert(game.flags.opened === false, "shop waits");
  S.frame(game, now + 8000);
  assert(game.player.capital === 0, "no sales before a choice");
  assert(!game.flags.shady, "shady starts off");
  assert(!S.skim(game, now).ok, "skim locked");
  assert(S.workHobby(game, now).ok, "hobby pays");
  assert(game.player.skills.mind === 1, "mind skill");
  assert(game.player.capital > 0, "hobby cash");
  assert(game.flags.opened === false, "hobby leaves the counter closed");
  var hobbyCash = game.player.capital;
  S.frame(game, now + 16000);
  assert(game.player.capital === hobbyCash, "no sales after a hobby");
  var shift = S.workShift(game, now);
  assert(shift.ok && game.player.skills.work === 1, "work skill");
  game.player.vp = 4;
  assert(S.unlockNode(game, "shady_open").ok, "street sense");
  assert(game.flags.shady, "shady wakes");
  assert(!S.score(game, now).ok, "score still locked");
  assert(S.unlockNode(game, "skim").ok, "skim node");
  var before = game.player.capital;
  var paid = S.skim(game, now, function () { return 0.99; });
  assert(paid.ok && game.player.capital > before, "skim pays");
  assert(game.player.heat > 0, "heat climbs");
  var bust = S.skim(game, now + 1000, function () { return 0; });
  assert(!bust.ok && bust.reason === "busted", "skim can bust");
})();

(function roomAndSkills() {
  var now = Date.now();
  var game = S.fresh(now);
  assert(!S.jobUnlocked(game, D.jobById.counter_lead), "lead sealed");
  assert(!S.buyRoom(game).ok, "rent needs cash");
  assert(S.workHobby(game, now, "tutor").ok, "tutor");
  assert(!S.workHobby(game, now, "stream").ok, "stream sealed");
  var i;
  for (i = 0; i < 4; i++) assert(S.workShift(game, now + 1000 * (i + 1)).ok, "shift " + i);
  assert(game.player.skills.work >= 4, "work skill");
  assert(S.jobUnlocked(game, D.jobById.counter_lead), "lead earned");
  game.player.capital = 40;
  assert(S.buyRoom(game).ok && game.player.place.owned, "corner rented");
  assert(game.player.capital === 0, "rent spent");
  game.player.capital = 25;
  assert(S.upgradeRoom(game, "lights").ok && game.player.place.lights, "lights in");
  var slow = S.fresh(now);
  slow.flags.opened = true;
  slow.slots[0].stock = 6;
  S.runBusiness(slow, now, 5000, function () { return 0.99; });
  assert(slow.slots[0].stock === 5, "one sale in five seconds");
})();

(function lifeDeck() {
  var now = Date.now();
  var game = S.fresh(now);
  game.player.capital = 200;
  assert(S.buyRoom(game).ok, "room for rent");
  game.player.xp = S.xpNeed(1) - 1;
  assert(S.workShift(game, now).ok, "shift into rent year");
  assert(game.player.level === 2, "year turned");
  assert(game.world.rentDue === 18 + 2 * 6, "landlord wants rent");
  var before = game.player.capital;
  assert(S.payRent(game).ok, "rent paid");
  assert(game.world.rentDue === 0, "rent cleared");
  assert(game.player.capital === before - (18 + 12), "rent cash");
  game.player.capital = 120;
  assert(S.buyFloor(game).ok && game.world.floor === 1, "second floor");

  var people = S.fresh(now);
  var s;
  for (s = 0; s < 3; s++) assert(S.workShift(people, now + 1000 * (s + 1)).ok, "shift for a regular");
  assert(people.world.regular && people.world.regular.name === "Sera Keel", "regular remembers");
  assert(S.compRegular(people).ok, "comp");
  assert(people.world.regular.mood === 2, "mood up");
  people.player.capital = 80;
  assert(S.buyRoom(people).ok, "their corner");
  for (s = 0; s < 3; s++) assert(S.workShift(people, now + 5000 * (s + 1)).ok, "more shifts");
  assert(people.world.rival === "Juniper Pike", "rival across the street");
  assert(S.currentLifeId(people, now) === "rival", "rival card wins");
  var beat = S.lifeBeat(people, "rival");
  assert(beat && beat.stamp === "RIVAL" && beat.line.indexOf("Juniper") >= 0, "rival copy");

  var day = S.fresh(now);
  day.flags.opened = true;
  S.frame(day, now + 1000);
  assert(day.world.showing, "a year card is up");
  assert(S.lifeBeat(day, day.world.showing).label, "card has a choice");
})();

function allLogs(game) {
  var out = "";
  var i;
  for (i = 0; i < game.logN; i++) out += (S.logLine(game, i) || "") + "\n";
  return out;
}

function countText(game, text) {
  var n = 0;
  var i;
  var line;
  for (i = 0; i < game.logN; i++) {
    line = S.logLine(game, i) || "";
    if (line.indexOf(text) >= 0) n += 1;
  }
  return n;
}

function memStorage() {
  var mem = {};
  return {
    mem: mem,
    getItem: function (k) { return mem[k] || null; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; }
  };
}

(function featurePass() {
  var now = 1_750_000_000_000;
  var freshGame = S.fresh(now);
  assert(freshGame.player.capital === 0, "feature fresh capital");
  assert(S.workShift(freshGame, now).ok, "fresh shift is not locked");

  assert(D.SHOPS.length === 3, "three shop names");
  var named = S.fresh(now);
  assert(S.setShop(named, 0).ok && named.player.shop === "Greasefire", "shop 0");
  assert(S.setShop(named, 1).ok && named.player.shop === "Neon Nook", "shop 1");
  assert(S.setShop(named, 2).ok && named.player.shop === "Orbit Counter", "shop 2");
  assert(!S.setShop(named, 9).ok, "shop reject");
  assert(S.cycleShop(named).page === 1, "shop cycles");
  var yearLine = S.lifeBeat(named, "year_open").line;
  assert(yearLine.indexOf("Orbit Counter") >= 0, "fill shop");
  assert(yearLine.indexOf("spring") >= 0, "fill season");
  assert(S.lifeBeat(named, "shopname").label, "shop card");

  var bare = S.fresh(now);
  bare.player.capital = 80;
  assert(S.buyRoom(bare).ok, "bare room");
  bare.player.xp = S.xpNeed(1) - 1;
  assert(S.workShift(bare, now).ok, "bare level");
  assert(bare.world.rentDue === 18 + bare.player.level * 6, "bare rent unchanged");

  var lit = S.fresh(now);
  lit.player.capital = 80;
  assert(S.buyRoom(lit).ok, "lit room");
  assert(S.upgradeRoom(lit, "lights").ok, "lit lights");
  lit.player.xp = S.xpNeed(1) - 1;
  assert(S.workShift(lit, now).ok, "lit level");
  assert(lit.world.rentDue > 18 + lit.player.level * 6, "upgrades bump rent");

  var locked = S.fresh(now);
  locked.player.capital = 40;
  assert(S.buyRoom(locked).ok, "lock room");
  locked.world.rentDue = 5;
  locked.player.capital = 0;
  assert(S.stallRent(locked).ok && S.stallRent(locked).ok && S.stallRent(locked).ok, "three stalls");
  assert(locked.player.place.lights === 0, "lights taken");
  assert(locked.world.locked >= 3, "locked nights");
  var blocked = S.workShift(locked, now);
  assert(!blocked.ok && blocked.reason === "locked", "shift blocked");
  locked.player.capital = 20;
  assert(S.payRent(locked).ok, "rent clears lock");
  assert(locked.world.locked === 0, "lock cleared");
  assert(S.workShift(locked, now + 1000).ok, "shift after rent");

  var lease = S.fresh(now);
  lease.player.capital = 40;
  assert(S.buyRoom(lease).ok, "lease room");
  assert(lease.world.deed === "renting", "deed renting");
  var payN;
  lease.player.capital = 30;
  for (payN = 0; payN < 3; payN++) {
    lease.world.rentDue = 5;
    assert(S.payRent(lease).ok, "lease pay " + payN);
  }
  assert(lease.world.deed === "mortgage", "three rents advance deed");

  var owned = S.fresh(now);
  owned.player.capital = 200;
  assert(S.buyRoom(owned).ok && S.buyFloor(owned).ok, "buy floor");
  assert(owned.world.floor === 1 && owned.world.upstairs === "none", "upstairs empty");
  assert(owned.world.deed === "owned", "floor owns the deed");
  assert(owned.world.goals.floor && owned.world.milestones.floor, "floor goal and milestone");
  assert(countText(owned, "Milestone: the floor.") === 1, "floor milestone once");

  var tutor = S.fresh(now);
  var office = S.fresh(now);
  var plain = S.fresh(now);
  tutor.world = { floor: 1, upstairs: "tutor", seen: {} };
  office.world = { floor: 1, upstairs: "office", seen: {} };
  var hobbyPlain = S.workHobby(plain, now);
  var hobbyTutor = S.workHobby(tutor, now);
  assert(hobbyTutor.ok && hobbyTutor.pay === hobbyPlain.pay + 3, "tutor upstairs pays");
  var shiftPlain = S.workShift(plain, now + 1000);
  var shiftOffice = S.workShift(office, now);
  assert(shiftOffice.ok && shiftOffice.pay === shiftPlain.pay + 3, "office upstairs pays");
  assert(!S.setUpstairs(plain, "tutor").ok, "upstairs needs floor");
  assert(S.setUpstairs(tutor, "office").ok && tutor.world.upstairs === "office", "pick office");

  owned.player.capital = 80;
  assert(S.upgradeRoom(owned, "cooler").ok && owned.player.place.cooler === 1, "cooler");
  assert(S.upgradeRoom(owned, "safe").ok && owned.player.place.safe === 1, "safe");
  assert(S.upgradeRoom(owned, "speaker").ok && owned.player.place.speaker === 1, "speaker");
  assert(S.upgradeRoom(owned, "plant").ok && owned.player.place.plant === 1, "plant");
  assert(S.upgradeRoom(owned, "neon").ok && owned.player.place.neon === 1, "neon");

  var people = S.fresh(now);
  var s;
  for (s = 0; s < 8; s++) assert(S.workShift(people, now + s * 1000).ok, "people shift " + s);
  assert(people.world.regular.name === "Sera Keel", "sera stays the regular");
  assert(people.world.regulars.length >= 3, "regulars array");
  var crew = "";
  var lightReg = null;
  for (s = 0; s < people.world.regulars.length; s++) {
    crew += people.world.regulars[s].name + " ";
    if (people.world.regulars[s].needsLights) lightReg = people.world.regulars[s];
  }
  assert(crew.indexOf("Sera Keel") >= 0 && crew.indexOf("Ivo Amar") >= 0 && crew.indexOf("Vela Hale") >= 0, "regular names");
  assert(lightReg && lightReg.due === false, "lights regular skipped");
  assert(countText(people, "Milestone: first regular.") === 1, "first regular once");
  people.player.place.lights = 1;
  people.player.shifts = 11;
  assert(S.workShift(people, now + 20000).ok, "later visit");
  assert(lightReg.due === true, "lights regular visits");
  var crewBeat = S.lifeBeat(people, "crew");
  assert(crewBeat && crewBeat.line.indexOf("Ivo Amar") >= 0, "crew card");

  var rival = S.fresh(now);
  rival.player.place = { owned: true, lights: 0, sign: 0, counter: 0 };
  rival.world = { rival: "Juniper Pike", seen: {}, truce: false, rivalSign: false };
  assert(S.rivalLunchMult(rival) === 0.82, "no-sign lunch penalty");
  rival.player.place.sign = 1;
  var copied = S.rivalLunchMult(rival);
  assert(rival.world.rivalSign === true, "rival copies sign");
  assert(copied > 0.82 && copied < 1, "copied sign is a smaller penalty");
  assert(S.makeTruce(rival).ok, "truce");
  assert(S.rivalLunchMult(rival) === 1, "truce clears lunch penalty");

  var emp = { pref: "morning" };
  assert(S.wagePrefMult(emp, "morning") === 1, "on preference");
  assert(S.wagePrefMult(emp, "night") > 1, "off preference costs more");
  var hire = S.fresh(now);
  var card = S.rollResume(hire, function () { return 0; });
  var hired = S.counterOffer(hire, card.id, card.floor);
  assert(hired.ok && hire.slots[0].employee.salary === card.floor, "hire salary unchanged");
  var pref = hire.slots[0].employee.pref;
  assert(pref === "morning" || pref === "lunch" || pref === "night", "pref assigned");

  var quitter = S.fresh(now);
  quitter.lastReal = now;
  quitter.player.stress = 95;
  quitter.slots[0].employee = { name: "Ada", salary: 10, traits: ["clock"], caught: false };
  S.frame(quitter, now);
  assert(!quitter.slots[0].employee, "clock quits");
  assert(countText(quitter, "quit") === 1, "quit logged");
  S.frame(quitter, now);
  assert(countText(quitter, "quit") === 1, "quit once");
  var stayer = S.fresh(now);
  stayer.lastReal = now;
  stayer.player.stress = 95;
  stayer.slots[0].employee = { name: "Bea", salary: 10, traits: ["loyal"], caught: false };
  S.frame(stayer, now);
  assert(stayer.slots[0].employee, "no clock, no quit");

  var promo = S.fresh(now);
  promo.player.skills.work = 7;
  assert(S.workShift(promo, now).ok, "promo shift");
  assert(promo.world.promoted && promo.flags.raised, "promoted with the raise");
  assert(countText(promo, "You got a raise.") === 1, "raise not double logged");

  var hobby = S.fresh(now);
  var h;
  for (h = 0; h < 5; h++) assert(S.workHobby(hobby, now + h * 1000).ok, "hobby " + h);
  assert(hobby.world.hobbyShop === "tutor", "hobby shop");
  assert(countText(hobby, "Hobby shop:") === 1, "hobby shop once");
  assert(S.workHobby(hobby, now + 8000).ok, "hobby again");
  assert(countText(hobby, "Hobby shop:") === 1, "hobby shop stays once");

  var runner = S.fresh(now);
  assert(!S.jobUnlocked(runner, D.jobById.runner), "runner sealed");
  runner.player.skills.hustle = 4;
  assert(S.jobUnlocked(runner, D.jobById.runner), "runner opens");
  assert(!S.jobUnlocked(runner, D.jobById.marketing), "marketing still sealed");

  var klass = S.fresh(now);
  klass.player.capital = 20;
  var mind = klass.player.intelligence;
  assert(S.takeClass(klass).ok, "class");
  assert(klass.player.capital === 10, "class cost");
  assert(klass.player.intelligence === mind + 2, "class mind");
  assert(!S.takeClass(klass).ok, "class once a year");

  var lot = S.fresh(now);
  assert(!S.claimLot(lot).ok, "lot needs degree");
  lot.degrees.bach = true;
  assert(S.claimLot(lot).ok && lot.world.secondLot, "second lot marker");
  assert(!S.claimLot(lot).ok, "lot once");

  var scout = S.fresh(now);
  scout.nodes.charter = true;
  scout.player.capital = 100;
  assert(S.dispatchScout(scout, "block").ok, "dispatch");
  scout.scouts[0].left = 100;
  scout.lastReal = now;
  S.frame(scout, now + 10000);
  assert(scout.scouts.length === 0, "scout finished");
  scout.slots[0].camera = true;
  scout.slots[0].stock = 0;
  assert(S.currentLifeId(scout, now + 10000) === "scout_back", "scout card");

  var album = S.fresh(now);
  album.player.xp = S.xpNeed(1) - 1;
  album.world = { regular: { name: "Sera Keel", mood: 2, visits: 2 }, floor: 1, biggestBill: 12, seen: {} };
  assert(S.workShift(album, now).ok, "album shift");
  assert(album.world.album.length === 1 && album.world.album[0] === "Y2", "album grows");
  var albumLog = allLogs(album);
  assert(albumLog.indexOf("Next XP threshold") >= 0, "rank log kept");
  assert(albumLog.indexOf("* Awards:") >= 0 && albumLog.indexOf("Sera Keel") >= 0 && albumLog.indexOf("floor up") >= 0, "awards");
  album.player.xp = S.xpNeed(album.player.level) - 1;
  assert(S.workShift(album, now + 1000).ok, "second year");
  assert(album.world.album.length === 2, "album grows again");
  var capped = S.fresh(now);
  capped.player.xp = 1e15;
  assert(S.workShift(capped, now).ok, "many years");
  assert(capped.world.album.length === 12, "album cap");

  var billed = S.fresh(now);
  for (s = 0; s < 4; s++) assert(S.workShift(billed, now + s * 1000).ok, "bill shift");
  assert(billed.world.bill > 0, "bill posted");
  var beforeBill = billed.player.capital;
  assert(S.payBill(billed).ok, "pay bill");
  assert(billed.player.capital === beforeBill - (beforeBill - billed.player.capital), "bill math");
  assert(billed.player.capital < beforeBill, "bill reduces capital");
  assert(billed.world.bill === 0, "bill cleared");

  function bustCapital(insured) {
    var g = S.fresh(now);
    g.nodes.skim = true;
    g.player.capital = 200;
    g.player.heat = 0;
    if (insured) g.world = { insured: true, seen: {} };
    var res = S.skim(g, now, function () { return 0; });
    assert(!res.ok && res.reason === "busted", "bust still busts");
    return g.player.capital;
  }
  assert(bustCapital(true) > bustCapital(false), "insurance softens the fine");

  var goals = S.fresh(now);
  goals.player.capital = 100;
  goals.lastReal = now;
  S.frame(goals, now);
  assert(goals.world.goals.hundred, "hundred goal");
  S.frame(goals, now);
  assert(countText(goals, "Goal: hundred") === 1, "hundred once");
  goals.slots[0].employee = { name: "Bea", salary: 8, traits: ["loyal"], caught: false, pref: "morning" };
  S.frame(goals, now);
  assert(goals.world.goals.hire, "hire goal");

  var loan = S.fresh(now);
  assert(S.takeLoan(loan).ok && loan.player.capital === 80 && loan.world.loan === 100, "loan");
  assert(!S.takeLoan(loan).ok, "one loan");
  loan.player.capital = 100;
  assert(S.payLoan(loan).ok && loan.player.capital === 0 && loan.world.loan === 0, "pay loan");

  var retired = S.fresh(now);
  retired.player.capital = 12;
  assert(S.retire(retired).ok && retired.world.retired, "retire flag");
  assert(retired.player.capital === 12, "retire keeps the save");
  assert(allLogs(retired).indexOf("Retired") >= 0, "retire log");

  var store = memStorage();
  var slotA = S.fresh(now);
  slotA.player.capital = 55;
  S.save(slotA, store);
  assert(store.getItem(D.SAVE_KEY), "primary key");
  assert(!store.getItem(D.SAVE_KEY + ".b"), "save ignores slot b");
  var slotB = S.fresh(now);
  slotB.player.capital = 77;
  S.saveSlot(slotB, store, "b");
  assert(Math.round(S.load(now, store).player.capital) === 55, "load stays on A");
  assert(Math.round(S.loadSlot(now, store, 1).player.capital) === 77, "slot b round trip");
  var raw = JSON.parse(store.mem[D.SAVE_KEY]);
  delete raw.world;
  delete raw.player.shop;
  store.mem[D.SAVE_KEY] = JSON.stringify(raw);
  var compat = S.load(now + 50, store);
  assert(Math.round(compat.player.capital) === 55, "old save capital");
  assert(compat.player.shop === "", "default shop");
  assert(compat.world.district === "downtown" && compat.world.loan === 0, "default world");
  assert(compat.world.menu.price === 1 && compat.world.album.length === 0, "default menu and album");

  var city = S.fresh(now);
  city.flags.opened = true;
  city.world = { rival: "Juniper Pike", seen: {} };
  city.lastReal = now;
  S.frame(city, now);
  S.frame(city, now);
  assert(countText(city, "City note:") === 1, "city note once per phase");

  var moved = S.fresh(now);
  moved.player.capital = 40;
  assert(S.moveDistrict(moved, "campus").ok, "campus");
  assert(S.moveDistrict(moved, "night").ok, "night district");
  assert(moved.player.capital === 10, "district cost");
  var campus = S.fresh(now);
  var night = S.fresh(now);
  campus.world = { district: "campus", seen: {}, menu: { price: 1 } };
  night.world = { district: "night", seen: {}, menu: { price: 1 } };
  campus.slots[0].stock = 6;
  night.slots[0].stock = 6;
  var lunch = { id: "lunch", name: "Lunch", revenue: 1.7, scout: 1, study: 1 };
  S.resolveCycle(campus, campus.slots[0], lunch, function () { return 0.99; }, now);
  S.resolveCycle(night, night.slots[0], lunch, function () { return 0.99; }, now);
  assert(S.districtLunchMult(campus) < S.districtLunchMult(night), "district mult");
  assert(night.player.capital > campus.player.capital, "district changes lunch");

  var drop = S.fresh(now);
  var dropCash = drop.player.capital;
  assert(S.deliver(drop, now).ok, "deliver");
  assert(drop.player.capital === dropCash + 6, "deliver cash");
  assert(!S.deliver(drop, now).ok, "deliver phase lock");

  var catered = S.fresh(now);
  catered.player.capital = 20;
  assert(S.cater(catered).ok && catered.player.capital === 48, "cater gain");
  assert(!S.cater(catered).ok, "cater once");

  var cheap = S.fresh(now);
  var dear = S.fresh(now);
  cheap.world = { menu: { price: 1 }, seen: {}, district: "downtown" };
  dear.world = { menu: { price: 3 }, seen: {}, district: "downtown" };
  cheap.slots[0].stock = 6;
  dear.slots[0].stock = 6;
  var standard = { id: "standard", name: "Standard", revenue: 1, scout: 1, study: 1 };
  S.resolveCycle(cheap, cheap.slots[0], standard, function () { return 0.99; }, now);
  S.resolveCycle(dear, dear.slots[0], standard, function () { return 0.99; }, now);
  assert(S.menuGrossMult(dear) < S.menuGrossMult(cheap), "menu mult");
  assert(dear.player.capital < cheap.player.capital, "higher price grosses less");
  assert(S.setMenu(cheap, 2).ok && cheap.world.menu.price === 2, "set menu");

  var spoil = S.fresh(now);
  spoil.slots[0].stock = 13;
  spoil.spoilAt = 0;
  spoil.lastReal = now;
  S.frame(spoil, now);
  assert(spoil.slots[0].stock === 12, "spoil tick");
  assert(countText(spoil, "stock turned") === 1, "spoil log");
  S.frame(spoil, now);
  assert(spoil.slots[0].stock === 12, "spoil not every frame");
  var cooled = S.fresh(now);
  cooled.player.place = { owned: true, cooler: 1 };
  cooled.slots[0].stock = 13;
  cooled.spoilAt = 0;
  cooled.lastReal = now;
  S.frame(cooled, now);
  assert(cooled.slots[0].stock === 13, "cooler holds stock");

  var low = S.fresh(now);
  assert(!S.layLow(low, now).ok, "lay low is shady");
  low.flags.shady = true;
  low.player.heat = 20;
  assert(S.layLow(low, now).ok && low.player.heat === 12, "heat drops");
  assert(!S.layLow(low, now + 100).ok && low.player.heat === 12, "lay low cooldown");
  low.player.capital = 30;
  low.player.heat = 20;
  assert(S.payFine(low).ok && low.player.heat === 8 && low.player.capital === 20, "fine drops heat");

  var quiet = S.fresh(now);
  quiet.flags.shady = true;
  quiet.player.place = { owned: true, lights: 0, sign: 0, counter: 0, cooler: 0, safe: 0, speaker: 0, plant: 0, neon: 0 };
  quiet.player.capital = 40;
  assert(S.buyQuiet(quiet).ok && quiet.world.quietRoom, "quiet room");
  function skimPay(extra) {
    var g = S.fresh(now);
    g.nodes.skim = true;
    if (extra) g.world = { quietRoom: true, seen: {} };
    var paid = S.skim(g, now, function () { return 0.99; });
    assert(paid.ok, "quiet skim pays");
    return paid.pay;
  }
  assert(skimPay(true) > skimPay(false), "quiet room pays more");

  var solo = S.fresh(now);
  var split = S.fresh(now);
  split.world = { partner: true, seen: {} };
  var soloShift = S.workShift(solo, now);
  var splitShift = S.workShift(split, now);
  assert(soloShift.pay === splitShift.pay, "partner does not change listed pay");
  var cut = Math.max(1, Math.round(soloShift.pay * 0.1));
  assert(split.player.capital === solo.player.capital - cut, "partner takes ten percent");
  assert(S.betrayPartner(split).betrayed === false && split.world.partner, "default roll does not betray");
  assert(S.betrayPartner(split, function () { return 0; }).betrayed === true, "injected betray");
  assert(!split.world.partner, "partner leaves");

  var favor = S.fresh(now);
  favor.world = { regular: { name: "Sera Keel", mood: 2, visits: 1 }, seen: {} };
  assert(!S.seraFavor(favor).ok, "favor needs mood");
  favor.world.regular.mood = 3;
  var favorCash = favor.player.capital;
  assert(S.seraFavor(favor).ok && favor.player.capital === favorCash + 8, "favor cash");
  assert(!S.seraFavor(favor).ok, "favor once a year");

  var council = S.fresh(now);
  council.player.place = { owned: true, sign: 1, lights: 0, counter: 0 };
  council.player.shifts = 1;
  council.player.capital = 20;
  assert(S.councilMute(council).ok, "mute");
  assert(S.signLift(council) === 0, "sign bonus muted");
  council.player.shifts = 10;
  assert(S.signLift(council) === 0.08, "sign bonus returns");

  var look = S.fresh(now);
  look.slots[0].stock = 4;
  look.slots[0].camera = false;
  assert(S.currentLifeId(look, now) === "inspect", "inspection without camera");
  look.slots[0].camera = true;
  assert(S.currentLifeId(look, now) !== "inspect", "inspection skipped with camera");
  look.slots[0].camera = false;
  look.flags.opened = true;
  look.lastReal = now;
  S.frame(look, now);
  assert(look.world.seen.inspect === look.player.level, "inspection once");
  assert(S.currentLifeId(look, now) !== "inspect", "inspection does not repeat");

  var market = S.fresh(now);
  market.player.visibility = 39;
  assert(!S.openNightMarket(market).ok, "market locked");
  market.player.visibility = 40;
  assert(S.openNightMarket(market).ok && market.world.nightMarket, "market opens");
  assert(S.nightBump(market, "night") > 1 && S.nightBump(market, "lunch") === 1, "night bump");

  var made = S.fresh(now);
  assert(S.synthesize(made, "grease", "trainee", "chalk", "fryer").ok, "craft for shift");
  assert(S.workShift(made, now).ok, "shift with craft");
  assert(countText(made, "crafted plate") === 1, "craft noted");
  assert(S.workShift(made, now + 1000).ok, "next shift");
  assert(countText(made, "crafted plate") === 1, "craft note once");

  var hint = S.fresh(now);
  hint.lastReal = now;
  hint.slots[0].camera = true;
  hint.slots[0].employee = { name: "Ada", salary: 9, traits: ["fingers"], caught: false };
  S.frame(hint, now);
  var hintLog = allLogs(hint);
  assert(hintLog.indexOf("tell") >= 0, "camera hint");
  assert(hintLog.indexOf("fingers") < 0 && hintLog.indexOf("Sticky") < 0, "hint hides the trait");
  S.frame(hint, now);
  assert(countText(hint, "tell") === 1, "hint once");

  var cal = S.fresh(now);
  assert(S.calendarLine(cal) === "clear", "empty calendar");
  cal.world.rentDue = 9;
  assert(S.calendarLine(cal).indexOf("rent") >= 0, "calendar rent");
  cal.degree = { id: "cert", left: 10, total: 10 };
  assert(S.calendarLine(cal).indexOf("exam") >= 0, "calendar exam");
  cal.player.level = 2;
  assert(S.calendarLine(cal).indexOf("festival") >= 0, "calendar festival");

  var caughtUp = S.fresh(now);
  caughtUp.flags.opened = true;
  caughtUp.world = { regular: { name: "Sera Keel", visits: 1, mood: 1 }, seen: {} };
  caughtUp.booted = false;
  caughtUp.lastReal = now - 4000;
  S.frame(caughtUp, now);
  var catchLog = allLogs(caughtUp);
  assert(catchLog.indexOf("Catch-up") >= 0 && catchLog.indexOf("Sera Keel") >= 0, "catch-up names the regular");

  var tenant = S.fresh(now);
  tenant.flags.opened = true;
  tenant.world = { deed: "owned", floor: 1, seen: {}, upstairs: "none" };
  tenant.player.capital = 0;
  tenant.lastReal = now;
  S.frame(tenant, now);
  assert(tenant.player.capital === 3, "tenant pays");
  S.frame(tenant, now);
  assert(tenant.player.capital === 3, "tenant once per phase");
})();

(function streetYear() {
  var now = 1_750_000_000_000;
  var spine = S.fresh(now);
  spine.player.capital = 80;
  assert(S.buyRoom(spine).ok, "spine room");
  spine.world.bill = 7;
  spine.player.xp = S.xpNeed(1) - 1;
  assert(S.workShift(spine, now).ok, "spine year");
  assert(allLogs(spine).indexOf("Next XP threshold") >= 0, "rank log kept");
  assert(spine.world.rentDue > 0 && spine.world.bill > 0, "rent and bill both due");
  assert(spine.world.spine[0] === "landlord", "rent is first");
  assert(spine.world.spine.indexOf("bill") > spine.world.spine.indexOf("landlord"), "bill waits behind rent");
  assert(S.currentLifeId(spine, now) === "landlord", "life id is rent");
  var lifeLogs = countText(spine, "* Life:");
  spine.phaseId = "nope";
  S.frame(spine, now + 400);
  assert(countText(spine, "* Life:") === lifeLogs, "unresolved spine blocks a new life log");
  spine.player.capital = 80;
  assert(S.payRent(spine).ok, "spine rent paid");
  assert(spine.world.spine[0] === "bill", "bill surfaces after rent");
  assert(S.currentLifeId(spine, now) === "bill", "life id is the bill");

  var sera = S.fresh(now);
  sera.player.place = { owned: true, lights: 0, sign: 0, counter: 0 };
  sera.world = { regular: { name: "Sera Keel", mood: 3, visits: 4 }, regularDue: true, seen: {}, favorYear: 0 };
  assert(S.seraWantId(sera) === "sera_dark", "sera wants lights");
  assert(S.currentLifeId(sera, now) === "sera_dark", "sera dark card");
  assert(S.lifeBeat(sera, "sera_dark").line.indexOf("almost didn't") >= 0, "sera dark copy");
  sera.player.place.lights = 1;
  assert(S.seraWantId(sera) === "favor_card", "sera favor when lights are on");

  var land = S.fresh(now);
  land.player.capital = 40;
  assert(S.buyRoom(land).ok, "landlord room");
  land.world.rentDue = 5;
  land.player.capital = 30;
  var mood = land.world.landlordMood;
  assert(S.stallRent(land).ok, "stall once");
  assert(land.world.landlordMood === mood - 1, "mood down on stall");
  var grim = S.lifeBeat(land, "landlord").line;
  assert(S.payRent(land).ok, "pay after stall");
  assert(land.world.landlordMood === mood, "mood up on pay");
  land.world.landlordMood = 4;
  var warm = S.lifeBeat(land, "landlord").line;
  assert(grim.indexOf("done waiting") >= 0 && warm.indexOf("likes the building") >= 0, "landlord line follows mood");

  var jun = S.fresh(now);
  jun.player.place = { owned: true, lights: 0, sign: 0, counter: 0 };
  jun.world = { rival: "Juniper Pike", rivalMemory: "thin", rivalSign: false, truce: false, seen: {} };
  jun.player.place.sign = 1;
  var copied = S.rivalLunchMult(jun);
  assert(copied > 0.82 && copied < 1, "copied penalty stays smaller");
  assert(jun.world.rivalMemory === "copied", "rival memory flips");
  assert(S.currentLifeId(jun, now) === "rival_flip", "rival flip card");

  var tutorBiz = S.fresh(now);
  tutorBiz.world = { floor: 1, upstairs: "tutor", hours: "", tutorPhase: "", seen: {} };
  tutorBiz.slots[0].stock = 0;
  tutorBiz.player.capital = 10;
  S.runBusiness(tutorBiz, now, 5000, function () { return 0.99; });
  assert(tutorBiz.player.capital === 14, "tutor class adds cash");
  S.runBusiness(tutorBiz, now, 5000, function () { return 0.99; });
  assert(tutorBiz.player.capital === 14, "tutor class once per phase");

  var officeBase = S.fresh(now);
  var officeBoost = S.fresh(now);
  officeBoost.world = { floor: 1, upstairs: "office", upstairsStaff: "Ada", seen: {} };
  var basePay = S.workShift(officeBase, now).pay;
  var boostPay = S.workShift(officeBoost, now).pay;
  assert(boostPay === basePay + 5, "office staff boosts shift pay");
  officeBoost.slots[0].employee = { name: "Ada", salary: 8, traits: ["loyal"], caught: false, pref: "lunch", want: "lunch", mood: 2 };
  assert(S.sendUpstairs(officeBoost).ok && officeBoost.world.upstairsStaff === "Ada", "send hire upstairs");

  var shut = S.fresh(now);
  shut.flags.opened = true;
  shut.flags.chosen = true;
  shut.lastReal = now;
  shut.slots[0].stock = 6;
  shut.world = { hours: "closed", hoursHold: true, seen: {}, spine: [] };
  S.frame(shut, now + 8000);
  assert(shut.slots[0].stock === 6, "closed frame does not sell");
  assert(S.setHours(shut, "open", now).ok && shut.world.hours === "open" && shut.world.hoursHold, "stay open");

  var crew = S.fresh(now);
  crew.lastReal = now;
  crew.slots[0].employee = { name: "Ada", salary: 8, traits: ["loyal"], caught: false, pref: "night", want: "night", mood: 2 };
  var phaseId = S.phaseAt(now).id;
  S.frame(crew, now);
  var moodAfter = crew.slots[0].employee.mood;
  S.frame(crew, now + 500);
  assert(crew.slots[0].employee.mood === moodAfter, "hire mood once per phase");
  assert(moodAfter === (phaseId === "night" ? 3 : 1), "hire mood follows the shift they want");

  var store = memStorage();
  var saved = S.fresh(now);
  saved.world = {
    landlordMood: 4,
    rivalMemory: "thin",
    spine: ["bill", "landlord"],
    hours: "closed",
    upstairsStaff: "Ada",
    wants: { sera: "lights", juniper: "lunch", landlord: "building" },
    seen: {}
  };
  S.save(saved, store);
  var loaded = S.load(now + 20, store);
  assert(loaded.world.landlordMood === 4, "landlord mood saved");
  assert(loaded.world.rivalMemory === "thin", "rival memory saved");
  assert(loaded.world.spine[0] === "bill" && loaded.world.spine[1] === "landlord", "spine saved");
  assert(loaded.world.hours === "closed" && loaded.world.upstairsStaff === "Ada", "hours and upstairs staff saved");
  assert(loaded.world.wants.sera === "lights", "wants saved");
})();

(function livingBlock() {
  var now = 1_750_000_000_000;
  var win = S.fresh(now);
  S.tickBlock(win);
  win.player.place.owned = true;
  win.player.place.sign = 0;
  win.world.rival = "Juniper Pike";
  win.world.rivalMemory = "thin";
  win.world.truce = false;
  var money0 = win.world.block.juniper.money;
  var busy0 = win.world.block.juniper.busy;
  S.tickBlock(win);
  assert(win.world.block.juniper.money > money0, "juniper's book moves when she is winning");
  assert(win.world.block.juniper.busy > busy0, "juniper's sidewalk fills when she is winning");
  assert(S.juniperWinning(win), "no sign means she is winning");
  var full = win.world.block.juniper.busy;
  assert(S.makeTruce(win).ok, "truce for the block");
  S.tickBlock(win);
  assert(win.world.block.juniper.busy < full, "truce thins her line");

  var old = S.fresh(now);
  S.tickBlock(old);
  delete old.world.block;
  delete old.world.spot;
  S.tickBlock(old);
  assert(old.world.block && old.world.block.juniper && old.world.block.campus && old.world.block.night, "old save grows shop books");
  assert(old.world.spot === "register", "old save stands at the register");

  var sera = S.fresh(now);
  sera.flags.opened = true;
  sera.world = { hours: "open", regular: { name: "Sera Keel", visits: 2, mood: 1 }, regularDue: true, seen: {} };
  assert(S.personPlace(sera, "sera") === "counter", "sera stands at the counter");
  sera.world.regularDue = false;
  assert(S.personPlace(sera, "sera") === "gone", "sera is gone when she is not due");

  var up = S.fresh(now);
  up.flags.opened = true;
  up.flags.chosen = true;
  up.lastReal = now;
  up.slots[0].stock = 6;
  up.world = { hours: "open", hoursHold: true, hoursPhase: S.phaseAt(now).id, spot: "upstairs", seen: {}, spine: [] };
  S.frame(up, now + 8000);
  assert(up.slots[0].stock === 6, "upstairs without a hire skips the open-hours sale");
  assert(S.registerCovered(up) === false, "register is empty upstairs");
  var biz = S.fresh(now);
  biz.flags.opened = true;
  biz.slots[0].stock = 6;
  biz.world = { hours: "open", spot: "upstairs", seen: {} };
  S.runBusiness(biz, now, 5000, function () { return 0.99; });
  assert(biz.slots[0].stock < 6, "runBusiness still sells from upstairs");
  var covered = S.fresh(now);
  covered.flags.opened = true;
  covered.lastReal = now;
  covered.slots[0].stock = 6;
  covered.slots[0].employee = { name: "Ada", salary: 8, traits: ["loyal"], caught: false, pref: "lunch", mood: 2 };
  covered.world = { hours: "open", hoursHold: true, hoursPhase: S.phaseAt(now).id, spot: "upstairs", upstairsStaff: "", seen: {}, spine: [] };
  S.frame(covered, now + 8000);
  assert(covered.slots[0].stock < 6, "a hire at the register still sells");
  covered.world.upstairsStaff = "Ada";
  covered.slots[0].stock = 6;
  covered.lastReal = now + 8000;
  S.frame(covered, now + 16000);
  assert(covered.slots[0].stock === 6, "hire upstairs leaves the register empty");

  var talk = S.fresh(now);
  S.tickBlock(talk);
  talk.phaseId = "night";
  talk.player.place.sign = 1;
  talk.player.place.lights = 1;
  talk.world = { regular: { name: "Sera Keel", visits: 3, mood: 2 }, hours: "open", seen: {} };
  var spoken = S.lifeBeat(talk, "regular").line;
  assert(spoken.indexOf("rain") >= 0 && spoken.indexOf("sign is on") >= 0, "grammar line includes two true facts");

  var book = S.fresh(now);
  var start = book.player.capital;
  var shift = S.workShift(book, now);
  var slip = book.world.lastSlip;
  assert(slip && start + slip.came - slip.rent - slip.bill === slip.left, "books slip totals match the shift");
  assert(slip.left === book.player.capital, "books slip left is the drawer");
  assert(slip.came === shift.pay, "books slip came in is the shift");
})();

(function nextSpendGoal() {
  var now = Date.now();
  var game = S.fresh(now);
  var goal = S.nextSpend(game);
  assert(game.player.capital === 0, "starting capital stays 0");
  assert(goal && goal.id === "room" && goal.cost === D.ROOM.rent && goal.fill === 0, "fresh goal is the corner rent");
  game.player.capital = 10;
  goal = S.nextSpend(game);
  assert(Math.abs(goal.fill - 10 / D.ROOM.rent) < 1e-9, "rent bar is capital over cost");
  game.player.place.owned = true;
  goal = S.nextSpend(game);
  assert(goal.id === "lights" && goal.cost === D.ROOM.lights, "next room piece is lights");
  game.player.place.lights = 1;
  game.player.place.sign = 1;
  game.player.place.counter = 1;
  goal = S.nextSpend(game);
  assert(goal.id === "plant" && goal.cost === D.ROOM.plant, "cheapest room extra is next");
  game.player.place.plant = 1;
  game.player.place.speaker = 1;
  game.player.place.neon = 1;
  game.player.place.cooler = 1;
  game.player.place.safe = 1;
  goal = S.nextSpend(game);
  assert(goal.id === "floor" && goal.cost === D.ROOM.floor, "floor is the locked upgrade");
  game.world.floor = 1;
  goal = S.nextSpend(game);
  assert(goal.id === "deg:cert" && goal.cost === D.degreeById.cert.cost, "degree gate uses tuition");
  game.flags.opened = true;
  game.slots[0].stock = 0;
  goal = S.nextSpend(game);
  assert(goal.id === "stock" && goal.cost === D.STOCK_PACK * D.STOCK_PRICE, "empty shelf is the restock gate");
  var hire = S.fresh(now);
  S.nextSpend(hire);
  hire.flags.opened = true;
  hire.world.spot = "upstairs";
  hire.slots[0].stock = 8;
  S.rollResume(hire, function () { return 0; });
  goal = S.nextSpend(hire);
  assert(goal.id === "hire" && goal.cost === hire.resumes[0].floor, "uncovered register points at the hire");
  var quiet = S.fresh(now);
  S.workHobby(quiet, now);
  assert(quiet.flags.opened === false, "hobby still does not open the shop");
})();

(function dayLines() {
  assert(S.dayVoice("Academic rank 1. Levels award 1 Void Point.").indexOf("drawer") >= 0, "rank line is a sentence");
  assert(S.dayVoice("Academic rank 1. Levels award 1 Void Point.").indexOf("Academic rank") < 0, "rank line drops the spreadsheet");
  assert(S.dayVoice("Clock phase: Morning Rush. Revenue x1.35.").indexOf("Revenue") < 0, "phase voice drops the multiplier");
  assert(S.dayVoice("+ Shift closed. Paid $18. Academic XP rose.") === "The shift paid $18.", "shift line keeps the money");
  assert(S.dayVoice("* Life: landlord") === "", "life id is not a sentence");
  var morning = S.phaseAt(new Date(2026, 5, 2, 8, 0, 0).getTime());
  var dark = S.fresh(new Date(2026, 5, 2, 8, 0, 0).getTime());
  dark.flags.opened = false;
  assert(S.phaseVoice(dark, morning).indexOf("Morning Rush") >= 0, "morning stamp");
  assert(S.phaseVoice(dark, morning).indexOf("dark") >= 0, "closed morning stays shut");
  dark.flags.opened = true;
  dark.world.hours = "open";
  assert(S.phaseVoice(dark, { id: "night", name: "Night Drift" }).indexOf("quiet") < 0, "open night is not the quiet line");
  dark.world.hours = "closed";
  assert(S.phaseVoice(dark, { id: "night", name: "Night Drift" }).indexOf("quiet") >= 0, "quiet night");
  var shop = S.describeLine("Morning Rush. The street is already hungry.", dark);
  assert(shop.art === "shopMorning" && shop.mark === "sun" && shop.tags.indexOf("shop") >= 0, "phase line carries the morning painting");
  var person = S.describeLine("+ Sera grins. You comped the meal. $4.", dark);
  assert(person.portrait === "sera" && person.money === 4 && person.mark === "coin", "person line names sera and the money");
  var plant = S.describeLine("+ A plant. The shift feels less sharp. $8.", dark);
  assert(plant.object === "plant" && plant.money === 8, "plant line keeps the object");
  var held = S.describeLine("! Busted. You're being held. Lost $12.", dark);
  assert(held.bust && held.text.indexOf("Busted") >= 0 || held.voice.indexOf("Busted") >= 0, "bust copy stays");
  var hot = S.fresh(new Date(2026, 5, 2, 8, 0, 0).getTime());
  hot.player.heat = 60;
  hot.flags.shady = true;
  var heatLine = S.describeLine("Heat is 60. The room feels watched.", hot);
  assert(heatLine.mark === "heat", "heat mark only when heat is high");
  var cool = S.describeLine("Heat is 60. The room feels watched.", dark);
  assert(cool.mark !== "heat", "low heat does not take the heat mark");

  var now = new Date(2026, 5, 2, 8, 5, 0).getTime();
  var earn = S.fresh(now - 1000);
  S.phaseVoice(earn, { id: "morning", name: "Morning Rush" });
  earn.lastReal = now - 1000;
  earn.flags.opened = true;
  earn.flags.chosen = true;
  earn.world.hours = "open";
  earn.world.hoursHold = true;
  earn.world.hoursPhase = "morning";
  earn.slots[0].stock = 8;
  earn.phaseId = "morning";
  earn.booted = true;
  S.frame(earn, now + 8000);
  assert(earn.slots[0].stock < 8, "open shop still sells");
  assert(countText(earn, "took in") === 1, "one earning line");
  assert(countText(earn, "Revenue x") === 0, "no revenue spreadsheet");
  var again = earn.player.capital;
  S.frame(earn, now + 16000);
  assert(countText(earn, "took in") === 1, "earning line holds for the phase");
  assert(earn.player.capital >= again, "later frames can still sell");

  var shut = S.fresh(now - 1000);
  S.phaseVoice(shut, { id: "morning", name: "Morning Rush" });
  shut.lastReal = now - 1000;
  shut.flags.opened = true;
  shut.flags.chosen = true;
  shut.world.hours = "closed";
  shut.world.hoursHold = true;
  shut.world.hoursPhase = "morning";
  shut.slots[0].stock = 6;
  shut.phaseId = "morning";
  shut.booted = true;
  S.frame(shut, now + 8000);
  assert(shut.slots[0].stock === 6, "closed frame still does not sell");
  assert(countText(shut, "took in") === 0, "no earning line while closed");

  var night = new Date(2026, 5, 2, 2, 0, 0).getTime();
  var quietNight = S.fresh(night - 500);
  quietNight.lastReal = night - 500;
  S.frame(quietNight, night + 500);
  assert(quietNight.player.capital === 0, "quiet night does not pay");
  assert(quietNight.flags.opened === false, "quiet night does not open the shop");
  assert(countText(quietNight, "quiet") >= 1, "quiet night line");

  var thin = S.fresh(now);
  S.phaseVoice(thin, { id: "morning", name: "Morning Rush" });
  thin.lastReal = now;
  thin.flags.opened = true;
  thin.flags.chosen = true;
  thin.booted = true;
  thin.phaseId = S.phaseAt(now).id;
  thin.world.hours = "open";
  thin.world.hoursHold = true;
  thin.world.hoursPhase = thin.phaseId;
  thin.slots[0].stock = 2;
  S.frame(thin, now);
  assert(thin.slots[0].stock === 2, "thin note does not sell on an empty tick");
  assert(countText(thin, "getting thin") === 1, "thin shelf line");

  var cover = S.fresh(now);
  S.phaseVoice(cover, { id: "morning", name: "Morning Rush" });
  cover.lastReal = now;
  cover.flags.opened = true;
  cover.flags.chosen = true;
  cover.booted = true;
  cover.phaseId = S.phaseAt(now).id;
  cover.world.hours = "open";
  cover.world.hoursHold = true;
  cover.world.hoursPhase = cover.phaseId;
  cover.slots[0].employee = { name: "Ada", salary: 8, traits: ["loyal"], caught: false, pref: "lunch", want: "lunch", mood: 2 };
  S.frame(cover, now);
  assert(countText(cover, "Ada has the register") === 1, "hire covering line");
  S.frame(cover, now + 400);
  assert(countText(cover, "Ada has the register") === 1, "hire line once per phase");
})();

(function shopNames() {
  var now = 1750000000000;
  var game = S.fresh(now);
  S.frame(game, now);
  assert(game.slots[0].name === "The Corner", "missing shop name migrates");
  assert(game.player.place.name === "The Corner", "place keeps the shop name");
  assert(game.player.shop === "", "name migration leaves the brand empty");
  assert(game.player.capital === 0 && game.flags.opened === false, "a name does not open the shop");
  var named = S.renameShop(game, 0, 1);
  assert(named.ok && named.name === "Greasefire", "rename picks Greasefire");
  assert(game.slots[0].name === "Greasefire" && game.player.place.name === "Greasefire", "rename stores the slot and the place");
  assert(game.player.shop === "Greasefire", "rename keeps the brand in step");
  assert(String(lastLog(game)).indexOf("Greasefire") >= 0, "rename line");
  assert(game.flags.opened === false, "rename leaves the counter closed");
  var store = memStorage();
  S.save(game, store);
  var raw = JSON.parse(store.mem[D.SAVE_KEY]);
  delete raw.slots[0].name;
  delete raw.player.place.name;
  raw.player.shop = "Neon Nook";
  store.mem[D.SAVE_KEY] = JSON.stringify(raw);
  var loaded = S.load(now + 20, store);
  assert(loaded.slots[0].name === "Neon Nook", "old save takes the brand as the name");
  assert(loaded.player.place.name === "Neon Nook", "old place name migrates");
  assert(loaded.player.shop === "Neon Nook", "old brand stays");
  var bare = JSON.parse(store.mem[D.SAVE_KEY]);
  bare.player.shop = "";
  delete bare.slots[0].name;
  delete bare.player.place.name;
  store.mem[D.SAVE_KEY] = JSON.stringify(bare);
  var corner = S.load(now + 30, store);
  assert(corner.slots[0].name === "The Corner" && corner.player.shop === "", "blank save gets The Corner");
})();

(function majorDay() {
  var now = new Date(2026, 5, 2, 18, 0, 0).getTime();
  assert(S.cleanShopName("  My\nShop\u0007  ") === "MyShop", "custom name strips controls and space");
  assert(S.cleanShopName("abcdefghijklmnopqrstuvwxyz") === "abcdefghijklmnopqrstuv", "custom name caps at 22");
  assert(S.cleanShopName("   ") === "", "blank name stays blank");

  var named = S.fresh(now);
  var custom = S.setShopName(named, 0, "  Night Window  ");
  assert(custom.ok && custom.name === "Night Window", "custom name stores cleaned text");
  assert(named.slots[0].name === "Night Window" && named.player.place.name === "Night Window", "name sits on the slot and the place");
  assert(named.player.shop === "Night Window", "custom name is the brand");
  assert(named.player.capital === 0 && named.flags.opened === false, "a custom name does not open the shop");
  var store = memStorage();
  S.save(named, store);
  var raw = JSON.parse(store.mem[D.SAVE_KEY]);
  delete raw.settings.clock;
  delete raw.player.place.shut;
  store.mem[D.SAVE_KEY] = JSON.stringify(raw);
  var loaded = S.load(now + 20, store);
  assert(loaded.slots[0].name === "Night Window" && loaded.player.place.name === "Night Window", "custom name survives the save");
  assert(loaded.settings.clock === 1, "missing clock migrates to 1x");
  assert(loaded.player.place.shut === false, "missing shut flag migrates closed-off");

  var shut = S.fresh(now);
  S.chapterNow(shut);
  shut.flags.opened = true;
  shut.flags.chosen = true;
  shut.lastReal = now;
  shut.booted = true;
  shut.phaseId = S.phaseAt(now).id;
  shut.slots[0].stock = 6;
  shut.world.hours = "open";
  shut.world.hoursHold = true;
  shut.world.hoursPhase = shut.phaseId;
  assert(S.setDoor(shut, false, now).ok && shut.player.place.shut === true && shut.world.hours === "closed", "close shuts the door");
  var beforeShut = shut.player.capital;
  S.frame(shut, now + 8000);
  assert(shut.slots[0].stock === 6 && shut.player.capital === beforeShut, "a shut door does not sell");
  shut.world.hours = "open";
  shut.lastReal = now + 8000;
  S.frame(shut, now + 16000);
  assert(shut.slots[0].stock === 6, "shut still blocks a sale after hours flip open");
  assert(S.setDoor(shut, true, now).ok && shut.player.place.shut === false, "open clears the shut flag");

  var sleep = S.fresh(now);
  sleep.player.capital = 15;
  sleep.slots[0].stock = 4;
  var slept = S.sleepToMorning(sleep, now);
  assert(sleep.player.capital === 15 && slept.same, "sleep does not mint money");
  assert(S.phaseAt(slept.land).id === "morning", "sleep lands on Morning Rush");
  assert(slept.skipped >= 1, "sleep writes a plate per skipped phase");
  assert(countText(sleep, "in the drawer") === slept.skipped, "each skipped phase names the drawer");
  assert(countText(sleep, "on the shelf") === slept.skipped, "each skipped phase names the shelf");

  var payA = S.fresh(now);
  var payB = S.fresh(now);
  payB.settings.clock = 2;
  var a = S.workShift(payA, now).pay;
  var b = S.workShift(payB, now).pay;
  assert(a === b && a > 0, "clock speed does not change a shift");
  var book = S.dayLedger(payA);
  assert(book.inn === a && book.out === 0 && book.left === payA.player.capital && book.from === "log", "day ledger reads the shift line");

  var fresh = S.fresh(now);
  assert(S.chapterNow(fresh).id === "bare", "chapter starts at the bare corner");
  fresh.flags.opened = true;
  assert(S.chapterNow(fresh).id === "shift", "first shift is a chapter");
  fresh.slots[0].employee = { name: "Ada", salary: 8, traits: [], mood: 2 };
  assert(S.chapterNow(fresh).id === "hire", "first hire is a chapter");
  fresh.world.rival = "Juniper Pike";
  assert(S.chapterNow(fresh).id === "rival", "a rival is a chapter");
  fresh.world.floor = 1;
  assert(S.chapterNow(fresh).id === "floor", "an owned floor is a chapter");

  assert(S.rushCrowd(S.phaseAt(new Date(2026, 5, 2, 12, 0, 0).getTime())) === 3, "lunch draws the most customers");
  assert(S.rushCrowd(S.phaseAt(new Date(2026, 5, 2, 8, 0, 0).getTime())) === 2, "morning draws a smaller rush");
  assert(S.rushCrowd(S.phaseAt(new Date(2026, 5, 2, 2, 0, 0).getTime())) === 0, "night is not a rush");

  var up = S.fresh(now);
  S.chapterNow(up);
  up.flags.opened = true;
  up.world.hours = "open";
  up.world.spot = "upstairs";
  assert(S.registerWatch(up).id === "nobody", "an empty register is nobody");
  up.slots[0].employee = { name: "Ada", salary: 8, traits: [], mood: 2 };
  assert(S.registerWatch(up).id === "hire" && S.registerWatch(up).name === "Ada", "the hire covers the register");

  var mem = S.fresh(now);
  S.chapterNow(mem);
  mem.world.regular = { name: "Sera Keel", visits: 4, mood: 2 };
  assert(S.memoryClause(mem) === "Visit 4", "memory uses the visit count");
  mem.world.behind = 2;
  mem.world.regular = null;
  assert(S.memoryClause(mem).indexOf("2 behind") >= 0, "memory uses rent that is behind");
  var land = S.lifeBeat(mem, "landlord").line;
  assert(land.indexOf("2 behind") >= 0, "the landlord plate shows the count");
})();

console.log(ok + " passed, " + fails + " failed");
if (fails) process.exit(1);
