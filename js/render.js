(function (root) {
  "use strict";

  var D = root.VoidData;
  var S = root.VoidSim;
  var SANS = "system-ui, Segoe UI, sans-serif";
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  var plate = null;
  var plateKey = "";
  var parts = [];
  var textCache = {};
  var cacheN = 0;

  function font(px, mono) {
    return px + "px " + (mono ? MONO : SANS);
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

  function rand(i) {
    var x = Math.sin(i * 127.1) * 43758.5453;
    return x - Math.floor(x);
  }

  function ensurePlate(w, h, perf, dpr) {
    var key = (w | 0) + "x" + (h | 0) + ":" + dpr + (perf ? ":p" : ":f");
    if (plate && plateKey === key) return plate;
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.floor(w * dpr));
    c.height = Math.max(1, Math.floor(h * dpr));
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#101216";
    g.fillRect(0, 0, w, h);
    var i;
    for (i = 0; i < 42; i++) {
      var a = 0.18 + rand(i + 4) * 0.5;
      g.fillStyle = "rgba(240,212,138," + a.toFixed(3) + ")";
      g.fillRect(rand(i) * w, rand(i + 21) * h, 1.6, 1.6);
    }
    if (perf) {
      g.fillStyle = "rgba(16,18,22,0.9)";
      g.fillRect(0, 0, w, h);
      plate = c;
    } else {
      var blur = document.createElement("canvas");
      blur.width = c.width;
      blur.height = c.height;
      var b = blur.getContext("2d");
      b.filter = "blur(6px)";
      b.drawImage(c, 0, 0);
      b.filter = "none";
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      b.fillStyle = "rgba(16,18,22,0.38)";
      b.fillRect(0, 0, w, h);
      plate = blur;
    }
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
    round(ctx, x, y, w, h, 6);
    ctx.fillStyle = disabled ? "#1a1d24" : on ? "#3c331f" : "#242a34";
    ctx.fill();
    ctx.strokeStyle = on ? "#d6b25e" : "#3d4452";
    ctx.lineWidth = 1;
    ctx.stroke();
    var f = font(w < 110 ? 11 : 13, false);
    ctx.font = f;
    ctx.fillStyle = disabled ? "#6c7380" : "#f6f3ec";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, f, label, w - 12), x + w * 0.5, y + h * 0.5);
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
    var f = font(11, false);
    ctx.font = f;
    ctx.fillStyle = "#d6b25e";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, flow.x, r.y + 13);
  }

  function para(flow, text) {
    var r = row(flow, 20);
    if (!r.on) return;
    var ctx = flow.ctx;
    var f = font(13, false);
    ctx.font = f;
    ctx.fillStyle = "#9aa1ad";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, f, text, flow.w), flow.x, r.y + 10);
  }

  function traitText(game, traitId, caught) {
    var t = D.TRAITS[traitId];
    if (!t) return traitId;
    if (t.hidden && !caught && game.player.intelligence < 75) return "Sealed trait";
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
        round(ctx, flow.x, r.y, flow.w, 100, 8);
        ctx.fillStyle = ui.focusSlot === i ? "#2a2418" : "#1c212b";
        ctx.fill();
        ctx.strokeStyle = "#3a3324";
        ctx.stroke();
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
      round(ctx2, flow.x, cr.y, flow.w, height, 8);
      ctx2.fillStyle = selected ? "#2a2418" : "#1c212b";
      ctx2.fill();
      ctx2.strokeStyle = card.dying ? "#e06a5c" : "#3a3324";
      ctx2.stroke();
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
    var phase = S.phaseAt(game.lastReal || Date.now());
    para(flow, phase.name + " adjusts prices. Visibility trims them slightly.");
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
    para(flow, "Combine Idea, Staff, Marketing, and Asset. Legendary recipes are filed in the Journal.");
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
        if (mat.cat !== ui.pick) continue;
        var count = game.mats[mat.id] || 0;
        if (count <= 0) continue;
        any = true;
        var pr = row(flow, 32);
        if (!pr.on) continue;
        button(flow.ctx, ui, "use:" + mat.cat + ":" + mat.id, flow.x, pr.y, flow.w, 28, mat.name + "  ×" + count, ui.synth[mat.cat] === mat.id, false);
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
      para(flow, tag + " · " + crafted.name + " · " + crafted.tag + " x" + Number(crafted.mult).toFixed(2));
    }
  }

  function uiOf(flow) {
    return flow.ui;
  }

  function drawJournal(flow, game, ui) {
    section(flow, "BLUEPRINT COOKBOOK");
    para(flow, "Discovered recipes stay here. Craft instantly when the four materials are in stores.");
    if (!game.book.length) para(flow, "The cookbook is empty. Experiment in the lab, or spend a Void Point to research.");
    var i;
    for (i = 0; i < game.book.length; i++) {
      var key = game.book[i];
      var legend = D.recipeByKey[key];
      var name = legend ? legend.name : key;
      var ids = legend ? [legend.idea, legend.staff, legend.marketing, legend.asset] : key.split("|");
      var bits = [];
      var k;
      var have = true;
      for (k = 0; k < ids.length; k++) {
        var item = D.itemById[ids[k]];
        bits.push(item ? item.fragment : ids[k]);
        if ((game.mats[ids[k]] || 0) < 1) have = false;
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
    if (r1.on) button(flow.ctx, ui, "opt:fx", flow.x, r1.y, flow.w, 32, "Text bursts: " + (game.settings.highFX ? "On" : "Off"), game.settings.highFX, false);
    var r2 = row(flow, 40);
    if (r2.on) button(flow.ctx, ui, "opt:fps", flow.x, r2.y, flow.w, 32, "Draw cap: " + (game.settings.fpsCap === 30 ? "30 Hz" : "60 Hz"), false, false);
    var r3 = row(flow, 40);
    if (r3.on) button(flow.ctx, ui, "opt:perf", flow.x, r3.y, flow.w, 32, "Performance mode: " + (game.settings.performanceMode ? "Flat fills" : "Soft plate"), game.settings.performanceMode, false);
    para(flow, "Performance mode skips the blurred plate and uses a translucent charcoal fill.");
    section(flow, "LEDGER");
    var r4 = row(flow, 40);
    if (r4.on) button(flow.ctx, ui, ui.resetArm ? "reset:yes" : "reset", flow.x, r4.y, flow.w, 32, ui.resetArm ? "Confirm wipe" : "Reset save", false, false);
    if (ui.resetArm) para(flow, "This clears the local ledger and keeps these settings.");
  }

  function drawMenu(ctx, game, ui, L) {
    var ease = ui.menuT;
    var y = L.header + (1 - ease) * (L.tabY - L.header);
    var h = L.tabY - y;
    round(ctx, 10, y, L.w - 20, h, 10);
    ctx.fillStyle = game.settings.performanceMode ? "rgba(16,18,22,0.94)" : "rgba(18,20,26,0.78)";
    ctx.fill();
    ctx.strokeStyle = "#d6b25e";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (ease < 0.8) return;
    var rect = { x: 10, y: y, w: L.w - 20, h: h };
    if (ui.scroll < 0) ui.scroll = 0;
    var flow = openFlow(ctx, ui, rect, ui.scroll);
    var titles = { job: "OCCUPATION", edu: "EDUCATION & MARKET", lab: "INVENTION LAB", scout: "SCOUTS & ASSETS", journal: "JOURNAL", settings: "SETTINGS" };
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

  function drawLog(ctx, game, ui, L) {
    var x = 16;
    var y = L.header + 4;
    var w = L.w - 32;
    var h = L.a1 - y - 8;
    ctx.font = font(11, false);
    ctx.fillStyle = "#6c7380";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("CORPORATE ACTIVITY", x, y);
    ctx.textAlign = "right";
    ctx.fillText(Math.round(ui.fps || 0) + " fps", x + w, y);
    ctx.textAlign = "left";
    var top = y + 16;
    var areaH = h - 16;
    var lineH = 18;
    var px = 13;
    var f = font(px, true);
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
    var y0 = top + areaH - count * lineH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, top, w, areaH);
    ctx.clip();
    var i;
    for (i = start; i < end; i++) {
      var text = S.logLine(game, i) || "";
      var ch = text.charAt(0);
      ctx.fillStyle = ch === "!" ? "#e06a5c" : ch === "+" ? "#d6b25e" : ch === "*" ? "#6fce9a" : "#d7d0c4";
      if (text.length > maxChars) text = text.substring(0, maxChars - 1) + "…";
      ctx.fillText(text, x, y0 + (i - start) * lineH);
    }
    ctx.restore();
  }

  function meter(ctx, x, y, w, h, label, valueText, fill, color) {
    ctx.font = font(11, false);
    ctx.fillStyle = "#9aa1ad";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(label, x, y);
    ctx.fillStyle = "#f6f3ec";
    ctx.font = font(13, false);
    ctx.textAlign = "right";
    ctx.fillText(valueText, x + w, y);
    var by = y + 18;
    round(ctx, x, by, w, 8, 4);
    ctx.fillStyle = "#2a303a";
    ctx.fill();
    var fw = w * fill;
    if (fw < 0) fw = 0;
    if (fw > w) fw = w;
    if (fw > 0) {
      round(ctx, x, by, Math.max(4, fw), 8, 4);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.textAlign = "left";
  }

  function drawMeters(ctx, game, L, t) {
    var y = L.b0 + 8;
    var x = 16;
    var gap = 12;
    var w = (L.w - 32 - gap * 3) / 4;
    var h = L.b1 - L.b0 - 16;
    if (h < 8) return;
    var wave = game.settings.highFX ? 0.985 + Math.sin(t * 0.004) * 0.015 : 1;
    var capitalFill = 1 - Math.exp(-game.player.capital / 500);
    meter(ctx, x, y, w, h, "CAPITAL", S.money(game.player.capital), capitalFill * wave, "#d6b25e");
    meter(ctx, x + (w + gap), y, w, h, "INTELLIGENCE", String(Math.round(game.player.intelligence)), game.player.intelligence / 100, "#f6f3ec");
    var stressColor = game.player.stress > 70 ? "#e06a5c" : "#d6b25e";
    meter(ctx, x + (w + gap) * 2, y, w, h, "STRESS", String(Math.round(game.player.stress)), game.player.stress / 100, stressColor);
    meter(ctx, x + (w + gap) * 3, y, w, h, "VISIBILITY", String(Math.round(game.player.visibility)), game.player.visibility / 100, "#f6f3ec");
  }

  function drawHeader(ctx, game, ui, L) {
    var phase = S.phaseAt(game.lastReal || Date.now());
    ctx.font = font(L.w < 720 ? 13 : 16, false);
    ctx.fillStyle = "#f6f3ec";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("VOIDLINE", 16, L.header * 0.42);
    ctx.font = font(11, false);
    ctx.fillStyle = "#d6b25e";
    ctx.fillText("THE GALACTIC GRIND", 16, L.header * 0.78);
    var meta = "Rk " + game.player.level + "  VP " + game.player.vp + "  " + S.clockLabel(game.lastReal || Date.now()) + "  " + phase.name;
    ctx.fillStyle = "#9aa1ad";
    ctx.font = font(12, false);
    var mw = measure(ctx, font(12, false), meta);
    var bx = L.w - 16 - 92 - 8 - 78;
    if (bx - mw > 200) ctx.fillText(meta, bx - mw - 12, L.header * 0.55);
    button(ctx, ui, "hdr:journal", L.w - 16 - 92 - 8 - 78, (L.header - 28) / 2, 78, 28, "Journal", ui.menu === "journal", false);
    button(ctx, ui, "hdr:settings", L.w - 16 - 92, (L.header - 28) / 2, 92, 28, "Settings", ui.menu === "settings", false);
  }

  function drawDock(ctx, game, ui, L) {
    var y = L.b1 + 8;
    var bottom = L.tabY - 6;
    if (ui.menuT < 0.5 && bottom > y + 20) {
      ctx.font = font(13, false);
      ctx.fillStyle = "#9aa1ad";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      var slot = game.slots[0];
      var job = D.jobById[slot.jobId];
      var emp = slot.employee ? slot.employee.name : "no hire";
      var line = (job ? job.name : "Kiosk") + " · stock " + slot.stock + " · " + emp + " · " + S.money(game.player.capital);
      ctx.fillText(clipText(ctx, font(13, false), line, L.w - 32), 16, y);
      ctx.font = font(12, false);
      ctx.fillStyle = "#6c7380";
      ctx.fillText("Open a tab. The ledger above records every cycle, hire, and audit.", 16, y + 22);
    }
    var labels = L.w < 860
      ? [["Occupation"], ["Education", "& Market"], ["Invention", "Lab"], ["Scouts", "& Assets"]]
      : [["Occupation"], ["Education & Market"], ["Invention Lab"], ["Scouts & Assets"]];
    var ids = ["job", "edu", "lab", "scout"];
    var gap = 8;
    var bw = (L.w - 32 - gap * 3) / 4;
    var i;
    for (i = 0; i < 4; i++) {
      var x = 16 + i * (bw + gap);
      var on = ui.menu === ids[i];
      round(ctx, x, L.tabY + 8, bw, L.tabH - 16, 8);
      ctx.fillStyle = on ? "#3c331f" : "#1b2028";
      ctx.fill();
      ctx.strokeStyle = on ? "#d6b25e" : "#3d4452";
      ctx.stroke();
      ctx.font = font(L.w < 860 ? 11 : 13, false);
      ctx.fillStyle = "#f6f3ec";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var lines = labels[i];
      var ly = L.tabY + L.tabH * 0.5 - (lines.length - 1) * 7;
      var n;
      for (n = 0; n < lines.length; n++) ctx.fillText(lines[n], x + bw * 0.5, ly + n * 14);
      pushHit(ui, "tab:" + ids[i], x, L.tabY + 8, bw, L.tabH - 16);
    }
    ctx.textAlign = "left";
  }

  function drawRules(ctx, L) {
    ctx.strokeStyle = "rgba(214,178,94,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, L.a1);
    ctx.lineTo(L.w - 12, L.a1);
    ctx.moveTo(12, L.b1);
    ctx.lineTo(L.w - 12, L.b1);
    ctx.stroke();
  }

  function tickParts(dt) {
    var i;
    for (i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life -= dt / 900;
      p.y += p.vy * dt / 1000;
      if (p.life <= 0) {
        var last = parts.length - 1;
        parts[i] = parts[last];
        parts.pop();
      }
    }
  }

  function spawn(text, x, y, color) {
    if (parts.length > 20) {
      parts.shift();
    }
    parts.push({ text: text, x: x, y: y, vy: -36, life: 1, color: color });
  }

  function drawParts(ctx) {
    ctx.font = font(14, false);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    var i;
    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx, game, ui, now) {
    var w = ui.w;
    var h = ui.h;
    if (w < 2 || h < 2) return;
    ctx.setTransform(ui.dpr || 1, 0, 0, ui.dpr || 1, 0, 0);
    ui.hits.length = 0;
    var bg = ensurePlate(w, h, !!game.settings.performanceMode, ui.dpr || 1);
    ctx.drawImage(bg, 0, 0, w, h);
    var L = layout(w, h);
    ui.L = L;
    drawLog(ctx, game, ui, L);
    drawMeters(ctx, game, L, now);
    drawRules(ctx, L);
    if (ui.menu && ui.menuT > 0.02) drawMenu(ctx, game, ui, L);
    drawHeader(ctx, game, ui, L);
    drawDock(ctx, game, ui, L);
    drawParts(ctx);
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
    spawn: spawn,
    layout: layout
  };
})(typeof window !== "undefined" ? window : globalThis);
