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

console.log(ok + " passed, " + fails + " failed");
if (fails) process.exit(1);
