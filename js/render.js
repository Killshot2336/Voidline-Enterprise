(function (root) {
  "use strict";

  var D = root.VoidData;
  var S = root.VoidSim;
  var SANS = "system-ui, Segoe UI, sans-serif";
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  var plate = null;
  var plateKey = "";
  var textCache = {};
  var cacheN = 0;

  var GOLD = "#f5c542";
  var VIOLET = "#b44ac0";
  var CYAN = "#3ec8d8";
  var CRIMSON = "#e23d3d";
  var NAVY = "#0c1020";
  var INK = "#f4efe4";
  var CREAM = "#f7f1e4";
  var DARK = "#1a140c";
  var frameGame = null;
  var logAnim = { n: -1, head: -1, t: 1 };
  var pops = [];
  var seenCash = null;
  var smileUntil = 0;
  var paperOn = false;
  var shakeLeft = 0;
  var pool = [];
  var pi;
  for (pi = 0; pi < 64; pi++) {
    pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, rot: 0, kind: 0, color: GOLD });
  }

  function font(px, mono) {
    return "600 " + px + "px " + (mono ? MONO : SANS);
  }

  function glowOk() {
    var g = frameGame;
    if (!g || !g.settings) return false;
    if (g.settings.performanceMode) return false;
    if (g.settings.fpsCap === 30) return false;
    return true;
  }

  function particlesOk() {
    var g = frameGame;
    return !!(g && g.settings && g.settings.highFX && glowOk());
  }

  function setGlow(ctx) {
    if (ctx) ctx.shadowBlur = 0;
  }

  function clearGlow(ctx) {
    ctx.shadowBlur = 0;
  }

  function easeOut(t) {
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    var u = 1 - t;
    return 1 - u * u * u;
  }

  function hoverMix(ui, id) {
    if (!ui.hot) ui.hot = {};
    var target = ui.hover === id ? 1 : 0;
    var cur = ui.hot[id] || 0;
    var dt = ui.dt > 0 ? ui.dt : 16;
    var k = 1 - Math.pow(0.001, dt / 140);
    cur += (target - cur) * k;
    if (Math.abs(cur - target) < 0.012) cur = target;
    ui.hot[id] = cur;
    return cur;
  }

  function uiScale(ui, id) {
    var base = 1 + 0.05 * hoverMix(ui, id);
    var press = ui.press;
    if (!press || press.id !== id) return base;
    var age = (ui.now || 0) - press.at;
    if (age < 0 || age >= 180) return base;
    var u = age / 180;
    var dip = 0.9;
    if (u < 0.4) return base - (u / 0.4) * (base - dip);
    return dip + ((u - 0.4) / 0.6) * (base - dip);
  }

  function mixHex(a, b, t) {
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    var out = "#";
    var i;
    for (i = 0; i < 3; i++) {
      var av = parseInt(a.substr(1 + i * 2, 2), 16);
      var bv = parseInt(b.substr(1 + i * 2, 2), 16);
      var v = Math.round(av + (bv - av) * t);
      var s = v.toString(16);
      if (s.length < 2) s = "0" + s;
      out += s;
    }
    return out;
  }

  function measure(ctx, fontStr, text) {
    var key = fontStr + "\n" + text;
    var hit = textCache[key];
    if (hit) return hit;
    ctx.font = fontStr;
    hit = ctx.measureText(text).width;
    if (cacheN > 400) {
      textCache = {};
      cacheN = 0;
    }
    textCache[key] = hit;
    cacheN += 1;
    return hit;
  }

  function clipText(ctx, fontStr, text, width) {
    if (measure(ctx, fontStr, text) <= width) return text;
    var lo = 0;
    var hi = text.length;
    var best = "";
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var slice = text.substring(0, mid) + "…";
      if (measure(ctx, fontStr, slice) <= width) {
        best = slice;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return best || "…";
  }

  function ensurePlate(w, h, perf, dpr) {
    var key = (w | 0) + "x" + (h | 0) + ":" + dpr + (perf ? ":p" : ":f");
    if (plate && plateKey === key) return plate;
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.floor(w * dpr));
    c.height = Math.max(1, Math.floor(h * dpr));
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = NAVY;
    g.fillRect(0, 0, w, h);
    if (!perf) {
      var glow = g.createRadialGradient(w * 0.5, h * 0.82, 12, w * 0.5, h * 0.72, Math.max(w, h) * 0.48);
      glow.addColorStop(0, "rgba(245,197,66,0.16)");
      glow.addColorStop(1, "rgba(12,16,32,0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
      var wash = g.createRadialGradient(w * 0.12, h * 0.08, 8, w * 0.2, h * 0.12, Math.max(w, h) * 0.42);
      wash.addColorStop(0, "rgba(62,200,216,0.14)");
      wash.addColorStop(1, "rgba(12,16,32,0)");
      g.fillStyle = wash;
      g.fillRect(0, 0, w, h);
    }
    var si;
    g.fillStyle = "#f4efe4";
    for (si = 0; si < 42; si++) {
      var sx = ((si * 97) % 1000) / 1000 * w;
      var sy = ((si * 53) % 520) / 520 * h * 0.42;
      g.globalAlpha = 0.28 + (si % 5) * 0.1;
      g.beginPath();
      g.arc(sx, sy, (si % 3) + 1, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    var moon = Math.min(w, h) * 0.05;
    g.fillStyle = "#f6e7b8";
    g.beginPath();
    g.arc(w * 0.78, h * 0.1, moon, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = NAVY;
    g.beginPath();
    g.arc(w * 0.78 + moon * 0.45, h * 0.09, moon * 0.82, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#171c30";
    g.fillRect(0, h * 0.78, w, h * 0.22);
    g.fillStyle = "#222844";
    g.fillRect(w * 0.06, h * 0.64, w * 0.12, h * 0.16);
    g.fillStyle = GOLD;
    g.fillRect(w * 0.08, h * 0.68, w * 0.03, h * 0.04);
    g.fillStyle = "#2a3358";
    g.fillRect(w * 0.82, h * 0.6, w * 0.1, h * 0.2);
    plate = c;
    plateKey = key;
    return plate;
  }

  function layout(w, h) {
    var narrow = w < 560;
    var header = narrow ? 156 : (h < 620 ? 118 : 134);
    var tabH = h < 620 ? 82 : 92;
    var storyBot = h - tabH;
    return {
      w: w,
      h: h,
      header: header,
      a1: storyBot,
      b0: storyBot,
      b1: storyBot,
      tabH: tabH,
      tabY: storyBot
    };
  }

  function round(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function icon(ctx, kind, cx, cy, s, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.6, s * 0.1);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    var u = s * 0.46;
    if (kind === "coin") {
      ctx.beginPath();
      ctx.arc(0, 0, u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a2a08";
      ctx.font = "700 " + Math.max(10, s * 0.5) + "px " + MONO;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", 0, 1);
    } else if (kind === "brain") {
      ctx.beginPath();
      ctx.arc(-u * 0.32, 0, u * 0.62, 0, Math.PI * 2);
      ctx.arc(u * 0.32, -u * 0.06, u * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(12,16,32,0.35)";
      ctx.fillRect(-u * 0.08, -u * 0.7, u * 0.16, u * 1.4);
    } else if (kind === "flame") {
      ctx.beginPath();
      ctx.moveTo(0, -u);
      ctx.bezierCurveTo(u * 0.95, -u * 0.15, u * 0.85, u * 0.55, 0, u);
      ctx.bezierCurveTo(-u * 0.85, u * 0.55, -u * 0.95, -u * 0.15, 0, -u);
      ctx.fill();
      ctx.fillStyle = "#fff3c4";
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.15);
      ctx.bezierCurveTo(u * 0.35, u * 0.15, u * 0.28, u * 0.55, 0, u * 0.72);
      ctx.bezierCurveTo(-u * 0.28, u * 0.55, -u * 0.35, u * 0.15, 0, -u * 0.15);
      ctx.fill();
    } else if (kind === "star") {
      var i;
      var a;
      ctx.beginPath();
      for (i = 0; i < 5; i++) {
        a = -Math.PI / 2 + i * Math.PI * 2 / 5;
        var px = Math.cos(a) * u;
        var py = Math.sin(a) * u;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
        a += Math.PI / 5;
        ctx.lineTo(Math.cos(a) * u * 0.42, Math.sin(a) * u * 0.42);
      }
      ctx.closePath();
      ctx.fill();
    } else if (kind === "shop") {
      ctx.beginPath();
      ctx.moveTo(-u * 1.05, -u * 0.05);
      ctx.lineTo(0, -u);
      ctx.lineTo(u * 1.05, -u * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-u * 0.82, -u * 0.05, u * 1.64, u * 1.05);
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(-u * 0.22, u * 0.22, u * 0.44, u * 0.78);
    } else if (kind === "cap") {
      ctx.beginPath();
      ctx.moveTo(-u * 0.85, u * 0.05);
      ctx.lineTo(0, -u * 0.85);
      ctx.lineTo(u * 0.85, u * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-u * 1.15, u * 0.05, u * 2.3, u * 0.28);
      ctx.beginPath();
      ctx.moveTo(u * 0.7, -u * 0.15);
      ctx.lineTo(u * 1.15, u * 0.35);
      ctx.lineTo(u * 0.55, u * 0.15);
      ctx.fill();
    } else if (kind === "people") {
      ctx.beginPath();
      ctx.arc(-u * 0.32, -u * 0.35, u * 0.38, 0, Math.PI * 2);
      ctx.arc(u * 0.38, -u * 0.22, u * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-u * 0.32, u * 0.55, u * 0.62, Math.PI, 0);
      ctx.arc(u * 0.42, u * 0.62, u * 0.5, Math.PI, 0);
      ctx.fill();
    } else if (kind === "box") {
      ctx.fillRect(-u * 0.85, -u * 0.15, u * 1.7, u * 1.05);
      ctx.fillRect(-u * 0.95, -u * 0.55, u * 1.9, u * 0.38);
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(-u * 0.12, -u * 0.55, u * 0.24, u * 0.38);
    } else if (kind === "book") {
      ctx.fillRect(-u * 0.8, -u * 0.7, u * 1.55, u * 1.45);
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(-u * 0.08, -u * 0.55, u * 0.12, u * 1.15);
    } else if (kind === "gear") {
      var t;
      for (t = 0; t < 6; t++) {
        ctx.save();
        ctx.rotate(t * Math.PI / 3);
        ctx.fillRect(-u * 0.16, -u * 0.95, u * 0.32, u * 0.4);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, u * 0.62, 0, Math.PI * 2);
      ctx.arc(0, 0, u * 0.26, 0, Math.PI * 2, true);
      ctx.fill("evenodd");
    } else if (kind === "alert") {
      ctx.beginPath();
      ctx.moveTo(0, -u);
      ctx.lineTo(u * 0.95, u * 0.8);
      ctx.lineTo(-u * 0.95, u * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(-u * 0.1, -u * 0.35, u * 0.2, u * 0.55);
      ctx.beginPath();
      ctx.arc(0, u * 0.42, u * 0.12, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "rest") {
      ctx.fillRect(-u * 0.55, -u * 0.15, u * 1.15, u * 0.85);
      ctx.strokeRect(-u * 0.55, -u * 0.15, u * 1.15, u * 0.85);
      ctx.beginPath();
      ctx.arc(u * 0.55, -u * 0.35, u * 0.28, Math.PI, 0);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, u * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function badge(ctx, kind, cx, cy, d, bg, fg) {
    ctx.beginPath();
    ctx.arc(cx, cy, d * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
    icon(ctx, kind, cx, cy, d * 0.62, fg);
  }

  function pushHit(ui, id, x, y, w, h) {
    if (ui.clip) {
      var c = ui.clip;
      var x2 = Math.max(x, c.x);
      var y2 = Math.max(y, c.y);
      var rw = Math.min(x + w, c.x + c.w) - x2;
      var rh = Math.min(y + h, c.y + c.h) - y2;
      if (rw < 8 || rh < 14) return;
      x = x2;
      y = y2;
      w = rw;
      h = rh;
    }
    ui.hits.push({ id: id, x: x, y: y, w: w, h: h });
  }

  function button(ctx, ui, id, x, y, w, h, label, on, disabled) {
    var scale = disabled ? 1 : uiScale(ui, id);
    var hover = ui.hover === id && !disabled;
    var cx = x + w * 0.5;
    var cy = y + h * 0.5;
    ctx.save();
    if (scale !== 1) {
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }
    clearGlow(ctx);
    round(ctx, x, y, w, h, paperOn ? 14 : 10);
    if (paperOn) {
      ctx.fillStyle = disabled ? "#e6dfd2" : on ? GOLD : hover ? "#fffdf8" : "#fffdf8";
      ctx.fill();
      ctx.strokeStyle = disabled ? "#d4cbb8" : DARK;
      ctx.lineWidth = on ? 2 : 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = disabled ? "#1a1e2a" : on ? "#3a3018" : hover ? "#243044" : "#171b28";
      ctx.fill();
      ctx.strokeStyle = disabled ? "#2a3142" : (on || hover) ? GOLD : "#2c3548";
      ctx.lineWidth = on ? 2 : 1;
      ctx.stroke();
    }
    var f = font(w < 110 ? 12 : 15, false);
    ctx.font = f;
    ctx.fillStyle = paperOn ? (disabled ? "#9a9186" : DARK) : (disabled ? "#6c7380" : on ? GOLD : INK);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, f, label, w - 12), cx, cy);
    ctx.restore();
    ctx.textAlign = "left";
    if (!disabled) pushHit(ui, id, x, y, w, h);
  }

  function openFlow(ctx, ui, rect, scroll) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    return {
      ctx: ctx,
      ui: ui,
      x: rect.x + 16,
      w: rect.w - 32,
      top: rect.y,
      bottom: rect.y + rect.h,
      cy: 12,
      scroll: scroll,
      rect: rect
    };
  }

  function row(flow, h) {
    var screen = flow.rect.y + flow.cy - flow.scroll;
    var on = screen + h > flow.top && screen < flow.bottom;
    flow.cy += h;
    return { y: screen, h: h, on: on };
  }

  function sectionIcon(text) {
    var map = {
      "WORK": "shop",
      "SCHOOL": "cap",
      "STUFF": "box",
      "PEOPLE": "people",
      "THE BOOK": "book",
      "SETTINGS": "gear",
      "YOUR SHOPS": "shop",
      "YOUR CORNER": "shop",
      "HOBBIES": "star",
      "RIGHT NOW": "flame",
      "JOBS YOU CAN OPEN": "shop",
      "WHO'S ASKING": "people",
      "HOW SHARP YOU ARE": "brain",
      "CLASSES": "cap",
      "BUY STUFF": "coin",
      "POINTS": "star",
      "CLOUT": "star",
      "SHADY": "alert",
      "STREET": "flame",
      "MACHINES": "gear",
      "MIX STUFF": "box",
      "SEND SOMEONE": "people",
      "OUT RIGHT NOW": "people",
      "WHAT YOU BUILT": "box",
      "HOW IT RUNS": "gear",
      "START OVER": "alert"
    };
    return map[text] || "";
  }

  function section(flow, text) {
    var r = row(flow, 30);
    if (!r.on) return;
    var ctx = flow.ctx;
    var kind = sectionIcon(text);
    var tx = flow.x;
    if (kind) {
      badge(ctx, kind, flow.x + 11, r.y + 15, 22, paperOn ? "#fffdf8" : "#241c10", paperOn ? "#8a5a12" : GOLD);
      tx += 28;
    }
    var f = font(12, false);
    ctx.font = f;
    ctx.fillStyle = text === "SHADY" || text === "STREET" ? VIOLET : (paperOn ? "#8a5a12" : GOLD);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, tx, r.y + 15);
    clearGlow(ctx);
  }

  function para(flow, text) {
    var r = row(flow, 20);
    if (!r.on) return;
    var ctx = flow.ctx;
    var f = font(14, false);
    ctx.font = f;
    ctx.fillStyle = paperOn ? "#3d3428" : "#c5cad6";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, f, text, flow.w), flow.x, r.y + 10);
    clearGlow(ctx);
  }

  function traitText(game, traitId, caught) {
    var t = D.TRAITS[traitId];
    if (!t) return traitId;
    if (t.hidden && !caught && game.player.intelligence < 75 && !(game.flags && game.flags.exposeTraits)) return "Sealed trait";
    return t.name;
  }

  function traitLine(game, traits, caught) {
    var bits = [];
    var i;
    for (i = 0; i < traits.length; i++) bits.push(traitText(game, traits[i], caught));
    return bits.join(" · ");
  }

  function titleInk() {
    return paperOn ? DARK : "#f6f3ec";
  }

  function muteInk() {
    return paperOn ? "#6b6258" : "#9aa1ad";
  }

  function cardFill() {
    return paperOn ? "#fffdf8" : "rgba(15,15,15,0.85)";
  }

  function drawOccupation(flow, game, ui) {
    var skills = game.player.skills || { work: 0, mind: 0, hustle: 0, clout: 0 };
    section(flow, "YOUR CORNER");
    para(flow, "Work " + skills.work + " · Mind " + skills.mind + " · Hustle " + skills.hustle + " · Clout " + skills.clout);
    var place = game.player.place || { owned: false, lights: 0, sign: 0, counter: 0 };
    if (!place.owned) {
      para(flow, "A bare corner rents for " + S.money(D.ROOM.rent) + ".");
      var rentRow = row(flow, 40);
      if (rentRow.on) button(flow.ctx, ui, "room", flow.x, rentRow.y, flow.w, 32, "Rent the corner", false, game.player.capital < D.ROOM.rent);
    } else {
      para(flow, (place.lights ? "Warm lights" : "Bare bulb") + " · " + (place.sign ? "sign up" : "no sign") + " · " + (place.counter ? "real counter" : "folding table") + ".");
      var parts = [["lights", "Warm lights"], ["sign", "Paint a sign"], ["counter", "Real counter"]];
      var pi;
      for (pi = 0; pi < parts.length; pi++) {
        var part = parts[pi][0];
        var done = !!place[part];
        var ur = row(flow, 36);
        if (!ur.on) continue;
        button(flow.ctx, ui, "upgrade:" + part, flow.x, ur.y, flow.w, 30, done ? parts[pi][1] + "  in" : parts[pi][1] + "  " + S.money(D.ROOM[part]), done, done || game.player.capital < D.ROOM[part]);
      }
    }
    section(flow, "HOBBIES");
    var hi;
    for (hi = 0; hi < D.HOBBIES.length; hi++) {
      var hobby = D.HOBBIES[hi];
      var openH = S.hobbyOpen(game, hobby);
      var hr = row(flow, 36);
      if (!hr.on) continue;
      button(flow.ctx, ui, "hobby:" + hobby.id, flow.x, hr.y, flow.w, 30, hobby.name + (openH ? "  " + S.money(hobby.pay) : "  needs " + hobby.needSkill + " " + hobby.need), false, !openH);
    }

    section(flow, "YOUR SHOPS");
    para(flow, "A shift turns stock into cash. A shady hire can walk off with the shelf.");
    var i;
    for (i = 0; i < game.slots.length; i++) {
      var slot = game.slots[i];
      var job = D.jobById[slot.jobId];
      var r = row(flow, 108);
      if (r.on) {
        var ctx = flow.ctx;
        clearGlow(ctx);
        round(ctx, flow.x, r.y, flow.w, 100, 16);
        ctx.fillStyle = cardFill();
        ctx.fill();
        ctx.strokeStyle = ui.focusSlot === i ? (paperOn ? DARK : GOLD) : (paperOn ? "#e0d2b8" : CYAN);
        ctx.lineWidth = ui.focusSlot === i ? 2 : 1;
        setGlow(ctx, ctx.strokeStyle);
        ctx.stroke();
        clearGlow(ctx);
        var f = font(15, false);
        ctx.font = f;
        ctx.fillStyle = titleInk();
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(clipText(ctx, f, "Shop " + (i + 1) + " · " + (job ? job.name : "Kiosk"), flow.w - 20), flow.x + 12, r.y + 18);
        ctx.font = font(12, false);
        ctx.fillStyle = muteInk();
        var emp = slot.employee ? slot.employee.name + " · " + S.money(slot.employee.salary) : "Nobody's working";
        if (slot.employee && slot.employee.caught) emp += "  · caught";
        ctx.fillText(clipText(ctx, font(12, false), emp + "  ·  stock " + slot.stock + "/" + S.stockCap(game), flow.w - 20), flow.x + 12, r.y + 40);
        if (slot.employee) {
          ctx.fillStyle = slot.employee.caught ? CRIMSON : muteInk();
          ctx.fillText(clipText(ctx, font(12, false), traitLine(game, slot.employee.traits, slot.employee.caught), flow.w - 20), flow.x + 12, r.y + 58);
        } else {
          ctx.fillText(slot.camera ? "Camera's on. Waiting for a hire." : "No camera. Theft stays a mystery.", flow.x + 12, r.y + 58);
        }
        var bw = Math.min(150, (flow.w - 36) / 3);
        button(ctx, ui, "stock:" + i, flow.x + 12, r.y + 68, bw, 26, "Buy stock", false, false);
        button(ctx, ui, "fire:" + i, flow.x + 18 + bw, r.y + 68, bw, 26, "Fire", false, !slot.employee);
        var camLabel = slot.camera ? "Camera on" : "Add camera";
        button(ctx, ui, "cam:" + i, flow.x + 24 + bw * 2, r.y + 68, bw, 26, camLabel, slot.camera, slot.camera);
        pushHit(ui, "focus:" + i, flow.x, r.y, flow.w, 64);
      }
    }
    if (S.slotCap(game) < 2) para(flow, "A second shop opens after Operations Bachelor or the Server Rack.");

    section(flow, "RIGHT NOW");
    var actions = row(flow, 40);
    if (actions.on) {
      var aw = (flow.w - 16) / 3;
      button(flow.ctx, ui, "shift", flow.x, actions.y, aw, 32, "Work the rush", true, false);
      button(flow.ctx, ui, "rest", flow.x + aw + 8, actions.y, aw, 32, "Take a break", false, false);
      button(flow.ctx, ui, "applicants", flow.x + (aw + 8) * 2, actions.y, aw, 32, "Find people", false, false);
    }

    section(flow, "JOBS YOU CAN OPEN");
    para(flow, "Goes on shop " + ((ui.focusSlot || 0) + 1) + ". Tap a shop to switch.");
    for (i = 0; i < D.JOBS.length; i++) {
      var spec = D.JOBS[i];
      var open = S.jobUnlocked(game, spec);
      var jr = row(flow, 36);
      if (!jr.on) continue;
      var current = game.slots[ui.focusSlot] && game.slots[ui.focusSlot].jobId === spec.id;
      flow.ctx.font = font(13, false);
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      var need = "Year " + spec.level;
      if (spec.skill) need += " · " + spec.skill + " " + spec.skillNeed;
      else if (spec.node) need += " · " + D.nodeById[spec.node].name;
      flow.ctx.fillStyle = open ? titleInk() : "#8a8478";
      flow.ctx.fillText(clipText(flow.ctx, font(13, false), spec.name + "  ·  " + need, flow.w - 120), flow.x, jr.y + 16);
      button(flow.ctx, ui, "apply:" + (ui.focusSlot || 0) + ":" + spec.id, flow.x + flow.w - 108, jr.y + 2, 108, 28, current ? "Active" : "Apply", current, !open || current);
    }

    section(flow, "WHO'S ASKING");
    para(flow, "Offer less than they ask. Three no's and they walk. Their real minimum stays hidden.");
    if (!game.resumes.length) para(flow, "Nobody's waiting. Go find people.");
    for (i = 0; i < game.resumes.length; i++) {
      var card = game.resumes[i];
      var selected = ui.selected === card.id;
      var slide = card.dying ? Math.min(1, card.slide) * (flow.w + 40) : 0;
      var height = selected && !card.dying ? 250 : 78;
      var cr = row(flow, height + 8);
      if (!cr.on) continue;
      var ctx2 = flow.ctx;
      ctx2.save();
      ctx2.translate(slide, 0);
      clearGlow(ctx2);
      round(ctx2, flow.x, cr.y, flow.w, height, 16);
      ctx2.fillStyle = cardFill();
      ctx2.fill();
      ctx2.strokeStyle = card.dying ? CRIMSON : selected ? (paperOn ? DARK : GOLD) : (paperOn ? "#e0d2b8" : CYAN);
      ctx2.lineWidth = 1;
      setGlow(ctx2, ctx2.strokeStyle);
      ctx2.stroke();
      clearGlow(ctx2);
      ctx2.font = font(15, false);
      ctx2.fillStyle = titleInk();
      ctx2.textAlign = "left";
      ctx2.textBaseline = "middle";
      ctx2.fillText(card.name, flow.x + 12, cr.y + 18);
      ctx2.font = font(12, false);
      var askLine = "Asks " + S.money(card.ask) + "   ·   strikes " + card.strikes + "/3";
      if (game.flags.insight || game.player.intelligence >= 75) {
        var low = Math.round(card.floor * 0.9);
        var high = Math.min(card.ask, Math.round(card.floor * 1.12));
        askLine += "   ·   range " + S.money(low) + "-" + S.money(high);
      }
      ctx2.fillStyle = "#d6b25e";
      ctx2.fillText(clipText(ctx2, font(12, false), askLine, flow.w - 24), flow.x + 12, cr.y + 40);
      ctx2.fillStyle = muteInk();
      ctx2.fillText(clipText(ctx2, font(12, false), traitLine(game, card.traits, false), flow.w - 24), flow.x + 12, cr.y + 60);
      if (!card.dying) pushHit(ui, "resume:" + card.id, flow.x, cr.y, flow.w, 74);
      if (selected && !card.dying) drawKeypad(ctx2, ui, flow.x + 12, cr.y + 78, Math.min(280, flow.w - 24));
      ctx2.restore();
    }
  }

  function drawKeypad(ctx, ui, x, y, w) {
    ctx.font = font(18, false);
    ctx.fillStyle = titleInk();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Your offer  " + (ui.offer ? S.money(Number(ui.offer)) : "$—"), x, y + 8);
    var keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "<"];
    var gap = 6;
    var bw = (w - gap * 2) / 3;
    var bh = 32;
    var i;
    for (i = 0; i < keys.length; i++) {
      var col = i % 3;
      var line = (i / 3) | 0;
      var id = keys[i] === "C" ? "dc" : keys[i] === "<" ? "db" : "d" + keys[i];
      button(ctx, ui, id, x + col * (bw + gap), y + 24 + line * (bh + gap), bw, bh, keys[i], false, false);
    }
    button(ctx, ui, "dok", x, y + 24 + 4 * (bh + gap), w, 32, "Make the offer", true, false);
  }

  function drawEducation(flow, game, ui) {
    section(flow, "HOW SHARP YOU ARE");
    para(flow, "XP " + Math.floor(game.player.xp) + " / " + Math.round(S.xpNeed(game.player.level)) + " to hit year " + (game.player.level + 1) + ". Each year gives 1 Void Point.");
    if (D.GRADS) {
      var g;
      for (g = 0; g < D.GRADS.length; g++) {
        var grad = D.GRADS[g];
        var held = game.grad && game.grad[grad.id];
        para(flow, (held ? "Graduated" : Math.round(grad.xp) + " XP") + " · " + grad.name + " · " + grad.text);
      }
    }
    section(flow, "CLASSES");
    para(flow, "Class follows the real clock. Some hours go faster.");
    if (game.degree) {
      var def = D.degreeById[game.degree.id];
      var pct = 1 - game.degree.left / game.degree.total;
      if (pct < 0) pct = 0;
      if (pct > 1) pct = 1;
      para(flow, (def ? def.name : "Degree") + "  " + Math.round(pct * 100) + "%  ·  " + S.fmtMs(game.degree.left) + " left");
      var bar = row(flow, 16);
      if (bar.on) {
        round(flow.ctx, flow.x, bar.y, flow.w, 8, 4);
        flow.ctx.fillStyle = "#2a303a";
        flow.ctx.fill();
        round(flow.ctx, flow.x, bar.y, Math.max(4, flow.w * pct), 8, 4);
        flow.ctx.fillStyle = "#d6b25e";
        flow.ctx.fill();
      }
    } else para(flow, "You're not in class. One class at a time.");
    var i;
    for (i = 0; i < D.DEGREES.length; i++) {
      var deg = D.DEGREES[i];
      var done = !!game.degrees[deg.id];
      var dr = row(flow, 36);
      if (!dr.on) continue;
      flow.ctx.font = font(13, false);
      flow.ctx.fillStyle = done ? "#2f8f5b" : titleInk();
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(clipText(flow.ctx, font(13, false), deg.name + " · " + deg.text, flow.w - 120), flow.x, dr.y + 16);
      button(flow.ctx, ui, "deg:" + deg.id, flow.x + flow.w - 108, dr.y + 2, 108, 28, done ? "Filed" : S.money(deg.cost), done, done);
    }

    section(flow, "BUY STUFF");
    var vol = S.volatilityFactor(game.lastReal || Date.now());
    para(flow, "Prices swing with the hour. Right now the swing is " + vol.toFixed(2) + ".");
    for (i = 0; i < D.ITEMS.length; i++) {
      var item = D.ITEMS[i];
      var ir = row(flow, 32);
      if (!ir.on) continue;
      var owned = game.mats[item.id] || 0;
      var locked = game.player.level < item.level;
      flow.ctx.font = font(13, false);
      flow.ctx.fillStyle = locked ? "#8a8478" : titleInk();
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(clipText(flow.ctx, font(13, false), item.name + " · " + item.cat + " · held " + owned, flow.w - 100), flow.x, ir.y + 14);
      button(flow.ctx, ui, "buy:" + item.id, flow.x + flow.w - 88, ir.y + 1, 88, 26, locked ? "Locked" : S.money(S.marketCost(game, item)), false, locked);
    }
  }

  function drawLab(flow, game, ui) {
    section(flow, "POINTS");
    para(flow, "You have " + game.player.vp + ". Spend them on clout or on machines. Each new year gives 1.");
    var lineName = "";
    var i;
    for (i = 0; i < D.NODES.length; i++) {
      var node = D.NODES[i];
      if (node.line !== lineName) {
        lineName = node.line;
        section(flow, lineName === "visibility" ? "CLOUT" : (lineName === "shady" ? "SHADY" : "MACHINES"));
      }
      var owned = !!game.nodes[node.id];
      var nr = row(flow, 44);
      if (!nr.on) continue;
      flow.ctx.font = font(14, false);
      flow.ctx.fillStyle = owned ? "#2f8f5b" : titleInk();
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(node.name, flow.x, nr.y + 12);
      flow.ctx.font = font(11, false);
      flow.ctx.fillStyle = muteInk();
      flow.ctx.fillText(clipText(flow.ctx, font(11, false), node.text, flow.w - 100), flow.x, nr.y + 30);
      button(flow.ctx, ui, "node:" + node.id, flow.x + flow.w - 88, nr.y + 6, 88, 28, owned ? "Open" : node.cost + " VP", owned, owned);
    }

    if (game.nodes.skim || game.nodes.score) {
      section(flow, "STREET");
      para(flow, "Heat is " + Math.round(game.player.heat || 0) + ". A bust takes cash. High heat makes you sit.");
      var street = row(flow, 40);
      if (street.on) {
        if (game.nodes.skim) button(flow.ctx, ui, "skim", flow.x, street.y, game.nodes.score ? (flow.w - 8) * 0.48 : flow.w, 32, "Skim", false, false);
        if (game.nodes.score) button(flow.ctx, ui, "score", flow.x + (game.nodes.skim ? (flow.w - 8) * 0.52 : 0), street.y, game.nodes.skim ? (flow.w - 8) * 0.48 : flow.w, 32, "Big score", false, false);
      }
    }

    section(flow, "MIX STUFF");
    para(flow, "Drop parts in the slots. Two of the right ones make something legendary. The book remembers it.");
    var cats = [
      ["idea", "Idea"],
      ["staff", "Staff"],
      ["marketing", "Marketing"],
      ["asset", "Asset"]
    ];
    var box = row(flow, 44);
    if (box.on) {
      var bw = (flow.w - 18) / 4;
      for (i = 0; i < cats.length; i++) {
        var id = ui.synth[cats[i][0]];
        var item = id ? D.itemById[id] : null;
        button(flow.ctx, ui, "pick:" + cats[i][0], flow.x + i * (bw + 6), box.y, bw, 36, item ? item.fragment : cats[i][1], ui.pick === cats[i][0], false);
      }
    }
    var go = row(flow, 40);
    if (go.on) {
      button(flow.ctx, ui, "synth", flow.x, go.y, (flow.w - 8) * 0.62, 32, "Mix it", true, false);
      button(flow.ctx, ui, "research", flow.x + (flow.w - 8) * 0.62 + 8, go.y, (flow.w - 8) * 0.38, 32, "Research 1 VP", false, game.player.vp < 1);
    }
    if (ui.pick) {
      section(flow, "CHOOSE " + ui.pick.toUpperCase());
      var any = false;
      for (i = 0; i < D.ITEMS.length; i++) {
        var mat = D.ITEMS[i];
        var count = game.mats[mat.id] || 0;
        if (count <= 0) continue;
        any = true;
        var pr = row(flow, 32);
        if (!pr.on) continue;
        button(flow.ctx, ui, "use:" + ui.pick + ":" + mat.id, flow.x, pr.y, flow.w, 28, mat.name + "  ×" + count, ui.synth[ui.pick] === mat.id, false);
      }
      if (!any) para(flow, "You don't own any of these. Buy them in School.");
    }
    para(flow, "Cameras bolt onto a shop after Camera Schematic. Cost " + S.money(D.CAM_COST) + ".");
  }

  function drawScouts(flow, game) {
    section(flow, "SEND SOMEONE");
    if (!game.nodes.charter) para(flow, "Scout Charter is still locked. It's on the clout line in Stuff.");
    else para(flow, "They leave on the real clock. Late night is faster. Two people out at once.");
    var i;
    for (i = 0; i < D.SCOUTS.length; i++) {
      var scout = D.SCOUTS[i];
      var sr = row(flow, 36);
      if (!sr.on) continue;
      flow.ctx.font = font(13, false);
      flow.ctx.fillStyle = titleInk();
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(clipText(flow.ctx, font(13, false), scout.name + " · " + scout.text, flow.w - 110), flow.x, sr.y + 16);
      button(flow.ctx, uiOf(flow), "scout:" + scout.id, flow.x + flow.w - 100, sr.y + 2, 100, 28, S.money(scout.cost), false, !game.nodes.charter);
    }
    if (S.liquidationValue) {
      para(flow, "Space " + (game.space || 0) + "%  ·  If you sold everything: " + S.money(S.liquidationValue(game, game.lastReal || Date.now())));
    }
    section(flow, "OUT RIGHT NOW");
    if (!game.scouts.length) para(flow, "Nobody's out.");
    for (i = 0; i < game.scouts.length; i++) {
      var mission = game.scouts[i];
      var def = D.scoutById[mission.id];
      var pct = 1 - mission.left / mission.total;
      para(flow, (def ? def.name : mission.id) + " · " + S.fmtMs(mission.left) + " · " + Math.round(pct * 100) + "%");
    }
    section(flow, "WHAT YOU BUILT");
    if (!game.crafted.length) para(flow, "You haven't mixed anything yet.");
    for (i = 0; i < game.crafted.length; i++) {
      var crafted = game.crafted[i];
      var tag = crafted.legendary ? "Legendary" : "Hybrid";
      var extra = crafted.blurb ? crafted.blurb : crafted.tag + " x" + Number(crafted.mult).toFixed(2);
      para(flow, tag + " · " + crafted.name + " · " + extra);
    }
  }

  function uiOf(flow) {
    return flow.ui;
  }

  function drawJournal(flow, game, ui) {
    section(flow, "THE BOOK");
    para(flow, "Stuff you've figured out. Mix it again when you still own the parts.");
    if (!game.book.length) para(flow, "Empty. Mix things in Stuff, or spend a Void Point to research.");
    var i;
    for (i = 0; i < game.book.length; i++) {
      var key = game.book[i];
      var pair = key.indexOf("pair:") === 0 && D.pairById ? D.pairById[Number(key.slice(5))] : null;
      var legend = pair || D.recipeByKey[key];
      var name = legend ? legend.name : key;
      var ids = pair ? [pair.a, pair.b] : legend ? [legend.idea, legend.staff, legend.marketing, legend.asset] : key.split("|");
      var bits = [];
      var k;
      var have = true;
      if (pair) {
        var ownedN = 0;
        var needN = 2;
        for (k = 0; k < game.crafted.length; k++) if (game.crafted[k].rid === 134) needN = 1;
        if ((game.mats[pair.a] || 0) >= 1) ownedN += 1;
        if ((game.mats[pair.b] || 0) >= 1) ownedN += 1;
        have = ownedN >= needN;
      }
      for (k = 0; k < ids.length; k++) {
        var item = D.itemById[ids[k]];
        bits.push(item ? item.fragment : ids[k]);
        if (!pair && (game.mats[ids[k]] || 0) < 1) have = false;
      }
      var active = false;
      for (k = 0; k < game.crafted.length; k++) if (game.crafted[k].key === key) active = true;
      var jr = row(flow, 48);
      if (!jr.on) continue;
      flow.ctx.font = font(14, false);
      flow.ctx.fillStyle = titleInk();
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(clipText(flow.ctx, font(14, false), (legend ? "★ " : "") + name, flow.w - 110), flow.x, jr.y + 14);
      flow.ctx.font = font(11, false);
      flow.ctx.fillStyle = muteInk();
      flow.ctx.fillText(clipText(flow.ctx, font(11, false), bits.join(" + "), flow.w - 110), flow.x, jr.y + 32);
      button(flow.ctx, ui, "craft:" + key, flow.x + flow.w - 100, jr.y + 8, 100, 28, active ? "Active" : "Craft", active, active || !have);
    }
  }

  function drawSettings(flow, game, ui) {
    section(flow, "HOW IT RUNS");
    para(flow, "Built for a school laptop. The clock keeps going even when the picture slows down.");
    var r1 = row(flow, 40);
    if (r1.on) button(flow.ctx, ui, "opt:fx", flow.x, r1.y, flow.w, 32, "Particle bursts: " + (game.settings.highFX ? "On" : "Off"), game.settings.highFX, false);
    var r2 = row(flow, 40);
    if (r2.on) button(flow.ctx, ui, "opt:fps", flow.x, r2.y, flow.w, 32, "Draw cap: " + (game.settings.fpsCap === 30 ? "30 Hz" : "60 Hz"), false, false);
    var r3 = row(flow, 40);
    if (r3.on) button(flow.ctx, ui, "opt:perf", flow.x, r3.y, flow.w, 32, "Performance mode: " + (game.settings.performanceMode ? "On" : "Off"), game.settings.performanceMode, false);
    para(flow, "Performance mode and the 30 Hz cap skip the click sparks.");
    section(flow, "START OVER");
    var r4 = row(flow, 40);
    if (r4.on) button(flow.ctx, ui, ui.resetArm ? "reset:yes" : "reset", flow.x, r4.y, flow.w, 32, ui.resetArm ? "Yes, wipe it" : "Reset save", false, false);
    if (ui.resetArm) para(flow, "This deletes your save and keeps these settings.");
  }

  function drawMenu(ctx, game, ui, L) {
    var ease = ui.menuT;
    var y = L.header + (1 - ease) * (L.tabY - L.header);
    var h = L.tabY - y;
    clearGlow(ctx);
    round(ctx, 10, y, L.w - 20, h, 18);
    ctx.fillStyle = CREAM;
    ctx.fill();
    ctx.strokeStyle = "#e4d3b0";
    ctx.lineWidth = 1;
    ctx.stroke();
    clearGlow(ctx);
    if (ease < 0.8) return;
    paperOn = true;
    var rect = { x: 10, y: y, w: L.w - 20, h: h };
    ui.clip = rect;
    if (ui.scroll < 0) ui.scroll = 0;
    var flow = openFlow(ctx, ui, rect, ui.scroll);
    var titles = { job: "WORK", edu: "SCHOOL", lab: "STUFF", scout: "PEOPLE", journal: "THE BOOK", settings: "SETTINGS" };
    section(flow, titles[ui.menu] || "MENU");
    var close = row(flow, 34);
    if (close.on) button(ctx, ui, "close", flow.x + flow.w - 90, close.y, 90, 26, "Close", false, false);
    if (ui.menu === "job") drawOccupation(flow, game, ui);
    else if (ui.menu === "edu") drawEducation(flow, game, ui);
    else if (ui.menu === "lab") drawLab(flow, game, ui);
    else if (ui.menu === "scout") drawScouts(flow, game);
    else if (ui.menu === "journal") drawJournal(flow, game, ui);
    else if (ui.menu === "settings") drawSettings(flow, game, ui);
    ctx.restore();
    paperOn = false;
    ui.clip = null;
    ui.contentH = flow.cy + 20;
    var max = ui.contentH - h;
    if (max < 0) max = 0;
    if (ui.scroll > max) ui.scroll = max;
  }

  function wrapLines(ctx, fontStr, text, width, maxLines) {
    var words = String(text || "").split(" ");
    var lines = [];
    var cur = "";
    var i;
    for (i = 0; i < words.length; i++) {
      var next = cur ? cur + " " + words[i] : words[i];
      if (measure(ctx, fontStr, next) <= width || !cur) cur = next;
      else {
        lines.push(cur);
        cur = words[i];
        if (lines.length === maxLines - 1) {
          i += 1;
          break;
        }
      }
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && i < words.length) {
      var rest = cur;
      var k;
      for (k = i; k < words.length; k++) rest += " " + words[k];
      lines[maxLines - 1] = clipText(ctx, fontStr, rest, width);
    }
    if (!lines.length) lines.push("");
    return lines;
  }

  function storyBeat(text, game) {
    var raw = text || "";
    var low = raw.toLowerCase();
    var body = raw;
    if (body.charAt(0) === "!" || body.charAt(0) === "+" || body.charAt(0) === "*") body = body.substring(1).replace(/^\s+/, "");
    var slot = game.slots && game.slots[0];
    var stockOut = !!(slot && slot.stock <= 0);
    var stressed = game.player.stress > 50;
    var beat = {
      line: body || "The door is open. Your move.",
      rail: GOLD,
      action: "shift",
      label: "Work the rush",
      alt: stressed ? "rest" : (stockOut ? "stock:0" : null),
      altLabel: stressed ? "Take a break" : (stockOut ? "Restock" : null)
    };
    if (!raw || low.indexOf("you're broke") >= 0 || low.indexOf("zero dollars") >= 0) {
      beat.line = "Zero dollars. A shift pays tonight. A hobby pays less and teaches you.";
      beat.label = "Take a shift";
      beat.alt = "hobby";
      beat.altLabel = "Start a hobby";
      beat.stamp = "DAY ONE";
      return beat;
    }
    if (low.indexOf("hobby paid") >= 0) {
      beat.line = body;
      beat.rail = CYAN;
      beat.action = "hobby";
      beat.label = "Keep going";
      beat.alt = "shift";
      beat.altLabel = "Take a shift";
      beat.stamp = "HOBBY";
      return beat;
    }
    if (low.indexOf("shady tree") >= 0 || low.indexOf("heat starts counting") >= 0) {
      beat.line = "The other tree is on. Petty scores can pay. Heat climbs if you get sloppy.";
      beat.rail = VIOLET;
      beat.action = "tab:lab";
      beat.label = "Open the tree";
      beat.alt = "shift";
      beat.altLabel = "Stay legit";
      beat.stamp = "HEAT";
      return beat;
    }
    if (low.indexOf("skimmed") >= 0 || low.indexOf("a fine landed") >= 0 || low.indexOf("the score paid") >= 0 || low.indexOf("the score failed") >= 0 || low.indexOf("you're being held") >= 0) {
      beat.line = body;
      beat.rail = VIOLET;
      beat.action = game.nodes && game.nodes.skim ? "skim" : "rest";
      beat.label = game.nodes && game.nodes.skim ? "Try again" : "Wait";
      beat.alt = "shift";
      beat.altLabel = "Stay legit";
      beat.stamp = "HEAT";
      return beat;
    }
    if (low.indexOf("you got a raise") >= 0) {
      beat.line = "They pay you more now. The work is starting to show.";
      beat.rail = CYAN;
      beat.action = "shift";
      beat.label = "Work it";
      beat.alt = "rest";
      beat.altLabel = "Take a break";
      beat.stamp = "RAISE";
      return beat;
    }
    if (low.indexOf("hobby open:") >= 0) {
      var hid = raw.match(/hobby open:\s*([a-z_]+)/i);
      beat.line = "Something you know just opened a new way to get paid.";
      beat.rail = CYAN;
      beat.action = hid ? "hobby:" + hid[1] : "hobby";
      beat.label = "Try it";
      beat.alt = "shift";
      beat.altLabel = "Keep working";
      beat.stamp = "HOBBY";
      return beat;
    }
    if (low.indexOf("job open:") >= 0) {
      beat.line = "A better chair is open. Your shifts earned it.";
      beat.rail = CYAN;
      beat.action = "tab:job";
      beat.label = "See the job";
      beat.alt = "shift";
      beat.altLabel = "Keep working";
      beat.stamp = "RAISE";
      return beat;
    }
    if (low.indexOf("rented the corner") >= 0 || low.indexOf("warm lights") >= 0 || low.indexOf("a sign") >= 0 || low.indexOf("real counter") >= 0) {
      beat.line = body;
      beat.rail = GOLD;
      beat.action = "tab:job";
      beat.label = "Change the room";
      beat.alt = "shift";
      beat.altLabel = "Work it";
      beat.stamp = "ROOM";
      return beat;
    }
    if (low.indexOf("out of stock") >= 0) {
      beat.line = "The register is empty. People are still in line.";
      beat.rail = CRIMSON;
      beat.action = "stock:0";
      beat.label = "Restock";
      beat.alt = "shift";
      beat.altLabel = "Work anyway";
      return beat;
    }
    if (low.indexOf("not enough capital") >= 0) {
      beat.line = "You can't pay for that. The drawer is too light.";
      beat.rail = CRIMSON;
      beat.label = "Work the rush";
      beat.alt = null;
      return beat;
    }
    if (low.indexOf("slot") >= 0 && low.indexOf("cycle") >= 0 && low.indexOf("offline") < 0) {
      var paid = raw.match(/-?\$[\d,]+/);
      var stockM = raw.match(/stock\s+(\d+)/i);
      var left = stockM ? Number(stockM[1]) : -1;
      var loss = raw.indexOf("-$") >= 0 || raw.indexOf("- $") >= 0;
      if (loss) {
        beat.line = "That rush lost money. The drawer got lighter.";
        beat.rail = CRIMSON;
        beat.label = "Work the rush";
      } else if (left === 0) {
        beat.line = "Sold out. " + (paid ? paid[0] + " was the last of it." : "The shelf is bare.");
        beat.rail = CRIMSON;
        beat.action = "stock:0";
        beat.label = "Restock";
        beat.alt = "shift";
        beat.altLabel = "Keep the door open";
      } else if (left >= 0 && left < 4) {
        beat.line = "The line paid " + (paid ? paid[0] : "cash") + ". The shelf is getting thin.";
        beat.rail = GOLD;
        beat.alt = "stock:0";
        beat.altLabel = "Restock";
      } else {
        var say = [
          "A wave of people just paid " + (paid ? paid[0] : "cash") + ".",
          "The line moved. " + (paid ? paid[0] : "Cash") + " hit the drawer.",
          "Another rush down. " + (paid ? paid[0] : "The drawer") + " is heavier."
        ];
        beat.line = say[(left > 0 ? left : 0) % say.length];
        beat.rail = GOLD;
      }
      return beat;
    }
    if (low.indexOf("offline slot") >= 0) {
      var off = raw.match(/-?\$[\d,]+/);
      beat.line = "While you were gone, the shop kept selling" + (off ? ". " + off[0] + " came in." : ".");
      beat.rail = GOLD;
      beat.label = "Work the rush";
      return beat;
    }
    if (low.indexOf("rank ") >= 0 && low.indexOf("void point") >= 0) {
      var yr = raw.match(/rank\s+(\d+)/i);
      beat.line = "Year " + (yr ? yr[1] : "up") + ". You picked up a Void Point.";
      beat.rail = CYAN;
      beat.action = "tab:lab";
      beat.label = "Spend it";
      beat.alt = "shift";
      beat.altLabel = "Keep working";
      return beat;
    }
    if (low.indexOf("shift closed") >= 0) {
      var paid = raw.match(/\$[\d,]+/);
      beat.line = paid ? "Rush over. " + paid[0] + " hits the drawer." : "Rush over. The drawer is heavier.";
      beat.rail = GOLD;
      beat.label = "Work another";
      if (game.flags && game.flags.shady && game.nodes && game.nodes.skim) {
        beat.alt = "skim";
        beat.altLabel = "Skim the drawer";
      }
      return beat;
    }
    if (low.indexOf("rest cycle") >= 0) {
      beat.line = "You sat down. Your eye stopped twitching.";
      beat.rail = CYAN;
      beat.label = "Back to work";
      beat.alt = null;
      return beat;
    }
    if (low.indexOf("resume filed") >= 0) {
      beat.line = body.replace("Resume filed:", "New face.").replace("asks", "wants");
      beat.rail = CYAN;
      beat.action = "tab:job";
      beat.label = "Meet them";
      beat.alt = "shift";
      beat.altLabel = "Keep working";
      return beat;
    }
    if (low.indexOf("rejected the third") >= 0) {
      beat.line = "They laughed at the offer and left.";
      beat.rail = CRIMSON;
      beat.action = "applicants";
      beat.label = "Find someone else";
      beat.alt = null;
      return beat;
    }
    if (low.indexOf("rejected") >= 0) {
      beat.line = "They said no. That's a strike.";
      beat.rail = CRIMSON;
      beat.action = "tab:job";
      beat.label = "Try again";
      beat.alt = null;
      return beat;
    }
    if (low.indexOf("locked into") >= 0) {
      beat.line = "They're on the clock. Don't leave them alone with the fries.";
      beat.rail = GOLD;
      beat.label = "Work the rush";
      return beat;
    }
    if (low.indexOf("released") >= 0) {
      beat.line = "You let them go. The shop feels quieter.";
      beat.rail = CRIMSON;
      beat.action = "applicants";
      beat.label = "Find someone";
      beat.alt = "shift";
      beat.altLabel = "Work alone";
      return beat;
    }
    if (low.indexOf("degree filed") >= 0 || low.indexOf("graduated") >= 0) {
      beat.line = "You finished. People look at you different now.";
      beat.rail = CYAN;
      beat.action = "tab:edu";
      beat.label = "See school";
      beat.alt = "shift";
      beat.altLabel = "Back to work";
      return beat;
    }
    if (low.indexOf("scout returned") >= 0) {
      beat.line = "Your person got back with something in their hands.";
      beat.rail = CYAN;
      beat.action = "tab:scout";
      beat.label = "See what they found";
      beat.alt = null;
      return beat;
    }
    if (low.indexOf("overheat") >= 0) {
      beat.line = "The machine is smoking. Give it a second.";
      beat.rail = CRIMSON;
      beat.label = "Work the rush";
      return beat;
    }
    if (low.indexOf("at cap") >= 0) {
      beat.line = "The shelf is packed. Go sell it.";
      beat.rail = GOLD;
      beat.alt = null;
      return beat;
    }
    if (low.indexOf("stock audit") >= 0) {
      beat.line = "Stock landed. The shelf looks alive again.";
      beat.rail = GOLD;
      return beat;
    }
    if (low.indexOf("freeze") >= 0 || (low.indexOf("audit") >= 0 && low.indexOf("stock") < 0)) {
      beat.line = "Someone official just froze the shop.";
      beat.rail = CRIMSON;
      beat.alt = "rest";
      beat.altLabel = "Take a break";
      return beat;
    }
    if (low.indexOf("lifting") >= 0 || low.indexOf("discrep") >= 0 || low.indexOf("theft") >= 0 || low.indexOf("caught") >= 0) {
      beat.line = "Stock walked out the back. Somebody's hands were full.";
      beat.rail = CRIMSON;
      beat.action = "tab:job";
      beat.label = "Check the shop";
      beat.alt = null;
      return beat;
    }
    if (low.indexOf("catch-up") >= 0) {
      beat.line = "You looked away. The shop kept the lights on.";
      beat.rail = CYAN;
      return beat;
    }
    if (low.indexOf("clock phase") >= 0) {
      if ((game.player.shifts || 0) < 1 && game.player.capital < 1 && !(game.flags && game.flags.shady)) {
        beat.line = "Zero dollars. A shift pays tonight. A hobby pays less and teaches you.";
        beat.label = "Take a shift";
        beat.alt = "hobby";
        beat.altLabel = "Start a hobby";
        beat.stamp = "DAY ONE";
        return beat;
      }
      var phase = S.phaseAt(game.lastReal || Date.now());
      var say = {
        morning: "Morning rush. Everyone wants food and nobody has patience.",
        lunch: "Lunch rush. The line is out the door.",
        evening: "After school. The shop fills with people killing time.",
        night: "Late night. Weirdos and regulars, that's the whole crowd.",
        standard: "Slow hour. You can hear the fryer."
      };
      beat.line = say[phase.id] || "The hour changed.";
      beat.rail = CYAN;
      return beat;
    }
    if (low.indexOf("ledger online") >= 0) {
      beat.line = "The lights just came on.";
      beat.rail = GOLD;
      beat.label = "Open up";
      return beat;
    }
    if (low.indexOf("kiosk stocked") >= 0) {
      beat.line = "The shelf has food. The door is unlocked.";
      beat.rail = GOLD;
      beat.label = "Open up";
      return beat;
    }
    if (low.indexOf("academic rank") >= 0) {
      beat.line = "You run the shop. Cash in the drawer. A line is waiting.";
      beat.rail = GOLD;
      beat.label = "Open up";
      return beat;
    }
    if (low.indexOf("blueprint") >= 0 || low.indexOf("cookbook") >= 0 || low.indexOf("foundry") >= 0 || low.indexOf("legendary") >= 0) {
      beat.line = "You mixed something new. It might actually work.";
      beat.rail = CYAN;
      beat.action = "hdr:journal";
      beat.label = "Open the book";
      beat.alt = "tab:lab";
      beat.altLabel = "Mix more";
      return beat;
    }
    if (raw.charAt(0) === "!") beat.rail = CRIMSON;
    else if (raw.charAt(0) === "+" || raw.indexOf("$") >= 0) beat.rail = GOLD;
    else beat.rail = CYAN;
    beat.line = body;
    return beat;
  }

  function fatButton(ctx, ui, id, x, y, w, h, label, ghost) {
    if (w < 8 || h < 8) return;
    var scale = uiScale(ui, id);
    var hover = ui.hover === id;
    var cx = x + w * 0.5;
    var cy = y + h * 0.5;
    ctx.save();
    if (scale !== 1) {
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }
    clearGlow(ctx);
    round(ctx, x, y, w, h, 16);
    if (ghost) {
      ctx.fillStyle = hover ? "#fffdf8" : "rgba(255,253,248,0.55)";
      ctx.fill();
      ctx.strokeStyle = DARK;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = hover ? "#ffdf6b" : GOLD;
      ctx.fill();
    }
    var f = font(h < 48 ? 16 : 20, false);
    ctx.font = f;
    ctx.fillStyle = DARK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var kind = actionIcon(id);
    var shift = w > 160 ? 16 : 0;
    if (shift) icon(ctx, kind, x + 28, cy, h < 48 ? 18 : 22, DARK);
    ctx.fillText(clipText(ctx, f, label, w - 24 - shift), cx + shift * 0.35, cy);
    ctx.restore();
    ctx.textAlign = "left";
    pushHit(ui, id, x, y, w, h);
  }

  function actionIcon(id) {
    if (!id) return "coin";
    if (id === "shift") return "shop";
    if (id === "rest") return "rest";
    if (id.indexOf("stock:") === 0) return "box";
    if (id.indexOf("job") >= 0 || id === "applicants") return "people";
    if (id.indexOf("edu") >= 0) return "cap";
    if (id.indexOf("scout") >= 0) return "people";
    if (id.indexOf("lab") >= 0 || id.indexOf("journal") >= 0) return "book";
    if (id === "synth" || id.indexOf("craft") === 0) return "box";
    return "coin";
  }

  function beatIcon(beat) {
    if (!beat) return "coin";
    if (beat.stamp === "HEAT") return "alert";
    if (beat.stamp === "ROOM") return "shop";
    if (beat.stamp === "HOBBY" || beat.stamp === "RAISE") return "star";
    if (beat.action === "stock:0") return "box";
    if (beat.action === "rest") return "rest";
    if (beat.action && beat.action.indexOf("edu") >= 0) return "cap";
    if (beat.action && beat.action.indexOf("scout") >= 0) return "people";
    if (beat.action && beat.action.indexOf("job") >= 0) return "people";
    if (beat.action && (beat.action.indexOf("lab") >= 0 || beat.action.indexOf("journal") >= 0)) return "book";
    if (beat.rail === CRIMSON) return "alert";
    if (beat.rail === CYAN) return "star";
    return "coin";
  }

  function beatStamp(beat) {
    if (!beat) return "RUSH";
    if (beat.stamp) return beat.stamp;
    if (beat.action === "stock:0") return "RESTOCK";
    if (beat.rail === CRIMSON) return "TROUBLE";
    if (beat.rail === CYAN) return "MOMENT";
    return "RUSH";
  }

  function drawFace(ctx, cx, cy, r, mood) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#f0c7a0";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.08, r, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fillStyle = "#241c18";
    ctx.fill();
    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.arc(cx - r * 0.28, cy + r * 0.02, r * 0.08, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.28, cy + r * 0.02, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = DARK;
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    if (mood === 1) ctx.arc(cx, cy + r * 0.18, r * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (mood === 2) {
      ctx.moveTo(cx - r * 0.22, cy + r * 0.38);
      ctx.quadraticCurveTo(cx, cy + r * 0.28, cx + r * 0.22, cy + r * 0.36);
    } else {
      ctx.moveTo(cx - r * 0.18, cy + r * 0.36);
      ctx.lineTo(cx + r * 0.18, cy + r * 0.36);
    }
    ctx.stroke();
    if (mood === 2) {
      ctx.fillStyle = "#7ec8e3";
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.78, cy, r * 0.1, r * 0.16, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function noteCash(game, now, x, y) {
    var c = game.player.capital;
    if (seenCash == null) {
      seenCash = c;
      return;
    }
    var d = Math.round(c - seenCash);
    seenCash = c;
    if (!d) return;
    pops.push({
      text: (d > 0 ? "+" : "") + S.money(d),
      x: x,
      y: y,
      born: now,
      life: 1100
    });
    if (pops.length > 5) pops.shift();
    if (d > 0) smileUntil = now + 1400;
  }

  function drawPops(ctx, now) {
    var i;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (i = pops.length - 1; i >= 0; i--) {
      var p = pops[i];
      var age = now - p.born;
      if (age > p.life) {
        pops.splice(i, 1);
        continue;
      }
      var u = age / p.life;
      ctx.globalAlpha = 1 - u * u;
      ctx.font = font(26, true);
      ctx.fillStyle = p.text.charAt(0) === "-" ? CRIMSON : GOLD;
      ctx.fillText(p.text, p.x, p.y - u * 54);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  function yearBlurb(game, now) {
    var phase = S.phaseAt(now);
    var names = {
      morning: "Morning rush",
      lunch: "Lunch rush",
      evening: "After school",
      night: "Late night",
      standard: "Slow hour"
    };
    var blur = "Year " + game.player.level + "  ·  " + (names[phase.id] || phase.name);
    if (game.flags && game.flags.shady) blur += "  ·  Heat " + Math.round(game.player.heat || 0);
    return blur;
  }

  function statTick(ctx, x, y, w, label, value, fill, color, kind) {
    if (fill < 0) fill = 0;
    if (fill > 1) fill = 1;
    badge(ctx, kind, x + 11, y + 11, 22, "#241c10", color);
    var f = font(12, false);
    ctx.font = f;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + 26, y + 11);
    ctx.textAlign = "right";
    ctx.fillStyle = color;
    ctx.fillText(String(Math.round(value)), x + w, y + 11);
    ctx.textAlign = "left";
    round(ctx, x, y + 24, w, 8, 4);
    ctx.fillStyle = "#1a2030";
    ctx.fill();
    var fw = w * fill;
    if (fw > 2) {
      round(ctx, x, y + 24, fw, 8, 4);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      round(ctx, x, y + 25, fw, 3, 2);
      ctx.fill();
    }
  }

  function logTag(text) {
    var ch = text.charAt(0);
    var low = text.toLowerCase();
    if (ch === "!" || low.indexOf("audit") >= 0 || low.indexOf("freeze") >= 0 || low.indexOf("discrep") >= 0 || low.indexOf("theft") >= 0 || low.indexOf("overheat") >= 0) {
      return { tag: "ALERT", color: CRIMSON, bg: "#3a1820" };
    }
    if (ch === "+" || text.indexOf("$") >= 0 || low.indexOf("capital") >= 0 || low.indexOf("market") >= 0 || low.indexOf("wage") >= 0 || low.indexOf("buy") >= 0) {
      return { tag: "CASH", color: GOLD, bg: "#3a3018" };
    }
    return { tag: "LAB", color: CYAN, bg: "#143038" };
  }

  function decorateOffer(game, hero) {
    if (!hero) return hero;
    if (hero.stamp === "HEAT" || hero.stamp === "DAY ONE" || hero.action === "stock:0") return hero;
    if (hero.alt === "skim" || hero.alt === "score") return hero;
    var place = game.player.place;
    if (place && !place.owned && game.player.capital >= D.ROOM.rent) {
      hero.alt = "room";
      hero.altLabel = "Rent the corner";
      return hero;
    }
    if (!place || !place.owned || hero.alt) return hero;
    var next = !place.lights ? "lights" : (!place.sign ? "sign" : (!place.counter ? "counter" : null));
    if (!next || game.player.capital < D.ROOM[next]) return hero;
    var labels = { lights: "Warm lights", sign: "Paint a sign", counter: "Real counter" };
    hero.alt = "upgrade:" + next;
    hero.altLabel = labels[next];
    return hero;
  }

  function drawStorefront(ctx, x, y, w, h, place) {
    var owned = !!(place && place.owned);
    clearGlow(ctx);
    round(ctx, x, y, w, h, 12);
    ctx.fillStyle = owned ? "#2c2418" : "#1c1814";
    ctx.fill();
    var win = owned && place.lights ? GOLD : "#3a342c";
    var ww = Math.min(36, (w - 40) / 3);
    var wi;
    for (wi = 0; wi < 3; wi++) {
      round(ctx, x + 12 + wi * (ww + 8), y + 10, ww, h * 0.42, 4);
      ctx.fillStyle = win;
      ctx.fill();
    }
    if (owned && place.sign) {
      round(ctx, x + w * 0.58, y + 8, Math.min(110, w * 0.28), 16, 4);
      ctx.fillStyle = GOLD;
      ctx.fill();
    }
    round(ctx, x + 10, y + h - 16, w - 20, 8, 3);
    ctx.fillStyle = owned && place.counter ? "#c4a574" : "#4a4036";
    ctx.fill();
  }

  function drawStory(ctx, game, ui, L, now) {
    var x = 16;
    var top = L.header + 10;
    var bot = L.tabY - 12;
    var w = L.w - 32;
    if (bot - top < 80 || w < 40) return;
    var newest = game.logN - 1;
    var strips = 0;
    if (newest >= 1 && bot - top > 280) strips = 1;
    if (newest >= 2 && bot - top > 360) strips = 2;
    var stripH = 40;
    var gap = 8;
    var sy = top;
    var s;
    for (s = strips; s >= 1; s--) {
      var oldBeat = storyBeat(S.logLine(game, newest - s) || "", game);
      clearGlow(ctx);
      round(ctx, x, sy, w, stripH, 12);
      ctx.fillStyle = s === 2 ? "#d9d0c0" : "#efe6d4";
      ctx.fill();
      badge(ctx, beatIcon(oldBeat), x + 18, sy + stripH * 0.5, 22, oldBeat.rail, "#fffdf8");
      ctx.font = font(14, false);
      ctx.fillStyle = DARK;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(clipText(ctx, font(14, false), oldBeat.line, w - 52), x + 36, sy + stripH * 0.5);
      sy += stripH + gap;
    }
    ctx.globalAlpha = 1;
    var cardH = bot - sy;
    if (logAnim.head !== game.logHead) {
      logAnim.head = game.logHead;
      logAnim.t = 0;
    }
    var scale = 0.94 + 0.06 * easeOut(logAnim.t);
    var cx = x + w * 0.5;
    var cy = sy + cardH * 0.5;
    var sw = w * scale;
    var sh = cardH * scale;
    var sx = cx - sw * 0.5;
    var scy = cy - sh * 0.5;
    var hero = storyBeat(newest >= 0 ? (S.logLine(game, newest) || "") : "", game);
    if (!game.flags || game.flags.chosen === false) {
      hero = {
        line: "Zero dollars. A shift pays tonight. A hobby pays less and teaches you.",
        rail: GOLD,
        action: "shift",
        label: "Take a shift",
        alt: "hobby",
        altLabel: "Start a hobby",
        stamp: "DAY ONE"
      };
    }
    if (game.player.heldUntil && now < game.player.heldUntil) {
      var left = Math.max(1, Math.ceil((game.player.heldUntil - now) / 1000));
      hero = {
        line: "You're sitting this out. " + left + "s left on the clock.",
        rail: VIOLET,
        action: "rest",
        label: "Wait it out",
        alt: null,
        altLabel: null,
        stamp: "HEAT"
      };
    } else if (game.flags && game.flags.chosen) {
      hero = decorateOffer(game, hero);
    }
    var band = Math.min(76, Math.max(58, sh * 0.18));
    ctx.save();
    clearGlow(ctx);
    round(ctx, sx, scy, sw, sh, 22);
    ctx.fillStyle = CREAM;
    ctx.fill();
    ctx.save();
    round(ctx, sx, scy, sw, sh, 22);
    ctx.clip();
    ctx.fillStyle = hero.rail;
    ctx.fillRect(sx, scy, sw, band);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(sx, scy, sw, band * 0.42);
    ctx.restore();
    var stampInk = hero.rail === GOLD ? DARK : "#fffdf8";
    badge(ctx, beatIcon(hero), sx + 40, scy + band * 0.5, 46, "#fffdf8", hero.rail);
    ctx.font = font(L.w < 720 ? 18 : 22, false);
    ctx.fillStyle = stampInk;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(beatStamp(hero), sx + 72, scy + band * 0.5);
    var textX = sx + 24;
    var textW = sw - 40;
    var f = font(L.w < 720 ? 22 : 28, false);
    var lines = wrapLines(ctx, f, hero.line, textW, 3);
    ctx.font = f;
    ctx.fillStyle = DARK;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    var ly = scy + band + 18;
    var li;
    for (li = 0; li < lines.length; li++) {
      ctx.fillText(lines[li], textX, ly);
      ly += L.w < 720 ? 28 : 36;
    }
    var slot0 = game.slots && game.slots[0];
    var job0 = slot0 ? D.jobById[slot0.jobId] : null;
    var who = slot0 && slot0.employee ? slot0.employee.name + " is on the register." : "You're working it alone.";
    var scene = (job0 ? job0.name : "The counter") + ". " + who;
    if ((game.player.shifts || 0) < 1 && game.player.capital < 20 && !(game.flags && game.flags.shady)) {
      scene = "No shop of your own yet. Just a way to get the first dollar.";
    } else {
      var placeBit = game.player.place;
      var roomBit = !placeBit || !placeBit.owned ? "Bare corner." : ((placeBit.lights ? "Warm lights" : "Bare bulb") + (placeBit.sign ? ", sign up" : "") + (placeBit.counter ? ", real counter" : "") + ".");
      scene = roomBit + " " + scene;
    }
    var sceneFont = font(15, false);
    ctx.font = sceneFont;
    ctx.fillStyle = "#6b6258";
    ctx.fillText(clipText(ctx, sceneFont, scene, textW), textX, ly + 6);
    ly += 28;
    if (sh > 340 && ly + 78 < scy + sh - 80) {
      drawStorefront(ctx, textX, ly, textW, 58, game.player.place);
      ly += 66;
    }
    if (sh > 250 && slot0) {
      var chipW = (textW - 16) / 3;
      var chipY = ly + 4;
      var whoShort = slot0.employee ? slot0.employee.name.split(" ")[0] : "Solo";
      var stressN = Math.round(game.player.stress);
      var chips = [
        ["box", "Stock " + slot0.stock, "#e08a3c"],
        ["people", whoShort, "#e2569a"],
        ["flame", (game.flags && game.flags.shady) ? ("Heat " + Math.round(game.player.heat || 0)) : ("Stress " + stressN), (game.flags && game.flags.shady) ? ((game.player.heat || 0) > 40 ? CRIMSON : VIOLET) : (stressN > 50 ? CRIMSON : "#c47a4a")]
      ];
      var ci;
      for (ci = 0; ci < chips.length; ci++) {
        var chx = textX + ci * (chipW + 8);
        round(ctx, chx, chipY, chipW, 32, 16);
        ctx.fillStyle = "#fffdf8";
        ctx.fill();
        ctx.strokeStyle = chips[ci][2];
        ctx.lineWidth = 2;
        ctx.stroke();
        icon(ctx, chips[ci][0], chx + 16, chipY + 16, 16, chips[ci][2]);
        ctx.font = font(12, false);
        ctx.fillStyle = DARK;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(clipText(ctx, font(12, false), chips[ci][1], chipW - 36), chx + 30, chipY + 16);
      }
      ly = chipY + 40;
    }
    var showAlt = hero.alt && sh > 210;
    var bh = sh < 200 ? 46 : 54;
    var by = scy + sh - 18 - bh;
    if (showAlt) by = scy + sh - 18 - bh * 2 - 8;
    if (by < ly + 8) by = ly + 8;
    if (!ui.menu) {
      fatButton(ctx, ui, hero.action, textX, by, textW, bh, hero.label, false);
      if (showAlt) fatButton(ctx, ui, hero.alt, textX, by + bh + 8, textW, bh, hero.altLabel, true);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }


  function capsule(ctx, x, y, w, h, label, valueText, fill, color, t, phase, opts) {
    if (fill < 0) fill = 0;
    if (fill > 1) fill = 1;
    var flat = !glowOk();
    var r = h * 0.5;
    clearGlow(ctx);
    round(ctx, x, y, w, h, r);
    ctx.fillStyle = "#141418";
    ctx.fill();
    var fw = Math.max(0, w * fill);
    if (fw > 2) {
      ctx.save();
      round(ctx, x, y, w, h, r);
      ctx.clip();
      var amp = flat ? 0 : Math.min(2.4, h * 0.18);
      var steps = amp > 0 ? 6 : 1;
      ctx.beginPath();
      var edge = x + fw;
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y);
      var s;
      for (s = 0; s <= steps; s++) {
        var py = y + (h * s / steps);
        var ox = amp * Math.sin(py * 0.5 + t * 0.003 + phase);
        ctx.lineTo(Math.min(x + w, edge + ox), py);
      }
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
    round(ctx, x, y, w, h, r);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    setGlow(ctx, color);
    ctx.stroke();
    clearGlow(ctx);
    var f = font(h < 18 ? 11 : 12, false);
    ctx.font = f;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, f, label, w * 0.52), x + 10, y + h * 0.5);
    ctx.textAlign = "right";
    var valueFont = valueText.indexOf("$") >= 0 ? font(h < 18 ? 11 : 12, true) : f;
    ctx.font = valueFont;
    ctx.fillText(clipText(ctx, valueFont, valueText, w * 0.4), x + w - 10, y + h * 0.5);
    clearGlow(ctx);
    ctx.textAlign = "left";
  }

  function drawMeters(ctx, game, L, t) {
    var x = 16;
    var gap = 10;
    var w = (L.w - 32 - gap * 3) / 4;
    var band = L.b1 - L.b0;
    var h = Math.max(16, Math.min(band - 10, 36));
    var y = L.b0 + (band - h) * 0.5;
    if (w < 20) return;
    var capitalFill = 1 - Math.exp(-game.player.capital / 500);
    var stressN = game.player.stress;
    var stressColor = stressN > 50 ? CRIMSON : "#c47a4a";
    capsule(ctx, x, y, w, h, "CASH", S.money(game.player.capital), capitalFill, GOLD, t, 0);
    capsule(ctx, x + (w + gap), y, w, h, "BRAIN", String(Math.round(game.player.intelligence)), game.player.intelligence / 100, CYAN, t, 1.7);
    capsule(ctx, x + (w + gap) * 2, y, w, h, "STRESS", String(Math.round(stressN)), stressN / 100, stressColor, t, 3.1);
    capsule(ctx, x + (w + gap) * 3, y, w, h, "CLOUT", String(Math.round(game.player.visibility)), game.player.visibility / 100, CYAN, t, 4.6);
  }

  function drawHeader(ctx, game, ui, L, now) {
    var r = L.w < 520 ? 24 : 28;
    var faceX = 18 + r;
    var faceY = 8 + r;
    var mood = 0;
    if (now < smileUntil) mood = 1;
    else if ((game.flags && game.flags.shady && (game.player.heat || 0) > 40) || game.player.stress > 50) mood = 2;
    ctx.beginPath();
    ctx.arc(faceX, faceY, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(faceX, faceY, r + 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "#2a2416";
    ctx.fill();
    drawFace(ctx, faceX, faceY, r, mood);
    if (mood === 1) badge(ctx, "coin", faceX + r * 0.7, faceY + r * 0.65, 16, GOLD, DARK);
    else if (mood === 2) badge(ctx, "flame", faceX + r * 0.7, faceY + r * 0.65, 16, CRIMSON, "#fffdf8");
    var textX = faceX + r + 14;
    var cash = S.money(game.player.capital);
    var cashSize = L.w < 520 ? 22 : 28;
    var cashFont = font(cashSize, true);
    var cashW = measure(ctx, cashFont, cash);
    var gear = L.w < 420 ? 34 : 40;
    var bookX = L.w - 12 - gear - 8 - gear;
    var pillW = cashW + 52;
    var pillH = L.w < 560 ? 34 : 40;
    var pillX = bookX - 12 - pillW;
    var stacked = pillX < textX + 88;
    if (stacked) pillX = textX;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = font(L.w < 720 ? 20 : 24, false);
    ctx.fillStyle = INK;
    ctx.fillText("You", textX, 8);
    var yearFont = font(13, false);
    ctx.font = yearFont;
    ctx.fillStyle = "#d5deea";
    var yearMax = Math.max(48, (stacked ? bookX : pillX) - textX - 10);
    ctx.fillText(clipText(ctx, yearFont, yearBlurb(game, now), yearMax), textX, 32);
    var pillY = stacked ? 52 : faceY - pillH * 0.5;
    clearGlow(ctx);
    round(ctx, pillX, pillY, pillW, pillH, 20);
    ctx.fillStyle = "#2a2416";
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.stroke();
    icon(ctx, "coin", pillX + 20, faceY, 22, GOLD);
    ctx.font = cashFont;
    ctx.fillStyle = GOLD;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(cash, pillX + 36, faceY);
    noteCash(game, now, pillX + pillW * 0.55, faceY);
    if (bookX > textX + 36) {
      ctx.font = font(11, false);
      ctx.fillStyle = "#8b93a7";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(String(Math.round(ui.fps || 0)), bookX - 6, 2);
    }
    var tickY = L.header - 40;
    var gap = 10;
    var tickW = Math.min(160, (L.w - 32 - gap * 2) / 3);
    var stressN = game.player.stress;
    statTick(ctx, 16, tickY, tickW, "Brain", game.player.intelligence, game.player.intelligence / 100, CYAN, "brain");
    statTick(ctx, 16 + tickW + gap, tickY, tickW, "Stress", stressN, stressN / 100, stressN > 50 ? CRIMSON : "#e08a3c", "flame");
    statTick(ctx, 16 + (tickW + gap) * 2, tickY, tickW, "Clout", game.player.visibility, game.player.visibility / 100, "#7ec8e3", "star");
    roundButton(ctx, ui, "hdr:journal", bookX, 8, gear, "book", ui.menu === "journal");
    roundButton(ctx, ui, "hdr:settings", L.w - 16 - gear, 8, gear, "gear", ui.menu === "settings");
    ctx.textAlign = "left";
  }

  function roundButton(ctx, ui, id, x, y, s, kind, on) {
    var hover = ui.hover === id;
    clearGlow(ctx);
    ctx.beginPath();
    ctx.arc(x + s * 0.5, y + s * 0.5, s * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = on ? GOLD : hover ? "#243044" : "#171b28";
    ctx.fill();
    ctx.strokeStyle = (on || hover) ? GOLD : "#3a4460";
    ctx.lineWidth = 2;
    ctx.stroke();
    icon(ctx, kind, x + s * 0.5, y + s * 0.5, s * 0.58, on ? DARK : GOLD);
    pushHit(ui, id, x, y, s, s);
  }

  function drawDock(ctx, game, ui, L) {
    var labels = ["Work", "School", "People", "Stuff"];
    var ids = ["job", "edu", "scout", "lab"];
    var kinds = ["shop", "cap", "people", "box"];
    var colors = [GOLD, "#7ec8e3", "#ff7ab6", "#e08a3c"];
    var gap = 8;
    var bw = (L.w - 32 - gap * 3) / 4;
    var i;
    for (i = 0; i < 4; i++) {
      var x = 16 + i * (bw + gap);
      var tw = bw;
      var th = L.tabH - 16;
      var ty = L.tabY + 8;
      var id = "tab:" + ids[i];
      var on = ui.menu === ids[i];
      var scale = uiScale(ui, id);
      var cx = x + tw * 0.5;
      var cy = ty + th * 0.5;
      var hover = ui.hover === id;
      ctx.save();
      if (scale !== 1) {
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);
      }
      clearGlow(ctx);
      round(ctx, x, ty, tw, th, 18);
      ctx.fillStyle = on ? GOLD : hover ? "#243044" : "#171b28";
      ctx.fill();
      ctx.strokeStyle = (hover || on) ? GOLD : "#2c3548";
      ctx.globalAlpha = 1;
      ctx.lineWidth = on ? 0 : 1;
      if (!on) ctx.stroke();
      icon(ctx, kinds[i], cx, cy - 11, 22, on ? DARK : colors[i]);
      ctx.font = font(L.w < 860 ? 13 : 14, false);
      ctx.fillStyle = on ? DARK : INK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labels[i], cx, cy + 12);
      clearGlow(ctx);
      ctx.restore();
      pushHit(ui, id, x, ty, tw, th);
    }
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  function drawRules(ctx, L) {
    ctx.strokeStyle = "#2c3548";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, L.a1);
    ctx.lineTo(L.w - 12, L.a1);
    ctx.moveTo(12, L.b1);
    ctx.lineTo(L.w - 12, L.b1);
    ctx.stroke();
    clearGlow(ctx);
  }

  function tick(dt, game) {
    frameGame = game;
    if (logAnim.n !== game.logN || logAnim.head !== game.logHead) {
      if (logAnim.n < 0) logAnim.t = 1;
      else logAnim.t = 0;
      logAnim.n = game.logN;
      logAnim.head = game.logHead;
    } else if (logAnim.t < 1) {
      logAnim.t += dt / 240;
      if (logAnim.t > 1) logAnim.t = 1;
    }
    if (!particlesOk()) return;
    var i;
    var step = dt / 1000;
    for (i = 0; i < pool.length; i++) {
      var p = pool[i];
      if (!p.alive) continue;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vy += 20 * step;
      p.rot += dt * 0.005;
      p.life -= dt / 680;
      if (p.life <= 0) p.alive = false;
    }
  }

  function tickParts(dt) {
    if (frameGame) tick(dt, frameGame);
  }

  function burst(x, y, color, game) {
    if (game) frameGame = game;
    if (!particlesOk()) return 0;
    var spawned = 0;
    var i;
    for (i = 0; i < pool.length && spawned < 10; i++) {
      var p = pool[i];
      if (p.alive) continue;
      var ang = (spawned / 10) * Math.PI * 2;
      var sp = 48 + (spawned % 4) * 16;
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * sp;
      p.vy = Math.sin(ang) * sp - 10;
      p.life = 1;
      p.rot = ang;
      p.kind = spawned % 3;
      p.color = color || CYAN;
      spawned += 1;
    }
    return spawned;
  }

  function spawn(text, x, y, color) {
    burst(x, y, color, frameGame);
  }

  function shake(frames) {
    shakeLeft = frames || 3;
  }

  function drawBit(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 0;
    if (p.kind === 0) ctx.fillRect(-2.2, -2.2, 4.4, 4.4);
    else if (p.kind === 1) {
      ctx.beginPath();
      ctx.moveTo(0, -3.6);
      ctx.lineTo(3.2, 0);
      ctx.lineTo(0, 3.6);
      ctx.lineTo(-3.2, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -3.6);
      ctx.lineTo(3.3, 2.6);
      ctx.lineTo(-3.3, 2.6);
      ctx.closePath();
      ctx.fill();
    }
    clearGlow(ctx);
    ctx.restore();
  }

  function drawParts(ctx) {
    if (!particlesOk()) return;
    var i;
    for (i = 0; i < pool.length; i++) {
      var p = pool[i];
      if (!p.alive) continue;
      ctx.globalAlpha = p.life < 0 ? 0 : p.life;
      drawBit(ctx, p);
    }
    ctx.globalAlpha = 1;
    clearGlow(ctx);
  }

  function draw(ctx, game, ui, now) {
    var w = ui.w;
    var h = ui.h;
    if (w < 2 || h < 2) return;
    frameGame = game;
    ui.now = now;
    var dpr = ui.dpr || 1;
    var ox = 0;
    var oy = 0;
    if (shakeLeft > 0) {
      var bounce = [0, 2, -5, 6];
      var mag = bounce[shakeLeft] || 0;
      ox = mag;
      oy = mag * 0.4;
      shakeLeft -= 1;
    }
    ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ui.hits.length = 0;
    ui.clip = null;
    var bg = ensurePlate(w, h, !!game.settings.performanceMode, dpr);
    ctx.drawImage(bg, 0, 0, w, h);
    var L = layout(w, h);
    ui.L = L;
    drawStory(ctx, game, ui, L, now);
    if (ui.menu && ui.menuT > 0.02) drawMenu(ctx, game, ui, L);
    drawHeader(ctx, game, ui, L, now);
    drawDock(ctx, game, ui, L);
    drawParts(ctx);
    drawPops(ctx, now);
    clearGlow(ctx);
    ctx.globalAlpha = 1;
  }

  function hitTest(ui, x, y) {
    var i;
    for (i = ui.hits.length - 1; i >= 0; i--) {
      var h = ui.hits[i];
      if (x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h) return h;
    }
    return null;
  }

  root.VoidRender = {
    draw: draw,
    hitTest: hitTest,
    tickParts: tickParts,
    tick: tick,
    spawn: spawn,
    burst: burst,
    shake: shake,
    layout: layout
  };
})(typeof window !== "undefined" ? window : globalThis);
