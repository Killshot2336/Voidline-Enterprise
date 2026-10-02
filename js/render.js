(function (root) {
  "use strict";

  var D = root.VoidData;
  var S = root.VoidSim;
  var SANS = "system-ui, Segoe UI, sans-serif";
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  var SERIF = "Georgia, Palatino, serif";
  var plate = null;
  var plateKey = "";
  var textCache = {};
  var cacheN = 0;

  var GOLD = "#f5c542";
  var VIOLET = "#b44ac0";
  var CYAN = "#3ec8d8";
  var CRIMSON = "#e23d3d";
  var INK = "#1c1612";
  var PAPER = "#efe6d4";
  var CREAM = "#efe6d4";
  var DARK = "#1c1612";
  var BRICK = "#8c4a32";
  var BRICK2 = "#6a3424";
  var LAMP = "#f0c36a";
  var NIGHT = "#1a2744";
  var QUIET = "#5c3d6e";
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
  var artImg = {};
  var ART_SRC = {
    shopMorning: "art/shop-morning.jpg",
    shopNoon: "art/shop-noon.jpg",
    shopEvening: "art/shop-evening.jpg",
    shopNight: "art/shop-night.jpg",
    shopClosed: "art/shop-closed.jpg",
    sera: "art/portrait-sera.jpg",
    landlord: "art/portrait-landlord.jpg",
    juniper: "art/portrait-juniper.jpg",
    hire: "art/portrait-hire.jpg",
    campus: "art/neighbor-campus.jpg",
    downtown: "art/neighbor-downtown.jpg",
    night: "art/neighbor-night.jpg",
    ledger: "art/obj-ledger.jpg",
    notebook: "art/obj-notebook.jpg",
    photostrip: "art/obj-photostrip.jpg",
    crate: "art/obj-crate.jpg",
    stock: "art/obj-stock.jpg",
    cooler: "art/obj-cooler.jpg",
    safe: "art/obj-safe.jpg",
    bulb: "art/obj-bulb.jpg",
    plant: "art/obj-plant.jpg",
    speaker: "art/obj-speaker.jpg",
    brass: "art/obj-brass.jpg"
  };

  function loadArt() {
    if (typeof Image === "undefined") return;
    var key;
    for (key in ART_SRC) {
      (function (name) {
        var img = new Image();
        img.onload = function () { artImg[name] = img; };
        img.onerror = function () { artImg[name] = null; };
        img.src = ART_SRC[name];
      })(key);
    }
  }

  function painted(key) {
    var img = artImg[key];
    if (!img || !img.complete || !img.naturalWidth) return null;
    return img;
  }

  function blit(ctx, key, x, y, w, h) {
    var img = painted(key);
    if (!img || w < 2 || h < 2) return false;
    ctx.drawImage(img, x, y, w, h);
    return true;
  }

  function blitContain(ctx, key, x, y, w, h) {
    var img = painted(key);
    if (!img || w < 2 || h < 2) return false;
    var ir = img.naturalWidth / img.naturalHeight;
    var r = w / Math.max(1, h);
    var dw = w;
    var dh = h;
    var dx = x;
    var dy = y;
    if (ir > r) {
      dh = w / ir;
      dy = y + (h - dh) * 0.5;
    } else {
      dw = h * ir;
      dx = x + (w - dw) * 0.5;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
    return true;
  }

  function blitCover(ctx, key, x, y, w, h) {
    var img = painted(key);
    if (!img || w < 2 || h < 2) return false;
    var ir = img.naturalWidth / img.naturalHeight;
    var r = w / Math.max(1, h);
    var sx = 0;
    var sy = 0;
    var sw = img.naturalWidth;
    var sh = img.naturalHeight;
    if (ir > r) {
      sw = sh * r;
      sx = (img.naturalWidth - sw) * 0.5;
    } else {
      sh = sw / r;
      sy = (img.naturalHeight - sh) * 0.28;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    return true;
  }

  loadArt();
  var pool = [];
  var pi;
  for (pi = 0; pi < 64; pi++) {
    pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, rot: 0, kind: 0, color: LAMP });
  }

  function font(px, mono, weight, serif) {
    var face = serif ? SERIF : (mono ? MONO : SANS);
    return (weight || 600) + " " + px + "px " + face;
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
      return { sky: "#e8b07a", sky2: "#f3d2b0", glow: "rgba(240,195,106,0.35)", wash: "rgba(239,230,212,0.22)", star: 0, moon: 0, sun: 1, rain: 0, haze: 0 };
    }
    if (phase === "lunch") {
      return { sky: "#f0e2cc", sky2: "#d9c4a4", glow: "rgba(239,230,212,0.4)", wash: "rgba(255,248,236,0.18)", star: 0, moon: 0, sun: 1, rain: 0, haze: 1 };
    }
    if (phase === "evening") {
      return { sky: "#c46a42", sky2: "#3a2a32", glow: "rgba(240,195,106,0.22)", wash: "rgba(140,74,50,0.16)", star: 0.22, moon: 1, sun: 0, rain: 0, haze: 0 };
    }
    if (phase === "standard") {
      return { sky: "#8d7560", sky2: "#3a322c", glow: "rgba(239,230,212,0.12)", wash: "rgba(239,230,212,0.08)", star: 0.05, moon: 0, sun: 0, rain: 0, haze: 0 };
    }
    return { sky: NIGHT, sky2: INK, glow: "rgba(240,195,106,0.1)", wash: "rgba(26,39,68,0)", star: 0.62, moon: 1, sun: 0, rain: 1, haze: 0 };
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
      var glow = g.createRadialGradient(w * 0.72, h * 0.16, 12, w * 0.72, h * 0.16, Math.max(w, h) * 0.42);
      glow.addColorStop(0, pal.glow);
      glow.addColorStop(1, "rgba(28,22,18,0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
      var wash = g.createRadialGradient(w * 0.12, h * 0.08, 8, w * 0.2, h * 0.12, Math.max(w, h) * 0.42);
      wash.addColorStop(0, pal.wash);
      wash.addColorStop(1, "rgba(28,22,18,0)");
      g.fillStyle = wash;
      g.fillRect(0, 0, w, h);
    }
    if (pal.star > 0) {
      var si;
      g.fillStyle = PAPER;
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
      g.fillStyle = LAMP;
      g.beginPath();
      g.arc(w * 0.78, h * 0.12, Math.min(w, h) * 0.045, 0, Math.PI * 2);
      g.fill();
    }
    if (pal.moon) {
      var moon = Math.min(w, h) * 0.05;
      g.fillStyle = PAPER;
      g.beginPath();
      g.arc(w * 0.78, h * 0.1, moon, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = pal.sky;
      g.beginPath();
      g.arc(w * 0.78 + moon * 0.45, h * 0.09, moon * 0.82, 0, Math.PI * 2);
      g.fill();
    }
    if (pal.haze) {
      g.fillStyle = "rgba(239,230,212,0.28)";
      g.fillRect(0, h * 0.18, w, 5);
      g.fillRect(0, h * 0.28, w, 3);
      g.fillRect(0, h * 0.4, w, 2);
    }
    if (pal.rain) {
      g.strokeStyle = "rgba(239,230,212,0.28)";
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
    plate = c;
    plateKey = key;
    return plate;
  }

  function layout(w, h) {
    var narrow = w < 560;
    var tabH = narrow ? 118 : (h < 720 ? 136 : 156);
    var storyBot = h - tabH;
    return {
      w: w,
      h: h,
      header: 0,
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
    var hover = ui.hover === id && !disabled;
    var tone = buttonTone;
    var ink = INK;
    var faint = disabled || tone === "locked";
    ctx.save();
    ctx.shadowBlur = 0;
    if (tone === "violet" && !faint) {
      ctx.fillStyle = "rgba(120, 70, 150, 0.16)";
      ctx.fillRect(x, y + 2, 4, Math.max(8, h - 4));
    }
    if (on && !faint) {
      ctx.fillStyle = "rgba(240,195,106,0.38)";
      ctx.fillRect(x, y, w, h);
    } else if (hover) {
      ctx.fillStyle = "rgba(28,22,18,0.05)";
      ctx.fillRect(x, y, w, h);
    }
    var f = font(h < 28 ? 15 : 17, false, 700, true);
    ctx.font = f;
    ctx.fillStyle = faint ? "#a3988c" : ink;
    ctx.globalAlpha = faint ? 0.8 : 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, f, label, w - 12), x + w * 0.5, y + h * 0.46);
    ctx.strokeStyle = faint ? "#a3988c" : ink;
    ctx.lineWidth = on ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + h - 3);
    ctx.lineTo(x + w - 8, y + h - 3);
    ctx.stroke();
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
    var shadyName = text === "SHADY" || text === "STREET";
    var locked = shadyName && sheetLock;
    var r = row(flow, 34);
    if (!r.on) return;
    var ctx = flow.ctx;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(239,230,212,0.94)";
    ctx.fillRect(flow.x - 6, r.y, flow.w + 12, 30);
    var f = font(18, false, 700, true);
    ctx.font = f;
    ctx.fillStyle = locked ? "#a3988c" : INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(locked && shadyName ? "Tied cards" : text, flow.x, r.y + 14);
    ctx.strokeStyle = "rgba(28,22,18,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(flow.x, r.y + 28);
    ctx.lineTo(flow.x + Math.min(flow.w, 220), r.y + 28);
    ctx.stroke();
    ctx.restore();
  }

  function para(flow, text) {
    var f = font(15, false, 500, true);
    var lines = wrapLines(flow.ctx, f, text, flow.w, 3);
    var i;
    for (i = 0; i < lines.length; i++) {
      var r = row(flow, 22);
      if (!r.on) continue;
      var ctx = flow.ctx;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(239,230,212,0.92)";
      ctx.fillRect(flow.x - 6, r.y, flow.w + 12, 20);
      ctx.font = f;
      ctx.fillStyle = INK;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(lines[i], flow.x, r.y + 10);
      ctx.restore();
    }
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
    var plan = row(flow, 96);
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
        ctx.fillStyle = "rgba(239,230,212,0.96)";
        ctx.fillRect(flow.x, r.y, flow.w, 100);
        ctx.strokeStyle = ui.focusSlot === i ? INK : "rgba(28,22,18,0.25)";
        ctx.lineWidth = ui.focusSlot === i ? 1.6 : 1;
        ctx.beginPath();
        ctx.moveTo(flow.x, r.y + 98);
        ctx.lineTo(flow.x + flow.w, r.y + 98);
        ctx.stroke();
        if (slot.employee && slot.employee.caught) {
          ctx.fillStyle = BRICK;
          ctx.font = font(15, false, 700, true);
          ctx.fillText("caught", flow.x + flow.w - 70, r.y + 16);
        }
        var f = font(17, false, 700, true);
        ctx.font = f;
        ctx.fillStyle = INK;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(clipText(ctx, f, "Shop " + (i + 1) + " · " + (job ? job.name : "Kiosk"), flow.w - 20), flow.x + 8, r.y + 18);
        ctx.font = font(15, false, 500, true);
        ctx.fillStyle = INK;
        var emp = slot.employee ? slot.employee.name + " · " + S.money(slot.employee.salary) : "Nobody's working";
        if (slot.employee && slot.employee.caught) emp += "  · caught";
        ctx.fillText(clipText(ctx, font(15, false, 500, true), emp + "  ·  stock " + slot.stock + "/" + S.stockCap(game), flow.w - 16), flow.x + 8, r.y + 40);
        if (slot.employee) {
          ctx.fillStyle = slot.employee.caught ? BRICK : INK;
          ctx.fillText(clipText(ctx, font(15, false, 500, true), traitLine(game, slot.employee.traits, slot.employee.caught), flow.w - 16), flow.x + 8, r.y + 58);
        } else {
          ctx.fillText(slot.camera ? "Camera's on. Waiting for a hire." : "No camera. Theft stays a mystery.", flow.x + 8, r.y + 58);
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
      flow.ctx.font = font(15, false, open ? 600 : 500, true);
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      var need = "Year " + spec.level;
      if (spec.skill) need += " · " + spec.skill + " " + spec.skillNeed;
      else if (spec.node) need += " · " + D.nodeById[spec.node].name;
      flow.ctx.fillStyle = open ? INK : "#a3988c";
      flow.ctx.fillText(clipText(flow.ctx, font(15, false, open ? 600 : 500, true), spec.name + "  ·  " + need, flow.w - 120), flow.x, jr.y + 16);
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
      ctx2.fillStyle = "rgba(239,230,212,0.96)";
      ctx2.fillRect(flow.x, cr.y, flow.w, height);
      ctx2.strokeStyle = card.dying ? BRICK : INK;
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.moveTo(flow.x, cr.y + height - 2);
      ctx2.lineTo(flow.x + flow.w, cr.y + height - 2);
      ctx2.stroke();
      clearGlow(ctx2);
      ctx2.font = font(17, false, 700, true);
      ctx2.fillStyle = INK;
      ctx2.textAlign = "left";
      ctx2.textBaseline = "middle";
      ctx2.fillText(card.name, flow.x + 8, cr.y + 18);
      ctx2.font = font(15, false, 500, true);
      var askLine = "Asks " + S.money(card.ask) + "   ·   strikes " + card.strikes + "/3";
      if (game.flags.insight || game.player.intelligence >= 75) {
        var low = Math.round(card.floor * 0.9);
        var high = Math.min(card.ask, Math.round(card.floor * 1.12));
        askLine += "   ·   range " + S.money(low) + "-" + S.money(high);
      }
      ctx2.fillStyle = INK;
      ctx2.fillText(clipText(ctx2, font(15, false, 500, true), askLine, flow.w - 16), flow.x + 8, cr.y + 40);
      ctx2.fillStyle = "#5c5348";
      ctx2.fillText(clipText(ctx2, font(15, false, 500, true), traitLine(game, card.traits, false), flow.w - 16), flow.x + 8, cr.y + 60);
      if (!card.dying) pushHit(ui, "resume:" + card.id, flow.x, cr.y, flow.w, 74);
      if (selected && !card.dying) drawKeypad(ctx2, ui, flow.x + 12, cr.y + 78, Math.min(280, flow.w - 24));
      ctx2.restore();
    }
  }

  function drawKeypad(ctx, ui, x, y, w) {
    var plateH = 24 + 4 * 38 + 40;
    blitCover(ctx, "brass", x - 6, y - 4, w + 12, plateH);
    ctx.font = font(17, false, 700, true);
    ctx.fillStyle = INK;
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
        flow.ctx.fillStyle = "#e4d8c4";
        flow.ctx.fill();
        round(flow.ctx, flow.x, bar.y, Math.max(4, flow.w * pct), 8, 4);
        flow.ctx.fillStyle = BRICK;
        flow.ctx.fill();
      }
    } else para(flow, "You're not in class. One class at a time.");
    var i;
    for (i = 0; i < D.DEGREES.length; i++) {
      var deg = D.DEGREES[i];
      var done = !!game.degrees[deg.id];
      var dr = row(flow, 36);
      if (!dr.on) continue;
      flow.ctx.font = font(15, false, 600, true);
      flow.ctx.fillStyle = done ? BRICK : INK;
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(clipText(flow.ctx, font(15, false, 600, true), deg.name + " · " + deg.text, flow.w - 120), flow.x, dr.y + 16);
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
      flow.ctx.font = font(15, false, 600, true);
      flow.ctx.fillStyle = locked ? "#a3988c" : INK;
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(clipText(flow.ctx, font(15, false, 600, true), item.name + " · " + item.cat + " · held " + owned, flow.w - 100), flow.x, ir.y + 14);
      button(flow.ctx, ui, "buy:" + item.id, flow.x + flow.w - 88, ir.y + 1, 88, 26, locked ? "Locked" : S.money(S.marketCost(game, item)), false, locked);
    }
  }

  function drawCrateGoods(flow, game) {
    var place = game.player.place || {};
    var slot = game.slots && game.slots[0];
    var goods = [
      ["stock", "Stock " + (slot ? slot.stock : 0)],
      ["bulb", place.lights ? "Lights" : "Bare"],
      ["cooler", place.cooler ? "Cooler" : "No cooler"],
      ["safe", place.safe ? "Safe" : "No safe"],
      ["speaker", place.speaker ? "Speaker" : "Quiet"],
      ["plant", place.plant ? "Plant" : "No plant"]
    ];
    var r = row(flow, 108);
    if (!r.on) return;
    var ctx = flow.ctx;
    var gap = 8;
    var n = goods.length;
    var bw = (flow.w - gap * (n - 1)) / n;
    var i;
    ctx.save();
    ctx.shadowBlur = 0;
    for (i = 0; i < n; i++) {
      var bx = flow.x + i * (bw + gap);
      var on = goods[i][0] === "stock" || (goods[i][0] === "bulb" ? place.lights : place[goods[i][0]]);
      ctx.globalAlpha = on ? 1 : 0.35;
      if (!blit(ctx, goods[i][0], bx, r.y, bw, 72)) {
        ctx.fillStyle = PAPER;
        ctx.fillRect(bx, r.y, bw, 72);
      }
      ctx.globalAlpha = 1;
      ctx.font = font(15, false, 600, true);
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(clipText(ctx, font(15, false, 600, true), goods[i][1], bw), bx + bw * 0.5, r.y + 88);
    }
    ctx.restore();
    ctx.textAlign = "left";
  }

  function drawLab(flow, game, ui) {
    sheetLock = !(game.flags && game.flags.shady);
    drawCrateGoods(flow, game);
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
      var faceDown = shadyNode && sheetLock;
      buttonTone = shadyNode && !faceDown ? "violet" : (faceDown ? "locked" : "");
      flow.ctx.save();
      flow.ctx.shadowBlur = 0;
      flow.ctx.fillStyle = faceDown ? "#d7ccb8" : PAPER;
      flow.ctx.fillRect(flow.x - 4, nr.y, flow.w + 8, 40);
      if (faceDown) {
        flow.ctx.strokeStyle = INK;
        flow.ctx.lineWidth = 1;
        flow.ctx.beginPath();
        flow.ctx.moveTo(flow.x + 8, nr.y + 20);
        flow.ctx.lineTo(flow.x + flow.w - 96, nr.y + 20);
        flow.ctx.stroke();
      } else if (shadyNode) {
        flow.ctx.fillStyle = "#7a4a86";
        flow.ctx.fillRect(flow.x - 4, nr.y, 4, 40);
      }
      flow.ctx.font = font(15, false, 700, true);
      flow.ctx.fillStyle = faceDown ? "#a3988c" : (owned ? BRICK : INK);
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(faceDown ? "Face down" : node.name, flow.x, nr.y + 12);
      if (!faceDown) {
        flow.ctx.font = font(15, false, 500, true);
        flow.ctx.fillStyle = "#5c5348";
        flow.ctx.fillText(clipText(flow.ctx, font(15, false, 500, true), node.text, flow.w - 100), flow.x, nr.y + 30);
      }
      flow.ctx.restore();
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

  function personWant(game, who) {
    var w = game.world || {};
    var wants = w.wants || {};
    if (who === "sera") {
      if (!w.regular) return "Not at the counter yet.";
      return (w.regular.name || "Sera") + " wants " + (wants.sera || "lights") + ".";
    }
    if (who === "landlord") {
      if (w.rentDue) return "Wants the rent, " + S.money(w.rentDue) + ".";
      return "Wants the building kept.";
    }
    if (who === "juniper") {
      if (!w.rival) return "No shop across the street.";
      return (w.rival || "Juniper") + " wants " + (wants.juniper || "lunch") + ".";
    }
    var emp = game.slots && game.slots[0] && game.slots[0].employee;
    if (!emp) return "Nobody is on the clock.";
    return emp.name + " wants the shift.";
  }

  function drawPeopleRow(flow, game) {
    var who = ["sera", "landlord", "juniper", "hire"];
    var r = row(flow, 168);
    if (!r.on) return;
    var ctx = flow.ctx;
    var gap = 8;
    var bw = (flow.w - gap * 3) / 4;
    var i;
    ctx.save();
    ctx.shadowBlur = 0;
    for (i = 0; i < 4; i++) {
      var bx = flow.x + i * (bw + gap);
      ctx.fillStyle = PAPER;
      ctx.fillRect(bx, r.y, bw, 112);
      blitCover(ctx, who[i], bx, r.y, bw, 112);
      ctx.font = font(15, false, 500, true);
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      var line = personWant(game, who[i]);
      var bits = wrapLines(ctx, font(15, false, 500, true), line, bw - 4, 2);
      ctx.fillText(bits[0] || "", bx + bw * 0.5, r.y + 118);
      if (bits[1]) ctx.fillText(bits[1], bx + bw * 0.5, r.y + 136);
    }
    ctx.restore();
    ctx.textAlign = "left";
  }

  function drawScouts(flow, game) {
    drawPeopleRow(flow, game);
    section(flow, "SEND SOMEONE");
    if (!game.nodes.charter) para(flow, "Scout Charter is still locked. It's on the clout line in Stuff.");
    else para(flow, "They leave on the real clock. Late night is faster. Two people out at once.");
    var i;
    for (i = 0; i < D.SCOUTS.length; i++) {
      var scout = D.SCOUTS[i];
      var sr = row(flow, 36);
      if (!sr.on) continue;
      flow.ctx.font = font(15, false, 600, true);
      flow.ctx.fillStyle = INK;
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(clipText(flow.ctx, font(15, false, 600, true), scout.name + " · " + scout.text, flow.w - 110), flow.x, sr.y + 16);
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
      flow.ctx.font = font(16, false, 700, true);
      flow.ctx.fillStyle = INK;
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(clipText(flow.ctx, font(16, false, 700, true), name, flow.w - 110), flow.x, jr.y + 14);
      flow.ctx.font = font(15, false, 500, true);
      flow.ctx.fillStyle = "#5c5348";
      flow.ctx.fillText(clipText(flow.ctx, font(15, false, 500, true), bits.join(" + "), flow.w - 110), flow.x, jr.y + 32);
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

  function sheetArt(menu) {
    if (menu === "job") return "ledger";
    if (menu === "edu") return "notebook";
    if (menu === "scout") return "photostrip";
    if (menu === "lab") return "crate";
    if (menu === "journal") return "notebook";
    return "";
  }

  function drawMenu(ctx, game, ui, L) {
    var ease = ui.menuT;
    var top = L.header;
    var bot = L.tabY;
    var span = bot - top;
    var y = top + (1 - ease) * span * 0.18;
    var h = bot - y;
    var inset = L.w < 520 ? 8 : 18;
    clearGlow(ctx);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(26,39,68,0.28)";
    ctx.fillRect(0, top, L.w, span);
    ctx.fillStyle = PAPER;
    ctx.fillRect(inset, y, L.w - inset * 2, h);
    var artH = Math.min(140, h * 0.24);
    var artKey = sheetArt(ui.menu);
    if (ui.menu === "settings") {
      ctx.fillStyle = BRICK;
      ctx.beginPath();
      ctx.arc(inset + 28, y + 22, 5, 0, Math.PI * 2);
      ctx.fill();
      artH = 36;
    } else if (artKey) {
      blitContain(ctx, artKey, inset + 8, y + 4, L.w - inset * 2 - 16, artH - 8);
    }
    if (ease < 0.8) {
      ctx.restore();
      return;
    }
    paperOn = true;
    roomAccent = INK;
    var rect = { x: inset, y: y + artH, w: L.w - inset * 2, h: Math.max(40, h - artH) };
    ui.clip = rect;
    if (ui.scroll < 0) ui.scroll = 0;
    var flow = openFlow(ctx, ui, rect, ui.scroll);
    var titles = { job: "Work", edu: "School", lab: "Stuff", scout: "People", journal: "The book", settings: "Settings" };
    section(flow, titles[ui.menu] || "Menu");
    var close = row(flow, 34);
    if (close.on) button(ctx, ui, "close", flow.x + flow.w - 110, close.y, 110, 28, "Close", false, false);
    if (ui.menu === "job") drawOccupation(flow, game, ui);
    else if (ui.menu === "edu") drawEducation(flow, game, ui);
    else if (ui.menu === "lab") drawLab(flow, game, ui);
    else if (ui.menu === "scout") drawScouts(flow, game);
    else if (ui.menu === "journal") drawJournal(flow, game, ui);
    else if (ui.menu === "settings") drawSettings(flow, game, ui);
    ctx.restore();
    paperOn = false;
    roomAccent = INK;
    buttonTone = "";
    sheetLock = false;
    ui.clip = null;
    ui.contentH = flow.cy + 20;
    var max = ui.contentH - rect.h;
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
      if (game.world && game.world.lastSlip && game.world.lastSlip.text) beat.line = game.world.lastSlip.text;
      else beat.line = paid ? "Rush over. " + paid[0] + " hits the drawer." : "Rush over. The drawer is heavier.";
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
    if (painted("hire")) {
      ctx.save();
      ctx.shadowBlur = 0;
      blitCover(ctx, "hire", cx - r * 1.15, cy - r * 1.45, r * 2.3, r * 2.8);
      ctx.restore();
      return;
    }
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
      ctx.fillStyle = INK;
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
      ctx.strokeStyle = INK;
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
      ctx.fillStyle = "#d7e4ee";
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
    var key = who === "landlord" || who === "juniper" || who === "hire" ? who : "sera";
    if (painted(key)) {
      ctx.save();
      ctx.shadowBlur = 0;
      blitCover(ctx, key, cx - r * 1.2, cy - r * 1.45, r * 2.4, r * 2.9);
      ctx.restore();
      return;
    }
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
    if (blitCover(ctx, "sera", x - s * 0.4, y - s, s * 0.8, s)) return;
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
    var keys = [["work", "W", INK], ["mind", "M", BRICK], ["hustle", "H", BRICK2], ["clout", "C", INK]];
    var i;
    var p;
    for (i = 0; i < 4; i++) {
      var val = skills[keys[i][0]] || 0;
      var filled = val > 5 ? 5 : val;
      if (filled < 0) filled = 0;
      var cx = x + i * 16;
      ctx.font = font(15, false, 700, true);
      ctx.fillStyle = keys[i][2];
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(keys[i][1], cx, y);
      for (p = 0; p < 5; p++) {
        ctx.beginPath();
        ctx.arc(cx, y + 8 + p * 5, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = p < filled ? keys[i][2] : "#d9cbb8";
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
      cash: game.player ? game.player.capital : 0,
      level: game.player ? game.player.level : 1,
      shop: (game.player && game.player.shop) || "",
      bill: chosen ? (world.bill || 0) : 0,
      upstairs: world.floor && chosen ? (world.upstairs || "none") : "",
      upstairsStaff: chosen ? (world.upstairsStaff || "") : "",
      district: world.district || "downtown",
      regulars: chosen && world.regulars ? world.regulars : [],
      hours: chosen ? (world.hours || "") : "",
      onClock: !!(chosen && slot && slot.employee && world.hours !== "closed"),
      spot: world.spot || "register",
      block: world.block || null,
      truce: !!world.truce,
      rivalMemory: world.rivalMemory || "",
      booksText: world.lastSlip && world.lastSlip.text ? world.lastSlip.text : "",
      thinLine: world.thin && world.thin.line ? world.thin.line : "",
      award: world.wallAward || null,
      places: {
        sera: S.personPlace ? S.personPlace(game, "sera") : "gone",
        landlord: S.personPlace ? S.personPlace(game, "landlord") : "gone",
        juniper: S.personPlace ? S.personPlace(game, "juniper") : "gone",
        hire: S.personPlace ? S.personPlace(game, "hire") : "gone"
      },
      winning: S.juniperWinning ? !!S.juniperWinning(game) : false
    };
  }

  function slipWords(hero, spec) {
    if (spec && spec.rewind >= 0 && spec.thinLine) return spec.thinLine;
    var line = (hero && hero.line) || "";
    if (spec && spec.booksText && line.indexOf("Came in") < 0) {
      return line ? (line + " " + spec.booksText) : spec.booksText;
    }
    return line;
  }

  function bookHealthy(book) {
    if (!book || book.hours === "closed") return false;
    return (book.busy || 0) >= 2 && (book.money || 0) >= 12;
  }

  function paintWindowGlow(ctx, x, y, w, h, alpha) {
    if (!(alpha > 0) || w < 4 || h < 4) return;
    ctx.fillStyle = "rgba(240,195,106," + Math.min(0.9, alpha).toFixed(3) + ")";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }

  function paintCrowd(ctx, x, foot, n, h) {
    var i;
    var count = n;
    if (count < 0) count = 0;
    if (count > 5) count = 5;
    for (i = 0; i < count; i++) drawFigure(ctx, x + i * Math.max(12, h * 0.035), foot, Math.max(22, h * 0.08), "walker");
  }

  function paintOtherShops(ctx, x, y, w, h, spec) {
    if (spec.dayOne) return;
    var block = spec.block || {};
    var j = block.juniper || {};
    var campus = block.campus || {};
    var night = block.night || {};
    var jBright = 0.15;
    if (j.hours !== "closed") jBright = 0.28 + Math.min(0.55, (j.busy || 0) * 0.08);
    if (spec.winning) jBright = Math.min(0.92, jBright + 0.28);
    if (spec.truce) jBright = Math.max(0.08, jBright - 0.35);
    var jx = x + w * 0.66;
    var jy = y + h * 0.28;
    var jw = Math.max(48, w * 0.16);
    var jh = Math.max(36, h * 0.18);
    if (spec.rival) {
      if (!blitContain(ctx, j.hours === "closed" ? "shopClosed" : "shopNoon", jx, jy, jw, jh)) {
        ctx.fillStyle = "#6a4034";
        ctx.fillRect(jx, jy, jw, jh);
      }
      var dim = spec.winning ? 0.05 : (spec.truce ? 0.55 : 0.28);
      if (j.hours === "closed") dim = 0.62;
      ctx.fillStyle = "rgba(20,16,14," + dim.toFixed(3) + ")";
      ctx.fillRect(jx, jy, jw, jh);
      paintWindowGlow(ctx, jx + jw * 0.12, jy + jh * 0.2, jw * 0.28, jh * 0.28, jBright);
      paintWindowGlow(ctx, jx + jw * 0.52, jy + jh * 0.2, jw * 0.28, jh * 0.28, jBright * 0.9);
      var crowd = spec.truce ? Math.min(1, j.busy || 0) : Math.min(5, j.busy || 0);
      if (spec.winning) crowd = Math.max(crowd, Math.min(5, (j.busy || 1)));
      paintCrowd(ctx, jx, jy + jh + 2, crowd, h);
    }
    var cx = x + w * 0.78;
    var cy = y + h * 0.22;
    var campusOn = spec.district === "campus" && bookHealthy(campus);
    var nightOn = spec.district === "night" && bookHealthy(night);
    if (spec.district === "campus" || spec.district === "night") {
      var glow = spec.district === "campus" ? (campusOn ? 0.72 : 0.16) : (nightOn ? 0.7 : 0.14);
      paintWindowGlow(ctx, cx, cy, Math.max(28, w * 0.1), Math.max(18, h * 0.08), glow);
      if (campusOn || nightOn) paintCrowd(ctx, cx, cy + h * 0.16, 3, h);
    }
  }

  function paintAwardPlaque(ctx, x, y, award) {
    if (!award) return;
    var w = 108;
    var h = 48;
    ctx.fillStyle = PAPER;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = BRICK;
    ctx.fillRect(x, y, w, 6);
    ctx.fillStyle = INK;
    ctx.font = font(13, false, 700, true);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(award.award || "", x + 8, y + 18);
    ctx.font = font(11, false, 500, true);
    ctx.fillText(clipText(ctx, font(11, false, 500, true), award.who || "", w - 12), x + 8, y + 30);
    ctx.fillText(clipText(ctx, font(11, false, 500, true), award.built || "", w - 12), x + 8, y + 40);
  }

  function paintPresence(ctx, x, y) {
    ctx.fillStyle = LAMP;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  }

  function paintEmptyStool(ctx, x, y) {
    drawChairUp(ctx, x, y, 16);
  }

  function paintLiving(ctx, rect, spec, who, ui, now) {
    var x = rect.x;
    var y = rect.y;
    var w = rect.w;
    var h = rect.h;
    if (spec.dayOne) return;
    ctx.save();
    ctx.shadowBlur = 0;
    if (spec.lights && spec.hours !== "closed") {
      ctx.fillStyle = "rgba(240,195,106,0.14)";
      ctx.fillRect(x + w * 0.14, y + h * 0.4, w * 0.36, h * 0.22);
    } else if (spec.owned) {
      ctx.fillStyle = "rgba(20,16,14,0.12)";
      ctx.fillRect(x + w * 0.14, y + h * 0.4, w * 0.36, h * 0.22);
    }
    if (spec.district === "campus") {
      ctx.fillStyle = "rgba(190,214,170,0.16)";
      ctx.fillRect(x, y, w, h * 0.34);
    } else if (spec.district === "night") {
      ctx.fillStyle = "rgba(16,20,40,0.16)";
      ctx.fillRect(x, y, w, h);
    }
    if (spec.upstairs === "tutor" || spec.upstairs === "office") {
      ctx.fillStyle = spec.upstairs === "office" ? "rgba(240,195,106,0.34)" : "rgba(62,200,216,0.22)";
      ctx.fillRect(x + w * 0.16, y + h * 0.16, w * 0.26, h * 0.1);
    }
    var hot = !!(spec.shady && (spec.heat || 0) >= 45);
    if (hot) {
      ctx.fillStyle = "rgba(122,74,134,0.9)";
      ctx.beginPath();
      ctx.arc(x + w * 0.36, y + h * 0.56, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    paintOtherShops(ctx, x, y, w, h, spec);
    if (spec.award) paintAwardPlaque(ctx, x + w * 0.5, y + h * 0.12, spec.award);
    var places = spec.places || {};
    var counterX = x + w * (who ? 0.56 : 0.4);
    var counterFoot = y + h * 0.8;
    var doorX = x + w * 0.5;
    var doorFoot = y + h * 0.86;
    var acrossX = x + w * 0.74;
    var acrossFoot = y + h * 0.62;
    var upX = x + w * 0.24;
    var upFoot = y + h * 0.3;
    if (spec.rewind === 2) {
      ctx.fillStyle = PAPER;
      ctx.fillRect(x + w * 0.52, y + h * 0.46, 72, 22);
      ctx.strokeStyle = INK;
      ctx.strokeRect(x + w * 0.52, y + h * 0.46, 72, 22);
      ctx.fillStyle = BRICK;
      ctx.font = font(12, false, 700, true);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("SHORT", x + w * 0.52 + 36, y + h * 0.46 + 11);
      ctx.textAlign = "left";
    }
    if (spec.rewind === 1) {
      var slide = ((now || 0) / 280) % 1;
      var i;
      for (i = 0; i < 3; i++) {
        var px = x + w * (0.62 + slide * 0.18) + i * 18;
        drawFigure(ctx, px, y + h * 0.58, h * 0.12, "walker");
      }
    }
    if (places.sera === "counter" && who !== "sera") drawFigure(ctx, counterX, counterFoot, h * 0.16, "sera");
    if (places.sera === "gone") paintEmptyStool(ctx, counterX - 8, counterFoot - 4);
    if (places.landlord === "door" && who !== "landlord") drawFigure(ctx, doorX, doorFoot, h * 0.18, "landlord");
    if (places.juniper === "across" && who !== "juniper") drawFigure(ctx, acrossX, acrossFoot, h * 0.14, "juniper");
    if (places.hire === "counter" && who !== "hire") drawFigure(ctx, counterX + 28, counterFoot, h * 0.15, "hire");
    if (places.hire === "upstairs") drawFigure(ctx, upX, upFoot, h * 0.1, "hire");
    var markX = x + w * 0.55;
    var markY = y + h * 0.68;
    if (spec.spot === "door") { markX = x + w * 0.68; markY = y + h * 0.64; }
    if (spec.spot === "upstairs") { markX = x + w * 0.52; markY = y + h * 0.22; }
    paintPresence(ctx, markX, markY);
    if (ui && !ui.menu) {
      if (spec.thinLine) {
        var rx = x + w - 78;
        var ry = y + 8;
        ctx.fillStyle = ui.rewind ? LAMP : PAPER;
        ctx.fillRect(rx, ry, 64, 22);
        ctx.strokeStyle = INK;
        ctx.strokeRect(rx, ry, 64, 22);
        ctx.fillStyle = INK;
        ctx.font = font(12, false, 700, true);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ui.rewind ? "Now" : "Replay", rx + 32, ry + 11);
        pushHit(ui, "rewind", rx, ry, 64, 22);
        ctx.textAlign = "left";
      }
    }
    ctx.restore();
  }

  function counterReady(game) {
    if (!game || !game.player || (game.player.shifts || 0) < 1) return false;
    var w = game.world || {};
    var met = !!(w.regular || w.rival);
    var slot = game.slots && game.slots[0];
    if (slot && slot.employee) met = true;
    var cash = game.player.capital || 0;
    var offer = cash >= (D.ROOM && D.ROOM.rent ? D.ROOM.rent : 40);
    var owned = !!(game.player.place && game.player.place.owned);
    return met || offer || owned;
  }

  function roomPaper(menu) {
    return PAPER;
  }

  function roomBand(menu) {
    return BRICK;
  }

  function drawFloorPlan(ctx, x, y, w, place, floor) {
    var bits = [
      ["Corner", !!(place && place.owned)],
      ["Lights", !!(place && place.lights)],
      ["Sign", !!(place && place.sign)],
      ["Counter", !!(place && place.counter)],
      ["Upstairs", !!floor]
    ];
    ctx.save();
    ctx.shadowBlur = 0;
    var thumb = Math.min(150, w * 0.28);
    if (!blitContain(ctx, (place && place.lights) ? "shopEvening" : "shopNoon", x, y, thumb, 78)) {
      ctx.fillStyle = BRICK;
      ctx.fillRect(x, y, thumb, 78);
    }
    ctx.font = font(15, false, 600, true);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    var i;
    for (i = 0; i < bits.length; i++) {
      ctx.fillStyle = bits[i][1] ? INK : "#a3988c";
      ctx.fillText(bits[i][0], x + thumb + 16, y + 10 + i * 15);
    }
    ctx.restore();
  }

  function drawStampBanner(ctx, x, y, w, h, hero) {
    var stamp = (hero && hero.stamp) || "";
    ctx.fillStyle = PAPER;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = INK;
    ctx.font = font(Math.max(15, Math.min(22, h * 0.45)), false, 700, true);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (stamp) ctx.fillText(stamp, x + w * 0.5, y + h * 0.5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.textAlign = "left";
  }

  function drawYearStamp(ctx, x, y, level) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.14);
    round(ctx, -32, -11, 64, 22, 3);
    ctx.fillStyle = "#fffdf8";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = BRICK;
    ctx.fillRect(-32, -11, 64, 6);
    ctx.font = font(15, false, 700, true);
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(level), 0, 3);
    ctx.restore();
  }

  function drawPhotoChip(ctx, x, y, maxW, game) {
    var up = game.world && game.world.floor;
    var text = "YR " + game.player.level + (up ? " · UPSTAIRS" : " · GROUND");
    var f = font(15, false, 700, true);
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
      ctx.font = font(15, false, 700, true);
      ctx.fillStyle = INK;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("0", x + 10, y);
    } else {
      for (i = 0; i < show; i++) icon(ctx, "star", x + i * 13, y, 11, "#fffdf8");
      ctx.font = font(15, false, 700, true);
      ctx.fillStyle = INK;
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
    ctx.fillStyle = "#cbbba6";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w - 34, y);
    ctx.quadraticCurveTo(x + w - 10, y + 8, x + w, y + 26);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fillStyle = PAPER;
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
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = p.text.charAt(0) === "-" ? BRICK : INK;
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

  function trackedWidth(ctx, fontStr, text, tracking) {
    ctx.font = fontStr;
    var chars = String(text || "").split("");
    var total = 0;
    var i;
    for (i = 0; i < chars.length; i++) {
      total += ctx.measureText(chars[i]).width;
      if (i) total += tracking;
    }
    return total;
  }

  function fillTracked(ctx, fontStr, text, cx, cy, tracking, color) {
    ctx.font = fontStr;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    var chars = String(text || "").split("");
    var widths = [];
    var total = 0;
    var i;
    for (i = 0; i < chars.length; i++) {
      widths.push(ctx.measureText(chars[i]).width);
      total += widths[i];
      if (i) total += tracking;
    }
    var x = cx - total * 0.5;
    for (i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], x, cy);
      x += widths[i] + tracking;
    }
  }

  function quad(ctx, x0, y0, x1, y1, x2, y2, x3, y3) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
  }

  function fillBricks(ctx, x, y, w, h, lite, dark) {
    if (w < 2 || h < 2) return;
    var ch = Math.max(7, Math.min(12, h / 16));
    var cw = ch * 2.2;
    var r = 0;
    var yy;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for (yy = y - ch; yy < y + h + ch; yy += ch) {
      var off = (r % 2) ? cw * 0.5 : 0;
      var xx;
      for (xx = x - cw; xx < x + w + cw; xx += cw) {
        ctx.fillStyle = ((r + ((xx / cw) | 0)) % 2) ? dark : lite;
        ctx.fillRect(xx + off, yy, cw - 1.4, ch - 1.4);
      }
      r += 1;
    }
    ctx.restore();
  }

  function fillBricksPoly(ctx, pts, lite, dark) {
    var minX = pts[0];
    var minY = pts[1];
    var maxX = pts[0];
    var maxY = pts[1];
    var i;
    for (i = 0; i < pts.length; i += 2) {
      if (pts[i] < minX) minX = pts[i];
      if (pts[i] > maxX) maxX = pts[i];
      if (pts[i + 1] < minY) minY = pts[i + 1];
      if (pts[i + 1] > maxY) maxY = pts[i + 1];
    }
    ctx.save();
    quad(ctx, pts[0], pts[1], pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
    ctx.clip();
    fillBricks(ctx, minX, minY, maxX - minX, maxY - minY, lite, dark);
    ctx.restore();
  }

  function drawPane(ctx, x, y, w, h, lit, interior) {
    if (w < 8 || h < 8) return;
    ctx.fillStyle = lit ? "#f6e2bc" : "#16130f";
    ctx.fillRect(x, y, w, h);
    if (lit) {
      ctx.fillStyle = "#e8c48a";
      ctx.fillRect(x, y + h * 0.58, w, h * 0.42);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, y + 1, Math.max(1, w - 2), Math.max(1, h - 2));
    ctx.clip();
    if (interior) interior(x, y, w, h);
    ctx.restore();
    ctx.strokeStyle = lit ? "#3a2418" : "#2a211c";
    ctx.lineWidth = Math.max(1.4, Math.min(3, w * 0.06));
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y);
    ctx.lineTo(x + w * 0.5, y + h);
    ctx.moveTo(x, y + h * 0.46);
    ctx.lineTo(x + w, y + h * 0.46);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, Math.min(4, w * 0.07));
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = lit ? "rgba(239,230,212,0.45)" : "rgba(239,230,212,0.12)";
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 2);
    ctx.lineTo(x + w * 0.48, y + 2);
    ctx.lineTo(x + 2, y + h * 0.52);
    ctx.closePath();
    ctx.fill();
  }

  function drawChairUp(ctx, x, y, s) {
    var leg = Math.max(3, s * 0.16);
    ctx.fillStyle = INK;
    ctx.fillRect(x, y, s, Math.max(4, s * 0.2));
    ctx.fillRect(x + s * 0.12, y - s * 0.85, leg, s * 0.85);
    ctx.fillRect(x + s - s * 0.12 - leg, y - s * 0.85, leg, s * 0.85);
    ctx.fillRect(x + s * 0.12, y - s * 0.85, s * 0.76, Math.max(3, s * 0.14));
  }

  function drawBulb(ctx, x, y, r) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.7);
    ctx.lineTo(x, y - r * 0.2);
    ctx.stroke();
    ctx.fillStyle = LAMP;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6df";
    ctx.beginPath();
    ctx.arc(x - r * 0.22, y - r * 0.22, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawFigure(ctx, x, foot, h, who) {
    if (h < 18) return;
    var key = who === "sera" || who === "landlord" || who === "juniper" || who === "hire" ? who : "hire";
    if (painted(key)) {
      ctx.save();
      ctx.shadowBlur = 0;
      blitCover(ctx, key, x - h * 0.22, foot - h, h * 0.44, h);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.shadowBlur = 0;
    var skin = "#e4c2a4";
    var headR = h * 0.115;
    var headCY = foot - h * 0.86;
    ctx.fillStyle = "rgba(28,22,18,0.22)";
    ctx.save();
    ctx.translate(x, foot - 1);
    ctx.scale(1, 0.22);
    ctx.beginPath();
    ctx.arc(0, 0, h * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = INK;
    var legW = Math.max(2, h * 0.065);
    ctx.fillRect(x - h * 0.09, foot - h * 0.4, legW, h * 0.4);
    ctx.fillRect(x + h * 0.025, foot - h * 0.4, legW, h * 0.4);
    ctx.fillRect(x - h * 0.11, foot - h * 0.055, h * 0.12, h * 0.05);
    ctx.fillRect(x + h * 0.01, foot - h * 0.055, h * 0.12, h * 0.05);
    if (who === "sera") {
      ctx.fillStyle = BRICK;
      ctx.beginPath();
      ctx.moveTo(x - h * 0.16, foot - h * 0.62);
      ctx.lineTo(x + h * 0.16, foot - h * 0.62);
      ctx.lineTo(x + h * 0.2, foot - h * 0.08);
      ctx.lineTo(x - h * 0.2, foot - h * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.moveTo(x - h * 0.12, foot - h * 0.58);
      ctx.lineTo(x + h * 0.12, foot - h * 0.58);
      ctx.lineTo(x + h * 0.14, foot - h * 0.16);
      ctx.lineTo(x - h * 0.14, foot - h * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1, h * 0.012);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - h * 0.08, headCY + headR * 0.9);
      ctx.lineTo(x - h * 0.05, foot - h * 0.58);
      ctx.moveTo(x + h * 0.08, headCY + headR * 0.9);
      ctx.lineTo(x + h * 0.05, foot - h * 0.58);
      ctx.stroke();
    } else if (who === "landlord") {
      ctx.fillStyle = "#2a241e";
      ctx.beginPath();
      ctx.moveTo(x - h * 0.19, foot - h * 0.64);
      ctx.lineTo(x + h * 0.19, foot - h * 0.64);
      ctx.lineTo(x + h * 0.23, foot - h * 0.06);
      ctx.lineTo(x - h * 0.23, foot - h * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = Math.max(1.4, h * 0.016);
      ctx.beginPath();
      ctx.moveTo(x, foot - h * 0.6);
      ctx.lineTo(x - h * 0.02, foot - h * 0.14);
      ctx.stroke();
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.moveTo(x - h * 0.09, foot - h * 0.66);
      ctx.lineTo(x, foot - h * 0.54);
      ctx.lineTo(x + h * 0.09, foot - h * 0.66);
      ctx.closePath();
      ctx.fill();
    } else if (who === "juniper") {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(x - h * 0.2, foot - h * 0.64);
      ctx.lineTo(x + h * 0.2, foot - h * 0.6);
      ctx.lineTo(x + h * 0.16, foot - h * 0.28);
      ctx.lineTo(x - h * 0.16, foot - h * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = BRICK;
      ctx.beginPath();
      ctx.moveTo(x - h * 0.02, foot - h * 0.62);
      ctx.lineTo(x + h * 0.1, foot - h * 0.58);
      ctx.lineTo(x + h * 0.02, foot - h * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = BRICK2;
      ctx.lineWidth = Math.max(1.2, h * 0.014);
      ctx.beginPath();
      ctx.moveTo(x - h * 0.16, foot - h * 0.46);
      ctx.lineTo(x + h * 0.14, foot - h * 0.44);
      ctx.stroke();
    } else if (who === "hire") {
      ctx.fillStyle = "#3a3028";
      ctx.fillRect(x - h * 0.15, foot - h * 0.64, h * 0.3, h * 0.32);
      ctx.fillStyle = LAMP;
      ctx.beginPath();
      ctx.arc(x + h * 0.07, foot - h * 0.5, Math.max(3, h * 0.045), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.fillRect(x + h * 0.045, foot - h * 0.505, h * 0.05, Math.max(1.5, h * 0.012));
    } else {
      ctx.fillStyle = "#2c261f";
      ctx.fillRect(x - h * 0.13, foot - h * 0.62, h * 0.26, h * 0.28);
    }
    ctx.strokeStyle = skin;
    ctx.lineWidth = Math.max(2.5, h * 0.042);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - h * 0.12, foot - h * 0.58);
    ctx.lineTo(x - h * 0.22, foot - h * 0.38);
    ctx.moveTo(x + h * 0.12, foot - h * 0.58);
    ctx.lineTo(x + h * 0.22, foot - h * 0.4);
    ctx.stroke();
    ctx.fillStyle = skin;
    ctx.fillRect(x - h * 0.035, headCY + headR * 0.72, h * 0.07, h * 0.05);
    ctx.beginPath();
    ctx.arc(x, headCY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    if (who === "juniper") {
      ctx.beginPath();
      ctx.moveTo(x - headR * 1.05, headCY + headR * 0.1);
      ctx.quadraticCurveTo(x - headR * 0.2, headCY - headR * 1.55, x + headR * 1.05, headCY - headR * 0.05);
      ctx.lineTo(x + headR * 0.7, headCY + headR * 0.35);
      ctx.quadraticCurveTo(x, headCY - headR * 0.2, x - headR * 1.05, headCY + headR * 0.1);
      ctx.fill();
    } else if (who === "landlord") {
      ctx.beginPath();
      ctx.arc(x, headCY - headR * 0.2, headR * 0.95, Math.PI * 1.08, Math.PI * 1.92);
      ctx.fill();
    } else if (who === "hire") {
      ctx.beginPath();
      ctx.arc(x, headCY - headR * 0.2, headR * 0.9, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x - headR * 1.2, headCY - headR * 0.22, headR * 2.5, headR * 0.2);
    } else {
      ctx.beginPath();
      ctx.arc(x, headCY - headR * 0.08, headR * 1.02, Math.PI * 0.95, Math.PI * 2.08);
      ctx.fill();
      if (who === "sera") {
        ctx.beginPath();
        ctx.arc(x + headR * 0.05, headCY - headR * 1.05, headR * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    var eyeY = headCY + headR * 0.08;
    var eyeR = Math.max(1.5, headR * 0.1);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x - headR * 0.34, eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(x + headR * 0.34, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.2, headR * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.52, eyeY - headR * 0.22);
    ctx.lineTo(x - headR * 0.16, eyeY - headR * 0.3);
    ctx.moveTo(x + headR * 0.16, eyeY - headR * 0.3);
    ctx.lineTo(x + headR * 0.52, eyeY - headR * 0.22);
    ctx.stroke();
    if (who === "landlord") {
      ctx.lineWidth = Math.max(1.1, headR * 0.07);
      ctx.beginPath();
      ctx.arc(x - headR * 0.34, eyeY, headR * 0.24, 0, Math.PI * 2);
      ctx.arc(x + headR * 0.34, eyeY, headR * 0.24, 0, Math.PI * 2);
      ctx.moveTo(x - headR * 0.1, eyeY);
      ctx.lineTo(x + headR * 0.1, eyeY);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(1.3, headR * 0.08);
    ctx.beginPath();
    if (who === "juniper") {
      ctx.moveTo(x - headR * 0.22, headCY + headR * 0.46);
      ctx.quadraticCurveTo(x, headCY + headR * 0.28, x + headR * 0.26, headCY + headR * 0.48);
    } else if (who === "landlord") {
      ctx.moveTo(x - headR * 0.18, headCY + headR * 0.46);
      ctx.lineTo(x + headR * 0.2, headCY + headR * 0.46);
    } else {
      ctx.arc(x, headCY + headR * 0.28, headR * 0.3, 0.12 * Math.PI, 0.88 * Math.PI);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawNeighbor(ctx, x, base, bw, bh, kind, neon) {
    var top = base - bh;
    var r;
    var c;
    if (kind === "campus") {
      ctx.fillStyle = "#e4d3bc";
      ctx.fillRect(x, top + bh * 0.22, bw, bh * 0.78);
      ctx.fillStyle = BRICK;
      ctx.beginPath();
      ctx.moveTo(x - 6, top + bh * 0.24);
      ctx.lineTo(x + bw * 0.5, top);
      ctx.lineTo(x + bw + 6, top + bh * 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PAPER;
      for (c = 0; c < 3; c++) ctx.fillRect(x + bw * 0.16 + c * bw * 0.24, top + bh * 0.42, Math.max(3, bw * 0.06), bh * 0.48);
      ctx.fillStyle = INK;
      ctx.fillRect(x + bw * 0.38, base - bh * 0.28, bw * 0.18, bh * 0.28);
      ctx.fillStyle = INK;
      ctx.fillRect(x + bw + 8, base - bh * 0.42, 5, bh * 0.42);
      ctx.beginPath();
      ctx.arc(x + bw + 10, base - bh * 0.55, bw * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "night") {
      ctx.fillStyle = "#241c18";
      ctx.fillRect(x, top, bw, bh);
      ctx.fillStyle = "#3a3028";
      for (r = 0; r < 4; r++) {
        for (c = 0; c < 3; c++) {
          ctx.fillRect(x + bw * 0.12 + c * bw * 0.28, top + bh * 0.12 + r * bh * 0.18, bw * 0.14, bh * 0.08);
        }
      }
      if (neon) {
        ctx.fillStyle = CYAN;
        ctx.fillRect(x + bw * 0.62, top + bh * 0.16, Math.max(3, bw * 0.045), bh * 0.5);
        ctx.fillStyle = VIOLET;
        ctx.fillRect(x + bw * 0.74, top + bh * 0.28, Math.max(3, bw * 0.045), bh * 0.36);
        ctx.fillStyle = CYAN;
        ctx.fillRect(x + bw * 0.12, top + bh * 0.14, bw * 0.4, Math.max(3, bh * 0.025));
      }
    } else {
      ctx.fillStyle = "#3a302a";
      ctx.fillRect(x, top, bw, bh);
      ctx.fillStyle = BRICK2;
      ctx.fillRect(x, top, bw, Math.max(4, bh * 0.04));
      for (r = 0; r < 6; r++) {
        for (c = 0; c < 3; c++) {
          ctx.globalAlpha = (r + c) % 3 === 0 ? 0.9 : 0.35;
          ctx.fillStyle = (r + c) % 3 === 0 ? LAMP : PAPER;
          ctx.fillRect(x + bw * 0.12 + c * bw * 0.28, top + bh * 0.1 + r * bh * 0.13, bw * 0.14, bh * 0.07);
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, top, bw, bh);
  }

  function cardWho(id, hero) {
    var key = String(id || "").toLowerCase();
    var stamp = String((hero && hero.stamp) || "").toUpperCase();
    if (key.indexOf("sera") >= 0 || key === "regular" || key === "favor_card" || key === "crew" || stamp === "SERA" || stamp === "REGULAR" || stamp === "FAVOR" || stamp === "REGULARS") return "sera";
    if (key === "landlord" || stamp === "RENT") return "landlord";
    if (key.indexOf("rival") >= 0 || stamp === "RIVAL") return "juniper";
    if (key.indexOf("hire") >= 0 || stamp === "HIRE") return "hire";
    return "";
  }

  function choicePlan(who, hero) {
    var a = hero && hero.action ? { id: hero.action, label: hero.label || "" } : null;
    var b = hero && hero.alt ? { id: hero.alt, label: hero.altLabel || "" } : null;
    var plan = { slip: null, door: null, person: null };
    if (who && a && b) {
      plan.person = a;
      plan.slip = b;
    } else if (who && a) {
      plan.person = a;
    } else if (a && b) {
      plan.slip = a;
      plan.door = b;
    } else if (a) {
      plan.slip = a;
    }
    return plan;
  }

  function drawTag(ctx, x, y, w, h, label, hot) {
    if (w < 8 || h < 8) return;
    ctx.fillStyle = hot ? LAMP : PAPER;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = INK;
    ctx.lineWidth = hot ? 2.5 : 1.5;
    ctx.strokeRect(x, y, w, h);
    var f = font(w < 100 ? 12 : 14, false, 700, true);
    var lines = wrapLines(ctx, f, label, w - 12, h > 48 ? 3 : 2);
    ctx.font = f;
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var lh = w < 100 ? 14 : 16;
    var block = (lines.length - 1) * lh;
    var i;
    for (i = 0; i < lines.length; i++) ctx.fillText(lines[i], x + w * 0.5, y + h * 0.5 - block * 0.5 + i * lh);
    ctx.textAlign = "left";
  }

  function paintUpstairs(ctx, x, y, w, h, kind, crowded) {
    if (kind === "tutor") {
      ctx.fillStyle = BRICK2;
      ctx.fillRect(x + 3, y + h * 0.7, w - 6, Math.max(3, h * 0.08));
      if (crowded) {
        drawFigure(ctx, x + w * 0.34, y + h - 1, h * 0.42, "walker");
        drawFigure(ctx, x + w * 0.68, y + h - 1, h * 0.36, "walker");
      }
    } else if (kind === "office") {
      ctx.fillStyle = BRICK2;
      ctx.fillRect(x + 3, y + h * 0.58, w - 6, Math.max(4, h * 0.1));
      ctx.fillStyle = PAPER;
      ctx.fillRect(x + w * 0.15, y + h * 0.48, w * 0.28, h * 0.1);
      drawBulb(ctx, x + w * 0.72, y + h * 0.38, Math.max(3, Math.min(7, w * 0.12)));
    }
  }

  function paintGround(ctx, x, y, w, h, spec, mode, seat) {
    var counterY = y + h * 0.62;
    var boxes;
    var bi;
    var bw;
    if (mode === "lit") {
      if (seat === "sera") drawFigure(ctx, x + w * 0.36, y + h - 1, Math.min(h * 0.5, 92), "sera");
      if (seat === "hire") drawFigure(ctx, x + w * 0.64, y + h - 1, Math.min(h * 0.48, 86), "hire");
      ctx.fillStyle = BRICK2;
      ctx.fillRect(x + 2, counterY, w - 4, Math.max(5, h * 0.12));
      ctx.fillStyle = PAPER;
      ctx.fillRect(x + 2, counterY - 3, w - 4, 4);
      boxes = spec.stock > 4 ? 4 : (spec.stock || 0);
      bw = Math.min(11, (w - 10) / 5);
      for (bi = 0; bi < boxes; bi++) {
        ctx.fillStyle = bi % 2 ? BRICK2 : BRICK;
        ctx.fillRect(x + 4 + bi * (bw + 2), counterY - bw - 3, bw, bw);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 4 + bi * (bw + 2), counterY - bw - 3, bw, bw);
      }
    } else if (mode === "closed") {
      ctx.fillStyle = "#241c16";
      ctx.fillRect(x, y + h * 0.72, w, h * 0.28);
      drawChairUp(ctx, x + w * 0.16, y + h * 0.7, Math.min(18, w * 0.28));
      if (w > 36) drawChairUp(ctx, x + w * 0.55, y + h * 0.74, Math.min(14, w * 0.22));
      if (w > 30 && h > 36) {
        var cardW = Math.min(44, w - 8);
        var cardH = 16;
        var cardX = x + (w - cardW) * 0.5;
        var cardY = y + h * 0.22;
        ctx.fillStyle = PAPER;
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.strokeRect(cardX, cardY, cardW, cardH);
        ctx.fillStyle = INK;
        ctx.font = font(Math.max(8, Math.min(11, w * 0.2)), false, 700, true);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("SHUT", cardX + cardW * 0.5, cardY + cardH * 0.5 + 1);
        ctx.textAlign = "left";
      }
    } else {
      ctx.fillStyle = "#241c16";
      ctx.fillRect(x, y + h * 0.78, w, h * 0.22);
    }
  }

  function shortChoice(label) {
    var raw = String(label || "").replace(/\s+/g, " ").trim();
    if (!raw) return "";
    var words = raw.split(" ");
    if (words.length <= 2) return raw;
    var skip = { a: 1, an: 1, the: 1, to: 1, of: 1, it: 1 };
    var keep = [];
    var i;
    for (i = 0; i < words.length && keep.length < 2; i++) {
      if (skip[words[i].toLowerCase()]) continue;
      keep.push(words[i]);
    }
    if (keep.length < 2) return words.slice(0, 2).join(" ");
    return keep.join(" ");
  }

  function phaseShopKey(spec) {
    if (spec.phase === "morning") return "shopMorning";
    if (spec.phase === "lunch" || spec.phase === "standard") return "shopNoon";
    if (spec.phase === "evening") return "shopEvening";
    return "shopNight";
  }

  function shopArtKey(spec) {
    if (!spec.dayOne && spec.hours === "closed") {
      if (spec.phase === "night") return "shopNight";
      return "shopClosed";
    }
    return phaseShopKey(spec);
  }

  var SIGN_BOX = {
    shopMorning: { x: 0.14, y: 0.375, w: 0.40, h: 0.08 },
    shopNoon: { x: 0.12, y: 0.40, w: 0.38, h: 0.075 },
    shopEvening: { x: 0.20, y: 0.40, w: 0.32, h: 0.065 },
    shopNight: { x: 0.18, y: 0.335, w: 0.30, h: 0.07 },
    shopClosed: { x: 0.23, y: 0.355, w: 0.36, h: 0.06 }
  };

  function paintShopName(ctx, name, x, y, w, h) {
    if (!name || w < 20) return;
    var px = Math.min(40, Math.max(18, h * 0.78));
    var track = Math.max(1, px * 0.16);
    var face = font(px, false, 700, true);
    while (px > 14 && trackedWidth(ctx, face, name, track) > w - 6) {
      px -= 1;
      track = Math.max(0.6, px * 0.12);
      face = font(px, false, 700, true);
    }
    fillTracked(ctx, face, name, x + w * 0.5, y + h * 0.55, track, INK);
  }

  function paintWords(ctx, x, y, w, h, label, hot) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = hot ? "rgba(240,195,106,0.85)" : PAPER;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = INK;
    var f = font(w < 90 ? 15 : 17, false, 700, true);
    var lines = wrapLines(ctx, f, label, w - 10, 2);
    ctx.font = f;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var i;
    for (i = 0; i < lines.length; i++) ctx.fillText(lines[i], x + w * 0.5, y + h * 0.5 + (i - (lines.length - 1) * 0.5) * 16);
    ctx.restore();
  }

  function drawStreetPainted(ctx, rect, spec, who, plan, hero, ui, now) {
    var x = rect.x;
    var y = rect.y;
    var w = rect.w;
    var h = rect.h;
    var key = shopArtKey(spec);
    var dayOne = !!spec.dayOne;
    var closed = spec.hours === "closed";
    var narrow = w < 560;
    var geo = { slip: null, door: null, person: null };
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (!blitCover(ctx, key, x, y, w, h)) {
      ctx.fillStyle = spec.phase === "night" ? NIGHT : "#cbbba6";
      ctx.fillRect(x, y, w, h);
    }
    if (closed && !dayOne && spec.phase === "night") {
      ctx.fillStyle = "rgba(26,39,68,0.42)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(239,230,212,0.35)";
      ctx.lineWidth = 1;
      var ri;
      var rainShift = ((now || 0) / 28) % (h + 20);
      for (ri = 0; ri < 18; ri++) {
        var rx = x + ((ri * 97) % 1000) / 1000 * w;
        var ry = y + ((ri * 53 + rainShift) % (h * 0.9));
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 3, ry + 11);
        ctx.stroke();
      }
    }
    if (!dayOne && spec.district && spec.district !== "downtown") {
      var nk = spec.district === "campus" ? "campus" : "night";
      blitContain(ctx, nk, x + w * 0.78, y + h * 0.3, w * 0.16, h * 0.2);
    }
    if (spec.rival && !dayOne && who !== "juniper") {
      blitContain(ctx, spec.phase === "night" ? "shopNight" : "shopNoon", x + w * 0.64, y + h * 0.26, w * 0.12, h * 0.16);
    }
    if (dayOne) {
      ctx.fillStyle = "rgba(28,22,18,0.5)";
      ctx.fillRect(x, y, w, h);
    }
    var signBox = SIGN_BOX[key] || SIGN_BOX.shopNoon;
    if (spec.cash != null) {
      var cash = spec.rewind === 2 ? "SHORT" : S.money(spec.cash);
      var cf = font(16, false, 700, true);
      ctx.font = cf;
      var tw = measure(ctx, cf, cash);
      var rx = x + w * 0.33;
      var ry = y + h * 0.68;
      ctx.fillStyle = "rgba(239,230,212,0.92)";
      ctx.fillRect(rx, ry, tw + 12, 22);
      ctx.fillStyle = INK;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(cash, rx + 6, ry + 11);
    }
    if (!dayOne && spec.level != null) {
      var cx = x + w * 0.05;
      var cy = y + h * 0.08;
      ctx.fillStyle = PAPER;
      ctx.fillRect(cx, cy, 48, 40);
      ctx.fillStyle = BRICK;
      ctx.fillRect(cx, cy, 48, 8);
      ctx.fillStyle = INK;
      ctx.font = font(16, false, 700, true);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(spec.level), cx + 24, cy + 26);
    }
    if (!dayOne) {
      var hot = !!(spec.shady && (spec.heat || 0) > 40);
      var bx = x + w * 0.34;
      var by = y + h * 0.58;
      if (hot) {
        ctx.fillStyle = "rgba(122,74,134,0.9)";
        ctx.beginPath();
        ctx.arc(bx + 12, by + 14, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!blit(ctx, "bulb", bx, by, 26, 30) && hot) {
        ctx.fillStyle = "#7a4a86";
        ctx.beginPath();
        ctx.arc(bx + 12, by + 14, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    paintLiving(ctx, { x: x, y: y, w: w, h: h }, spec, who, ui, now);
    var portraitW = 0;
    if (who && painted(who)) {
      var pw = Math.min(w * 0.46, h * 0.78);
      var ph = h * 0.96;
      var py = y + h - ph;
      portraitW = pw;
      blitCover(ctx, who, x, py, pw, ph);
      geo.person = { x: x, y: py, w: pw, h: ph };
      if (plan.person) {
        var tagW = Math.min(160, pw - 16);
        var tagH = 40;
        var tagX = x + 12;
        var tagY = py + ph - tagH - 16;
        paintWords(ctx, tagX, tagY, tagW, tagH, shortChoice(plan.person.label), ui.hover === plan.person.id);
      }
    }
    var line = slipWords(hero, spec);
    var slipChoice = plan.slip;
    var slipW = Math.min(narrow ? 210 : 280, w * (who ? 0.34 : 0.4));
    var bodyFont = font(narrow ? 16 : 18, false, 500, true);
    var lines = wrapLines(ctx, bodyFont, line, slipW - 22, 6);
    var lineH = narrow ? 18 : 20;
    var slipH = 18 + lines.length * lineH + (slipChoice ? 34 : 12);
    var slipX = who ? x + w * 0.5 : x + w * 0.08;
    var slipY = y + h * (who ? 0.5 : 0.54);
    if (slipX + slipW > x + w - 8) slipW = x + w - 8 - slipX;
    if (slipY + slipH > y + h - 8) slipY = y + h - slipH - 8;
    geo.slip = { x: slipX, y: slipY, w: slipW, h: slipH };
    ctx.save();
    ctx.translate(slipX + 16, slipY + 8);
    ctx.rotate(-0.03);
    ctx.translate(-(slipX + 16), -(slipY + 8));
    ctx.fillStyle = "#d9cbb8";
    ctx.fillRect(slipX + 3, slipY + 4, slipW, slipH);
    ctx.fillStyle = PAPER;
    ctx.fillRect(slipX, slipY, slipW, slipH);
    ctx.fillStyle = BRICK;
    ctx.beginPath();
    ctx.arc(slipX + 14, slipY + 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = bodyFont;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    var li;
    for (li = 0; li < lines.length; li++) ctx.fillText(lines[li], slipX + 12, slipY + 18 + li * lineH);
    if (slipChoice) {
      var ruleY = slipY + 18 + lines.length * lineH + 4;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(slipX + 12, ruleY);
      ctx.lineTo(slipX + slipW - 12, ruleY);
      ctx.stroke();
      var labelf = font(narrow ? 16 : 18, false, 700, true);
      ctx.font = labelf;
      ctx.fillStyle = ui.hover === slipChoice.id ? BRICK : INK;
      ctx.fillText(clipText(ctx, labelf, shortChoice(slipChoice.label), slipW - 24), slipX + 12, ruleY + 6);
    }
    ctx.restore();
    if (plan.door) {
      var doorW = Math.max(88, Math.min(130, w * 0.14));
      var doorH = 44;
      var doorX = x + w * 0.4;
      var doorY = y + h * 0.68;
      if (who) doorX = x + w * 0.62;
      geo.door = { x: doorX, y: doorY, w: doorW, h: doorH };
      paintWords(ctx, doorX, doorY, doorW, doorH, shortChoice(plan.door.label), ui.hover === plan.door.id);
    }
    if (!dayOne && spec.shop) {
      var nameX = x + w * signBox.x;
      var nameW = w * signBox.w;
      if (portraitW && nameX < x + portraitW) {
        var cut = x + portraitW - nameX;
        nameX += cut;
        nameW -= cut;
      }
      if (spec.rewind === 0) {
        ctx.fillStyle = "rgba(20,16,14,0.78)";
        ctx.fillRect(nameX, y + h * signBox.y, nameW, h * signBox.h);
      } else if (nameW > 40) paintShopName(ctx, spec.shop, nameX, y + h * signBox.y, nameW, h * signBox.h);
    }
    if (!ui.menu) {
      var jx = x + w * 0.58;
      var jy = y + h * 0.1;
      blitContain(ctx, "photostrip", jx, jy, 70, 28);
      pushHit(ui, "hdr:journal", jx, jy, 70, 28);
      var sx = jx + 76;
      ctx.fillStyle = PAPER;
      ctx.fillRect(sx, jy + 2, 36, 24);
      ctx.fillStyle = BRICK;
      ctx.beginPath();
      ctx.arc(sx + 8, jy + 8, 3, 0, Math.PI * 2);
      ctx.fill();
      pushHit(ui, "hdr:settings", sx, jy + 2, 36, 24);
    }
    ctx.restore();
    ctx.textAlign = "left";
    return geo;
  }

  function drawStreet(ctx, rect, spec, who, plan, hero, ui, now) {
    if (painted(shopArtKey(spec))) return drawStreetPainted(ctx, rect, spec, who, plan, hero, ui, now);
    return drawStreetBuilt(ctx, rect, spec, who, plan, hero, ui, now);
  }

  function drawStreetBuilt(ctx, rect, spec, who, plan, hero, ui, now) {
    var x = rect.x;
    var y = rect.y;
    var w = rect.w;
    var h = rect.h;
    var phase = spec.phase || "night";
    var dayOne = !!spec.dayOne;
    var closed = spec.hours === "closed";
    var openLit = !!(spec.lights && !closed && !dayOne);
    var narrow = w < 560;
    var horizon = y + h * 0.38;
    var frontFrac = narrow ? 0.5 : 0.38;
    var fx = x + w * 0.03;
    var fw = w * frontFrac;
    var fy = y + h * 0.08;
    var fh = h * 0.8;
    var sideW = fw * 0.34;
    var bricks = dayOne ? { lite: "#4e3a32", dark: "#3a2a24" } : (phase === "night" ? { lite: "#6a4034", dark: "#4a2c22" } : (phase === "lunch" ? { lite: "#a15c40", dark: "#7a4030" } : { lite: BRICK, dark: BRICK2 }));
    var sideLite = dayOne ? "#3a2a24" : BRICK2;
    var sideDark = dayOne ? "#2a1e1a" : "#4a281c";
    var upY = fy + 10;
    var upH = Math.max(28, fh * 0.24);
    var signY = upY + upH + 8;
    var signH = Math.max(34, Math.min(64, fh * 0.11));
    var awningY = signY + signH + 4;
    var groundY = awningY + 14;
    var groundH = fy + fh - 10 - groundY;
    if (groundH < 56) {
      upH = Math.max(22, fh * 0.18);
      signH = Math.max(28, fh * 0.09);
      signY = upY + upH + 6;
      awningY = signY + signH + 3;
      groundY = awningY + 10;
      groundH = fy + fh - 8 - groundY;
    }
    var doorW = Math.max(56, Math.min(84, fw * 0.24));
    var doorX = fx + fw - doorW - 8;
    var doorY = groundY;
    var doorH = Math.max(36, groundH);
    var geo = { slip: null, door: { x: doorX, y: doorY, w: doorW, h: doorH }, person: null };
    var kind = spec.district === "campus" ? "campus" : (spec.district === "night" ? "night" : "downtown");
    var seatLeft = "";
    var seatRight = "";
    var roomMode = openLit ? "lit" : (closed ? "closed" : "dark");
    if (openLit && !who && spec.regular) seatLeft = "sera";
    if (openLit && spec.onClock && who !== "hire") seatRight = "hire";
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.fillStyle = dayOne ? "#cbbba6" : "#e4d8c4";
    ctx.fillRect(x, horizon, w, y + h - horizon);
    var farL = x + w * 0.5;
    var farR = x + w * 0.62;
    var nearL = x + w * (narrow ? 0.6 : 0.46);
    var nearR = x + w * 0.94;
    var nearY = y + h;
    ctx.fillStyle = dayOne ? "#2a221c" : "#241c18";
    quad(ctx, farL, horizon, farR, horizon, nearR, nearY, nearL, nearY);
    ctx.fill();
    ctx.strokeStyle = "rgba(239,230,212,0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([7, 9]);
    ctx.beginPath();
    ctx.moveTo((farL + farR) * 0.5, horizon + 2);
    ctx.lineTo((nearL + nearR) * 0.5, nearY - 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(28,22,18,0.28)";
    var si;
    for (si = 1; si < 7; si++) {
      var t = si / 7;
      var sy = horizon + (nearY - horizon) * (t * t);
      var span = (sy - horizon) / Math.max(1, nearY - horizon);
      var leftEdge = farL + (nearL - farL) * span;
      ctx.beginPath();
      ctx.moveTo(x + 6, sy);
      ctx.lineTo(leftEdge - 4, sy);
      ctx.moveTo(nearR - (nearR - farR) * (1 - span), sy);
      ctx.lineTo(x + w - 6, sy);
      ctx.stroke();
    }

    if (kind === "downtown") {
      drawNeighbor(ctx, x + w * 0.46, horizon + 4, w * 0.1, h * (narrow ? 0.2 : 0.26), "downtown", false);
      drawNeighbor(ctx, x + w * 0.7, horizon + 2, w * 0.12, h * 0.18, "downtown", false);
    } else if (kind === "campus") {
      drawNeighbor(ctx, x + w * 0.46, horizon + 6, w * 0.16, h * 0.16, "campus", false);
      drawNeighbor(ctx, x + w * 0.7, horizon + 8, w * 0.1, h * 0.12, "campus", false);
    } else {
      drawNeighbor(ctx, x + w * 0.44, horizon + 2, w * 0.09, h * 0.2, "night", false);
      drawNeighbor(ctx, x + w * 0.66, horizon + 4, w * 0.14, h * 0.2, "night", true);
    }

    if (spec.rival) {
      var rx = x + w * (narrow ? 0.72 : 0.66);
      var rw = w * (narrow ? 0.12 : 0.13);
      var rh = h * 0.16;
      var ry = horizon - rh * 0.15;
      var rivalSide = [rx + rw, ry + 4, rx + rw + rw * 0.35, ry + rh * 0.2, rx + rw + rw * 0.28, ry + rh * 0.78, rx + rw, ry + rh];
      fillBricksPoly(ctx, rivalSide, BRICK2, "#4a281c");
      fillBricks(ctx, rx, ry, rw, rh, BRICK, BRICK2);
      drawPane(ctx, rx + 6, ry + rh * 0.18, Math.max(10, rw * 0.4), rh * 0.34, openLit && !closed, null);
      ctx.fillStyle = BRICK2;
      ctx.fillRect(rx - 2, ry + rh * 0.55, rw + 8, 5);
      if (who !== "juniper" && !closed && !dayOne) {
        drawFigure(ctx, rx + rw * 0.45, ry + rh + 2, Math.max(36, h * 0.11), "juniper");
      }
    }

    var side = [fx + fw, fy + 6, fx + fw + sideW, fy + fh * 0.1, fx + fw + sideW * 0.86, fy + fh * 0.48, fx + fw, fy + fh];
    fillBricksPoly(ctx, side, sideLite, sideDark);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    quad(ctx, side[0], side[1], side[2], side[3], side[4], side[5], side[6], side[7]);
    ctx.stroke();
    fillBricks(ctx, fx, fy, fw, fh, bricks.lite, bricks.dark);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(fx, fy, fw, fh);
    if (phase === "morning" && !dayOne) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(fx, fy, fw, fh);
      ctx.clip();
      ctx.fillStyle = "rgba(240,195,106,0.55)";
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + fw * 0.58, fy);
      ctx.lineTo(fx + fw * 0.24, fy + fh);
      ctx.lineTo(fx, fy + fh);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (phase === "lunch" && !dayOne) {
      ctx.fillStyle = "rgba(239,230,212,0.22)";
      ctx.fillRect(fx, fy, fw, fh);
    } else if (phase === "night" && !dayOne) {
      ctx.fillStyle = "rgba(28,22,18,0.34)";
      ctx.fillRect(fx, fy, fw, fh);
    }

    ctx.save();
    quad(ctx, side[0], side[1], side[2], side[3], side[4], side[5], side[6], side[7]);
    ctx.clip();
    drawPane(ctx, fx + fw + sideW * 0.18, fy + fh * 0.16, sideW * 0.42, fh * 0.16, false, null);
    ctx.restore();

    var upKind = spec.upstairs || "";
    var upLit = (upKind === "tutor" || upKind === "office") && !closed && !dayOne;
    var gaps = 8;
    var upCount = fw > 280 ? 3 : 2;
    var upW = (fw - 20 - gaps * (upCount - 1)) / upCount;
    var ui2;
    for (ui2 = 0; ui2 < upCount; ui2++) {
      var ux = fx + 8 + ui2 * (upW + gaps);
      drawPane(ctx, ux, upY, upW, upH - 4, upLit && !dayOne, function (px, py, pw, ph) {
        if (dayOne || !upLit) return;
        paintUpstairs(ctx, px, py, pw, ph, upKind, ui2 === 1 || upCount < 3);
      });
    }

    if (spec.sign && spec.owned && !dayOne) {
      ctx.fillStyle = PAPER;
      ctx.fillRect(fx + 8, signY, fw - 16, signH);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.strokeRect(fx + 8, signY, fw - 16, signH);
      ctx.fillStyle = BRICK;
      ctx.fillRect(fx + 8, signY + signH - 4, fw - 16, 4);
      if (spec.rewind === 0) {
        ctx.fillStyle = "rgba(20,16,14,0.78)";
        ctx.fillRect(fx + 8, signY, fw - 16, signH);
      } else if (spec.shop) {
        var pxSize = Math.min(34, signH * 0.62);
        var track = Math.max(0.8, pxSize * 0.12);
        var face = font(pxSize, false, 700, true);
        while (pxSize > 13 && trackedWidth(ctx, face, spec.shop, track) > fw - 32) {
          pxSize -= 1;
          track = Math.max(0.6, pxSize * 0.1);
          face = font(pxSize, false, 700, true);
        }
        fillTracked(ctx, face, spec.shop, fx + fw * 0.5, signY + signH * 0.46, track, INK);
      }
    }

    ctx.save();
    quad(ctx, fx - 2, awningY, fx + fw + 10, awningY, fx + fw + 18, awningY + 14, fx + 4, awningY + 14);
    ctx.clip();
    ctx.fillStyle = BRICK;
    ctx.fillRect(fx - 4, awningY, fw + 28, 16);
    ctx.fillStyle = BRICK2;
    var stripe;
    for (stripe = 0; stripe < 8; stripe += 2) ctx.fillRect(fx + stripe * ((fw + 24) / 8), awningY, (fw + 24) / 8, 16);
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    quad(ctx, fx - 2, awningY, fx + fw + 10, awningY, fx + fw + 18, awningY + 14, fx + 4, awningY + 14);
    ctx.stroke();

    var winGap = 8;
    var winX = fx + 8;
    var winSpan = doorX - 10 - winX;
    var each = (winSpan - winGap) / 2;
    if (each > 12 && groundH > 24) {
      drawPane(ctx, winX, groundY, each, groundH, openLit, function (px, py, pw, ph) {
        paintGround(ctx, px, py, pw, ph, spec, roomMode, seatLeft);
      });
      drawPane(ctx, winX + each + winGap, groundY, each, groundH, openLit, function (px, py, pw, ph) {
        paintGround(ctx, px, py, pw, ph, spec, roomMode, seatRight);
      });
    }

    ctx.fillStyle = openLit ? "#5c3428" : "#1c1612";
    ctx.fillRect(doorX, doorY, doorW, doorH);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(doorX, doorY, doorW, doorH);
    ctx.strokeRect(doorX + 5, doorY + 8, doorW - 10, Math.max(16, doorH * 0.38));
    ctx.fillStyle = LAMP;
    ctx.beginPath();
    ctx.arc(doorX + doorW - 12, doorY + doorH * 0.55, 3.6, 0, Math.PI * 2);
    ctx.fill();
    if (spec.owned && !dayOne) icon(ctx, "key", doorX - 16, doorY + 22, 22, LAMP);

    if (phase === "evening" && !dayOne) {
      ctx.fillStyle = "rgba(240,195,106,0.42)";
      ctx.beginPath();
      ctx.moveTo(doorX - 16, doorY + doorH);
      ctx.lineTo(doorX + doorW + 28, doorY + doorH);
      ctx.lineTo(doorX + doorW + 78, y + h);
      ctx.lineTo(doorX - 46, y + h);
      ctx.closePath();
      ctx.fill();
    }
    if (phase === "night" && !dayOne && (spec.owned || spec.lights)) {
      drawBulb(ctx, doorX + doorW * 0.5, doorY - 2, narrow ? 6 : 8);
      ctx.fillStyle = "rgba(240,195,106,0.3)";
      ctx.save();
      ctx.translate(doorX + doorW * 0.5, doorY + doorH + 6);
      ctx.scale(1, 0.28);
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (!closed && !dayOne) {
      var extras = spec.regulars || [];
      var shown = 0;
      var ei;
      for (ei = 0; ei < extras.length && shown < 2; ei++) {
        if (!extras[ei]) continue;
        if (spec.regular && extras[ei].name === spec.regular.name) continue;
        drawFigure(ctx, x + w * 0.5 + shown * 28, horizon + h * 0.22, h * 0.075, "walker");
        shown += 1;
      }
      if (!who) {
        drawFigure(ctx, nearL + (nearR - nearL) * 0.35, y + h * 0.72, h * 0.09, "walker");
        drawFigure(ctx, nearL + (nearR - nearL) * 0.62, y + h * 0.8, h * 0.1, "walker");
      }
    }

    if (phase === "night") {
      ctx.strokeStyle = "rgba(239,230,212,0.32)";
      ctx.lineWidth = 1;
      var ri;
      var rainShift = ((now || 0) / 28) % (h + 20);
      for (ri = 0; ri < 22; ri++) {
        var rx = x + ((ri * 97) % 1000) / 1000 * w;
        var ry = y + ((ri * 53 + rainShift) % (h * 0.86));
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 4, ry + 12);
        ctx.stroke();
      }
    }

    if (dayOne) {
      ctx.fillStyle = "rgba(28,22,18,0.46)";
      ctx.fillRect(x, y, w, h);
    }

    paintLiving(ctx, { x: x, y: y, w: w, h: h }, spec, who, ui, now);
    if (who) {
      var ph = h * 0.4;
      var pcx = x + w * (narrow ? 0.8 : 0.72);
      var foot = y + h - 4;
      drawFigure(ctx, pcx, foot, ph, who);
      geo.person = { x: pcx - ph * 0.28, y: foot - ph, w: ph * 0.56, h: ph };
      if (plan.person) {
        var tagW = Math.min(150, Math.max(88, ph * 0.7));
        var tagH = 36;
        var tagX = geo.person.x + geo.person.w - 10;
        var tagY = geo.person.y + ph * 0.42;
        if (tagX + tagW > x + w - 6) tagX = x + w - 6 - tagW;
        drawTag(ctx, tagX, tagY, tagW, tagH, plan.person.label, ui.hover === plan.person.id);
      }
    }

    var line = slipWords(hero, spec);
    var slipChoice = plan.slip;
    var slipW = plan.door ? Math.min(250, Math.max(150, doorX - fx - 16)) : Math.min(280, Math.max(170, w * 0.32));
    var bodyFont = font(narrow ? 15 : 17, false, 600, true);
    var lines = wrapLines(ctx, bodyFont, line, slipW - 22, 6);
    var lineH = narrow ? 18 : 20;
    var slipH = 22 + lines.length * lineH + (slipChoice ? 32 : 14);
    var slipX = plan.door ? fx + 10 : doorX - 6;
    var slipY = plan.door ? groundY + 4 : doorY + 8;
    if (slipX < x + 8) slipX = x + 8;
    if (slipX + slipW > x + w - 8) slipW = x + w - 8 - slipX;
    if (geo.person && slipX + slipW > geo.person.x - 8) {
      slipW = Math.max(140, geo.person.x - 8 - slipX);
    }
    if (slipY + slipH > y + h - 8) slipY = y + h - 8 - slipH;
    if (slipY < y + 8) slipY = y + 8;
    geo.slip = { x: slipX, y: slipY, w: slipW, h: slipH };
    ctx.save();
    ctx.translate(slipX + slipW * 0.5, slipY + 10);
    ctx.rotate(-0.03);
    ctx.translate(-(slipX + slipW * 0.5), -(slipY + 10));
    ctx.fillStyle = "#d9cbb8";
    ctx.fillRect(slipX + 4, slipY + 5, slipW, slipH);
    ctx.fillStyle = PAPER;
    ctx.fillRect(slipX, slipY, slipW, slipH);
    ctx.strokeStyle = slipChoice && ui.hover === slipChoice.id ? LAMP : INK;
    ctx.lineWidth = slipChoice && ui.hover === slipChoice.id ? 2.5 : 1.5;
    ctx.strokeRect(slipX, slipY, slipW, slipH);
    ctx.fillStyle = BRICK;
    ctx.beginPath();
    ctx.arc(slipX + 14, slipY + 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = bodyFont;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    var li;
    for (li = 0; li < lines.length; li++) ctx.fillText(lines[li], slipX + 12, slipY + 20 + li * lineH);
    if (slipChoice) {
      var ruleY = slipY + 20 + lines.length * lineH + 4;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(slipX + 12, ruleY);
      ctx.lineTo(slipX + slipW - 12, ruleY);
      ctx.stroke();
      var labelf = font(narrow ? 13 : 15, false, 700, true);
      ctx.font = labelf;
      ctx.fillStyle = INK;
      ctx.fillText(clipText(ctx, labelf, slipChoice.label, slipW - 24), slipX + 12, ruleY + 6);
    }
    ctx.restore();

    if (plan.door) {
      var dtagW = Math.max(doorW - 8, 72);
      var dtagH = 48;
      var dtagX = doorX + 4;
      var dtagY = doorY + doorH * 0.42;
      if (dtagX + dtagW > doorX + doorW - 4) dtagW = doorW - 8;
      drawTag(ctx, dtagX, dtagY, dtagW, dtagH, plan.door.label, ui.hover === plan.door.id);
      if (ui.hover === plan.door.id) {
        ctx.strokeStyle = LAMP;
        ctx.lineWidth = 3;
        ctx.strokeRect(doorX, doorY, doorW, doorH);
      }
    }

    ctx.restore();
    return geo;
  }

  function drawStorefront(ctx, x, y, w, h, spec) {
    drawStreet(ctx, { x: x, y: y, w: w, h: h }, spec || {}, "", { slip: null, door: null, person: null }, { line: "" }, { hover: "" }, 0);
  }

  function drawStory(ctx, game, ui, L, now) {
    var top = L.header;
    var bot = L.tabY;
    var w = L.w;
    var cardH = bot - top;
    if (cardH < 80 || w < 40) return;
    var newest = game.logN - 1;
    if (logAnim.head !== game.logHead) {
      logAnim.head = game.logHead;
      logAnim.t = 0;
    }
    var deal = easeOut(logAnim.t);
    var hero = storyBeat(newest >= 0 ? (S.logLine(game, newest) || "") : "", game);
    var lifeId = "";
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
      lifeId = showId || "";
      var lived = showId && S.lifeBeat ? S.lifeBeat(game, showId) : null;
      if (lived) hero = lived;
      else hero = offerHours(game, decorateOffer(game, hero));
    }
    var handsOn = hero.action === "shift";
    var spec = storySpec(game, now, handsOn);
    spec.rewind = ui.rewind ? (ui.rewindStep || 0) : -1;
    var who = spec.dayOne ? "" : cardWho(lifeId, hero);
    var plan = choicePlan(who, hero);
    ctx.save();
    ctx.globalAlpha = 0.82 + 0.18 * deal;
    var geo = drawStreet(ctx, { x: 0, y: top, w: w, h: cardH }, spec, who, plan, hero, ui, now);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (!ui.menu) {
      var clipWas = ui.clip;
      ui.clip = { x: 0, y: top, w: w, h: cardH };
      if (plan.slip && geo.slip) pushHit(ui, plan.slip.id, geo.slip.x, geo.slip.y, geo.slip.w, geo.slip.h);
      if (plan.door && geo.door) pushHit(ui, plan.door.id, geo.door.x, geo.door.y, geo.door.w, geo.door.h);
      if (plan.person && geo.person) pushHit(ui, plan.person.id, geo.person.x, geo.person.y, geo.person.w, geo.person.h);
      var sx = 0;
      var sy = top;
      var sw = w;
      var sh = cardH;
      if (!spec.dayOne) {
        pushHit(ui, "stand:register", sx + sw * 0.5, sy + sh * 0.62, Math.max(44, sw * 0.1), Math.max(36, sh * 0.1));
        pushHit(ui, "stand:door", sx + sw * 0.64, sy + sh * 0.58, Math.max(44, sw * 0.09), Math.max(40, sh * 0.14));
        if (spec.floor) pushHit(ui, "stand:upstairs", sx + sw * 0.48, sy + sh * 0.15, Math.max(48, sw * 0.12), Math.max(32, sh * 0.1));
      }
      if (spec.thinLine) pushHit(ui, "rewind", sx + sw - 78, sy + 8, 64, 22);
      ui.clip = clipWas;
    }
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
    if (!game || !game.player || L.b1 <= L.b0) return;
    var cash = S.money(game.player.capital);
    var f = font(16, false, 700, true);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.font = f;
    ctx.fillStyle = PAPER;
    ctx.fillRect(16, L.b0 + 4, measure(ctx, f, cash) + 12, 22);
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(cash, 22, L.b0 + 15);
    ctx.restore();
  }

  function drawHeader(ctx, game, ui, L, now) {
    ctx.shadowBlur = 0;
    if (L.header < 8) return;
    ctx.save();
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, L.w, L.header);
    ctx.fillStyle = INK;
    ctx.font = font(18, false, 700, true);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(S.money(game.player.capital), 12, L.header * 0.5);
    ctx.restore();
  }

  function roundButton(ctx, ui, id, x, y, s, kind, on) {
    var hover = ui.hover === id;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x + s * 0.5, y + s * 0.5, s * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = on ? LAMP : hover ? "#f7f1e4" : PAPER;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    icon(ctx, kind, x + s * 0.5, y + s * 0.5, s * 0.5, INK);
    ctx.restore();
    pushHit(ui, id, x, y, s, s);
  }

  function drawTree(ctx, x, y, w, h) {
    ctx.fillStyle = "#3d5c32";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + h * 0.08);
    ctx.lineTo(x + w * 0.86, y + h * 0.62);
    ctx.lineTo(x + w * 0.14, y + h * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2a241c";
    ctx.fillRect(x + w * 0.44, y + h * 0.62, w * 0.12, h * 0.28);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  }

  function drawDock(ctx, game, ui, L) {
    var ready = counterReady(game);
    var shady = ready && game.flags && game.flags.shady;
    var items = [
      { id: "tab:job", label: "Work", art: "ledger", menu: "job", show: ready },
      { id: "tab:edu", label: "School", art: "notebook", menu: "edu", show: true },
      { id: "tab:scout", label: "People", art: "photostrip", menu: "scout", show: true },
      { id: "tab:lab", label: "Stuff", art: "crate", menu: "lab", show: ready },
      { id: "shady", label: "Tree", art: "", menu: "lab", show: !!shady, tree: true }
    ];
    var shown = [];
    var i;
    for (i = 0; i < items.length; i++) if (items[i].show) shown.push(items[i]);
    var gap = 10;
    var bw = (L.w - 28 - gap * Math.max(0, shown.length - 1)) / Math.max(1, shown.length);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#5a3828";
    ctx.fillRect(0, L.tabY, L.w, L.h - L.tabY);
    ctx.fillStyle = "#3a2418";
    ctx.fillRect(0, L.tabY, L.w, 10);
    ctx.fillStyle = "rgba(239,230,212,0.08)";
    ctx.fillRect(0, L.tabY + 10, L.w, 3);
    for (i = 0; i < shown.length; i++) {
      var item = shown[i];
      var on = ui.menu === item.menu;
      var hover = ui.hover === item.id;
      var lift = on ? 22 : (hover ? 8 : 0);
      var x = 14 + i * (bw + gap);
      var objH = Math.max(64, L.tabH - 36);
      var ty = L.tabY + 16 - lift;
      ctx.save();
      if (on) {
        ctx.fillStyle = "rgba(28,22,18,0.28)";
        ctx.fillRect(x + 8, L.tabY + L.tabH - 18, bw - 16, 8);
      }
      if (item.tree) drawTree(ctx, x, ty, bw, objH);
      else if (!blitCover(ctx, item.art, x, ty, bw, objH)) {
        ctx.fillStyle = PAPER;
        ctx.fillRect(x, ty, bw, objH);
      }
      ctx.font = font(L.w < 520 ? 15 : 17, false, 700, true);
      ctx.fillStyle = PAPER;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.label, x + bw * 0.5, Math.min(L.h - 14, ty + objH + 12));
      ctx.restore();
      pushHit(ui, item.id, x, ty, bw, objH + 18);
    }
    ctx.restore();
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }


  function drawRules(ctx, L) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PAPER;
    ctx.fillRect(18, L.a1 - 28, Math.min(280, L.w - 36), 22);
    ctx.fillStyle = INK;
    ctx.font = font(15, false, 500, true);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("One shop. The picture is the game.", 26, L.a1 - 17);
    ctx.restore();
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
      p.color = color || LAMP;
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
    if (ui.rewind) {
      if (!ui.rewindAt) ui.rewindAt = now;
      ui.rewindStep = Math.floor((now - ui.rewindAt) / 650) % 3;
    } else ui.rewindStep = -1;
    var phaseId = S.phaseAt(now).id;
    var bg = ensurePlate(w, h, !!game.settings.performanceMode, dpr, phaseId);
    ctx.drawImage(bg, 0, 0, w, h);
    var heatN = (game.player && game.player.heat) || 0;
    if (game.flags && game.flags.shady && heatN > 28) {
      var ha = (heatN - 28) / 220;
      if (ha > 0.16) ha = 0.16;
      ctx.fillStyle = "rgba(28, 22, 18, " + ha.toFixed(3) + ")";
      ctx.fillRect(0, 0, w, h);
    }
    buttonTone = "";
    sheetLock = false;
    var L = layout(w, h);
    ui.L = L;
    drawStory(ctx, game, ui, L, now);
    if (ui.menu && ui.menuT > 0.02) drawMenu(ctx, game, ui, L);
    drawHeader(ctx, game, ui, L, now);
    noteCash(game, now, Math.min(120, w * 0.2), h * 0.62);
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
