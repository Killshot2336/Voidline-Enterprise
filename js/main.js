(function (root) {
  "use strict";

  var S = root.VoidSim;
  var R = root.VoidRender;
  var canvas = document.getElementById("view");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d", { alpha: false }) || canvas.getContext("2d");
  var game = S.load(Date.now(), root.localStorage);
  var ui = {
    menu: null,
    menuT: 0,
    scroll: 0,
    contentH: 0,
    logScroll: 0,
    logPin: true,
    offer: "",
    selected: null,
    focusSlot: 0,
    synth: { idea: null, staff: null, marketing: null, asset: null },
    pick: null,
    resetArm: false,
    hits: [],
    w: 1,
    h: 1,
    dpr: 1,
    fps: 60,
    seenPulse: game.pulse || 0,
    seenLevel: game.player.level,
    hover: null,
    press: null,
    drag: null
  };

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var perf = game.settings.performanceMode;
    var dpr = perf ? 1 : Math.min(root.devicePixelRatio || 1, 1.5);
    ui.w = Math.max(1, rect.width);
    ui.h = Math.max(1, rect.height);
    ui.dpr = dpr;
    canvas.width = Math.max(1, Math.floor(ui.w * dpr));
    canvas.height = Math.max(1, Math.floor(ui.h * dpr));
  }

  function persist() {
    try { S.save(game, root.localStorage); } catch (err) { /* ignore quota */ }
  }

  var audioCtx = null;

  function queuePay(before, kind) {
    if (ui.cashHold == null) ui.cashHold = before;
    ui.payKind = kind || "small";
  }

  function unlockAudio(then) {
    try {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === "suspended" && audioCtx.resume) {
        var pending = audioCtx.resume();
        if (pending && pending.then) {
          pending.then(function () { if (then) then(); }).catch(function () {});
          return audioCtx;
        }
      }
      if (then) then();
      return audioCtx;
    } catch (err) {
      return null;
    }
  }

  function blip(freq, dur, type, peak) {
    try {
      if (game.settings && game.settings.muted) return;
      var ac = audioCtx;
      if (!ac || ac.state === "suspended") return;
      var osc = ac.createOscillator();
      var gain = ac.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      gain.gain.setValueAtTime(peak == null ? 0.04 : peak, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur + 0.02);
    } catch (err) { /* audio must not break the game */ }
  }

  function chime() {
    try {
      if (game.settings && game.settings.muted) return;
      var ac = audioCtx;
      if (!ac || ac.state === "suspended") return;
      var t = ac.currentTime;
      var notes = [523, 784];
      var i;
      for (i = 0; i < notes.length; i++) {
        var osc = ac.createOscillator();
        var gain = ac.createGain();
        var start = t + i * 0.07;
        osc.type = "sine";
        osc.frequency.setValueAtTime(notes[i], start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.045, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(start);
        osc.stop(start + 0.18);
      }
    } catch (err) { /* audio must not break the game */ }
  }

  function hearCoin() {
    var ping = ui.coinPing || 0;
    if (ping === (ui.heardPing || 0)) return;
    ui.heardPing = ping;
    blip(880, 0.09, "triangle", 0.05);
  }

  function degreeCount(gameState) {
    var n = 0;
    var k;
    var bag = gameState.degrees || {};
    for (k in bag) if (bag[k]) n += 1;
    return n;
  }

  function hearClocks() {
    var degN = degreeCount(game);
    var scoutN = (game.scouts || []).length;
    if (!ui.clockSeed) {
      ui.seenDeg = degN;
      ui.seenScouts = scoutN;
      ui.clockSeed = true;
      return;
    }
    if (degN > ui.seenDeg || scoutN < ui.seenScouts) chime();
    ui.seenDeg = degN;
    ui.seenScouts = scoutN;
  }

  function toggleMenu(name) {
    if (ui.menu === name) {
      ui.menu = null;
      ui.look = "";
      ui.lift = "";
    } else {
      ui.menu = name;
      ui.scroll = 0;
      ui.pick = null;
      ui.resetArm = false;
    }
  }

  function selectedCard() {
    var i;
    for (i = 0; i < game.resumes.length; i++) if (game.resumes[i].id === ui.selected) return game.resumes[i];
    return null;
  }

  function act(id) {
    var now = Date.now();
    if (!id) return;
    if (id === "shady") { toggleMenu("lab"); return; }
    if (id.indexOf("tab:") === 0) {
      toggleMenu(id.substring(4));
      return;
    }
    if (id === "hdr:journal") { toggleMenu("journal"); return; }
    if (id === "hdr:settings") { toggleMenu("settings"); return; }
    if (id === "close") { ui.menu = null; ui.look = ""; ui.lift = ""; return; }
    if (id.indexOf("look:") === 0) {
      var who = id.substring(5);
      if (ui.menu === "scout" && ui.look === who) {
        ui.menu = null;
        ui.look = "";
        ui.lift = "";
        return;
      }
      ui.look = who;
      if (ui.menu !== "scout") {
        ui.menu = "scout";
        ui.scroll = 0;
        ui.pick = null;
      }
      return;
    }
    if (id === "page:next" || id === "page:prev") {
      if (ui.flip > 0 && ui.flip < 1) return;
      ui.flip = 0.001;
      ui.flipDir = id === "page:next" ? 1 : -1;
      ui.flipKind = ui.menu;
      ui.flipApplied = false;
      return;
    }
    if (id.indexOf("lift:") === 0) {
      var lifted = id.substring(5);
      ui.lift = ui.lift === lifted ? "" : lifted;
      return;
    }
    if (id === "shift") {
      var beforeShift = game.player.capital;
      var shift = S.workShift(game, now);
      if (shift && shift.ok) queuePay(beforeShift, "shift");
      return;
    }
    if (id === "hobby" || id.indexOf("hobby:") === 0) {
      var beforeHobby = game.player.capital;
      var hobby = id === "hobby" ? S.workHobby(game, now) : S.workHobby(game, now, id.substring(6));
      if (hobby && hobby.ok) queuePay(beforeHobby, "small");
      return;
    }
    if (id === "room") { S.buyRoom(game); return; }
    if (id === "floor") { S.buyFloor(game); return; }
    if (id === "rentpay") { S.payRent(game); return; }
    if (id === "rentstall") { S.stallRent(game); return; }
    if (id === "comp") { S.compRegular(game); return; }
    if (id === "greet") { S.greetRegular(game); return; }
    if (id.indexOf("upgrade:") === 0) { S.upgradeRoom(game, id.substring(8)); return; }
    if (id.indexOf("shop:") === 0) {
      var which = id.substring(5);
      if (which === "more") S.cycleShop(game);
      else if (which === "pick") S.setShop(game, (game.world && game.world.shopPage) || 0);
      else S.setShop(game, Number(which));
      return;
    }
    if (id.indexOf("up:") === 0) { S.setUpstairs(game, id.substring(3)); return; }
    if (id === "sendup") { S.sendUpstairs(game); return; }
    if (id === "hours:open") { S.setHours(game, "open", now); return; }
    if (id === "hours:close") { S.setHours(game, "closed", now); return; }
    if (id.indexOf("stand:") === 0) { S.stand(game, id.substring(6)); return; }
    if (id === "rewind") {
      ui.rewind = ui.rewind ? 0 : 1;
      ui.rewindAt = now;
      ui.rewindStep = 0;
      return;
    }
    if (id === "truce") { S.makeTruce(game); return; }
    if (id === "class") { S.takeClass(game); return; }
    if (id === "lot") { S.claimLot(game); return; }
    if (id === "billpay") { S.payBill(game); return; }
    if (id === "insure") { S.buyInsurance(game); return; }
    if (id === "loan") { S.takeLoan(game); return; }
    if (id === "loanpay") { S.payLoan(game); return; }
    if (id === "deliver") { S.deliver(game, now); return; }
    if (id === "cater") { S.cater(game); return; }
    if (id.indexOf("menu:") === 0) { S.setMenu(game, Number(id.substring(5))); return; }
    if (id === "laylow") { S.layLow(game, now); return; }
    if (id === "fine") { S.payFine(game); return; }
    if (id === "quiet") { S.buyQuiet(game); return; }
    if (id === "partner") { S.takePartner(game); return; }
    if (id === "favor") { S.seraFavor(game); return; }
    if (id === "council:pay") { S.councilPay(game); return; }
    if (id === "council:mute") { S.councilMute(game); return; }
    if (id === "inspectpay") { S.payInspect(game); return; }
    if (id === "nightmarket") { S.openNightMarket(game); return; }
    if (id === "retire") { S.retire(game); return; }
    if (id.indexOf("district:") === 0) { S.moveDistrict(game, id.substring(9)); return; }
    if (id === "skim") { S.skim(game, now); return; }
    if (id === "score") { S.score(game, now); return; }
    if (id === "rest") { S.rest(game, now); return; }
    if (id === "applicants") { S.rollResume(game); return; }
    if (id.indexOf("stock:") === 0) {
      var beforeStock = game.player.capital;
      var stocked = S.buyStock(game, Number(id.substring(6)));
      if (stocked && stocked.ok) queuePay(beforeStock, "small");
      return;
    }
    if (id.indexOf("fire:") === 0) { S.fire(game, Number(id.substring(5))); return; }
    if (id.indexOf("cam:") === 0) { S.installCamera(game, Number(id.substring(4))); return; }
    if (id.indexOf("focus:") === 0) { ui.focusSlot = Number(id.substring(6)); return; }
    if (id.indexOf("apply:") === 0) {
      var bits = id.split(":");
      S.applyJob(game, Number(bits[1]), bits[2]);
      return;
    }
    if (id.indexOf("resume:") === 0) {
      ui.selected = Number(id.substring(7));
      ui.offer = "";
      return;
    }
    if (id === "dc") { ui.offer = ""; return; }
    if (id === "db") { ui.offer = ui.offer.substring(0, ui.offer.length - 1); return; }
    if (id.charAt(0) === "d" && id.length === 2 && id !== "dok") {
      if (ui.offer.length < 5) ui.offer += id.charAt(1);
      return;
    }
    if (id === "dok") {
      if (ui.selected != null) S.counterOffer(game, ui.selected, ui.offer);
      ui.offer = "";
      return;
    }
    if (id.indexOf("deg:") === 0) { S.enroll(game, id.substring(4), now); return; }
    if (id.indexOf("buy:") === 0) { S.buyItem(game, id.substring(4)); return; }
    if (id.indexOf("node:") === 0) { S.unlockNode(game, id.substring(5)); return; }
    if (id.indexOf("pick:") === 0) {
      var cat = id.substring(5);
      ui.pick = ui.pick === cat ? null : cat;
      return;
    }
    if (id.indexOf("use:") === 0) {
      var parts = id.split(":");
      ui.synth[parts[1]] = parts[2];
      ui.pick = null;
      return;
    }
    if (id === "synth") {
      var s = ui.synth;
      S.synthesize(game, s.idea, s.staff, s.marketing, s.asset);
      return;
    }
    if (id === "research") { S.research(game); return; }
    if (id.indexOf("scout:") === 0) { S.dispatchScout(game, id.substring(6)); return; }
    if (id.indexOf("craft:") === 0) { S.craftFromBook(game, id.substring(6)); return; }
    if (id === "opt:fx") { game.settings.highFX = !game.settings.highFX; game.rev += 1; return; }
    if (id === "opt:fps") {
      game.settings.fpsCap = game.settings.fpsCap === 30 ? 60 : 30;
      game.rev += 1;
      return;
    }
    if (id === "opt:perf") {
      game.settings.performanceMode = !game.settings.performanceMode;
      game.rev += 1;
      resize();
      return;
    }
    if (id === "opt:sound") {
      game.settings.muted = !game.settings.muted;
      game.rev += 1;
      return;
    }
    if (id === "reset") { ui.resetArm = true; return; }
    if (id === "reset:yes") {
      var keep = ui;
      game = S.reset(game, now);
      ui.selected = null;
      ui.offer = "";
      ui.synth = { idea: null, staff: null, marketing: null, asset: null };
      ui.resetArm = false;
      ui.seenPulse = 0;
      ui.seenLevel = game.player.level;
      root.VOID.game = game;
      persist();
      keep.menu = "settings";
    }
  }

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (ui.w / Math.max(1, rect.width)),
      y: (e.clientY - rect.top) * (ui.h / Math.max(1, rect.height))
    };
  }

  canvas.addEventListener("pointerdown", function (e) {
    canvas.setPointerCapture(e.pointerId);
    var p = pointerPos(e);
    var hit = R.hitTest(ui, p.x, p.y);
    unlockAudio(hit ? function () { blip(640, 0.035, "square", 0.03); } : null);
    if (hit) ui.press = { id: hit.id, at: Date.now() };
    ui.drag = { x: p.x, y: p.y, sx: p.x, sy: p.y, scroll: ui.scroll, log: ui.logScroll, moved: false };
  });

  canvas.addEventListener("pointermove", function (e) {
    var p = pointerPos(e);
    var hit = R.hitTest(ui, p.x, p.y);
    ui.hover = hit ? hit.id : null;
    canvas.style.cursor = hit ? "pointer" : "default";
    if (!ui.drag) return;
    var dy = p.y - ui.drag.sy;
    if (Math.abs(p.x - ui.drag.sx) + Math.abs(dy) > 8) ui.drag.moved = true;
    if (!ui.drag.moved) return;
    if (ui.menu && p.y > (ui.L ? ui.L.header : 0) && p.y < (ui.L ? ui.L.tabY : ui.h)) ui.scroll = ui.drag.scroll - (p.y - ui.drag.sy);
    else if (ui.logTop != null && p.y >= ui.logTop && p.y <= ui.logBot) {
      ui.logPin = false;
      ui.logScroll = ui.drag.log + Math.round((ui.drag.sy - p.y) / 18);
    }
  });

  canvas.addEventListener("pointerup", function (e) {
    var p = pointerPos(e);
    var drag = ui.drag;
    ui.drag = null;
    if (!drag || drag.moved) return;
    var hit = R.hitTest(ui, p.x, p.y);
    if (hit) {
      act(hit.id);
      var col = "#f0c36a";
      if (hit.id.indexOf("stock:") === 0 || hit.id.indexOf("buy:") === 0) col = "#8c4a32";
      if (hit.id === "synth" || hit.id.indexOf("craft:") === 0) col = "#f0c36a";
      if (hit.id.indexOf("fire:") === 0 || hit.id === "reset:yes") col = "#6a3424";
      R.burst(p.x, p.y, col, game);
    }
  });

  canvas.addEventListener("pointerleave", function () { ui.hover = null; });

  canvas.addEventListener("pointercancel", function () { ui.drag = null; });

  canvas.addEventListener("wheel", function (e) {
    var p = pointerPos(e);
    if (ui.menu && ui.L && p.y > ui.L.header && p.y < ui.L.tabY) {
      ui.scroll += e.deltaY;
      e.preventDefault();
      return;
    }
    if (ui.logTop != null && p.y >= ui.logTop && p.y <= ui.logBot) {
      ui.logPin = false;
      ui.logScroll += e.deltaY < 0 ? 1 : -1;
      if (ui.logScroll <= 0) {
        ui.logScroll = 0;
        ui.logPin = true;
      }
      e.preventDefault();
    }
  }, { passive: false });

  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  root.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { ui.menu = null; ui.look = ""; ui.lift = ""; return; }
    if (e.key === "1") toggleMenu("job");
    else if (e.key === "2") toggleMenu("edu");
    else if (e.key === "3") toggleMenu("scout");
    else if (e.key === "4") toggleMenu("lab");
    else if (ui.selected != null && e.key >= "0" && e.key <= "9") {
      if (ui.offer.length < 5) ui.offer += e.key;
    } else if (ui.selected != null && e.key === "Backspace") {
      ui.offer = ui.offer.substring(0, ui.offer.length - 1);
      e.preventDefault();
    } else if (ui.selected != null && e.key === "Enter") {
      S.counterOffer(game, ui.selected, ui.offer);
      ui.offer = "";
    }
  });

  root.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") persist();
  });

  var lastTs = 0;
  var lastDraw = 0;
  var lastSave = 0;
  var savedRev = -1;

  function paintError(err) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#1c1612";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#efe6d4";
    ctx.font = "16px sans-serif";
    ctx.fillText(String(err && err.message ? err.message : err), 24, 40);
  }

  function frame(ts) {
    root.requestAnimationFrame(frame);
    var now = Date.now();
    try {
      var dt = lastTs ? ts - lastTs : 16;
      lastTs = ts;
      if (dt > 80) dt = 80;
      if (dt < 0) dt = 0;
      S.frame(game, now);
      S.advanceSlides(game, dt);
      if (R.settle) R.settle(ui, game, dt, now);
      if (ui.focusSlot >= game.slots.length) ui.focusSlot = 0;
      var card = selectedCard();
      if (ui.selected != null && !card) ui.selected = null;
      var target = ui.menu ? 1 : 0;
      ui.menuT += (target - ui.menuT) * Math.min(1, dt / 140);
      if (!ui.menu && ui.menuT < 0.015) ui.menuT = 0;
      R.tick(dt, game);
      ui.seenPulse = game.pulse;
      hearCoin();
      hearClocks();
      if (game.player.level > ui.seenLevel) R.shake(3);
      ui.seenLevel = game.player.level;
      document.body.classList.toggle("perf", !!game.settings.performanceMode);
      var cap = game.settings.fpsCap === 30 ? 30 : 60;
      if (ts - lastDraw < (1000 / cap) - 0.5) return;
      var span = lastDraw ? ts - lastDraw : 16;
      lastDraw = ts;
      ui.fps = ui.fps * 0.8 + (1000 / Math.max(span, 1)) * 0.2;
      ui.dt = span;
      R.draw(ctx, game, ui, now);
      if (game.rev !== savedRev && now - lastSave > 700) {
        persist();
        savedRev = game.rev;
        lastSave = now;
      }
    } catch (err) {
      paintError(err);
    }
  }

  resize();
  root.VOID = { game: game, ui: ui, sim: S, render: R, resize: resize };
  root.requestAnimationFrame(frame);
})(window);
