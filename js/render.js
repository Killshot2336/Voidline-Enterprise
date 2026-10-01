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
  var CYAN = "#3ec8d8";
  var CRIMSON = "#e23d3d";
  var NAVY = "#0c1020";
  var INK = "#f4efe4";
  var frameGame = null;
  var logAnim = { n: -1, head: -1, t: 1 };
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
      var glow = g.createRadialGradient(w * 0.5, h * 0.78, 12, w * 0.5, h * 0.72, Math.max(w, h) * 0.48);
      glow.addColorStop(0, "rgba(245,197,66,0.18)");
      glow.addColorStop(1, "rgba(12,16,32,0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
    }
    plate = c;
    plateKey = key;
    return plate;
  }

  function layout(w, h) {
    var header = h < 620 ? 42 : 50;
    var tabH = h < 620 ? 52 : 58;
    return {
      w: w,
      h: h,
      header: header,
      a1: h * 0.5,
      b0: h * 0.5,
      b1: h * 0.6,
      tabH: tabH,
      tabY: h - tabH
    };
  }

  function round(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function pushHit(ui, id, x, y, w, h) {
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
    round(ctx, x, y, w, h, 10);
    ctx.fillStyle = disabled ? "#1a1e2a" : on ? "#3a3018" : hover ? "#243044" : "#171b28";
    ctx.fill();
    ctx.strokeStyle = disabled ? "#2a3142" : (on || hover) ? GOLD : "#2c3548";
    ctx.lineWidth = on ? 2 : 1;
    ctx.stroke();
    var f = font(w < 110 ? 12 : 15, false);
    ctx.font = f;
    ctx.fillStyle = disabled ? "#6c7380" : on ? GOLD : INK;
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

  function section(flow, text) {
    var r = row(flow, 26);
    if (!r.on) return;
    var ctx = flow.ctx;
    var f = font(12, false);
    ctx.font = f;
    ctx.fillStyle = GOLD;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, flow.x, r.y + 13);
    clearGlow(ctx);
  }

  function para(flow, text) {
    var r = row(flow, 20);
    if (!r.on) return;
    var ctx = flow.ctx;
    var f = font(14, false);
    ctx.font = f;
    ctx.fillStyle = "#c5cad6";
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

  function drawOccupation(flow, game, ui) {
    section(flow, "VENTURE SLOTS");
    para(flow, "Accelerated cycles burn stock into capital. Hidden traits can shrink the shelf.");
    var i;
    for (i = 0; i < game.slots.length; i++) {
      var slot = game.slots[i];
      var job = D.jobById[slot.jobId];
      var r = row(flow, 108);
      if (r.on) {
        var ctx = flow.ctx;
        clearGlow(ctx);
        round(ctx, flow.x, r.y, flow.w, 100, 8);
        ctx.fillStyle = "rgba(15,15,15,0.85)";
        ctx.fill();
        ctx.strokeStyle = ui.focusSlot === i ? GOLD : CYAN;
        ctx.lineWidth = 1;
        setGlow(ctx, ctx.strokeStyle);
        ctx.stroke();
        clearGlow(ctx);
        var f = font(15, false);
        ctx.font = f;
        ctx.fillStyle = "#f6f3ec";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(clipText(ctx, f, "Slot " + (i + 1) + " · " + (job ? job.name : "Kiosk"), flow.w - 20), flow.x + 12, r.y + 18);
        ctx.font = font(12, false);
        ctx.fillStyle = "#9aa1ad";
        var emp = slot.employee ? slot.employee.name + " @ " + S.money(slot.employee.salary) : "Unstaffed";
        if (slot.employee && slot.employee.caught) emp += "  FLAGGED";
        ctx.fillText(clipText(ctx, font(12, false), emp + "  ·  stock " + slot.stock + "/" + S.stockCap(game), flow.w - 20), flow.x + 12, r.y + 40);
        if (slot.employee) {
          ctx.fillStyle = slot.employee.caught ? "#e06a5c" : "#c8c2b4";
          ctx.fillText(clipText(ctx, font(12, false), traitLine(game, slot.employee.traits, slot.employee.caught), flow.w - 20), flow.x + 12, r.y + 58);
        } else {
          ctx.fillText(slot.camera ? "Camera live. Waiting for a hire." : "No camera. Shrinkage stays anonymous.", flow.x + 12, r.y + 58);
        }
        var bw = Math.min(150, (flow.w - 36) / 3);
        button(ctx, ui, "stock:" + i, flow.x + 12, r.y + 68, bw, 26, "Buy stock", false, false);
        button(ctx, ui, "fire:" + i, flow.x + 18 + bw, r.y + 68, bw, 26, "Fire", false, !slot.employee);
        var camLabel = slot.camera ? "Camera on" : "Socket cam";
        button(ctx, ui, "cam:" + i, flow.x + 24 + bw * 2, r.y + 68, bw, 26, camLabel, slot.camera, slot.camera);
        pushHit(ui, "focus:" + i, flow.x, r.y, flow.w, 64);
      }
    }
    if (S.slotCap(game) < 2) para(flow, "Second slot opens with an Operations Bachelor or the Server Rack.");

    section(flow, "OWNER ACTIONS");
    var actions = row(flow, 40);
    if (actions.on) {
      var aw = (flow.w - 16) / 3;
      button(flow.ctx, ui, "shift", flow.x, actions.y, aw, 32, "Run shift", false, false);
      button(flow.ctx, ui, "rest", flow.x + aw + 8, actions.y, aw, 32, "Rest", false, false);
      button(flow.ctx, ui, "applicants", flow.x + (aw + 8) * 2, actions.y, aw, 32, "Seek resumes", false, false);
    }

    section(flow, "CORPORATE APPLICATIONS");
    para(flow, "Applies to slot " + ((ui.focusSlot || 0) + 1) + ". Tap a slot card to change the target.");
    for (i = 0; i < D.JOBS.length; i++) {
      var spec = D.JOBS[i];
      var open = S.jobUnlocked(game, spec);
      var jr = row(flow, 36);
      if (!jr.on) continue;
      var current = game.slots[ui.focusSlot] && game.slots[ui.focusSlot].jobId === spec.id;
      flow.ctx.font = font(13, false);
      flow.ctx.fillStyle = open ? "#f6f3ec" : "#6c7380";
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      var need = "Rank " + spec.level + (spec.node ? " · " + D.nodeById[spec.node].name : "");
      flow.ctx.fillText(clipText(flow.ctx, font(13, false), spec.name + "  ·  " + need, flow.w - 120), flow.x, jr.y + 16);
      button(flow.ctx, ui, "apply:" + (ui.focusSlot || 0) + ":" + spec.id, flow.x + flow.w - 108, jr.y + 2, 108, 28, current ? "Active" : "Apply", current, !open || current);
    }

    section(flow, "RESUME CARDS");
    para(flow, "Counter below the ask. Three rejections destroy the card. The floor wage stays hidden.");
    if (!game.resumes.length) para(flow, "No applicants on the board.");
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
      round(ctx2, flow.x, cr.y, flow.w, height, 8);
      ctx2.fillStyle = "rgba(15,15,15,0.85)";
      ctx2.fill();
      ctx2.strokeStyle = card.dying ? CRIMSON : selected ? GOLD : CYAN;
      ctx2.lineWidth = 1;
      setGlow(ctx2, ctx2.strokeStyle);
      ctx2.stroke();
      clearGlow(ctx2);
      ctx2.font = font(15, false);
      ctx2.fillStyle = "#f6f3ec";
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
      ctx2.fillStyle = "#c8c2b4";
      ctx2.fillText(clipText(ctx2, font(12, false), traitLine(game, card.traits, false), flow.w - 24), flow.x + 12, cr.y + 60);
      if (!card.dying) pushHit(ui, "resume:" + card.id, flow.x, cr.y, flow.w, 74);
      if (selected && !card.dying) drawKeypad(ctx2, ui, flow.x + 12, cr.y + 78, Math.min(280, flow.w - 24));
      ctx2.restore();
    }
  }

  function drawKeypad(ctx, ui, x, y, w) {
    ctx.font = font(18, false);
    ctx.fillStyle = "#f6f3ec";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Counter  " + (ui.offer ? S.money(Number(ui.offer)) : "$—"), x, y + 8);
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
    button(ctx, ui, "dok", x, y + 24 + 4 * (bh + gap), w, 32, "Submit counter-offer", true, false);
  }

  function drawEducation(flow, game, ui) {
    section(flow, "ACADEMIC RANK");
    para(flow, "XP " + Math.floor(game.player.xp) + " / " + Math.round(S.xpNeed(game.player.level)) + " for rank " + (game.player.level + 1) + ". Each rank grants 1 Void Point.");
    if (D.GRADS) {
      var g;
      for (g = 0; g < D.GRADS.length; g++) {
        var grad = D.GRADS[g];
        var held = game.grad && game.grad[grad.id];
        para(flow, (held ? "Graduated" : Math.round(grad.xp) + " XP") + " · " + grad.name + " · " + grad.text);
      }
    }
    section(flow, "DEGREES");
    para(flow, "Study time follows the device clock and speeds up or slows with the hour.");
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
    } else para(flow, "No enrollment. One degree clock at a time.");
    var i;
    for (i = 0; i < D.DEGREES.length; i++) {
      var deg = D.DEGREES[i];
      var done = !!game.degrees[deg.id];
      var dr = row(flow, 36);
      if (!dr.on) continue;
      flow.ctx.font = font(13, false);
      flow.ctx.fillStyle = done ? "#6fce9a" : "#f6f3ec";
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(clipText(flow.ctx, font(13, false), deg.name + " · " + deg.text, flow.w - 120), flow.x, dr.y + 16);
      button(flow.ctx, ui, "deg:" + deg.id, flow.x + flow.w - 108, dr.y + 2, 108, 28, done ? "Filed" : S.money(deg.cost), done, done);
    }

    section(flow, "MARKET");
    var vol = S.volatilityFactor(game.lastReal || Date.now());
    para(flow, "Clock ticker. Volatility " + vol.toFixed(2) + ". Visibility trims the quote.");
    for (i = 0; i < D.ITEMS.length; i++) {
      var item = D.ITEMS[i];
      var ir = row(flow, 32);
      if (!ir.on) continue;
      var owned = game.mats[item.id] || 0;
      var locked = game.player.level < item.level;
      flow.ctx.font = font(13, false);
      flow.ctx.fillStyle = locked ? "#6c7380" : "#f6f3ec";
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(clipText(flow.ctx, font(13, false), item.name + " · " + item.cat + " · held " + owned, flow.w - 100), flow.x, ir.y + 14);
      button(flow.ctx, ui, "buy:" + item.id, flow.x + flow.w - 88, ir.y + 1, 88, 26, locked ? "Rk " + item.level : S.money(S.marketCost(game, item)), false, locked);
    }
  }

  function drawLab(flow, game, ui) {
    section(flow, "VOID POINTS");
    para(flow, "VP " + game.player.vp + ". Two lines: Visibility and Tech. Each rank-up grants 1 VP.");
    var lineName = "";
    var i;
    for (i = 0; i < D.NODES.length; i++) {
      var node = D.NODES[i];
      if (node.line !== lineName) {
        lineName = node.line;
        section(flow, lineName === "visibility" ? "VISIBILITY LINE" : "TECH LINE");
      }
      var owned = !!game.nodes[node.id];
      var nr = row(flow, 44);
      if (!nr.on) continue;
      flow.ctx.font = font(14, false);
      flow.ctx.fillStyle = owned ? "#6fce9a" : "#f6f3ec";
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(node.name, flow.x, nr.y + 12);
      flow.ctx.font = font(11, false);
      flow.ctx.fillStyle = "#9aa1ad";
      flow.ctx.fillText(clipText(flow.ctx, font(11, false), node.text, flow.w - 100), flow.x, nr.y + 30);
      button(flow.ctx, ui, "node:" + node.id, flow.x + flow.w - 88, nr.y + 6, 88, 28, owned ? "Open" : node.cost + " VP", owned, owned);
    }

    section(flow, "R&D SYNTHESIZER");
    para(flow, "Four baseline parts, or any two slots for a legendary pair. The Journal files what you discover.");
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
      button(flow.ctx, ui, "synth", flow.x, go.y, (flow.w - 8) * 0.62, 32, "Synthesize", true, false);
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
      if (!any) para(flow, "None in stores. Buy baseline materials in Education & Market.");
    }
    para(flow, "Security Camera Modules socket onto a venture slot after Camera Schematic. Cost " + S.money(D.CAM_COST) + ".");
  }

  function drawScouts(flow, game) {
    section(flow, "SCOUTS");
    if (!game.nodes.charter) para(flow, "Scout Charter is locked on the Visibility line.");
    else para(flow, "Exploration runs on the device clock. Night Drift speeds the route. Two channels max.");
    var i;
    for (i = 0; i < D.SCOUTS.length; i++) {
      var scout = D.SCOUTS[i];
      var sr = row(flow, 36);
      if (!sr.on) continue;
      flow.ctx.font = font(13, false);
      flow.ctx.fillStyle = "#f6f3ec";
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(clipText(flow.ctx, font(13, false), scout.name + " · " + scout.text, flow.w - 110), flow.x, sr.y + 16);
      button(flow.ctx, uiOf(flow), "scout:" + scout.id, flow.x + flow.w - 100, sr.y + 2, 100, 28, S.money(scout.cost), false, !game.nodes.charter);
    }
    if (S.liquidationValue) {
      para(flow, "Space research " + (game.space || 0) + "%  ·  Liquidation " + S.money(S.liquidationValue(game, game.lastReal || Date.now())));
    }
    section(flow, "CHANNELS");
    if (!game.scouts.length) para(flow, "No scouts in the field.");
    for (i = 0; i < game.scouts.length; i++) {
      var mission = game.scouts[i];
      var def = D.scoutById[mission.id];
      var pct = 1 - mission.left / mission.total;
      para(flow, (def ? def.name : mission.id) + " · " + S.fmtMs(mission.left) + " · " + Math.round(pct * 100) + "%");
    }
    section(flow, "ACTIVE ASSETS");
    if (!game.crafted.length) para(flow, "No synthesized assets yet.");
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
    section(flow, "BLUEPRINT COOKBOOK");
    para(flow, "Discovered recipes stay here. Craft when the listed materials are in stores.");
    if (!game.book.length) para(flow, "The cookbook is empty. Experiment in the lab, or spend a Void Point to research.");
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
      flow.ctx.fillStyle = "#f6f3ec";
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(clipText(flow.ctx, font(14, false), (legend ? "★ " : "") + name, flow.w - 110), flow.x, jr.y + 14);
      flow.ctx.font = font(11, false);
      flow.ctx.fillStyle = "#9aa1ad";
      flow.ctx.fillText(clipText(flow.ctx, font(11, false), bits.join(" + "), flow.w - 110), flow.x, jr.y + 32);
      button(flow.ctx, ui, "craft:" + key, flow.x + flow.w - 100, jr.y + 8, 100, 28, active ? "Active" : "Craft", active, active || !have);
    }
  }

  function drawSettings(flow, game, ui) {
    section(flow, "SYSTEM SETTINGS");
    para(flow, "Tuned for low-end machines. Drawing is capped. The simulation still follows the clock.");
    var r1 = row(flow, 40);
    if (r1.on) button(flow.ctx, ui, "opt:fx", flow.x, r1.y, flow.w, 32, "Particle bursts: " + (game.settings.highFX ? "On" : "Off"), game.settings.highFX, false);
    var r2 = row(flow, 40);
    if (r2.on) button(flow.ctx, ui, "opt:fps", flow.x, r2.y, flow.w, 32, "Draw cap: " + (game.settings.fpsCap === 30 ? "30 Hz" : "60 Hz"), false, false);
    var r3 = row(flow, 40);
    if (r3.on) button(flow.ctx, ui, "opt:perf", flow.x, r3.y, flow.w, 32, "Performance mode: " + (game.settings.performanceMode ? "On" : "Off"), game.settings.performanceMode, false);
    para(flow, "Performance mode and the 30 Hz cap skip particles and the meter wave.");
    section(flow, "LEDGER");
    var r4 = row(flow, 40);
    if (r4.on) button(flow.ctx, ui, ui.resetArm ? "reset:yes" : "reset", flow.x, r4.y, flow.w, 32, ui.resetArm ? "Confirm wipe" : "Reset save", false, false);
    if (ui.resetArm) para(flow, "This clears the local ledger and keeps these settings.");
  }

  function drawMenu(ctx, game, ui, L) {
    var ease = ui.menuT;
    var y = L.header + (1 - ease) * (L.tabY - L.header);
    var h = L.tabY - y;
    clearGlow(ctx);
    round(ctx, 10, y, L.w - 20, h, 10);
    ctx.fillStyle = "rgba(12,16,32,0.94)";
    ctx.fill();
    ctx.strokeStyle = "#2c3548";
    ctx.lineWidth = 1;
    ctx.stroke();
    clearGlow(ctx);
    if (ease < 0.8) return;
    var rect = { x: 10, y: y, w: L.w - 20, h: h };
    if (ui.scroll < 0) ui.scroll = 0;
    var flow = openFlow(ctx, ui, rect, ui.scroll);
    var titles = { job: "THE SHIFT", edu: "SCHOOL", lab: "THE LAB", scout: "THE CREW", journal: "PLAYBOOK", settings: "SETTINGS" };
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
    ui.contentH = flow.cy + 20;
    var max = ui.contentH - h;
    if (max < 0) max = 0;
    if (ui.scroll > max) ui.scroll = max;
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

  function drawLog(ctx, game, ui, L, now) {
    var x = 16;
    var y = L.header + 4;
    var w = L.w - 32;
    var h = L.a1 - y - 8;
    var fHead = font(13, false);
    ctx.font = fHead;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Tonight", x, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "#8b93a7";
    ctx.font = font(12, false);
    ctx.fillText(Math.round(ui.fps || 0) + " fps", x + w, y);
    ctx.textAlign = "left";
    var top = y + 16;
    var areaH = h - 16;
    var lineH = 22;
    var px = 14;
    var f = font(px, false);
    ctx.font = f;
    var charW = measure(ctx, f, "0000000000") / 10;
    var maxChars = Math.max(8, Math.floor(w / charW));
    var vis = Math.floor(areaH / lineH);
    if (vis < 1) vis = 1;
    var maxScroll = Math.max(0, game.logN - vis);
    if (ui.logPin) ui.logScroll = 0;
    if (ui.logScroll < 0) ui.logScroll = 0;
    if (ui.logScroll > maxScroll) ui.logScroll = maxScroll;
    if (ui.logScroll === 0) ui.logPin = true;
    var end = game.logN - ui.logScroll;
    var start = end - vis;
    if (start < 0) start = 0;
    var count = end - start;
    var slide = (1 - easeOut(logAnim.t)) * lineH;
    var y0 = top + areaH - count * lineH + slide;
    var chipFont = font(11, false);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, top, w, areaH);
    ctx.clip();
    var i;
    for (i = start; i < end; i++) {
      var text = S.logLine(game, i) || "";
      var ly = y0 + (i - start) * lineH;
      var rel = (ly - top) / Math.max(1, areaH);
      var fade = rel < 0.32 ? rel / 0.32 : 1;
      if (fade < 0) fade = 0;
      var alpha = fade * fade;
      var meta = logTag(text);
      var body = text;
      if (body.charAt(0) === "!" || body.charAt(0) === "+" || body.charAt(0) === "*") body = body.substring(1).replace(/^\s+/, "");
      ctx.font = chipFont;
      var chipW = measure(ctx, chipFont, meta.tag) + 16;
      ctx.globalAlpha = alpha;
      round(ctx, x, ly, chipW, 16, 8);
      ctx.fillStyle = meta.bg;
      ctx.fill();
      ctx.fillStyle = meta.color;
      ctx.textBaseline = "top";
      ctx.fillText(meta.tag, x + 8, ly + 2);
      ctx.font = f;
      ctx.fillStyle = INK;
      var shown = clipText(ctx, f, body, Math.max(12, w - chipW - 10));
      if (shown.length > maxChars) shown = shown.substring(0, maxChars - 1) + "…";
      ctx.fillText(shown, x + chipW + 8, ly);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    clearGlow(ctx);
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

  function drawHeader(ctx, game, ui, L) {
    var phase = S.phaseAt(game.lastReal || Date.now());
    ctx.font = font(L.w < 720 ? 18 : 22, false);
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Voidline", 16, L.header * 0.38);
    ctx.font = font(11, false);
    ctx.fillStyle = GOLD;
    ctx.fillText("Galactic Grind", 16, L.header * 0.78);
    var meta = "Rank " + game.player.level + "  ·  " + S.clockLabel(game.lastReal || Date.now()) + "  " + phase.name;
    ctx.fillStyle = "#c5cad6";
    ctx.font = font(13, false);
    var mw = measure(ctx, font(12, false), meta);
    var bx = L.w - 16 - 92 - 8 - 78;
    if (bx - mw > 200) ctx.fillText(meta, bx - mw - 12, L.header * 0.55);
    button(ctx, ui, "hdr:journal", L.w - 16 - 92 - 8 - 78, (L.header - 28) / 2, 78, 28, "Journal", ui.menu === "journal", false);
    button(ctx, ui, "hdr:settings", L.w - 16 - 92, (L.header - 28) / 2, 92, 28, "Settings", ui.menu === "settings", false);
  }

  function drawDock(ctx, game, ui, L) {
    var y = L.b1 + 8;
    var bottom = L.tabY - 6;
    if (ui.menuT < 0.5 && bottom > y + 36) {
      var slot = game.slots[0];
      var job = D.jobById[slot.jobId];
      var emp = slot.employee ? slot.employee.name + " on register" : "Nobody on register";
      var cardH = Math.min(78, bottom - y - 6);
      clearGlow(ctx);
      round(ctx, 16, y, L.w - 32, cardH, 14);
      ctx.fillStyle = "#14182a";
      ctx.fill();
      ctx.strokeStyle = "#2c3548";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = font(cardH < 64 ? 16 : 20, false);
      ctx.fillStyle = INK;
      ctx.fillText(clipText(ctx, font(cardH < 64 ? 16 : 20, false), job ? job.name : "Kiosk", L.w - 240), 32, y + cardH * 0.34);
      ctx.font = font(13, false);
      ctx.fillStyle = "#b7c0d0";
      ctx.fillText(clipText(ctx, font(13, false), emp + "  ·  stock " + slot.stock, L.w - 240), 32, y + cardH * 0.68);
      var bw = Math.min(168, (L.w - 64) * 0.34);
      button(ctx, ui, "shift", L.w - 32 - bw, y + (cardH - 42) * 0.5, bw, 42, "Run shift", true, false);
    }
    var labels = [["Shift"], ["School"], ["Lab"], ["Scouts"]];
    var ids = ["job", "edu", "lab", "scout"];
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
      round(ctx, x, ty, tw, th, 8);
      ctx.fillStyle = on ? "#241c10" : "#171b28";
      ctx.fill();
      ctx.strokeStyle = (hover || on) ? GOLD : "#2c3548";
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = font(L.w < 860 ? 13 : 15, false);
      ctx.fillStyle = (hover || on) ? GOLD : INK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var lines = labels[i];
      var ly = cy - (lines.length - 1) * 7;
      var n;
      for (n = 0; n < lines.length; n++) ctx.fillText(lines[n], cx, ly + n * 14);
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
      logAnim.t += dt / 150;
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
    var bg = ensurePlate(w, h, !!game.settings.performanceMode, dpr);
    ctx.drawImage(bg, 0, 0, w, h);
    var L = layout(w, h);
    ui.L = L;
    drawLog(ctx, game, ui, L, now);
    drawMeters(ctx, game, L, now);
    drawRules(ctx, L);
    if (ui.menu && ui.menuT > 0.02) drawMenu(ctx, game, ui, L);
    drawHeader(ctx, game, ui, L);
    drawDock(ctx, game, ui, L);
    drawParts(ctx);
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
