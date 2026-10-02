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
  var cashPulse = 0;
  var paperOn = false;
  var buttonTone = "";
  var sheetLock = false;
  var roomAccent = "#8a5a12";
  var shakeLeft = 0;
  var pool = [];
  var pi;
  for (pi = 0; pi < 64; pi++) {
    pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, rot: 0, kind: 0, color: GOLD });
  }

  function font(px, mono, weight) {
    return (weight || 600) + " " + px + "px " + (mono ? MONO : SANS);
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

  function platePalette(phase) {
    if (phase === "morning") {
      return { sky: "#f0b56a", sky2: "#f8d7a4", ground: "#2c2418", glow: "rgba(245,197,66,0.24)", wash: "rgba(255,214,150,0.2)", star: 0.08, moon: 0, sun: 1, rain: 0, haze: 0 };
    }
    if (phase === "lunch") {
      return { sky: "#7ec4e6", sky2: "#f4e3b6", ground: "#2a3140", glow: "rgba(255,248,220,0.2)", wash: "rgba(255,255,255,0.14)", star: 0, moon: 0, sun: 1, rain: 0, haze: 1 };
    }
    if (phase === "evening") {
      return { sky: "#d2653a", sky2: "#2c2458", ground: "#1a1428", glow: "rgba(226,90,60,0.18)", wash: "rgba(90,40,130,0.14)", star: 0.28, moon: 1, sun: 0, rain: 0, haze: 0 };
    }
    if (phase === "standard") {
      return { sky: "#243454", sky2: "#12182c", ground: "#171c30", glow: "rgba(62,200,216,0.14)", wash: "rgba(62,200,216,0.1)", star: 0.4, moon: 0, sun: 0, rain: 0, haze: 0 };
    }
    return { sky: "#0c1020", sky2: "#10162c", ground: "#171c30", glow: "rgba(245,197,66,0.16)", wash: "rgba(62,200,216,0.12)", star: 0.55, moon: 1, sun: 0, rain: 1, haze: 0 };
  }

  function ensurePlate(w, h, perf, dpr, phase) {
    phase = phase || "night";
    var key = (w | 0) + "x" + (h | 0) + ":" + dpr + (perf ? ":p" : ":f") + ":" + phase;
    if (plate && plateKey === key) return plate;
    var pal = platePalette(phase);
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.floor(w * dpr));
    c.height = Math.max(1, Math.floor(h * dpr));
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.shadowBlur = 0;
    if (perf) {
      g.fillStyle = pal.sky;
      g.fillRect(0, 0, w, h);
    } else {
      var sky = g.createLinearGradient(0, 0, 0, h * 0.78);
      sky.addColorStop(0, pal.sky);
      sky.addColorStop(1, pal.sky2);
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      var glow = g.createRadialGradient(w * 0.5, h * 0.82, 12, w * 0.5, h * 0.72, Math.max(w, h) * 0.48);
      glow.addColorStop(0, pal.glow);
      glow.addColorStop(1, "rgba(12,16,32,0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
      var wash = g.createRadialGradient(w * 0.12, h * 0.08, 8, w * 0.2, h * 0.12, Math.max(w, h) * 0.42);
      wash.addColorStop(0, pal.wash);
      wash.addColorStop(1, "rgba(12,16,32,0)");
      g.fillStyle = wash;
      g.fillRect(0, 0, w, h);
    }
    if (pal.star > 0) {
      var si;
      g.fillStyle = "#f4efe4";
      for (si = 0; si < 42; si++) {
        var sx = ((si * 97) % 1000) / 1000 * w;
        var sy = ((si * 53) % 520) / 520 * h * 0.42;
        g.globalAlpha = pal.star * (0.45 + (si % 5) * 0.12);
        g.beginPath();
        g.arc(sx, sy, (si % 3) + 1, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    if (pal.sun) {
      g.fillStyle = "#fff4c8";
      g.beginPath();
      g.arc(w * 0.78, h * 0.12, Math.min(w, h) * 0.045, 0, Math.PI * 2);
      g.fill();
    }
    if (pal.moon) {
      var moon = Math.min(w, h) * 0.05;
      g.fillStyle = "#f6e7b8";
      g.beginPath();
      g.arc(w * 0.78, h * 0.1, moon, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = pal.sky;
      g.beginPath();
      g.arc(w * 0.78 + moon * 0.45, h * 0.09, moon * 0.82, 0, Math.PI * 2);
      g.fill();
    }
    if (pal.haze) {
      g.fillStyle = "rgba(255,255,255,0.16)";
      g.fillRect(0, h * 0.18, w, 5);
      g.fillRect(0, h * 0.28, w, 3);
      g.fillRect(0, h * 0.4, w, 2);
    }
    if (pal.rain) {
      g.strokeStyle = "rgba(190, 206, 230, 0.35)";
      g.lineWidth = 1;
      var ri;
      for (ri = 0; ri < 28; ri++) {
        var rx = ((ri * 137) % 1000) / 1000 * w;
        var ry = ((ri * 89) % 700) / 700 * h * 0.7;
        g.beginPath();
        g.moveTo(rx, ry);
        g.lineTo(rx - 3, ry + 10);
        g.stroke();
      }
    }
    g.fillStyle = pal.ground;
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
    var header = narrow ? 188 : (h < 620 ? 150 : 168);
    var tabH = h < 620 ? 100 : 116;
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
      ctx.fillRect(-u * 0.95, -u * 0.2, u * 1.7, u * 0.22);
      ctx.fillRect(-u * 0.7, -u * 0.72, u * 1.15, u * 0.18);
      ctx.fillRect(-u * 0.72, -u * 0.2, u * 0.16, u * 0.72);
      ctx.fillRect(u * 0.42, -u * 0.2, u * 0.16, u * 0.72);
    } else if (kind === "key") {
      ctx.beginPath();
      ctx.arc(-u * 0.32, -u * 0.12, u * 0.36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(u * 0.02, -u * 0.12);
      ctx.lineTo(u * 0.95, -u * 0.12);
      ctx.moveTo(u * 0.55, -u * 0.12);
      ctx.lineTo(u * 0.55, u * 0.22);
      ctx.moveTo(u * 0.82, -u * 0.12);
      ctx.lineTo(u * 0.82, u * 0.16);
      ctx.stroke();
    } else if (kind === "chain") {
      ctx.beginPath();
      ctx.arc(-u * 0.36, 0, u * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(u * 0.36, 0, u * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === "bulb") {
      ctx.beginPath();
      ctx.arc(0, -u * 0.18, u * 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-u * 0.2, u * 0.26, u * 0.4, u * 0.16);
      ctx.fillRect(-u * 0.14, u * 0.44, u * 0.28, u * 0.12);
    } else if (kind === "hand") {
      ctx.fillRect(-u * 0.55, -u * 0.1, u * 0.26, u * 0.8);
      ctx.fillRect(-u * 0.22, -u * 0.55, u * 0.24, u * 1.05);
      ctx.fillRect(u * 0.08, -u * 0.32, u * 0.24, u * 0.88);
      ctx.fillRect(-u * 0.7, u * 0.38, u * 1.3, u * 0.34);
    } else if (kind === "drop") {
      ctx.beginPath();
      ctx.moveTo(0, -u);
      ctx.bezierCurveTo(u * 0.7, -u * 0.1, u * 0.55, u * 0.7, 0, u * 0.85);
      ctx.bezierCurveTo(-u * 0.55, u * 0.7, -u * 0.7, -u * 0.1, 0, -u);
      ctx.fill();
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
    var rr = paperOn ? 14 : 10;
    var tone = buttonTone;
    if (paperOn) {
      round(ctx, x + 3, y + 3, w, h, rr);
      ctx.fillStyle = disabled ? "#d9d0c2" : "#c9bba6";
      ctx.fill();
    }
    round(ctx, x, y, w, h, rr);
    var ink = paperOn ? DARK : INK;
    if (paperOn) {
      var fill = "#fffdf8";
      var stroke = DARK;
      if (disabled) {
        fill = "#e6dfd2";
        stroke = "#d4cbb8";
        ink = "#9a9186";
      } else if (tone === "violet") {
        fill = on ? VIOLET : hover ? "#fbf7fd" : "#f6e9fa";
        stroke = VIOLET;
        ink = on ? "#fffdf8" : "#4a2060";
      } else if (tone === "locked") {
        fill = "#ece6dc";
        stroke = "#8d8494";
        ink = "#6d6570";
      } else if (on) {
        fill = GOLD;
      }
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = on ? 2 : 1.5;
      if (tone === "locked") ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = disabled ? "#1a1e2a" : on ? "#3a3018" : hover ? "#243044" : "#171b28";
      ctx.fill();
      ctx.strokeStyle = disabled ? "#2a3142" : (on || hover) ? GOLD : "#2c3548";
      ctx.lineWidth = on ? 2 : 1;
      ctx.stroke();
      ink = disabled ? "#6c7380" : on ? GOLD : INK;
    }
    var f = font(w < 110 ? 12 : 15, false, on ? 700 : 600);
    ctx.font = f;
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var labelShift = 0;
    if (paperOn && w >= 124 && (tone === "locked" || tone === "violet")) {
      icon(ctx, tone === "locked" ? "chain" : "alert", x + 16, cy, 14, ink);
      labelShift = 8;
    }
    ctx.fillText(clipText(ctx, f, label, w - 12 - (labelShift ? 16 : 0)), cx + labelShift, cy);
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
      "THE BLOCK": "people",
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
    var shadyName = text === "SHADY" || text === "STREET";
    var locked = shadyName && sheetLock;
    if (shadyName) {
      round(ctx, flow.x - 4, r.y + 2, flow.w + 8, 26, 8);
      ctx.fillStyle = locked ? "rgba(90,80,100,0.16)" : "rgba(180,74,192,0.16)";
      ctx.fill();
    }
    var kind = locked ? "chain" : sectionIcon(text);
    var tx = flow.x;
    var accent = shadyName ? (locked ? "#8d7a9a" : VIOLET) : (paperOn ? roomAccent : GOLD);
    if (kind) {
      badge(ctx, kind, flow.x + 11, r.y + 15, 22, paperOn ? "#fffdf8" : "#241c10", accent);
      tx += 28;
    }
    var f = font(12, false, 700);
    ctx.font = f;
    ctx.fillStyle = accent;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, tx, r.y + 15);
    if (locked) {
      icon(ctx, "chain", flow.x + flow.w - 12, r.y + 15, 14, "#8d7a9a");
    }
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
    var plan = row(flow, 46);
    if (plan.on) drawFloorPlan(flow.ctx, flow.x, plan.y + 2, flow.w, place, game.world && game.world.floor);
    if (game.world && (game.world.rentDue || game.player.place.owned)) {
      section(flow, "THE BLOCK");
      if (game.world.rentDue) {
        para(flow, "Rent due " + S.money(game.world.rentDue) + (game.world.behind ? ". You have stalled " + game.world.behind + " time" + (game.world.behind === 1 ? "" : "s") + "." : "."));
        var rentRow = row(flow, 40);
        if (rentRow.on) {
          button(flow.ctx, ui, "rentpay", flow.x, rentRow.y, (flow.w - 8) * 0.48, 32, "Pay rent", false, game.player.capital < game.world.rentDue);
          button(flow.ctx, ui, "rentstall", flow.x + (flow.w - 8) * 0.52, rentRow.y, (flow.w - 8) * 0.48, 32, "Stall", false, false);
        }
      }
      if (game.player.place.owned && !game.world.floor) {
        var floorRow = row(flow, 40);
        if (floorRow.on) button(flow.ctx, ui, "floor", flow.x, floorRow.y, flow.w, 32, "Buy the floor  " + S.money(D.ROOM.floor), false, game.player.capital < D.ROOM.floor);
      } else if (game.world.floor) para(flow, "The second floor is yours.");
      if (game.world.regular) para(flow, game.world.regular.name + " · visits " + game.world.regular.visits + " · mood " + game.world.regular.mood);
      if (game.world.rival) para(flow, game.world.rival + (game.player.place.sign ? " is across the street. Your sign is holding." : " is across the street. Lunch is thinner."));
    }

    section(flow, "HOBBIES");
    var hi;
    for (hi = 0; hi < D.HOBBIES.length; hi++) {
      var hobby = D.HOBBIES[hi];
      var openH = S.hobbyOpen(game, hobby);
      var hr = row(flow, 36);
      if (!hr.on) continue;
      var hk = hobby.id === "tutor" ? "cap" : hobby.id === "flip" ? "coin" : hobby.id === "stream" ? "star" : "book";
      badge(flow.ctx, hk, flow.x + 14, hr.y + 15, 26, "#fffdf8", openH ? "#8a5a12" : "#b7ad9e");
      button(flow.ctx, ui, "hobby:" + hobby.id, flow.x + 32, hr.y, flow.w - 32, 30, hobby.name + (openH ? "  " + S.money(hobby.pay) : "  needs " + hobby.needSkill + " " + hobby.need), false, !openH);
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
        if (slot.employee && slot.employee.caught) {
          ctx.fillStyle = "rgba(255, 244, 210, 0.72)";
          ctx.beginPath();
          ctx.moveTo(flow.x + 36, r.y + 2);
          ctx.lineTo(flow.x + 58, r.y + 62);
          ctx.lineTo(flow.x + 14, r.y + 62);
          ctx.closePath();
          ctx.fill();
        }
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
    sheetLock = !(game.flags && game.flags.shady);
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
      var shadyNode = node.line === "shady";
      buttonTone = shadyNode ? (sheetLock ? "locked" : "violet") : "";
      flow.ctx.font = font(14, false, 700);
      flow.ctx.fillStyle = owned ? "#2f8f5b" : (shadyNode && !sheetLock ? "#4a2060" : titleInk());
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(node.name, flow.x, nr.y + 12);
      flow.ctx.font = font(11, false);
      flow.ctx.fillStyle = muteInk();
      flow.ctx.fillText(clipText(flow.ctx, font(11, false), node.text, flow.w - 100), flow.x, nr.y + 30);
      button(flow.ctx, ui, "node:" + node.id, flow.x + flow.w - 88, nr.y + 6, 88, 28, owned ? "Open" : node.cost + " VP", owned, owned);
      buttonTone = "";
    }

    if (game.nodes.skim || game.nodes.score) {
      section(flow, "STREET");
      para(flow, "Heat is " + Math.round(game.player.heat || 0) + ". A bust takes cash. High heat makes you sit.");
      var street = row(flow, 40);
      if (street.on) {
        buttonTone = "violet";
        if (game.nodes.skim) button(flow.ctx, ui, "skim", flow.x, street.y, game.nodes.score ? (flow.w - 8) * 0.48 : flow.w, 32, "Skim", false, false);
        if (game.nodes.score) button(flow.ctx, ui, "score", flow.x + (game.nodes.skim ? (flow.w - 8) * 0.52 : 0), street.y, game.nodes.skim ? (flow.w - 8) * 0.48 : flow.w, 32, "Big score", false, false);
        buttonTone = "";
      }
    }
    sheetLock = false;

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
    ctx.save();
    round(ctx, 10, y, L.w - 20, h, 18);
    ctx.clip();
    ctx.fillStyle = roomPaper(ui.menu);
    ctx.fillRect(10, y, L.w - 20, h);
    ctx.fillStyle = roomBand(ui.menu);
    ctx.fillRect(10, y, L.w - 20, 10);
    ctx.restore();
    round(ctx, 10, y, L.w - 20, h, 18);
    ctx.strokeStyle = roomBand(ui.menu);
    ctx.lineWidth = 1;
    ctx.stroke();
    clearGlow(ctx);
    if (ease < 0.8) return;
    paperOn = true;
    roomAccent = ui.menu === "edu" ? "#1d5c78" : ui.menu === "scout" ? "#8a3060" : ui.menu === "lab" ? "#6a3480" : ui.menu === "journal" ? "#6b5340" : "#8a5a12";
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
    roomAccent = "#8a5a12";
    buttonTone = "";
    sheetLock = false;
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
    if (low.indexOf("life:") >= 0) {
      var idm = raw.match(/life:\s*([a-z_]+)/i);
      if (idm && S.lifeBeat) {
        var lived = S.lifeBeat(game, idm[1]);
        if (lived) return lived;
      }
    }
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
    round(ctx, x + 3, y + 4, w, h, 16);
    ctx.fillStyle = ghost ? "#b7a88e" : "#8a6414";
    ctx.fill();
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
    var f = font(h < 48 ? 16 : 20, false, 700);
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
    if (beat.stamp === "HEAT" || beat.stamp === "RENT" || beat.stamp === "RIVAL") return "alert";
    if (beat.stamp === "REGULAR") return "people";
    if (beat.stamp === "ROOM" || beat.stamp === "UPSTAIRS") return "shop";
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

  function drawFace(ctx, cx, cy, r, o) {
    if (typeof o === "number") o = { mood: o };
    o = o || {};
    var mood = o.mood || 0;
    var stress = o.stress || 0;
    var heat = o.heat || 0;
    var shady = !!o.shady;
    var job = o.job || "";
    var broke = !!o.broke;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = stress > 75 ? "#e0ae90" : "#f0c7a0";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - r * 0.92, cy + r * 0.05, r * 0.14, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.92, cy + r * 0.05, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#241c18";
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.08, r, Math.PI * 1.02, Math.PI * 1.98);
    ctx.fill();
    if (!broke && (job === "fast_food" || job === "counter_lead" || job === "")) {
      ctx.fillStyle = "#fffdf8";
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.78, cy - r * 0.42);
      ctx.lineTo(cx, cy - r * 1.2);
      ctx.lineTo(cx + r * 0.78, cy - r * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(cx - r, cy - r * 0.48, r * 2, r * 0.16);
      ctx.strokeStyle = DARK;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - r, cy - r * 0.48, r * 2, r * 0.16);
    } else if (job === "tutor_desk" || job === "server") {
      ctx.strokeStyle = "#1a140c";
      ctx.lineWidth = Math.max(1.2, r * 0.06);
      ctx.beginPath();
      ctx.arc(cx - r * 0.28, cy + r * 0.02, r * 0.22, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.28, cy + r * 0.02, r * 0.22, 0, Math.PI * 2);
      ctx.moveTo(cx - r * 0.06, cy + r * 0.02);
      ctx.lineTo(cx + r * 0.06, cy + r * 0.02);
      ctx.stroke();
    } else if (job === "engineer" || job === "automation") {
      ctx.fillStyle = CYAN;
      ctx.fillRect(cx - r * 0.72, cy - r * 0.55, r * 1.44, r * 0.14);
    }
    ctx.strokeStyle = "#241c18";
    ctx.lineWidth = Math.max(1.4, r * 0.07);
    ctx.lineCap = "round";
    ctx.beginPath();
    if (stress > 50) {
      ctx.moveTo(cx - r * 0.46, cy - r * 0.2);
      ctx.lineTo(cx - r * 0.12, cy - r * 0.08);
      ctx.moveTo(cx + r * 0.46, cy - r * 0.2);
      ctx.lineTo(cx + r * 0.12, cy - r * 0.08);
    } else {
      ctx.moveTo(cx - r * 0.46, cy - r * 0.12);
      ctx.lineTo(cx - r * 0.12, cy - r * 0.18);
      ctx.moveTo(cx + r * 0.12, cy - r * 0.18);
      ctx.lineTo(cx + r * 0.46, cy - r * 0.12);
    }
    ctx.stroke();
    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.arc(cx - r * 0.28, cy + r * 0.04, r * 0.08, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.28, cy + r * 0.04, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    if (shady && heat > 40) {
      ctx.strokeStyle = VIOLET;
      ctx.lineWidth = Math.max(1.5, r * 0.07);
      ctx.beginPath();
      ctx.arc(cx + r * 0.28, cy + r * 0.04, r * 0.16, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (stress > 60) {
      ctx.strokeStyle = "rgba(90,50,40,0.75)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.42, cy + r * 0.18);
      ctx.lineTo(cx - r * 0.14, cy + r * 0.18);
      ctx.moveTo(cx + r * 0.14, cy + r * 0.18);
      ctx.lineTo(cx + r * 0.42, cy + r * 0.18);
      ctx.stroke();
    }
    ctx.strokeStyle = DARK;
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.beginPath();
    if (mood === 1 && stress < 70) ctx.arc(cx, cy + r * 0.22, r * 0.26, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (mood === 2 || stress > 70) {
      ctx.moveTo(cx - r * 0.22, cy + r * 0.42);
      ctx.quadraticCurveTo(cx, cy + r * 0.28, cx + r * 0.22, cy + r * 0.4);
    } else {
      ctx.moveTo(cx - r * 0.16, cy + r * 0.38);
      ctx.lineTo(cx + r * 0.16, cy + r * 0.38);
    }
    ctx.stroke();
    if (stress > 45 || (shady && heat > 35)) {
      ctx.fillStyle = "#7ec8e3";
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.78, cy + r * 0.08, r * 0.08, r * 0.13, 0.4, 0, Math.PI * 2);
      ctx.fill();
      if (stress > 70) {
        ctx.beginPath();
        ctx.ellipse(cx - r * 0.78, cy + r * 0.22, r * 0.06, r * 0.1, -0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawNpc(ctx, cx, cy, r, who) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = who === "landlord" ? "#e4c0a2" : "#f3c8ae";
    ctx.fill();
    if (who === "landlord") {
      ctx.fillStyle = "#9aa0a8";
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.2, r * 0.78, Math.PI * 1.15, Math.PI * 1.85);
      ctx.fill();
      ctx.fillStyle = "#6a5648";
      ctx.fillRect(cx - r * 0.28, cy + r * 0.28, r * 0.56, r * 0.1);
      ctx.strokeStyle = "#1a140c";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(cx - r * 0.28, cy, r * 0.18, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.28, cy, r * 0.18, 0, Math.PI * 2);
      ctx.stroke();
    } else if (who === "hire") {
      ctx.fillStyle = "#e7c56a";
      ctx.fillRect(cx - r * 0.72, cy - r * 0.95, r * 1.44, r * 0.28);
      ctx.fillStyle = "#1c2430";
      ctx.fillRect(cx - r * 0.55, cy - r * 0.22, r * 1.1, r * 0.16);
    } else if (who === "juniper") {
      ctx.fillStyle = "#6a1d3a";
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.95, cy + r * 0.15);
      ctx.quadraticCurveTo(cx - r * 0.1, cy - r * 1.2, cx + r * 0.35, cy - r * 0.15);
      ctx.lineTo(cx + r, cy + r * 0.2);
      ctx.quadraticCurveTo(cx + r * 0.1, cy - r * 0.35, cx - r * 0.95, cy + r * 0.15);
      ctx.fill();
    } else {
      ctx.fillStyle = "#1c2430";
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.02, r * 0.98, Math.PI * 0.95, Math.PI * 2.08);
      ctx.fill();
      ctx.fillStyle = CYAN;
      ctx.fillRect(cx - r * 0.08, cy - r * 0.95, r * 0.14, r * 0.32);
    }
    ctx.fillStyle = who === "juniper" ? "#4a2030" : who === "landlord" ? "#3a342c" : who === "hire" ? "#1e3a5f" : "#245060";
    round(ctx, cx - r * 0.75, cy + r * 0.72, r * 1.5, r * 0.7, 3);
    ctx.fill();
    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.arc(cx - r * 0.26, cy + r * 0.02, r * 0.08, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.26, cy + r * 0.02, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = DARK;
    ctx.lineWidth = Math.max(1.2, r * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    if (who === "juniper") {
      ctx.moveTo(cx - r * 0.18, cy + r * 0.32);
      ctx.quadraticCurveTo(cx, cy + r * 0.5, cx + r * 0.2, cy + r * 0.3);
    } else if (who === "landlord") {
      ctx.moveTo(cx - r * 0.16, cy + r * 0.46);
      ctx.lineTo(cx + r * 0.16, cy + r * 0.4);
    } else ctx.arc(cx, cy + r * 0.22, r * 0.2, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  function drawPerson(ctx, x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y - s * 0.72, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - s * 0.22, y);
    ctx.lineTo(x, y - s * 0.5);
    ctx.lineTo(x + s * 0.22, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawSkillPips(ctx, x, y, skills) {
    var keys = [["work", "W", GOLD], ["mind", "M", CYAN], ["hustle", "H", "#e08a3c"], ["clout", "C", "#e2569a"]];
    var i;
    var p;
    for (i = 0; i < 4; i++) {
      var val = skills[keys[i][0]] || 0;
      var filled = val > 5 ? 5 : val;
      if (filled < 0) filled = 0;
      var cx = x + i * 16;
      ctx.font = font(9, true, 800);
      ctx.fillStyle = keys[i][2];
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(keys[i][1], cx, y);
      for (p = 0; p < 5; p++) {
        ctx.beginPath();
        ctx.arc(cx, y + 8 + p * 5, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = p < filled ? keys[i][2] : "#2a3348";
        ctx.fill();
      }
    }
    ctx.textAlign = "left";
  }

  function signWord(job, closed) {
    if (closed) return "SHUT";
    if (!job) return "OPEN";
    var map = {
      fast_food: "FRIES",
      counter_lead: "OPEN",
      tutor_desk: "TUTOR",
      marketing: "ADS",
      automation: "AUTO",
      scout_lead: "SCOUT",
      server: "OPS",
      pr: "PR",
      engineer: "VOID"
    };
    return map[job.id] || "OPEN";
  }

  function skyFill(phase, dayOne, district) {
    if (dayOne) return "#1a1e2a";
    if (district === "night") return phase === "morning" ? "#3a4258" : "#141722";
    if (district === "campus" && (phase === "morning" || phase === "standard")) return "#d5e6c8";
    if (phase === "morning") return "#f0b56a";
    if (phase === "lunch") return "#9fd4ea";
    if (phase === "evening") return "#e07a4a";
    if (phase === "night") return "#12162a";
    return "#31486e";
  }

  function heldDegree(game) {
    var k;
    if (!game.degrees) return false;
    for (k in game.degrees) if (game.degrees[k]) return true;
    return false;
  }

  function storySpec(game, now, hands) {
    var place = (game.player && game.player.place) || {};
    var world = game.world || {};
    var slot = game.slots && game.slots[0];
    var job = slot && D.jobById ? D.jobById[slot.jobId] : null;
    var chosen = !!(game.flags && game.flags.chosen);
    var phase = S.phaseAt(now);
    return {
      owned: !!place.owned,
      lights: !!place.lights,
      sign: !!place.sign,
      counter: !!place.counter,
      floor: !!(world.floor && chosen),
      rival: chosen ? (world.rival || "") : "",
      rentDue: chosen ? (world.rentDue || 0) : 0,
      regular: chosen ? world.regular : null,
      regularDue: !!(chosen && world.regularDue),
      stock: slot ? slot.stock : 0,
      employee: slot ? slot.employee : null,
      job: job,
      phase: phase.id,
      now: now,
      dayOne: !chosen,
      degree: heldDegree(game),
      heat: (game.player && game.player.heat) || 0,
      shady: !!(game.flags && game.flags.shady),
      hands: !!hands,
      shop: (game.player && game.player.shop) || "",
      bill: chosen ? (world.bill || 0) : 0,
      upstairs: world.floor && chosen ? (world.upstairs || "none") : "",
      upstairsStaff: chosen ? (world.upstairsStaff || "") : "",
      district: world.district || "downtown",
      regulars: chosen && world.regulars ? world.regulars : [],
      hours: chosen ? (world.hours || "") : "",
      onClock: !!(chosen && slot && slot.employee && world.hours !== "closed")
    };
  }

  function roomPaper(menu) {
    if (menu === "job") return "#f4e4cc";
    if (menu === "edu") return "#e4eef6";
    if (menu === "scout") return "#f8e4ee";
    if (menu === "lab") return "#f1e6f7";
    if (menu === "journal") return "#f7f1e4";
    return "#eceae6";
  }

  function roomBand(menu) {
    if (menu === "job") return "#e2b15a";
    if (menu === "edu") return "#7eb6d4";
    if (menu === "scout") return "#e48ab4";
    if (menu === "lab") return "#c49ad4";
    if (menu === "journal") return "#e4d3b0";
    return "#d9d3c8";
  }

  function drawFloorPlan(ctx, x, y, w, place, floor) {
    var bits = [
      ["CORNER", !!(place && place.owned)],
      ["LIGHTS", !!(place && place.lights)],
      ["SIGN", !!(place && place.sign)],
      ["COUNTER", !!(place && place.counter)],
      ["FLOOR", !!floor]
    ];
    var gap = 6;
    var cw = (w - gap * 4) / 5;
    var i;
    ctx.save();
    for (i = 0; i < 5; i++) {
      var bx = x + i * (cw + gap);
      round(ctx, bx, y, cw, 36, 6);
      ctx.fillStyle = bits[i][1] ? (i === 4 ? "#e7c56a" : "#c4a574") : "#f7f1e6";
      ctx.fill();
      ctx.strokeStyle = bits[i][1] ? DARK : "#b7ad9e";
      ctx.lineWidth = bits[i][1] ? 2 : 1;
      if (!bits[i][1]) ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = font(cw < 58 ? 8 : 9, true, 800);
      ctx.fillStyle = bits[i][1] ? DARK : "#8a8278";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bits[i][0], bx + cw * 0.5, y + 18);
    }
    ctx.restore();
  }

  function drawStampBanner(ctx, x, y, w, h, hero) {
    var stamp = (hero && hero.stamp) || "";
    ctx.fillStyle = (hero && hero.rail) || GOLD;
    ctx.fillRect(x, y, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (stamp === "DAY ONE") {
      ctx.fillStyle = "rgba(26,20,12,0.22)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(26,20,12,0.35)";
      ctx.fillRect(x + 10, y + h * 0.72, w * 0.28, 2);
    } else {
      ctx.fillStyle = stamp === "HEAT" || stamp === "RIVAL" ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.14)";
      var step = stamp === "RAISE" ? 18 : 26;
      var i;
      for (i = -2; i < 16; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * step, y);
        ctx.lineTo(x + i * step + 9, y);
        ctx.lineTo(x + i * step + 9 + h, y + h);
        ctx.lineTo(x + i * step + h, y + h);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x, y, w, h * 0.28);
    ctx.restore();
  }

  function drawYearStamp(ctx, x, y, level) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.14);
    round(ctx, -32, -11, 64, 22, 3);
    ctx.fillStyle = "#fffdf8";
    ctx.fill();
    ctx.strokeStyle = CRIMSON;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = font(11, true, 800);
    ctx.fillStyle = CRIMSON;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("YEAR " + level, 0, 1);
    ctx.restore();
  }

  function drawPhotoChip(ctx, x, y, maxW, game) {
    var up = game.world && game.world.floor;
    var text = "YR " + game.player.level + (up ? " · UPSTAIRS" : " · GROUND");
    var f = font(11, true, 700);
    ctx.font = f;
    var tw = measure(ctx, f, text) + 16;
    if (tw > maxW) tw = maxW;
    round(ctx, x, y, tw, 18, 9);
    ctx.fillStyle = "#fffdf8";
    ctx.fill();
    ctx.strokeStyle = DARK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = DARK;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, f, text, tw - 12), x + 8, y + 9);
  }

  function drawVpStamps(ctx, x, y, vp) {
    var n = vp | 0;
    if (n < 0) n = 0;
    var show = n > 4 ? 4 : n;
    var i;
    ctx.save();
    if (!show) {
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "#fffdf8";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = font(10, true, 700);
      ctx.fillStyle = "#fffdf8";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("VP 0", x + 10, y);
    } else {
      for (i = 0; i < show; i++) icon(ctx, "star", x + i * 13, y, 11, "#fffdf8");
      ctx.font = font(10, true, 800);
      ctx.fillStyle = "#fffdf8";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(n > 4 ? String(n) : "", x + show * 13, y);
    }
    ctx.restore();
  }

  function drawPhotoFrame(ctx, x, y, w, h) {
    ctx.save();
    ctx.strokeStyle = "#e4d3b0";
    ctx.lineWidth = 1;
    round(ctx, x + 7, y + 7, w - 14, h - 14, 16);
    ctx.stroke();
    ctx.strokeStyle = DARK;
    ctx.lineWidth = 2;
    var c = 12;
    var inset = 11;
    ctx.beginPath();
    ctx.moveTo(x + inset, y + inset + c);
    ctx.lineTo(x + inset, y + inset);
    ctx.lineTo(x + inset + c, y + inset);
    ctx.moveTo(x + w - inset - c, y + inset);
    ctx.lineTo(x + w - inset, y + inset);
    ctx.lineTo(x + w - inset, y + inset + c);
    ctx.moveTo(x + inset, y + h - inset - c);
    ctx.lineTo(x + inset, y + h - inset);
    ctx.lineTo(x + inset + c, y + h - inset);
    ctx.moveTo(x + w - inset - c, y + h - inset);
    ctx.lineTo(x + w - inset, y + h - inset);
    ctx.lineTo(x + w - inset, y + h - inset - c);
    ctx.stroke();
    ctx.restore();
  }

  function drawPeel(ctx, x, y, w) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + w - 34, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + 26);
    ctx.closePath();
    ctx.fillStyle = "#6a3480";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w - 34, y);
    ctx.quadraticCurveTo(x + w - 10, y + 8, x + w, y + 26);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fillStyle = VIOLET;
    ctx.fill();
    ctx.restore();
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
    cashPulse = now;
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
      var py = p.y - u * 62;
      var popFont = font(30, true, 800);
      ctx.font = popFont;
      var tw = measure(ctx, popFont, p.text);
      ctx.globalAlpha = 1 - u * u;
      round(ctx, p.x - tw * 0.5 - 10, py - 16, tw + 20, 32, 10);
      ctx.fillStyle = p.text.charAt(0) === "-" ? "#3a1820" : "#2a2416";
      ctx.fill();
      ctx.fillStyle = p.text.charAt(0) === "-" ? CRIMSON : GOLD;
      ctx.fillText(p.text, p.x, py);
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

  function offerHours(game, hero) {
    if (!hero || hero.alt || !game.flags || !game.flags.chosen || !game.world) return hero;
    if (game.world.hours === "closed") {
      hero.alt = "hours:open";
      hero.altLabel = "Stay open";
    }
    return hero;
  }

  function decorateOffer(game, hero) {
    if (!hero) return hero;
    if (hero.stamp === "HEAT" || hero.stamp === "DAY ONE" || hero.stamp === "RENT" || hero.stamp === "RIVAL" || hero.stamp === "REGULAR" || hero.stamp === "UPSTAIRS" || hero.action === "stock:0") return hero;
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

  function drawStorefront(ctx, x, y, w, h, spec) {
    if (w < 48 || h < 44) return;
    spec = spec || {};
    var owned = !!spec.owned;
    var lights = !!spec.lights;
    var signed = !!spec.sign;
    var counter = !!spec.counter;
    var floor = !!spec.floor && h >= 96;
    var dayOne = !!spec.dayOne;
    var closed = (spec.stock || 0) <= 0 || spec.hours === "closed";
    var phase = spec.phase || "night";
    var now = spec.now || 0;
    var district = spec.district || "downtown";
    ctx.save();
    clearGlow(ctx);
    round(ctx, x, y, w, h, 12);
    ctx.clip();
    ctx.fillStyle = skyFill(phase, dayOne, district);
    ctx.fillRect(x, y, w, h);
    var skyH = Math.max(14, Math.min(36, h * 0.12));
    var streetH = Math.max(28, Math.min(120, h * 0.26));
    var street = y + h - streetH;
    var streetInk = dayOne ? "#1c2028" : "#2a3144";
    if (!dayOne && district === "campus") streetInk = "#3d4a34";
    if (!dayOne && district === "night") streetInk = "#12151c";
    ctx.fillStyle = streetInk;
    ctx.fillRect(x, street, w, streetH);
    ctx.fillStyle = dayOne ? "#343b48" : (district === "campus" ? "#6a7a48" : "#5a6478");
    ctx.fillRect(x, street, w, 5);
    if (!dayOne && district === "downtown") {
      ctx.fillStyle = "#d8deea";
      var walk;
      for (walk = 0; walk < 4; walk++) ctx.fillRect(x + w * 0.42 + walk * 14, street + 10, 8, 4);
    }
    if (!dayOne && district === "campus") {
      ctx.fillStyle = "#2f6b4f";
      ctx.beginPath();
      ctx.moveTo(x + 18, y + 8);
      ctx.lineTo(x + 18, y + 28);
      ctx.lineTo(x + 40, y + 16);
      ctx.closePath();
      ctx.fill();
    }
    if (!dayOne && district === "night") {
      ctx.fillStyle = "#7a4ea3";
      ctx.fillRect(x + 10, street - 3, w * 0.22, 3);
    }
    var rivalW = spec.rival ? Math.max(64, Math.min(160, w * 0.2)) : 0;
    var shopX = x + 8;
    var shopW = w - 16 - (rivalW ? rivalW + 16 : 0);
    var shopTop = y + skyH;
    var shopBot = street + 2;
    ctx.fillStyle = dayOne ? "#4a4036" : owned ? "#8d5e40" : "#6a5548";
    ctx.fillRect(shopX, shopTop, shopW, shopBot - shopTop);
    ctx.fillStyle = dayOne ? "#2a221c" : "#3a2418";
    ctx.fillRect(shopX - 4, shopTop, shopW + 8, Math.max(5, h * 0.04));
    var groundTop = shopTop + Math.max(5, h * 0.04);
    if (floor) {
      var upH = (shopBot - shopTop) * 0.36;
      groundTop = shopTop + upH;
      var uw = Math.max(16, Math.min(40, shopW * 0.12));
      var upKind = spec.upstairs || "none";
      var upFill = upKind === "tutor" ? "#ffe08a" : (upKind === "office" ? "#b7d4ea" : "#14110e");
      var uh = Math.max(12, upH - 18);
      var ui2;
      for (ui2 = 0; ui2 < 3; ui2++) {
        var ux = shopX + 14 + ui2 * (uw + 12);
        if (ux + uw > shopX + shopW - 36) break;
        ctx.fillStyle = dayOne ? "#1a1612" : upFill;
        ctx.fillRect(ux, shopTop + 10, uw, uh);
        ctx.strokeStyle = "#2a2118";
        ctx.strokeRect(ux, shopTop + 10, uw, uh);
        if (dayOne || upKind === "none") continue;
        if (upKind === "tutor") {
          ctx.fillStyle = "#f3c8ae";
          ctx.beginPath();
          ctx.arc(ux + uw * 0.32, shopTop + 10 + uh * 0.42, Math.max(2, uw * 0.12), 0, Math.PI * 2);
          ctx.arc(ux + uw * 0.68, shopTop + 10 + uh * 0.48, Math.max(2, uw * 0.1), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "#6d88a4";
          ctx.fillRect(ux + 3, shopTop + 10 + uh * 0.62, uw - 6, 3);
          if (spec.upstairsStaff && ui2 === 1) {
            drawNpc(ctx, ux + uw * 0.5, shopTop + 10 + uh * 0.55, Math.max(6, uh * 0.28), "hire");
          }
        }
      }
      if (spec.degree) {
        var fx = shopX + shopW - 30;
        var fy = shopTop + 10;
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 2;
        ctx.strokeRect(fx, fy, 18, 14);
        ctx.beginPath();
        ctx.moveTo(fx, fy + 7);
        ctx.lineTo(fx + 18, fy + 7);
        ctx.stroke();
      }
    }
    var lit = lights && !closed && !dayOne;
    var winY = groundTop + 8;
    var winH = Math.max(18, (shopBot - groundTop) * 0.46);
    var winW = Math.max(18, Math.min(56, (shopW * 0.55) / 3));
    var wi;
    for (wi = 0; wi < 3; wi++) {
      var wx = shopX + 12 + wi * (winW + 8);
      if (wx + winW > shopX + shopW * 0.62) break;
      ctx.fillStyle = lit ? "#ffe08a" : "#14110e";
      ctx.fillRect(wx, winY, winW, winH);
      ctx.strokeStyle = "#241c14";
      ctx.lineWidth = 1;
      ctx.strokeRect(wx, winY, winW, winH);
      if (closed) {
        ctx.fillStyle = "#efe4d2";
        ctx.fillRect(wx + 2, winY + winH * 0.4, winW - 4, 3);
      } else if (lit) {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillRect(wx + 3, winY + 3, Math.max(4, winW * 0.22), Math.max(4, winH * 0.18));
      }
    }
    if (owned && !lights && !dayOne) {
      var bulbX = shopX + 12 + winW * 0.5;
      ctx.strokeStyle = "#efe4d2";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bulbX, groundTop + 2);
      ctx.lineTo(bulbX, winY + 2);
      ctx.stroke();
      icon(ctx, "bulb", bulbX, winY + Math.min(16, winH * 0.45), Math.min(20, winH), "#f5c542");
    }
    var doorW = Math.max(18, Math.min(32, shopW * 0.09));
    var doorX = shopX + shopW - doorW - 8;
    var doorH = shopBot - winY;
    ctx.fillStyle = closed || dayOne || !owned ? "#16130f" : "#6b4030";
    ctx.fillRect(doorX, winY, doorW, doorH);
    ctx.strokeStyle = "#1a140c";
    ctx.strokeRect(doorX, winY, doorW, doorH);
    if (owned && !dayOne) icon(ctx, "key", doorX - 14, winY + 18, 16, GOLD);
    if (owned && !dayOne && (spec.rentDue > 0 || spec.bill > 0)) {
      var notes = [];
      if (spec.rentDue > 0) notes.push("RENT");
      if (spec.bill > 0) notes.push("BILL");
      var ni;
      for (ni = 0; ni < notes.length; ni++) {
        var ny = winY + 6 + ni * 16;
        ctx.fillStyle = "#fffdf8";
        ctx.fillRect(doorX + 2, ny, doorW - 4, 14);
        ctx.strokeStyle = CRIMSON;
        ctx.strokeRect(doorX + 2, ny, doorW - 4, 14);
        ctx.fillStyle = CRIMSON;
        ctx.font = font(8, true, 800);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(notes[ni], doorX + doorW * 0.5, ny + 7);
      }
    }
    if (signed && !dayOne) {
      var word = spec.shop || signWord(spec.job, closed);
      var sf = font(Math.max(13, Math.min(22, h * 0.075)), true, 800);
      ctx.font = sf;
      var boardW = Math.min(shopW * 0.72, Math.max(120, measure(ctx, sf, word) + 28));
      var boardH = Math.max(24, Math.min(36, h * 0.08));
      var sgx = shopX + 14;
      var sgy = Math.max(y + 4, shopTop - boardH * 0.45);
      round(ctx, sgx, sgy, boardW, boardH, 3);
      ctx.fillStyle = closed ? "#241c16" : GOLD;
      ctx.fill();
      ctx.strokeStyle = DARK;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = closed ? "#f4efe4" : DARK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(clipText(ctx, sf, word, boardW - 12), sgx + boardW * 0.5, sgy + boardH * 0.5);
    } else if (closed && owned && !dayOne) {
      ctx.fillStyle = "#efe4d2";
      ctx.fillRect(shopX + 12, shopTop + 8, 46, 16);
      ctx.fillStyle = DARK;
      ctx.font = font(11, true, 800);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("SHUT", shopX + 35, shopTop + 16);
    }
    var cX = shopX + 12;
    var cRight = doorX - 18;
    var cW = cRight - cX;
    var cY = winY + winH - 6;
    if (cW > 24) {
      if (counter && owned && !dayOne) {
        ctx.fillStyle = "#6b442c";
        ctx.fillRect(cX, cY, cW, Math.max(6, winH * 0.16));
        ctx.fillStyle = "#e7c98a";
        ctx.fillRect(cX, cY - 7, cW, 8);
        ctx.fillStyle = GOLD;
        ctx.fillRect(cX, cY - 9, cW, 3);
      } else {
        ctx.strokeStyle = dayOne ? "#8a8074" : "#d5dbe4";
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(cX, cY);
        ctx.lineTo(cX + cW, cY);
        ctx.moveTo(cX + 6, cY);
        ctx.lineTo(cX + 22, cY + 10);
        ctx.moveTo(cX + 22, cY);
        ctx.lineTo(cX + 6, cY + 10);
        ctx.moveTo(cX + cW - 22, cY);
        ctx.lineTo(cX + cW - 6, cY + 10);
        ctx.moveTo(cX + cW - 6, cY);
        ctx.lineTo(cX + cW - 22, cY + 10);
        ctx.stroke();
      }
      var stock = spec.stock || 0;
      var boxN = stock > 5 ? 5 : stock;
      var bw = Math.min(14, (cW - 8) / 6);
      var bi;
      for (bi = 0; bi < boxN; bi++) icon(ctx, "box", cX + 12 + bi * (bw + 4), cY - 14, bw + 8, "#e08a3c");
      if (spec.employee && spec.onClock) {
        var ex = cX + cW - 16;
        var ey = cY - 8;
        drawNpc(ctx, ex, ey, Math.max(11, Math.min(18, winH * 0.28)), "hire");
        if (spec.employee.caught) {
          ctx.fillStyle = CRIMSON;
          ctx.beginPath();
          ctx.arc(ex + 10, ey - 12, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (spec.regular && !dayOne) {
        drawNpc(ctx, cX + 22, cY - 6, Math.max(11, Math.min(18, winH * 0.28)), "sera");
        if (spec.regularDue) {
          var dueOn = ((now / 460) | 0) % 2 === 0;
          ctx.fillStyle = dueOn ? CYAN : "#145058";
          ctx.beginPath();
          ctx.arc(cX + 34, cY - 22, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (spec.hands) icon(ctx, "hand", cX + Math.min(cW * 0.4, 70), cY - 2, 18, "#f0c7a0");
    }
    if (!dayOne && owned && (phase === "morning" || phase === "lunch")) {
      var puff = (now % 1400) / 1400;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.arc(shopX + shopW * 0.55, y + 8 + (1 - puff) * 8, 3 + puff * 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (!dayOne && phase === "night") {
      var blinkOn = ((now / 480) | 0) % 2 === 0;
      ctx.fillStyle = blinkOn ? CRIMSON : "#5a2430";
      ctx.beginPath();
      ctx.arc(shopX + shopW - 10, shopTop + 10, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    var foot = street + 8;
    var body = Math.max(16, Math.min(30, streetH * 0.42));
    if (spec.rentDue > 0 && owned && !dayOne) drawNpc(ctx, doorX + doorW * 0.5, foot - 4, Math.max(9, body * 0.42), "landlord");
    var extras = spec.regulars || [];
    var extraN = 0;
    var ei;
    for (ei = 0; ei < extras.length && extraN < 3; ei++) {
      if (!extras[ei] || (spec.regular && extras[ei].name === spec.regular.name)) continue;
      drawNpc(ctx, shopX + 28 + extraN * 22, foot - 2, Math.max(7, body * 0.28), "sera");
      extraN += 1;
    }
    var openRush = !dayOne && spec.hours !== "closed" && (phase === "morning" || phase === "lunch" || phase === "evening");
    var crowd = dayOne ? 0 : (spec.hours === "closed" ? 0 : (openRush ? 3 : (phase === "night" ? 1 : 1)));
    var ci;
    for (ci = 0; ci < crowd; ci++) drawPerson(ctx, shopX + shopW * 0.42 + ci * 18, foot, body * 0.72, ci % 2 ? "#12161e" : "#1c2636");
    if (spec.rival && rivalW > 24) {
      var rx = x + w - rivalW - 8;
      var ry = shopTop + (shopBot - shopTop) * 0.18;
      var rh = shopBot - ry;
      ctx.globalAlpha = signed ? 1 : 0.48;
      ctx.fillStyle = signed ? "#73485c" : "#3a3038";
      ctx.fillRect(rx, ry, rivalW, rh);
      ctx.fillStyle = signed ? "#4a3040" : "#221c22";
      ctx.beginPath();
      ctx.moveTo(rx - 4, ry + 1);
      ctx.lineTo(rx + rivalW * 0.5, ry - Math.min(14, skyH - 2));
      ctx.lineTo(rx + rivalW + 4, ry + 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = lit && signed ? "#c4a060" : "#120e12";
      ctx.fillRect(rx + 8, ry + 10, Math.max(10, rivalW * 0.28), Math.max(10, rh * 0.32));
      ctx.globalAlpha = 1;
      drawNpc(ctx, rx + rivalW * 0.55, foot - 2, Math.max(9, body * 0.38), "juniper");
      var lineN = signed ? 1 : 3;
      var wk;
      ctx.globalAlpha = signed ? 0.4 : 1;
      for (wk = 0; wk < lineN; wk++) {
        var t = ((now / 1600) + wk * 0.33) % 1;
        drawPerson(ctx, shopX + shopW + 8 + t * Math.max(12, rx - shopX - shopW - 10), foot, body * (signed ? 0.48 : 0.72), "#10141c");
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawStory(ctx, game, ui, L, now) {
    var x = 16;
    var top = L.header + 10;
    var bot = L.tabY - 12;
    var w = L.w - 32;
    if (bot - top < 80 || w < 40) return;
    var newest = game.logN - 1;
    var strips = 0;
    if (newest >= 1 && bot - top > 760) strips = 1;
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
    var deal = easeOut(logAnim.t);
    var scale = 0.94 + 0.06 * deal;
    var cx = x + w * 0.5 + (1 - deal) * Math.min(28, w * 0.05);
    var cy = sy + cardH * 0.5 + (1 - deal) * 16;
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
      var frontId = game.world && game.world.spine && game.world.spine[0];
      var showId = frontId || (game.world && game.world.showing);
      var lived = showId && S.lifeBeat ? S.lifeBeat(game, showId) : null;
      if (lived) hero = lived;
      else hero = offerHours(game, decorateOffer(game, hero));
    }
    var handsOn = hero.action === "shift";
    var spec = storySpec(game, now, handsOn);
    var band = Math.min(46, Math.max(34, sh * 0.09));
    var bh = sh < 240 ? 42 : 48;
    var showAlt = !!(hero.alt && sh > 150);
    var sideBy = !!(showAlt && sw >= 560);
    var btnBlock = sideBy || !showAlt ? bh : bh * 2 + 8;
    var btnTop = scy + sh - 12 - btnBlock;
    if (btnTop < scy + band + 28) btnTop = scy + band + 28;
    ctx.save();
    clearGlow(ctx);
    if (deal < 0.995) {
      ctx.globalAlpha = 0.4 * (1 - deal);
      round(ctx, sx - 18 * (1 - deal), scy + 8, sw, sh, 22);
      ctx.fillStyle = "#cbb892";
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    round(ctx, sx + 4, scy + 5, sw, sh, 22);
    ctx.fillStyle = "#c9b89a";
    ctx.fill();
    round(ctx, sx, scy, sw, sh, 22);
    ctx.fillStyle = spec.dayOne ? "#efe4d2" : CREAM;
    ctx.fill();
    ctx.save();
    round(ctx, sx, scy, sw, sh, 22);
    ctx.clip();
    drawStampBanner(ctx, sx, scy, sw, band, hero);
    ctx.restore();
    drawPhotoFrame(ctx, sx, scy, sw, sh);
    if (spec.shady && spec.heat > 50) drawPeel(ctx, sx, scy, sw);
    var stampInk = hero.rail === GOLD || hero.stamp === "DAY ONE" ? DARK : "#fffdf8";
    badge(ctx, beatIcon(hero), sx + 36, scy + band * 0.5, 42, "#fffdf8", hero.rail);
    var titleFont = font(L.w < 720 ? 18 : 22, false, 800);
    ctx.font = titleFont;
    ctx.fillStyle = stampInk;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, titleFont, beatStamp(hero), sw > 520 ? sw - 250 : sw - 150), sx + 64, scy + band * 0.5);
    if (sw > 280) drawVpStamps(ctx, sx + sw - (sw > 560 ? 200 : 118), scy + band * 0.5, game.player.vp || 0);
    var textX = sx + 16;
    var textW = sw - 32;
    var cursor = scy + band + 8;
    var lineH = L.w < 720 ? 20 : 22;
    var bodyFont = font(L.w < 720 ? 16 : 18, false, 600);
    var lines = wrapLines(ctx, bodyFont, hero.line, textW, sh > 280 ? 2 : 1);
    ctx.font = bodyFont;
    ctx.fillStyle = DARK;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    var li;
    for (li = 0; li < lines.length; li++) {
      ctx.fillText(lines[li], textX, cursor);
      cursor += lineH;
    }
    var storeY = cursor + 6;
    var storeH = scy + sh - 10 - storeY;
    if (storeH >= 72) {
      drawStorefront(ctx, textX, storeY, textW, storeH, spec);
    }
    if (!ui.menu) {
      var clipWas = ui.clip;
      ui.clip = { x: sx, y: scy, w: sw, h: sh };
      if (sideBy) {
        var gap = 8;
        var bw = (textW - gap) / 2;
        fatButton(ctx, ui, hero.action, textX, btnTop, bw, bh, hero.label, false);
        fatButton(ctx, ui, hero.alt, textX + bw + gap, btnTop, bw, bh, hero.altLabel, true);
      } else {
        fatButton(ctx, ui, hero.action, textX, btnTop, textW, bh, hero.label, false);
        if (showAlt) fatButton(ctx, ui, hero.alt, textX, btnTop + bh + 8, textW, bh, hero.altLabel, true);
      }
      ui.clip = clipWas;
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
    var jobId = "";
    var broke = !(game.flags && game.flags.chosen);
    if (!broke && game.slots && game.slots[0] && D.jobById[game.slots[0].jobId]) jobId = game.slots[0].jobId;
    var shadyOn = !!(game.flags && game.flags.shady);
    var heatN = game.player.heat || 0;
    drawFace(ctx, faceX, faceY, r, {
      mood: mood,
      stress: game.player.stress || 0,
      heat: heatN,
      shady: shadyOn,
      job: jobId,
      broke: broke
    });
    if (mood === 1) badge(ctx, "coin", faceX + r * 0.7, faceY + r * 0.65, 16, GOLD, DARK);
    else if (mood === 2) badge(ctx, "flame", faceX + r * 0.7, faceY + r * 0.65, 16, shadyOn && heatN > 40 ? VIOLET : CRIMSON, "#fffdf8");
    if (shadyOn && heatN > 25 && ((now / 380) | 0) % 2 === 0) {
      ctx.fillStyle = VIOLET;
      ctx.beginPath();
      ctx.arc(faceX - r * 0.72, faceY - r * 0.72, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (L.header >= 146) drawSkillPips(ctx, faceX - 22, faceY + r + 18, game.player.skills || {});
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
    var pulse = 0;
    if (cashPulse && now - cashPulse < 680) pulse = Math.sin(((now - cashPulse) / 680) * Math.PI);
    var pillCY = pillY + pillH * 0.5;
    clearGlow(ctx);
    ctx.save();
    if (pulse) {
      var pcx = pillX + pillW * 0.5;
      ctx.translate(pcx, pillCY);
      ctx.scale(1 + pulse * 0.16, 1 + pulse * 0.16);
      ctx.translate(-pcx, -pillCY);
      ctx.globalAlpha = 0.85;
      round(ctx, pillX - 5, pillY - 5, pillW + 10, pillH + 10, 22);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    round(ctx, pillX, pillY, pillW, pillH, 20);
    ctx.fillStyle = "#2a2416";
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.stroke();
    icon(ctx, "coin", pillX + 20, pillCY, 22, GOLD);
    ctx.font = cashFont;
    ctx.fillStyle = GOLD;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(cash, pillX + 36, pillCY);
    ctx.restore();
    noteCash(game, now, pillX + pillW * 0.55, pillCY);
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
    var hot = !!(game.flags && game.flags.shady && (game.player.heat || 0) > 40);
    var accent = hot ? VIOLET : GOLD;
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
      round(ctx, x + 3, ty + 4, tw, th, 18);
      ctx.fillStyle = "#07090f";
      ctx.fill();
      round(ctx, x, ty, tw, th, 18);
      ctx.fillStyle = on ? (hot ? "#d7a4e4" : GOLD) : hover ? "#243044" : "#171b28";
      ctx.fill();
      ctx.strokeStyle = (hover || on || hot) ? accent : "#2c3548";
      ctx.globalAlpha = 1;
      ctx.lineWidth = on ? 0 : 1.5;
      if (!on) ctx.stroke();
      var ink = on ? DARK : (hot && i === 3 ? VIOLET : colors[i]);
      icon(ctx, kinds[i], cx, cy - 14, 26, ink);
      ctx.fillStyle = on ? DARK : accent;
      ctx.fillRect(cx - 16, cy + 2, 32, 3);
      ctx.font = font(L.w < 860 ? 13 : 15, false, 700);
      ctx.fillStyle = on ? DARK : INK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labels[i], cx, cy + 18);
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
      logAnim.t += dt / 320;
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
      var bounce = [0, 1, -2, 2];
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
    var phaseId = S.phaseAt(now).id;
    var bg = ensurePlate(w, h, !!game.settings.performanceMode, dpr, phaseId);
    ctx.drawImage(bg, 0, 0, w, h);
    var heatN = (game.player && game.player.heat) || 0;
    if (game.flags && game.flags.shady && heatN > 28) {
      var ha = (heatN - 28) / 80;
      if (ha > 0.32) ha = 0.32;
      ctx.fillStyle = "rgba(110, 36, 150, " + ha.toFixed(3) + ")";
      ctx.fillRect(0, 0, w, h);
    }
    buttonTone = "";
    sheetLock = false;
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
