"use strict";

var fs = require("fs");
var path = require("path");

global.window = global;
eval(fs.readFileSync(path.join(__dirname, "../js/data.js"), "utf8"));
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
})();

console.log(ok + " passed, " + fails + " failed");
if (fails) process.exit(1);
