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

  function toggleMenu(name) {
    if (ui.menu === name) ui.menu = null;
    else {
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
    if (id.indexOf("tab:") === 0) {
      toggleMenu(id.substring(4));
      return;
    }
    if (id === "hdr:journal") { toggleMenu("journal"); return; }
    if (id === "hdr:settings") { toggleMenu("settings"); return; }
    if (id === "close") { ui.menu = null; return; }
    if (id === "shift") { S.workShift(game, now); return; }
    if (id === "rest") { S.rest(game, now); return; }
    if (id === "applicants") { S.rollResume(game); return; }
    if (id.indexOf("stock:") === 0) { S.buyStock(game, Number(id.substring(6))); return; }
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
    if (ui.menu && p.y < (ui.L ? ui.L.tabY : ui.h)) ui.scroll = ui.drag.scroll - (p.y - ui.drag.sy);
    else if (p.y < ui.h * 0.5) {
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
      var col = "#00ffcc";
      if (hit.id.indexOf("stock:") === 0 || hit.id.indexOf("buy:") === 0) col = "#FFD700";
      if (hit.id === "synth" || hit.id.indexOf("craft:") === 0) col = "#FFD700";
      if (hit.id.indexOf("fire:") === 0 || hit.id === "reset:yes") col = "#ff3366";
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
    if (p.y < ui.h * 0.5) {
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
    if (e.key === "Escape") { ui.menu = null; return; }
    if (e.key === "1") toggleMenu("job");
    else if (e.key === "2") toggleMenu("edu");
    else if (e.key === "3") toggleMenu("lab");
    else if (e.key === "4") toggleMenu("scout");
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
    ctx.fillStyle = "#0c1020";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e06a5c";
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
      if (ui.focusSlot >= game.slots.length) ui.focusSlot = 0;
      var card = selectedCard();
      if (ui.selected != null && !card) ui.selected = null;
      var target = ui.menu ? 1 : 0;
      ui.menuT += (target - ui.menuT) * Math.min(1, dt / 140);
      if (!ui.menu && ui.menuT < 0.015) ui.menuT = 0;
      R.tick(dt, game);
      ui.seenPulse = game.pulse;
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
