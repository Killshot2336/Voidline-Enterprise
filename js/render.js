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
  var frameUi = null;
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
  var cashHeld = false;
  var artImg = {};
  var cutCache = {};
  var ART_SRC = {
    shopMorning: "art/shop-morning.jpg",
    shopNoon: "art/shop-noon.jpg",
    shopEvening: "art/shop-evening.jpg",
    shopNight: "art/shop-night.jpg",
    shopClosed: "art/shop-closed.jpg",
    sera: "art/portrait-sera.png",
    landlord: "art/portrait-landlord.png",
    juniper: "art/portrait-juniper.png",
    hire: "art/portrait-hire.png",
    campus: "art/neighbor-campus.jpg",
    downtown: "art/neighbor-downtown.jpg",
    night: "art/neighbor-night.jpg",
    ledger: "art/obj-ledger.png",
    notebook: "art/obj-notebook.png",
    photostrip: "art/obj-photostrip.png",
    crate: "art/obj-crate.png",
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

  var SHOP_BIAS = 0.16;

  function blitCover(ctx, key, x, y, w, h, biasX, biasY) {
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
      sx = (img.naturalWidth - sw) * (biasX == null ? 0.5 : biasX);
    } else {
      sh = sw / r;
      sy = (img.naturalHeight - sh) * (biasY == null ? 0.28 : biasY);
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

  function textFace(px, role) {
    if (role === "num") return "600 " + px + "px " + MONO;
    if (role === "title") return "700 " + px + "px " + SERIF;
    return "500 " + px + "px " + SERIF;
  }

  function phaseGround(phase) {
    if (phase === "morning") return "#3a2c28";
    if (phase === "lunch") return "#24323a";
    if (phase === "evening") return "#3a261c";
    if (phase === "standard") return "#2a2836";
    return "#1a2744";
  }

  function hexA(hex, a) {
    var n = parseInt(String(hex || "#000000").slice(1), 16);
    var r = (n >> 16) & 255;
    var g = (n >> 8) & 255;
    var b = n & 255;
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
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
    var dock = h < 640 ? 58 : 70;
    var header = 40;
    return {
      w: w,
      h: h,
      header: header,
      a1: h - dock,
      b0: header,
      b1: h - dock,
      tabH: dock,
      tabY: h - dock,
      dock: dock
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
    if (!ui || ui.muteHits) return;
    if (ui.hitOx) x += ui.hitOx;
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
    var dark = tone === "dark";
    var f = textFace(15, dark ? "body" : "title");
    ctx.font = f;
    ctx.fillStyle = faint ? "#6e665c" : (dark ? PAPER : ink);
    ctx.globalAlpha = faint ? 0.8 : 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, f, label, w - 12), x + w * 0.5, y + h * 0.46);
    ctx.strokeStyle = faint ? "#6e665c" : (dark ? "rgba(239,230,212,0.28)" : ink);
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
    var on = screen >= flow.top - 1 && screen + h <= flow.bottom + 1;
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
    var r = row(flow, 32);
    if (!r.on) return;
    var ctx = flow.ctx;
    ctx.save();
    ctx.shadowBlur = 0;
    if (buttonTone !== "dark") {
      ctx.fillStyle = "rgba(239,230,212,0.94)";
      ctx.fillRect(flow.x - 6, r.y, flow.w + 12, 30);
    }
    var f = textFace(18, "title");
    ctx.font = f;
    ctx.fillStyle = buttonTone === "dark" ? PAPER : (locked ? "#a3988c" : INK);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(locked && shadyName ? "Tied cards" : text, flow.x, r.y + 14);
    ctx.strokeStyle = buttonTone === "dark" ? "rgba(239,230,212,0.22)" : "rgba(28,22,18,0.45)";
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
      if (buttonTone !== "dark") {
        ctx.fillStyle = "rgba(239,230,212,0.92)";
        ctx.fillRect(flow.x - 6, r.y, flow.w + 12, 20);
      }
      ctx.font = f;
      ctx.fillStyle = buttonTone === "dark" ? PAPER : INK;
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

  function darkTitle(flow, text) {
    var r = row(flow, 32);
    if (!r.on) return;
    var ctx = flow.ctx;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.font = textFace(18, "title");
    ctx.fillStyle = PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(String(text || ""), flow.x, r.y + 16);
    ctx.restore();
  }

  function darkNote(flow, text) {
    var f = textFace(13, "body");
    var lines = wrapLines(flow.ctx, f, text, flow.w, 3);
    var i;
    for (i = 0; i < lines.length; i++) {
      var r = row(flow, 20);
      if (!r.on) continue;
      var ctx = flow.ctx;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.font = f;
      ctx.fillStyle = "#c8c0b4";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(lines[i], flow.x, r.y + 10);
      ctx.restore();
    }
  }

  function darkKicker(flow, text) {
    var r = row(flow, 24);
    if (!r.on) return;
    var ctx = flow.ctx;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.font = textFace(11, "title");
    ctx.fillStyle = "#9aa1ad";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(String(text || "").toUpperCase(), flow.x, r.y + 14);
    ctx.restore();
  }

  function darkLine(flow, id, label, meta, disabled) {
    var r = row(flow, 32);
    if (!r.on) return;
    var ctx = flow.ctx;
    var ui = flow.ui;
    var hot = !disabled && ui && id && ui.hover === id;
    var metaText = meta || "";
    var metaFont = metaText.charAt(0) === "$" ? textFace(13, "num") : textFace(13, "body");
    var labFont = textFace(15, "body");
    ctx.save();
    ctx.shadowBlur = 0;
    if (hot) {
      ctx.fillStyle = "rgba(240,195,106,0.10)";
      ctx.fillRect(flow.x, r.y, flow.w, 28);
    }
    var metaW = metaText ? measure(ctx, metaFont, metaText) : 0;
    var nameMax = Math.max(24, flow.w - metaW - 16);
    var lab = clipText(ctx, labFont, label || "", nameMax);
    ctx.font = labFont;
    ctx.fillStyle = disabled ? "#6e665c" : PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(lab, flow.x, r.y + 16);
    if (metaText) {
      ctx.font = metaFont;
      ctx.fillStyle = disabled ? "#6e665c" : PAPER;
      ctx.textAlign = "right";
      ctx.fillText(metaText, flow.x + flow.w, r.y + 16);
    }
    ctx.restore();
    if (id && !disabled && ui) pushHit(ui, id, flow.x, r.y, flow.w, 28);
  }

  function darkFeature(flow, id, label, price, fill, disabled) {
    var showBar = fill != null;
    var boxH = showBar ? 54 : 40;
    var r = row(flow, boxH + 8);
    if (!r.on) return;
    var ctx = flow.ctx;
    var ui = flow.ui;
    var hot = !disabled && ui && id && ui.hover === id;
    var f = showBar ? fill : 0;
    if (f < 0) f = 0;
    if (f > 1) f = 1;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = hot ? "rgba(240,195,106,0.16)" : "rgba(20,16,14,0.5)";
    ctx.fillRect(flow.x, r.y, flow.w, boxH);
    ctx.fillStyle = LAMP;
    ctx.fillRect(flow.x, r.y, 3, boxH);
    var nameFont = textFace(15, "title");
    var priceFont = textFace(13, "num");
    var priceW = price ? measure(ctx, priceFont, price) + 16 : 0;
    var textY = showBar ? r.y + 20 : r.y + boxH * 0.5;
    ctx.font = nameFont;
    ctx.fillStyle = PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, nameFont, label || "", Math.max(24, flow.w - priceW - 24)), flow.x + 14, textY);
    if (price) {
      ctx.font = priceFont;
      ctx.fillStyle = LAMP;
      ctx.textAlign = "right";
      ctx.fillText(price, flow.x + flow.w - 12, textY);
    }
    if (showBar) {
      var barX = flow.x + 14;
      var barW = flow.w - 28;
      ctx.fillStyle = "rgba(239,230,212,0.16)";
      ctx.fillRect(barX, r.y + 38, barW, 5);
      if (f > 0) {
        ctx.fillStyle = LAMP;
        ctx.fillRect(barX, r.y + 38, Math.max(2, barW * f), 5);
      }
    }
    ctx.restore();
    if (id && !disabled && ui) pushHit(ui, id, flow.x, r.y, flow.w, boxH);
  }

  function roomCatalog() {
    return [
      ["room", "Rent the corner"],
      ["lights", "Warm lights"],
      ["sign", "Paint a sign"],
      ["counter", "Real counter"],
      ["plant", "Plant"],
      ["speaker", "Speaker"],
      ["neon", "Neon"],
      ["cooler", "Cooler"],
      ["safe", "Safe"],
      ["floor", "Buy the floor"]
    ];
  }

  function roomCost(id) {
    if (id === "room") return D.ROOM.rent;
    return D.ROOM[id] || 0;
  }

  function roomAction(id) {
    if (id === "room") return "room";
    if (id === "floor") return "floor";
    if (id === "lights" || id === "sign" || id === "counter" || id === "plant" || id === "speaker" || id === "neon" || id === "cooler" || id === "safe") return "upgrade:" + id;
    return "";
  }

  function partOwned(game, id) {
    var place = (game.player && game.player.place) || {};
    if (id === "room") return !!place.owned;
    if (id === "floor") return !!(game.world && game.world.floor);
    return !!place[id];
  }

  function partOpen(game, id) {
    var place = (game.player && game.player.place) || {};
    if (id === "room") return !place.owned;
    if (!place.owned) return false;
    return !partOwned(game, id);
  }

  function cheapestRoom(game) {
    var catalog = roomCatalog();
    var best = null;
    var i;
    for (i = 0; i < catalog.length; i++) {
      var part = catalog[i];
      if (!partOpen(game, part[0])) continue;
      var cost = roomCost(part[0]);
      if (!best || cost < best.cost) best = { id: part[0], label: part[1], cost: cost };
    }
    return best;
  }

  function screenGoal(game) {
    var w = game.world || {};
    var cap = (game.player && game.player.capital) || 0;
    if (w.locked >= 3 && w.rentDue > 0) {
      return { id: "rent", label: "Pay rent", cost: w.rentDue, price: S.money(w.rentDue), fill: cap / w.rentDue };
    }
    var life = S.currentLifeId ? S.currentLifeId(game, game.lastReal || 0) : "";
    if (life === "landlord" && w.rentDue > 0) {
      return { id: "rent", label: "Pay rent", cost: w.rentDue, price: S.money(w.rentDue), fill: cap / w.rentDue };
    }
    return S.nextSpend ? S.nextSpend(game) : null;
  }

  function closestRoom(game) {
    var goal = screenGoal(game);
    var action = goal ? roomAction(goal.id) : "";
    var cap = (game.player && game.player.capital) || 0;
    if (action && partOpen(game, goal.id)) {
      var cost = goal.cost || roomCost(goal.id);
      return {
        id: goal.id,
        action: action,
        label: goal.label || "Upgrade",
        cost: cost,
        price: goal.price || (cost ? S.money(cost) : ""),
        fill: goal.fill != null ? goal.fill : (cost > 0 ? cap / cost : 1)
      };
    }
    var cheap = cheapestRoom(game);
    if (!cheap) return null;
    return {
      id: cheap.id,
      action: roomAction(cheap.id),
      label: cheap.label,
      cost: cheap.cost,
      price: S.money(cheap.cost),
      fill: cheap.cost > 0 ? cap / cheap.cost : 1
    };
  }

  function shopStatusLine(game, slot, now) {
    var bits = [];
    var phase = S.phaseAt(now);
    if (phase && phase.name) bits.push(phase.name);
    var opened = !!(game.flags && game.flags.opened);
    var closed = doorClosed(game);
    if (!opened) bits.push("Not selling");
    else if (closed) bits.push("Shop closed");
    else if (!slot || slot.stock <= 0) bits.push("Out of stock");
    else {
      bits.push("Selling");
      if (game.lastNet) bits.push("last " + S.money(game.lastNet));
    }
    if (slot) {
      var job = D.jobById[slot.jobId];
      if (job) bits.push(job.name);
      bits.push("stock " + slot.stock + "/" + S.stockCap(game));
    }
    return bits.join("  ·  ");
  }

  function jobNeed(spec) {
    var need = "Year " + spec.level;
    if (spec.skill) need += " · " + spec.skill + " " + spec.skillNeed;
    else if (spec.node && D.nodeById[spec.node]) need += " · " + D.nodeById[spec.node].name;
    return need;
  }

  function nextDegree(game) {
    var i;
    var later = null;
    var degs = D.DEGREES || [];
    for (i = 0; i < degs.length; i++) {
      var deg = degs[i];
      if (game.degrees && game.degrees[deg.id]) continue;
      if (game.degree && game.degree.id === deg.id) continue;
      if (!later) later = deg;
      if ((game.player.level || 1) >= deg.level) return deg;
    }
    return later;
  }

  function dayHand(now) {
    var d = new Date(now || Date.now());
    return (d.getHours() * 60 + d.getMinutes()) / (24 * 60);
  }

  function paintClock(ctx, cx, cy, r, pct) {
    var p = pct;
    if (p < 0) p = 0;
    if (p > 1) p = 1;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(20,16,14,0.55)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(239,230,212,0.45)";
    ctx.stroke();
    var i;
    for (i = 0; i < 12; i++) {
      var a = -Math.PI / 2 + i * (Math.PI * 2 / 12);
      var inner = r - (i % 3 === 0 ? 12 : 7);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
      ctx.strokeStyle = "rgba(239,230,212,0.55)";
      ctx.lineWidth = i % 3 === 0 ? 2 : 1;
      ctx.stroke();
    }
    if (p > 0.004) {
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(8, r - 16), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
      ctx.strokeStyle = LAMP;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    var ang = -Math.PI / 2 + Math.PI * 2 * p;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * Math.max(12, r - 28), cy + Math.sin(ang) * Math.max(12, r - 28));
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = LAMP;
    ctx.fill();
    ctx.restore();
  }

  function drawSchoolClock(flow, game, ui) {
    var now = (ui && ui.now) || game.lastReal || Date.now();
    var running = game.degree;
    var def = running && D.degreeById ? D.degreeById[running.id] : null;
    var remain = 0;
    if (def && running.total) remain = running.left / running.total;
    if (remain < 0) remain = 0;
    if (remain > 1) remain = 1;
    var viewH = Math.max(160, flow.bottom - flow.top);
    var r = Math.min(88, flow.w * 0.2, viewH * 0.2);
    if (r < 64) r = 64;
    var block = row(flow, r * 2 + 48);
    if (!block.on) return;
    var ctx = flow.ctx;
    var cx = flow.x + flow.w * 0.5;
    var cy = block.y + r + 4;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(239,230,212,0.22)";
    ctx.lineWidth = 8;
    ctx.stroke();
    if (def && remain > 0.004) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remain);
      ctx.strokeStyle = LAMP;
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    var hand = def ? (1 - remain) : dayHand(now);
    var ang = -Math.PI / 2 + Math.PI * 2 * hand;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * (r - 18), cy + Math.sin(ang) * (r - 18));
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 2;
    ctx.stroke();
    var nameFace = textFace(15, "title");
    var name = def ? def.name : "School";
    var nameLines = wrapLines(ctx, nameFace, name, Math.max(48, r * 1.5), 2);
    ctx.font = nameFace;
    ctx.fillStyle = PAPER;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var i;
    for (i = 0; i < nameLines.length; i++) ctx.fillText(nameLines[i], cx, cy + (i - (nameLines.length - 1) * 0.5) * 18);
    ctx.font = textFace(13, "num");
    ctx.fillStyle = LAMP;
    var sub = def ? S.fmtMs(running.left) : S.clockLabel(now);
    ctx.fillText(clipText(ctx, textFace(13, "num"), sub, flow.w - 8), cx, cy + r + 18);
    ctx.restore();
  }


  function drawDegreeRail(flow, game, ui) {
    var degs = D.DEGREES || [];
    if (!degs.length) return;
    var r = row(flow, 58);
    if (!r.on) return;
    var ctx = flow.ctx;
    var n = degs.length;
    var gap = 8;
    var bw = (flow.w - gap * (n - 1)) / n;
    var next = nextDegree(game);
    var i;
    ctx.save();
    ctx.shadowBlur = 0;
    for (i = 0; i < n; i++) {
      var deg = degs[i];
      var x = flow.x + i * (bw + gap);
      var done = !!(game.degrees && game.degrees[deg.id]);
      var live = !!(game.degree && game.degree.id === deg.id);
      var isNext = !!(next && next.id === deg.id && !live);
      var hot = ui && ui.hover === "deg:" + deg.id;
      ctx.fillStyle = (isNext || live || hot) ? LAMP : "rgba(239,230,212,0.35)";
      ctx.fillRect(x + bw * 0.5 - 3, r.y + 2, 6, 6);
      if (isNext || live) {
        ctx.fillStyle = LAMP;
        ctx.fillRect(x + 4, r.y + 14, Math.max(8, bw - 8), 2);
      }
      var nameFont = textFace(11, "title");
      ctx.font = nameFont;
      ctx.fillStyle = done ? "#6e665c" : PAPER;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(clipText(ctx, nameFont, deg.name, bw - 4), x + bw * 0.5, r.y + 30);
      var metaFont = textFace(11, "num");
      ctx.font = metaFont;
      ctx.fillStyle = done ? "#6e665c" : LAMP;
      var meta = done ? "Filed" : (live ? "Now" : S.money(deg.cost));
      ctx.fillText(clipText(ctx, metaFont, meta, bw - 4), x + bw * 0.5, r.y + 46);
      if (!done && ui) pushHit(ui, "deg:" + deg.id, x, r.y, bw, 56);
    }
    ctx.restore();
  }

  function hireSlot(game, ui) {
    var slots = game.slots || [];
    var focus = ui && ui.focusSlot != null ? ui.focusSlot : 0;
    if (focus < 0) focus = 0;
    if (slots[focus] && slots[focus].employee) return focus;
    var i;
    for (i = 0; i < slots.length; i++) if (slots[i].employee) return i;
    if (!slots.length) return 0;
    if (focus >= slots.length) return 0;
    return focus;
  }

  function personHere(game, who) {
    var w = game.world || {};
    if (who === "sera") return !!w.regular;
    if (who === "landlord") return !!(w.rentDue);
    if (who === "juniper") return !!w.rival;
    var slots = game.slots || [];
    var i;
    for (i = 0; i < slots.length; i++) if (slots[i].employee) return true;
    return false;
  }

  function personCaption(game, who, ui) {
    if (!personHere(game, who)) {
      if (who === "sera") return "Regular";
      if (who === "landlord") return "Landlord";
      if (who === "juniper") return "Rival";
      return "Hire";
    }
    var w = game.world || {};
    if (who === "sera") return (w.regular && w.regular.name) || "Regular";
    if (who === "landlord") return "Landlord";
    if (who === "juniper") return w.rival || "Rival";
    var idx = hireSlot(game, ui);
    var emp = game.slots && game.slots[idx] && game.slots[idx].employee;
    return emp ? emp.name : "Hire";
  }

  function personChoice(game, who, ui) {
    var w = game.world || {};
    var cap = (game.player && game.player.capital) || 0;
    if (who === "sera") {
      if (!w.regular) return { line: "Not at the counter.", action: "", label: "", price: "" };
      return { line: w.regular.name + "  ·  visits " + (w.regular.visits || 0), action: "greet", label: "Greet", price: "" };
    }
    if (who === "landlord") {
      if (w.rentDue) return { line: "Rent is due.", action: "rentpay", label: "Pay rent", price: S.money(w.rentDue), fill: cap / w.rentDue, disabled: cap < w.rentDue };
      return { line: "The building is quiet.", action: "", label: "", price: "" };
    }
    if (who === "juniper") {
      if (!w.rival) return { line: "No shop across the street.", action: "", label: "", price: "" };
      var place = (game.player && game.player.place) || {};
      if (!place.sign) return { line: w.rival + " is across the street.", action: "upgrade:sign", label: "Paint a sign", price: S.money(D.ROOM.sign), fill: D.ROOM.sign > 0 ? cap / D.ROOM.sign : 1, disabled: cap < D.ROOM.sign };
      if (!w.truce) return { line: w.rival + " is across the street.", action: "truce", label: "Call a truce", price: "" };
      return { line: w.rival + " is across the street. The truce is holding.", action: "", label: "", price: "" };
    }
    var idx = hireSlot(game, ui);
    var emp = game.slots && game.slots[idx] && game.slots[idx].employee;
    if (!emp) return { line: "Nobody is on the clock.", action: "applicants", label: "Find people", price: "" };
    var line = emp.name + "  ·  " + S.money(emp.salary);
    if (emp.caught) line += "  ·  Busted";
    return { line: line, action: "fire:" + idx, label: "Fire", price: S.money(emp.salary) };
  }

  function drawPeopleBand(flow, game, ui, active) {
    var cast = [
      ["sera", "Regular"],
      ["landlord", "Landlord"],
      ["juniper", "Rival"],
      ["hire", "Hire"]
    ];
    var gap = 10;
    var bw = (flow.w - gap * 3) / 4;
    var viewH = Math.max(160, flow.bottom - flow.top);
    var ph = Math.min(248, Math.max(150, viewH * 0.4));
    if (ph + 40 > viewH - 80) ph = Math.max(130, viewH - 180);
    var pw = Math.max(36, Math.round(ph * 318 / 1088));
    if (pw > bw - 4) {
      pw = bw - 4;
      ph = Math.round(pw * 1088 / 318);
    }
    var band = row(flow, ph + 56);
    if (!band.on) return;
    var ctx = flow.ctx;
    var look = active || (ui && ui.look) || "";
    var i;
    ctx.save();
    ctx.shadowBlur = 0;
    for (i = 0; i < cast.length; i++) {
      var who = cast[i][0];
      var bx = flow.x + i * (bw + gap);
      var here = personHere(game, who);
      var on = look === who;
      var px = bx + (bw - pw) * 0.5;
      var imgY = band.y + 8;
      if (on) {
        ctx.fillStyle = LAMP;
        ctx.fillRect(px, band.y, pw, 3);
      }
      ctx.globalAlpha = here ? 1 : 0.38;
      ctx.fillStyle = "#14110e";
      ctx.fillRect(px, imgY, pw, ph);
      blitContain(ctx, who, px, imgY, pw, ph);
      ctx.globalAlpha = 1;
      if (here) {
        ctx.fillStyle = LAMP;
        ctx.beginPath();
        ctx.arc(px + pw - 5, imgY + 8, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      var capFont = font(bw < 72 ? 10 : 13, false, 700, true);
      ctx.font = capFont;
      ctx.fillStyle = on ? LAMP : (here ? PAPER : "#8a8178");
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(clipText(ctx, capFont, personCaption(game, who, ui), bw - 4), bx + bw * 0.5, imgY + ph + 26);
      if (ui) pushHit(ui, "look:" + who, bx, band.y, bw, ph + 40);
    }
    ctx.restore();
  }

  function drawDarkKeypad(flow, ui) {
    var w = Math.min(280, flow.w);
    var bh = 30;
    var gap = 6;
    var r = row(flow, 24 + 4 * (bh + gap) + 36);
    if (!r.on) return;
    var ctx = flow.ctx;
    var x = flow.x;
    var y = r.y;
    var keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "<"];
    var bw = (w - gap * 2) / 3;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.font = font(14, false, 700, true);
    ctx.fillStyle = PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Offer  " + (ui.offer ? S.money(Number(ui.offer)) : "$—"), x, y + 10);
    var i;
    for (i = 0; i < keys.length; i++) {
      var col = i % 3;
      var line = (i / 3) | 0;
      var id = keys[i] === "C" ? "dc" : (keys[i] === "<" ? "db" : "d" + keys[i]);
      var kx = x + col * (bw + gap);
      var ky = y + 22 + line * (bh + gap);
      ctx.fillStyle = ui.hover === id ? "rgba(240,195,106,0.22)" : "rgba(20,16,14,0.55)";
      ctx.fillRect(kx, ky, bw, bh);
      ctx.font = font(15, false, 700, true);
      ctx.fillStyle = PAPER;
      ctx.textAlign = "center";
      ctx.fillText(keys[i], kx + bw * 0.5, ky + bh * 0.5);
      pushHit(ui, id, kx, ky, bw, bh);
    }
    var oy = y + 22 + 4 * (bh + gap);
    ctx.fillStyle = LAMP;
    ctx.fillRect(x, oy, w, 30);
    ctx.fillStyle = INK;
    ctx.font = font(14, false, 700, true);
    ctx.fillText("Make the offer", x + w * 0.5, oy + 15);
    pushHit(ui, "dok", x, oy, w, 30);
    ctx.restore();
  }

  function nextShelfBuy(game) {
    var best = null;
    var locked = null;
    var i;
    for (i = 0; i < D.ITEMS.length; i++) {
      var item = D.ITEMS[i];
      if ((game.mats[item.id] || 0) > 0) continue;
      var cost = S.marketCost(game, item);
      var open = (game.player.level || 1) >= item.level;
      if (open) {
        if (!best || cost < best.cost) best = { item: item, cost: cost, locked: false };
      } else if (!locked || item.level < locked.item.level || (item.level === locked.item.level && cost < locked.cost)) {
        locked = { item: item, cost: cost, locked: true };
      }
    }
    return best || locked;
  }

  function drawNextBuy(flow, game, ui, nxt) {
    if (!nxt) {
      darkNote(flow, "Nothing left to buy.");
      return;
    }
    var r = row(flow, 78);
    if (!r.on) return;
    var ctx = flow.ctx;
    var side = 64;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(20,16,14,0.5)";
    ctx.fillRect(flow.x, r.y, flow.w, 70);
    ctx.fillStyle = LAMP;
    ctx.fillRect(flow.x, r.y, 3, 70);
    ctx.fillStyle = "#14110e";
    ctx.fillRect(flow.x + 14, r.y + 4, side, side);
    if (!blitContain(ctx, itemArt(nxt.item.cat), flow.x + 18, r.y + 8, side - 8, side - 8)) {
      ctx.fillStyle = "#2a2018";
      ctx.fillRect(flow.x + 22, r.y + 12, side - 16, side - 16);
    }
    var nameFont = font(16, false, 700, true);
    ctx.font = nameFont;
    ctx.fillStyle = PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, nameFont, nxt.item.name, flow.w - side - 40), flow.x + side + 26, r.y + 24);
    ctx.font = font(14, false, 700, true);
    ctx.fillStyle = LAMP;
    ctx.fillText(nxt.locked ? "Locked" : S.money(nxt.cost), flow.x + side + 26, r.y + 46);
    ctx.restore();
    if (!nxt.locked && ui) pushHit(ui, "buy:" + nxt.item.id, flow.x, r.y, flow.w, 70);
  }

  function drawShelfBoard(flow, game, ui) {
    var items = [];
    var i;
    for (i = 0; i < D.ITEMS.length; i++) {
      if ((game.mats[D.ITEMS[i].id] || 0) > 0) items.push(D.ITEMS[i]);
    }
    if (!items.length) {
      darkNote(flow, "The shelf is empty.");
      return;
    }
    var cols = Math.max(3, Math.min(6, Math.floor(flow.w / 86) || 1));
    var gap = 8;
    var cell = (flow.w - gap * (cols - 1)) / cols;
    var iconH = Math.min(58, Math.max(36, cell * 0.62));
    var rh = iconH + 22;
    var rowCount = Math.ceil(items.length / cols);
    var rIndex;
    for (rIndex = 0; rIndex < rowCount; rIndex++) {
      var block = row(flow, rh);
      if (!block.on) continue;
      var ctx = flow.ctx;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#3a2a22";
      ctx.fillRect(flow.x, block.y + iconH - 5, flow.w, 6);
      var c;
      for (c = 0; c < cols; c++) {
        var idx = rIndex * cols + c;
        if (idx >= items.length) break;
        var item = items[idx];
        var owned = game.mats[item.id] || 0;
        var ix = flow.x + c * (cell + gap);
        if (!blitContain(ctx, itemArt(item.cat), ix + 4, block.y, cell - 8, iconH - 10)) {
          ctx.fillStyle = "#241c16";
          ctx.fillRect(ix + 8, block.y + 4, cell - 16, iconH - 16);
        }
        var nameFont = font(11, false, 700, true);
        ctx.font = nameFont;
        ctx.fillStyle = PAPER;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(clipText(ctx, nameFont, item.fragment + "  " + owned, cell - 2), ix + cell * 0.5, block.y + iconH + 2);
        if (ui) pushHit(ui, "buy:" + item.id, ix, block.y, cell, rh - 2);
      }
      ctx.restore();
    }
  }

  function drawBuyChips(flow, game, ui, skipId) {
    var list = [];
    var chipFont = font(12, false, 600, true);
    var i;
    for (i = 0; i < D.ITEMS.length; i++) {
      var item = D.ITEMS[i];
      if ((game.mats[item.id] || 0) > 0) continue;
      if (skipId && item.id === skipId) continue;
      if ((game.player.level || 1) < item.level) continue;
      var label = item.fragment + "  " + S.money(S.marketCost(game, item));
      var tw = Math.min(flow.w, measure(flow.ctx, chipFont, label) + 16);
      list.push({ item: item, label: label, tw: tw });
    }
    if (!list.length) return;
    darkKicker(flow, "Still out");
    var lines = [];
    var cur = [];
    var curW = 0;
    for (i = 0; i < list.length; i++) {
      var chip = list[i];
      var add = chip.tw + (cur.length ? 6 : 0);
      if (cur.length && curW + add > flow.w) {
        lines.push(cur);
        cur = [chip];
        curW = chip.tw;
      } else {
        cur.push(chip);
        curW += add;
      }
    }
    if (cur.length) lines.push(cur);
    var li;
    for (li = 0; li < lines.length; li++) {
      var r = row(flow, 28);
      if (!r.on) continue;
      var ctx = flow.ctx;
      var x = flow.x;
      var ci;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.font = chipFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (ci = 0; ci < lines[li].length; ci++) {
        var c = lines[li][ci];
        var hot = ui && ui.hover === "buy:" + c.item.id;
        ctx.fillStyle = hot ? "rgba(240,195,106,0.16)" : "rgba(20,16,14,0.45)";
        ctx.fillRect(x, r.y, c.tw, 24);
        ctx.fillStyle = PAPER;
        ctx.fillText(c.label, x + c.tw * 0.5, r.y + 12);
        if (ui) pushHit(ui, "buy:" + c.item.id, x, r.y, c.tw, 24);
        x += c.tw + 6;
      }
      ctx.restore();
    }
  }

  function drawMixRow(flow, game, ui) {
    var cats = [["idea", "Idea"], ["staff", "Staff"], ["marketing", "Marketing"], ["asset", "Asset"]];
    var r = row(flow, 36);
    if (r.on && ui) {
      var ctx = flow.ctx;
      var gap = 6;
      var bw = (flow.w - gap * 3) / 4;
      var i;
      ctx.save();
      ctx.shadowBlur = 0;
      for (i = 0; i < cats.length; i++) {
        var id = "pick:" + cats[i][0];
        var picked = ui.synth && ui.synth[cats[i][0]];
        var item = picked ? D.itemById[picked] : null;
        var x = flow.x + i * (bw + gap);
        var on = ui.pick === cats[i][0];
        ctx.fillStyle = on ? "rgba(240,195,106,0.2)" : "rgba(20,16,14,0.5)";
        ctx.fillRect(x, r.y, bw, 30);
        if (on) {
          ctx.fillStyle = LAMP;
          ctx.fillRect(x, r.y, bw, 2);
        }
        var f = font(bw < 70 ? 11 : 13, false, 700, true);
        ctx.font = f;
        ctx.fillStyle = PAPER;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(clipText(ctx, f, item ? item.fragment : cats[i][1], bw - 8), x + bw * 0.5, r.y + 16);
        pushHit(ui, id, x, r.y, bw, 30);
      }
      ctx.restore();
    }
    darkLine(flow, "synth", "Mix it", "", false);
    darkLine(flow, "research", "Research", "1 VP", (game.player.vp || 0) < 1);
    if (ui && ui.pick) {
      var any = false;
      var k;
      for (k = 0; k < D.ITEMS.length; k++) {
        var mat = D.ITEMS[k];
        var count = game.mats[mat.id] || 0;
        if (count <= 0 || mat.cat !== ui.pick) continue;
        any = true;
        darkLine(flow, "use:" + ui.pick + ":" + mat.id, mat.name + "  ×" + count, "", false);
      }
      if (!any) darkNote(flow, "You don't own any of these.");
    }
  }

  function drawNavTab(ctx, ui, id, x, y, w, h, label, on, mark, clock) {
    if (!id || w < 8 || h < 8) return;
    var sink = pressSink(ui, id);
    var cx = x + w * 0.5;
    var wordY = y + h * 0.62 + sink;
    ctx.save();
    ctx.shadowBlur = 0;
    if (clock != null) miniHand(ctx, cx, y + h * 0.3 + sink, 9, clock);
    else if (mark) icon(ctx, mark, cx, y + h * 0.28 + sink, Math.min(16, h * 0.34), on ? LAMP : "#8a8178");
    var f = textFace(13, on ? "title" : "body");
    ctx.font = f;
    ctx.fillStyle = on ? LAMP : "#8a8178";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, f, label || "", w - 8), cx, wordY);
    if (on) {
      var tw = Math.min(w - 16, measure(ctx, f, label || ""));
      ctx.fillStyle = LAMP;
      ctx.fillRect(cx - tw * 0.5, wordY + 10, tw, 2);
    }
    ctx.restore();
    pushHit(ui, id, x, y, w, h);
  }


  function drawTabGround(ctx, game, ui, L, which) {
    var y = L.header;
    var h = L.tabY - y;
    if (h < 40) return;
    ctx.save();
    ctx.shadowBlur = 0;
    var body = { x: 8, y: y + 8, w: L.w - 16, h: h - 16 };
    ui.clip = body;
    buttonTone = "dark";
    var flow = openFlow(ctx, ui, body, ui.scroll || 0);
    if (which === "job") drawOccupation(flow, game, ui);
    else if (which === "edu") drawEducation(flow, game, ui);
    else if (which === "scout") drawScouts(flow, game);
    else if (which === "lab") drawLab(flow, game, ui);
    else if (which === "settings") drawSettings(flow, game, ui);
    else if (which === "journal") drawJournal(flow, game, ui);
    ui.contentH = flow.cy + 16;
    ctx.restore();
    ctx.restore();
    ui.clip = null;
    var max = (ui.contentH || 0) - body.h;
    if (max < 0) max = 0;
    if (ui.scroll < 0) ui.scroll = 0;
    if (ui.scroll > max) ui.scroll = max;
    paintScrollFade(ctx, body, ui);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    buttonTone = "";
  }



  function drawScoutLines(flow, game) {
    var locked = !(game.nodes && game.nodes.charter);
    var i;
    if (!game.nodes || !game.nodes.charter) darkNote(flow, "Scout Charter is still locked.");
    for (i = 0; i < D.SCOUTS.length; i++) {
      var scout = D.SCOUTS[i];
      darkLine(flow, locked ? "" : ("scout:" + scout.id), scout.name, S.money(scout.cost), locked);
    }
    if (!game.scouts || !game.scouts.length) darkNote(flow, "Nobody's out.");
    for (i = 0; i < (game.scouts || []).length; i++) {
      var mission = game.scouts[i];
      var def = D.scoutById[mission.id];
      darkNote(flow, (def ? def.name : mission.id) + "  ·  " + S.fmtMs(mission.left));
    }
  }

  function drawShopStill(flow, game, now) {
    var w = Math.min(flow.w, 320);
    var h = Math.round(w * 9 / 16);
    var r = row(flow, h + 6);
    if (!r.on) return;
    var phase = S.phaseAt(now || Date.now());
    var open = !!(game.flags && game.flags.opened) && !doorClosed(game);
    var key = "shopClosed";
    if (open && phase.id === "morning") key = "shopMorning";
    else if (open && phase.id === "lunch") key = "shopNoon";
    else if (open && phase.id === "evening") key = "shopEvening";
    else if (open && phase.id === "night") key = "shopNight";
    else if (open) key = "shopNoon";
    var x = flow.x + Math.round((flow.w - w) * 0.5);
    var ctx = flow.ctx;
    ctx.save();
    ctx.shadowBlur = 0;
    if (!blitCover(ctx, key, x, r.y, w, h, 0.35, 0.36)) {
      ctx.fillStyle = "#241c16";
      ctx.fillRect(x, r.y, w, h);
    }
    ctx.strokeStyle = "rgba(239,230,212,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, r.y + 0.5, w - 1, h - 1);
    ctx.restore();
  }

  function drawBackRoom(flow, game, ui) {
    var shadyOpen = !!(game.flags && game.flags.shady);
    darkKicker(flow, "The back room");
    darkNote(flow, "You have " + ((game.player && game.player.vp) || 0) + ".");
    var lineName = "";
    var lineLabel = { visibility: "Clout", tech: "Machines", shady: "Shady" };
    var hinted = false;
    var i;
    for (i = 0; i < D.NODES.length; i++) {
      var node = D.NODES[i];
      if (node.line !== lineName) {
        lineName = node.line;
        darkKicker(flow, lineLabel[lineName] || lineName);
      }
      var owned = !!(game.nodes && game.nodes[node.id]);
      var faceDown = node.line === "shady" && !shadyOpen;
      darkLine(flow, "node:" + node.id, faceDown ? "Face down" : node.name, owned ? "Open" : (node.cost + " VP"), owned);
      if (!hinted && !owned && !faceDown && node.text) {
        darkNote(flow, node.text);
        hinted = true;
      }
    }
    if (game.nodes && game.nodes.skim) darkLine(flow, "skim", "Skim", "", false);
    if (game.nodes && game.nodes.score) darkLine(flow, "score", "Big score", "", false);
    if (shadyOpen) darkNote(flow, "Heat is " + Math.round((game.player && game.player.heat) || 0) + ".");
    darkKicker(flow, "Mix");
    drawMixRow(flow, game, ui);
    darkLine(flow, "hdr:journal", "The book", "", false);
  }

  function capFlow(flow) {
    var max = 560;
    if (flow.w > max) {
      var extra = flow.w - max;
      flow.x += Math.round(extra * 0.5);
      flow.w = max;
    }
  }

  function roomPartsOwned(place) {
    var keys = ["lights", "sign", "counter", "cooler", "safe", "speaker", "plant", "neon"];
    var i;
    for (i = 0; i < keys.length; i++) if (!place[keys[i]]) return false;
    return true;
  }

  function nextTreeNode(game) {
    var shady = !!(game.flags && game.flags.shady);
    var i;
    for (i = 0; i < D.NODES.length; i++) {
      var node = D.NODES[i];
      if (game.nodes && game.nodes[node.id]) continue;
      if (node.line === "shady" && !shady) continue;
      if (node.requires && !(game.nodes && game.nodes[node.requires])) continue;
      return node;
    }
    return null;
  }

  function nextJobOffer(game, slot) {
    var locked = null;
    var i;
    for (i = 0; i < D.JOBS.length; i++) {
      var spec = D.JOBS[i];
      if (!slot || slot.jobId === spec.id) continue;
      if (S.jobUnlocked(game, spec)) return { spec: spec, open: true };
      if (!locked) locked = spec;
    }
    return locked ? { spec: locked, open: false } : null;
  }

  function nameCycleId(slot, focus) {
    var names = ["The Corner"].concat(D.SHOPS || []);
    var at = names.indexOf(slot && slot.name);
    if (at < 0) at = 0;
    return "name:" + focus + ":" + ((at + 1) % names.length);
  }

  function paintStripCell(ctx, ui, y, x, w, h, id, title, meta, dim, allow) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#14110e";
    ctx.fillRect(x, y, w, h);
    var titleFace = textFace(15, "title");
    var lines = wrapLines(ctx, titleFace, title || "", Math.max(40, w - 12), 2);
    ctx.font = titleFace;
    ctx.fillStyle = PAPER;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(lines[0] || "", x + w * 0.5, y + (meta ? 26 : h * 0.5));
    if (lines[1] && !meta) ctx.fillText(lines[1], x + w * 0.5, y + 46);
    if (meta) {
      var metaFace = textFace(15, "num");
      ctx.font = metaFace;
      ctx.fillStyle = dim ? "#6e665c" : LAMP;
      ctx.fillText(clipText(ctx, metaFace, meta, Math.max(20, w - 12)), x + w * 0.5, y + h - 18);
    }
    ctx.restore();
    if (id && ui && allow !== false) pushHit(ui, id, x, y, w, h);
  }

  function drawShopRoster(flow, game, ui, focus) {
    var slots = game.slots || [];
    var locked = (S.slotCap ? S.slotCap(game) : 1) < 2;
    var n = slots.length + (locked ? 1 : 0);
    if (!n) return;
    var gap = 8;
    var cell = Math.min(150, (flow.w - gap * (n - 1)) / n);
    var rowW = cell * n + gap * (n - 1);
    var x0 = flow.x + Math.max(0, (flow.w - rowW) * 0.5);
    var photoH = Math.max(52, Math.round(cell * 9 / 16));
    var r = row(flow, photoH + 28);
    if (!r.on) return;
    var ctx = flow.ctx;
    var now = (ui && (ui.presentAt || ui.now)) || Date.now();
    var key = shopArtNow(game, now, null);
    var i;
    ctx.save();
    ctx.shadowBlur = 0;
    for (i = 0; i < slots.length; i++) {
      var x = x0 + i * (cell + gap);
      paintShopCard(ctx, game, key, x, r.y, cell, photoH, { camera: !!slots[i].camera });
      if (i === focus) {
        ctx.fillStyle = LAMP;
        ctx.fillRect(x, r.y + photoH + 4, cell, 2);
      }
      var nameFace = textFace(15, "title");
      ctx.font = nameFace;
      ctx.fillStyle = i === focus ? PAPER : "#8a8178";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(clipText(ctx, nameFace, slots[i].name || ("Shop " + (i + 1)), cell - 4), x + cell * 0.5, r.y + photoH + 8);
      if (ui) pushHit(ui, "focus:" + i, x, r.y, cell, photoH + 26);
    }
    if (locked) {
      var lx = x0 + slots.length * (cell + gap);
      var cost = D.degreeById && D.degreeById.bach ? D.degreeById.bach.cost : 0;
      paintEmptyFrame(ctx, lx, r.y, cell, photoH, cost);
      ctx.font = textFace(15, "body");
      ctx.fillStyle = "#8a8178";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("Second", lx + cell * 0.5, r.y + photoH + 8);
    }
    ctx.restore();
  }

  function drawShopHero(flow, game, ui, slot, focus, now) {
    var place = (game.player && game.player.place) || {};
    var key = shopArtNow(game, now, null);
    var ph = Math.round(Math.min(200, Math.max(128, flow.w * 9 / 16)));
    var r = row(flow, ph + 8);
    if (!r.on) return;
    var ctx = flow.ctx;
    var name = slot.name || "The Corner";
    var sub = "";
    var dimSub = false;
    var cap = (game.player && game.player.capital) || 0;
    if (!place.owned) {
      sub = "Rent  " + S.money(D.ROOM.rent);
      dimSub = cap < D.ROOM.rent;
    } else if (game.world && game.world.floor) sub = "The floor";
    else if (roomPartsOwned(place)) {
      sub = "Floor  " + S.money(D.ROOM.floor);
      dimSub = cap < D.ROOM.floor;
    }
    paintShopCard(ctx, game, key, flow.x, r.y, flow.w, ph, {
      camera: !!slot.camera,
      name: name,
      sub: sub,
      dimSub: dimSub
    });
    if (!ui) return;
    if (!place.owned) pushHit(ui, "room", flow.x, r.y, flow.w, ph);
    else {
      pushHit(ui, nameCycleId(slot, focus), flow.x, r.y + ph - 46, Math.round(flow.w * 0.62), 46);
      if (!game.world.floor && roomPartsOwned(place)) pushHit(ui, "floor", flow.x + Math.round(flow.w * 0.62), r.y + ph - 46, flow.w - Math.round(flow.w * 0.62), 46);
    }
    if (!slot.camera && game.nodes && game.nodes.camera) {
      var price = S.money(D.CAM_COST);
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = cap < D.CAM_COST ? 0.4 : 1;
      ctx.font = textFace(15, "num");
      ctx.fillStyle = LAMP;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(price, flow.x + flow.w - 10, r.y + 30);
      ctx.restore();
      pushHit(ui, "cam:" + focus, flow.x + flow.w - 88, r.y + 8, 80, 40);
    }
  }

  function drawRoomGrid(flow, game, ui, place) {
    var parts = [
      ["lights", "Lights", "bulb"],
      ["sign", "Sign", ""],
      ["counter", "Counter", ""],
      ["cooler", "Cooler", "cooler"],
      ["safe", "Safe", "safe"],
      ["speaker", "Speaker", "speaker"],
      ["plant", "Plant", "plant"],
      ["neon", "Neon", ""]
    ];
    var next = -1;
    var i;
    if (place.owned) {
      for (i = 0; i < parts.length; i++) if (!place[parts[i][0]]) { next = i; break; }
    }
    var cols = 4;
    var gap = 8;
    var cellW = (flow.w - gap * (cols - 1)) / cols;
    var cellH = 86;
    var r = row(flow, cellH * 2 + gap);
    if (!r.on) return;
    var ctx = flow.ctx;
    var cap = (game.player && game.player.capital) || 0;
    ctx.save();
    ctx.shadowBlur = 0;
    for (i = 0; i < parts.length; i++) {
      var col = i % cols;
      var rowi = (i / cols) | 0;
      var x = flow.x + col * (cellW + gap);
      var y = r.y + rowi * (cellH + gap);
      var owned = !!place[parts[i][0]];
      var isNext = i === next;
      ctx.save();
      ctx.globalAlpha = (owned || isNext) ? 1 : 0.32;
      ctx.fillStyle = owned ? "#2a241c" : "#14110e";
      ctx.fillRect(x, y, cellW, cellH);
      if (owned) {
        ctx.fillStyle = LAMP;
        ctx.fillRect(x, y, cellW, 3);
      }
      var art = parts[i][2];
      if (art) {
        if (!blitCover(ctx, art, x + 6, y + 8, Math.max(8, cellW - 12), 34, 0.5, 0.45)) {
          ctx.fillStyle = "#14110e";
          ctx.fillRect(x + 6, y + 8, Math.max(8, cellW - 12), 34);
        }
      } else if (parts[i][0] === "sign") {
        ctx.fillStyle = owned ? LAMP : "#3a342c";
        ctx.fillRect(x + 8, y + 18, Math.max(8, cellW - 16), 10);
      } else if (parts[i][0] === "counter") {
        ctx.fillStyle = owned ? PAPER : "#3a342c";
        ctx.fillRect(x + 8, y + 26, Math.max(8, cellW - 16), 7);
      } else {
        ctx.fillStyle = owned ? VIOLET : "#3a342c";
        ctx.fillRect(x + 8, y + 20, Math.max(8, cellW - 16), 6);
      }
      var nameFace = textFace(15, "title");
      ctx.font = nameFace;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (isNext) {
        var cost = D.ROOM[parts[i][0]] || 0;
        var afford = cap >= cost;
        ctx.fillStyle = PAPER;
        ctx.fillText(clipText(ctx, nameFace, parts[i][1], cellW - 4), x + cellW * 0.5, y + cellH - 28);
        ctx.font = textFace(15, "num");
        ctx.fillStyle = afford ? LAMP : "#6e665c";
        ctx.fillText(S.money(cost), x + cellW * 0.5, y + cellH - 12);
      } else {
        ctx.fillStyle = owned ? PAPER : "#8a8178";
        ctx.fillText(clipText(ctx, nameFace, parts[i][1], cellW - 4), x + cellW * 0.5, y + cellH - 14);
      }
      ctx.restore();
      if (isNext && ui) pushHit(ui, "upgrade:" + parts[i][0], x, y, cellW, cellH);
    }
    ctx.restore();
  }

  function drawShopStrip(flow, game, ui, slot, focus) {
    var gap = 8;
    var bw = (flow.w - gap * 2) / 3;
    var h = 84;
    var r = row(flow, h);
    if (!r.on) return;
    var ctx = flow.ctx;
    var cap = (game.player && game.player.capital) || 0;
    var stock = slot.stock || 0;
    var limit = S.stockCap(game);
    var buyN = D.STOCK_PACK;
    var room = limit - stock;
    if (buyN > room) buyN = room;
    var cost = buyN * D.STOCK_PRICE;
    var stockMeta = buyN > 0 ? S.money(cost) : "Full";
    paintStripCell(ctx, ui, r.y, flow.x, bw, h, buyN > 0 ? ("stock:" + focus) : "", "Stock " + stock + "/" + limit, stockMeta, buyN > 0 && cap < cost, buyN > 0);

    var hx = flow.x + bw + gap;
    if (slot.employee) {
      var emp = slot.employee;
      paintStripCell(ctx, ui, r.y, hx, bw, h, "fire:" + focus, emp.name, emp.caught ? "Busted" : S.money(emp.salary), !!emp.caught, true);
    } else paintStripCell(ctx, ui, r.y, hx, bw, h, "applicants", "Hire", "Find someone", false, true);

    var job = D.jobById[slot.jobId];
    var offer = nextJobOffer(game, slot);
    var jx = flow.x + (bw + gap) * 2;
    var jobMeta = "This job";
    var jobId = "";
    var jobDim = false;
    if (offer && offer.open) {
      jobMeta = offer.spec.name;
      jobId = "apply:" + focus + ":" + offer.spec.id;
    } else if (offer) {
      jobMeta = jobNeed(offer.spec);
      jobDim = true;
    }
    paintStripCell(ctx, ui, r.y, jx, bw, h, jobId, job ? job.name : "Job", jobMeta, jobDim, !!jobId);
  }

  function drawRegisterStrip(flow, game) {
    var who = S.registerWatch ? S.registerWatch(game) : { id: "you", name: "You" };
    var line = "Register  ·  " + who.name;
    if (who.id === "nobody" && game.flags && game.flags.opened && !doorClosed(game)) line = "Register  ·  Nobody. The register is empty.";
    darkNote(flow, line);
  }

  function drawNamePicks(flow, game, ui, slot, focus) {
    var names = ["The Corner"].concat(D.SHOPS || []);
    var gap = 6;
    var n = names.length;
    var bw = (flow.w - gap * (n - 1)) / n;
    var h = 56;
    var r = row(flow, h);
    if (r.on) {
      var i;
      var ctx = flow.ctx;
      for (i = 0; i < n; i++) {
        var x = flow.x + i * (bw + gap);
        var on = slot && slot.name === names[i];
        paintStripCell(ctx, ui, r.y, x, bw, h, "name:" + focus + ":" + i, names[i], "", false, true);
        if (on) {
          ctx.save();
          ctx.shadowBlur = 0;
          ctx.fillStyle = LAMP;
          ctx.fillRect(x, r.y + h - 3, bw, 3);
          ctx.restore();
        }
      }
    }
    var field = row(flow, 48);
    if (!field.on) return;
    var typing = !!(ui && ui.naming);
    var buf = typing ? String((ui && ui.nameBuf) || "") : "";
    var label = typing ? ((buf || "Type a name") + (buf ? "" : "")) : ("Name  " + ((slot && slot.name) || ""));
    if (typing && buf) label = buf;
    paintStripCell(flow.ctx, ui, field.y, flow.x, flow.w, 48, "name:type", label, "", false, true);
  }

  function drawDoorRow(flow, game, ui) {
    var gap = 8;
    var bw = (flow.w - gap) / 2;
    var h = 48;
    var r = row(flow, h);
    if (!r.on) return;
    var shut = doorClosed(game);
    var ctx = flow.ctx;
    paintStripCell(ctx, ui, r.y, flow.x, bw, h, "door:open", "Open", "", false, true);
    paintStripCell(ctx, ui, r.y, flow.x + bw + gap, bw, h, "door:close", "Close", "", false, true);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = LAMP;
    if (!shut) ctx.fillRect(flow.x, r.y + h - 3, bw, 3);
    else ctx.fillRect(flow.x + bw + gap, r.y + h - 3, bw, 3);
    ctx.restore();
  }

  function drawOccupation(flow, game, ui) {
    capFlow(flow);
    var now = (ui && ui.now) || game.lastReal || Date.now();
    var slots = game.slots || [];
    var focus = ui && ui.focusSlot != null ? ui.focusSlot : 0;
    if (!slots[focus]) focus = 0;
    var slot = slots[focus] || null;
    var place = (game.player && game.player.place) || {};
    darkLine(flow, "close", "Back", "", false);
    drawShopRoster(flow, game, ui, focus);
    if (!slot) {
      darkNote(flow, "No shop on the books.");
      return;
    }
    drawShopHero(flow, game, ui, slot, focus, (ui && ui.presentAt) || now);
    drawRegisterStrip(flow, game);
    drawNamePicks(flow, game, ui, slot, focus);
    drawDoorRow(flow, game, ui);
    drawRoomGrid(flow, game, ui, place);
    drawShopStrip(flow, game, ui, slot, focus);
    var node = nextTreeNode(game);
    if (node) {
      var afford = (game.player.vp || 0) >= node.cost;
      darkLine(flow, "node:" + node.id, node.name, node.cost + " VP", !afford);
    }
    row(flow, 16);
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
    capFlow(flow);
    darkLine(flow, "close", "Back", "", false);
    drawSchoolClock(flow, game, ui);
    var next = nextDegree(game);
    if (next) {
      var afford = (game.player.capital || 0) >= next.cost;
      var locked = (game.player.level || 1) < next.level;
      darkLine(flow, locked ? "" : ("deg:" + next.id), next.name, locked ? ("Year " + next.level) : S.money(next.cost), locked || !afford);
      return;
    }
    var hobby = null;
    var i;
    for (i = 0; i < D.HOBBIES.length; i++) {
      var item = D.HOBBIES[i];
      if (!(item.need > 0)) continue;
      if (!S.hobbyOpen(game, item)) { hobby = item; break; }
    }
    if (hobby) {
      darkLine(flow, "", hobby.name, (hobby.needSkill || hobby.skill) + " " + hobby.need, true);
      return;
    }
    var classCost = 10;
    darkLine(flow, "class", "Night class", S.money(classCost), (game.player.capital || 0) < classCost);
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
    var shadyOpen = !!(game.flags && game.flags.shady);
    darkTitle(flow, "Stuff");
    drawOwnedShelf(flow, game, ui);
    drawShelfList(flow, game, ui);

    darkKicker(flow, "Send someone");
    if (!game.nodes || !game.nodes.charter) darkNote(flow, "Scout Charter is still locked.");
    else darkNote(flow, "They leave on the real clock. Two people out at once.");
    var i;
    for (i = 0; i < D.SCOUTS.length; i++) {
      var scout = D.SCOUTS[i];
      var locked = !(game.nodes && game.nodes.charter);
      darkLine(flow, locked ? "" : ("scout:" + scout.id), scout.name, S.money(scout.cost), locked);
    }
    if (!game.scouts || !game.scouts.length) darkNote(flow, "Nobody's out.");
    for (i = 0; i < (game.scouts || []).length; i++) {
      var mission = game.scouts[i];
      var def = D.scoutById[mission.id];
      var pct = mission.total ? (1 - mission.left / mission.total) : 0;
      darkNote(flow, (def ? def.name : mission.id) + "  ·  " + S.fmtMs(mission.left) + "  ·  " + Math.round(pct * 100) + "%");
    }

    darkKicker(flow, "The tree");
    darkNote(flow, "You have " + (game.player.vp || 0) + ".");
    var lineName = "";
    var lineLabel = { visibility: "Clout", tech: "Machines", shady: "Shady" };
    var hinted = false;
    for (i = 0; i < D.NODES.length; i++) {
      var node = D.NODES[i];
      if (node.line !== lineName) {
        lineName = node.line;
        darkKicker(flow, lineLabel[lineName] || lineName);
      }
      var owned = !!(game.nodes && game.nodes[node.id]);
      var faceDown = node.line === "shady" && !shadyOpen;
      darkLine(flow, "node:" + node.id, faceDown ? "Face down" : node.name, owned ? "Open" : (node.cost + " VP"), owned);
      if (!hinted && !owned && !faceDown && node.text) {
        darkNote(flow, node.text);
        hinted = true;
      }
    }
    if (game.nodes && game.nodes.skim) darkLine(flow, "skim", "Skim", "", false);
    if (game.nodes && game.nodes.score) darkLine(flow, "score", "Big score", "", false);
    if (game.flags && game.flags.shady) darkNote(flow, "Heat is " + Math.round(game.player.heat || 0) + ".");

    darkKicker(flow, "Mix");
    drawMixRow(flow, game, ui);
    if (game.crafted && game.crafted.length) {
      darkKicker(flow, "Mixed");
      for (i = 0; i < game.crafted.length; i++) {
        var crafted = game.crafted[i];
        var tag = crafted.legendary ? "Legendary" : "Hybrid";
        darkNote(flow, tag + "  ·  " + crafted.name);
      }
    }
    darkLine(flow, "hdr:journal", "The book", "", false);
    darkNote(flow, "Cameras bolt onto a shop after Camera Schematic. Cost " + S.money(D.CAM_COST) + ".");
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
    var r = row(flow, 214);
    if (!r.on) return;
    var ctx = flow.ctx;
    var gap = 8;
    var bw = (flow.w - gap * 3) / 4;
    var ph = 156;
    var i;
    ctx.save();
    ctx.shadowBlur = 0;
    for (i = 0; i < 4; i++) {
      var bx = flow.x + i * (bw + gap);
      var pw = Math.min(bw - 16, Math.round(ph * 0.46));
      var px = bx + (bw - pw) * 0.5;
      ctx.fillStyle = "#1c1612";
      ctx.fillRect(px, r.y, pw, ph);
      if (!blitContain(ctx, who[i], px, r.y, pw, ph)) {
        ctx.fillStyle = PAPER;
        ctx.fillRect(px, r.y, pw, ph);
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.strokeRect(px, r.y, pw, ph);
      ctx.font = font(15, false, 500, true);
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      var line = personWant(game, who[i]);
      var bits = wrapLines(ctx, font(15, false, 500, true), line, bw - 8, 2);
      ctx.fillText(bits[0] || "", bx + bw * 0.5, r.y + ph + 8);
      if (bits[1]) ctx.fillText(bits[1], bx + bw * 0.5, r.y + ph + 26);
      if (flow.ui) pushHit(flow.ui, "look:" + who[i], bx, r.y, bw, ph + 48);
    }
    ctx.restore();
    ctx.textAlign = "left";
  }

  function spokeWho(game) {
    var id = S.currentLifeId ? (S.currentLifeId(game, game.lastReal || Date.now()) || "") : "";
    if (id === "regular" || id === "sera_dark") return "sera";
    if (id === "landlord") return "landlord";
    if (id === "rival" || id === "rival_flip") return "juniper";
    var n = game.logN || 0;
    var i;
    for (i = n - 1; i >= 0 && i >= n - 6; i--) {
      var raw = String(S.logLine(game, i) || "").toLowerCase();
      if (raw.indexOf("landlord") >= 0 || raw.indexOf("rent is") >= 0) return "landlord";
      if (raw.indexOf("juniper") >= 0 || raw.indexOf("rival") >= 0) return "juniper";
      if (raw.indexOf("sera") >= 0 || raw.indexOf("regular") >= 0) return "sera";
      if (raw.indexOf("busted") >= 0 || raw.indexOf("register") >= 0) return "hire";
    }
    var w = game.world || {};
    if (w.rentDue > 0) return "landlord";
    if (w.regular && w.regularDue) return "sera";
    if (w.rival && !w.truce) return "juniper";
    var slots = game.slots || [];
    for (i = 0; i < slots.length; i++) if (slots[i].employee) return "hire";
    if ((game.resumes || []).length) return "hire";
    return "";
  }

  function peopleFact(game, who) {
    var w = game.world || {};
    if (who === "sera" && w.regular) {
      return (w.regular.name || "Sera") + "  ·  mood " + (w.regular.mood == null ? 0 : w.regular.mood) + "  ·  visits " + (w.regular.visits || 0);
    }
    if (who === "landlord") {
      if ((w.behind || 0) > 0 && w.rentDue > 0) return "Rent is " + w.behind + " behind. Rent is " + S.money(w.rentDue) + ".";
      if (w.rentDue > 0) return "Rent is " + S.money(w.rentDue) + ".";
      return "The building is quiet.";
    }
    if (who === "juniper") {
      if (w.thin && w.thin.line) return w.thin.line;
      if (w.rival) return w.rival + (w.truce ? ". The truce is holding." : " is across the street.");
    }
    if (who === "hire") {
      var emp = null;
      var slots = game.slots || [];
      var i;
      for (i = 0; i < slots.length; i++) if (slots[i].employee) { emp = slots[i].employee; break; }
      if (emp && emp.caught) return "You're being held.";
      if (emp) return emp.name + "  ·  " + S.money(emp.salary);
    }
    return "Nobody is at the counter.";
  }

  function drawFaceLine(flow, text, lamp) {
    var face = textFace(15, "body");
    var lines = wrapLines(flow.ctx, face, text || "", flow.w, 3);
    var i;
    for (i = 0; i < lines.length; i++) {
      var r = row(flow, 22);
      if (!r.on) continue;
      var ctx = flow.ctx;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.font = face;
      ctx.fillStyle = lamp ? LAMP : PAPER;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(lines[i], flow.x + flow.w * 0.5, r.y + 11);
      ctx.restore();
    }
  }

  function drawScouts(flow, game) {
    var ui = flow.ui;
    capFlow(flow);
    darkLine(flow, "close", "Back", "", false);
    var cast = ["sera", "landlord", "juniper", "hire"];
    var look = ui && ui.look;
    if (!look || cast.indexOf(look) < 0) look = spokeWho(game);
    var viewH = Math.max(240, flow.bottom - flow.top);
    var ph = Math.min(400, Math.max(240, Math.floor(viewH * 0.5)));
    var pw = Math.round(ph * 318 / 1088);
    if (pw > flow.w - 8) {
      pw = flow.w - 8;
      ph = Math.round(pw * 1088 / 318);
    }
    var hireIdx = hireSlot(game, ui);
    var emp = game.slots && game.slots[hireIdx] && game.slots[hireIdx].employee;
    var busted = look === "hire" && !!(emp && emp.caught);
    if (look) {
      var hero = row(flow, ph + 8);
      if (hero.on) {
        var ctx = flow.ctx;
        var px = flow.x + (flow.w - pw) * 0.5;
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#14110e";
        ctx.fillRect(px, hero.y, pw, ph);
        paintFigure(ctx, look, px, hero.y, pw, ph, busted ? 0.4 : 1, 0);
        ctx.restore();
      }
    }
    drawFaceLine(flow, busted ? "Busted" : (look ? personCaption(game, look, ui) : "Nobody"), busted);
    var fact = look ? peopleFact(game, look) : "Nobody is at the counter.";
    if (fact) drawFaceLine(flow, fact, false);
    var choice = look ? personChoice(game, look, ui) : null;
    if (choice && choice.action) {
      var words = choice.label || "Choose";
      if (choice.price) words += "  " + choice.price;
      var lines = choiceLines(flow.ctx, words, flow.w);
      var chip = row(flow, Math.max(48, lines.h) + 8);
      if (chip.on) {
        chipControl(flow.ctx, ui, choice.disabled ? "" : choice.action, flow.x, chip.y, flow.w, Math.max(48, lines.h), lines.lines, choice.disabled ? "dim" : "lamp");
      }
    } else if (!look || !choice || !choice.action) {
      var find = choiceLines(flow.ctx, "Find people", flow.w);
      var chip2 = row(flow, find.h + 8);
      if (chip2.on && (!choice || choice.action !== "applicants")) chipControl(flow.ctx, ui, "applicants", flow.x, chip2.y, flow.w, find.h, find.lines, "lamp");
    }
    if (look === "hire" && !emp) {
      var resumes = game.resumes || [];
      if (resumes.length) {
        var card = resumes[0];
        var selected = ui && ui.selected === card.id;
        darkLine(flow, "resume:" + card.id, card.name, S.money(card.ask), (game.player.capital || 0) < (card.floor || 0));
        if (selected && !card.dying && ui) drawDarkKeypad(flow, ui);
      }
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
      flow.ctx.font = textFace(15, "title");
      flow.ctx.fillStyle = buttonTone === "dark" ? PAPER : INK;
      flow.ctx.textAlign = "left";
      flow.ctx.textBaseline = "middle";
      flow.ctx.fillText(clipText(flow.ctx, textFace(15, "title"), name, flow.w - 110), flow.x, jr.y + 14);
      flow.ctx.font = textFace(13, "body");
      flow.ctx.fillStyle = buttonTone === "dark" ? "#8a8178" : "#5c5348";
      flow.ctx.fillText(clipText(flow.ctx, font(15, false, 500, true), bits.join(" + "), flow.w - 110), flow.x, jr.y + 32);
      button(flow.ctx, ui, "craft:" + key, flow.x + flow.w - 100, jr.y + 8, 100, 28, active ? "Active" : "Craft", active, active || !have);
    }
  }

  function drawSettings(flow, game, ui) {
    darkTitle(flow, "Settings");
    var r = row(flow, 40);
    if (r.on) drawSoundSwitch(flow.ctx, ui, flow.x, r.y, flow.w, !(game.settings && game.settings.muted));
    var speed = game.settings && game.settings.clock;
    var speedLabel = speed === 0 ? "Pause" : (speed === 2 ? "2×" : "1×");
    darkLine(flow, "opt:clock", "Clock", speedLabel, false);
    darkLine(flow, "opt:fx", "Particle bursts", game.settings.highFX ? "On" : "Off", false);
    darkLine(flow, "opt:fps", "Draw cap", game.settings.fpsCap === 30 ? "30 Hz" : "60 Hz", false);
    darkLine(flow, "opt:perf", "Performance", game.settings.performanceMode ? "On" : "Off", false);
    darkNote(flow, "Performance mode and the 30 Hz cap skip the click sparks.");
    darkLine(flow, ui.resetArm ? "reset:yes" : "reset", ui.resetArm ? "Yes, wipe it" : "Reset save", "", false);
    if (ui.resetArm) darkNote(flow, "This deletes your save and keeps these settings.");
  }


  function easeToward(cur, target, dt, ms) {
    if (cur == null) return target;
    var k = 1 - Math.pow(0.001, (dt > 0 ? dt : 16) / (ms || 280));
    var n = cur + (target - cur) * k;
    if (Math.abs(n - target) < 0.004) n = target;
    return n;
  }

  function glideTo(ui, key, target, dt, ms) {
    var g = ui.glides || (ui.glides = {});
    var slot = g[key];
    if (!slot) {
      g[key] = { pos: target, from: target, to: target, t: 1 };
      return target;
    }
    if (Math.abs(slot.to - target) > 0.0008) {
      slot.from = slot.pos;
      slot.to = target;
      slot.t = 0;
    }
    if (slot.t < 1) {
      slot.t += (dt > 0 ? dt : 16) / (ms || 720);
      if (slot.t > 1) slot.t = 1;
      var u = slot.t;
      var e = u * u * (3 - 2 * u);
      slot.pos = slot.from + (slot.to - slot.from) * e;
    } else slot.pos = target;
    return slot.pos;
  }

  function liftAmount(holdT) {
    var t = holdT || 0;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    if (t < 0.16) return -0.07 * Math.sin((t / 0.16) * Math.PI);
    if (t < 0.78) {
      var u = (t - 0.16) / 0.62;
      return u * u * (3 - 2 * u);
    }
    var s = (t - 0.78) / 0.22;
    return 1 + Math.sin(s * Math.PI) * 0.03;
  }

  function restSpot(L, kind) {
    var w = L.w;
    var h = L.h;
    var narrow = w < 560;
    var sill = h * 0.69;
    var x0 = w * (narrow ? 0.14 : 0.18);
    if (kind === "job") {
      var bw = narrow ? 46 : 64;
      var bh = bw * 0.64;
      return { x: x0, y: sill - bh, w: bw, h: bh };
    }
    if (kind === "edu") {
      var nw = narrow ? 42 : 56;
      var nh = nw * 0.66;
      return { x: x0 + (narrow ? 50 : 70), y: sill - nh + 2, w: nw, h: nh };
    }
    if (kind === "scout") {
      var pw = narrow ? 72 : 96;
      var ph = pw * 0.38;
      return { x: x0 + (narrow ? 98 : 136), y: sill - ph + 4, w: pw, h: ph };
    }
    var cw = narrow ? 40 : 54;
    var ch = cw * 0.66;
    return { x: x0 + (narrow ? 176 : 244), y: sill - ch, w: cw, h: ch };
  }

  function readSpot(L, kind) {
    var w = L.w;
    var h = L.h;
    var narrow = w < 560;
    var top = 112;
    if (kind === "lab") {
      var cw = Math.min(w * (narrow ? 0.46 : 0.3), 280);
      var ch = cw * 0.7;
      return { x: narrow ? 16 : w * 0.08, y: Math.max(top, h * 0.28), w: cw, h: ch };
    }
    var bw = Math.min(w * (narrow ? 0.84 : 0.56), kind === "edu" ? 520 : 580);
    var bh = Math.min(h * 0.46, bw * 0.68);
    var bx = narrow ? (w - bw) * 0.5 : w * 0.1;
    var by = Math.max(top, h * 0.18);
    var floor = h - (L.dock || 96) - 12;
    if (by + bh > floor) bh = Math.max(150, floor - by);
    return { x: bx, y: by, w: bw, h: bh };
  }

  function objectPose(L, kind, holdT) {
    var lift = liftAmount(holdT);
    var rest = restSpot(L, kind);
    if (kind === "scout") {
      var raised = lift > 0 ? lift : 0;
      return {
        x: rest.x,
        y: rest.y - raised * 20,
        w: rest.w * (1 + raised * 0.08),
        h: rest.h * (1 + raised * 0.08),
        t: lift
      };
    }
    var read = readSpot(L, kind);
    return {
      x: rest.x + (read.x - rest.x) * lift,
      y: rest.y + (read.y - rest.y) * lift,
      w: Math.max(12, rest.w + (read.w - rest.w) * lift),
      h: Math.max(12, rest.h + (read.h - rest.h) * lift),
      t: lift
    };
  }

  function paintCut(ctx, key, x, y, w, h) {
    var img = painted(key);
    if (!img || w < 2 || h < 2) return false;
    var src = ART_SRC[key] || "";
    if (src.indexOf(".png") >= 0) {
      ctx.drawImage(img, x, y, w, h);
      return true;
    }
    var cut = cutout(key);
    if (cut) ctx.drawImage(cut, x, y, w, h);
    else ctx.drawImage(img, x, y, w, h);
    return true;
  }

  function inkReady(ui) {
    return (ui.holdT || 0) > 0.72 && !(ui.flip > 0 && ui.flip < 1);
  }

  function inkLine(ctx, ui, id, x, y, w, h, label, faint, quiet) {
    if (w < 8 || h < 10) return;
    var hot = !faint && ui.hover === id;
    var px = h < 22 ? 15 : 16;
    var face = "italic " + px + "px \"Liberation Serif\", Georgia, serif";
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "multiply";
    ctx.font = face;
    ctx.fillStyle = faint ? "rgba(110, 82, 54, 0.45)" : (hot ? "#6a3414" : "#2a2018");
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, face, label, Math.max(8, w - 6)), x + 2, y + h * 0.55);
    ctx.restore();
    if (!faint && !quiet && inkReady(ui)) pushHit(ui, id, x, y, w, h);
  }

  function blitSlice(ctx, key, sx, sy, sw, sh, dx, dy, dw, dh) {
    var img = painted(key);
    if (!img || dw < 2 || dh < 2) return false;
    ctx.drawImage(img, sx * img.naturalWidth, sy * img.naturalHeight, sw * img.naturalWidth, sh * img.naturalHeight, dx, dy, dw, dh);
    return true;
  }

  function cutout(key) {
    if (cutCache[key]) return cutCache[key];
    var img = painted(key);
    if (!img || !img.naturalWidth) return null;
    try {
      var c = document.createElement("canvas");
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      c.width = w;
      c.height = h;
      var g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      var data = g.getImageData(0, 0, w, h);
      var px = data.data;
      var bgR = px[0];
      var bgG = px[1];
      var bgB = px[2];
      var seen = new Uint8Array(w * h);
      var stack = [0, w - 1, (h - 1) * w, (h - 1) * w + w - 1];
      var guard = 0;
      var limit = w * h;
      while (stack.length && guard < limit) {
        guard += 1;
        var p = stack.pop();
        if (seen[p]) continue;
        var i4 = p * 4;
        var dr = px[i4] - bgR;
        var dg = px[i4 + 1] - bgG;
        var db = px[i4 + 2] - bgB;
        if (dr * dr + dg * dg + db * db > 2400) continue;
        seen[p] = 1;
        px[i4 + 3] = 0;
        var x = p % w;
        var y = (p / w) | 0;
        if (x > 0 && !seen[p - 1]) stack.push(p - 1);
        if (x + 1 < w && !seen[p + 1]) stack.push(p + 1);
        if (y > 0 && !seen[p - w]) stack.push(p - w);
        if (y + 1 < h && !seen[p + w]) stack.push(p + w);
      }
      g.putImageData(data, 0, 0);
      cutCache[key] = c;
      return c;
    } catch (err) {
      cutCache[key] = null;
      return null;
    }
  }

  function screenOf(ui, x, y) {
    var c = ui && ui.cam;
    if (!c || !(c.z > 0)) return { x: x, y: y };
    return {
      x: c.fx + (x - c.fx) * c.z,
      y: c.fy + (y - c.fy) * c.z
    };
  }

  function pushWorld(ui, id, x, y, w, h) {
    if (!ui || !ui.hits) return;
    var p = screenOf(ui, x, y);
    var q = screenOf(ui, x + w, y + h);
    pushHit(ui, id, p.x, p.y, q.x - p.x, q.y - p.y);
  }

  function bindCam(ui, w, h, top) {
    var z = ui.camZ || 1;
    if (z < 1) z = 1;
    ui.cam = {
      z: z,
      fx: (ui.camX == null ? 0.42 : ui.camX) * w,
      fy: (top || 0) + (ui.camY == null ? 0.52 : ui.camY) * h
    };
  }

  function camGoal(ui, spec) {
    var look = ui.menu === "scout" ? (ui.look || "sera") : "";
    var rect = { x: 0, y: 0, w: ui.w || 1, h: ui.h || 1 };
    var boxes = sceneBoxes(rect, shopArtKey(spec || {}));
    if (look === "juniper") return boxCenter(boxes.juniper, rect, 1.04);
    if (look === "landlord") return boxCenter(boxes.door, rect, 1.04);
    if (look === "hire") {
      if (spec && spec.places && spec.places.hire === "upstairs") return boxCenter(boxes.up, rect, 1.04);
      return boxCenter(boxes.window, rect, 1.04);
    }
    if (look === "sera") return boxCenter(boxes.window, rect, 1.04);
    if (ui.menu === "job") return { x: 0.42, y: 0.54, z: 1.02 };
    if (ui.menu === "lab") return { x: 0.48, y: 0.56, z: 1.02 };
    if (ui.menu === "edu") return { x: 0.4, y: 0.5, z: 1 };
    if (spec && spec.opened && spec.hours !== "closed") return { x: 0.42, y: 0.52, z: 1 };
    return { x: 0.42, y: 0.5, z: 1 };
  }

  function inkFor(game, ui) {
    var list = D.DEGREES || [];
    var deg = list[ui.classPage || 0];
    if (!deg) return 0;
    if (game.degrees && game.degrees[deg.id]) return 1;
    if (game.degree && game.degree.id === deg.id && game.degree.total) {
      var p = 1 - game.degree.left / game.degree.total;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      return p;
    }
    return 0;
  }

  function advanceFlip(ui) {
    if (!(ui.flip > 0)) return;
    var dt = ui.dt > 0 ? ui.dt : 16;
    ui.flip += dt / 500;
    if (ui.flip >= 0.5 && !ui.flipApplied) {
      ui.flipApplied = true;
      ui.scroll = 0;
      var dir = ui.flipDir || 1;
      if (ui.flipKind === "edu") {
        var n = (D.DEGREES || []).length || 1;
        ui.classPage = ((ui.classPage || 0) + dir + n * 4) % n;
      } else if (ui.flipKind === "job") {
        var next = (ui.jobPage || 0) + dir;
        if (next < 0) next = 0;
        if (next > 2) next = 2;
        ui.jobPage = next;
      }
    }
    if (ui.flip >= 1) {
      ui.flip = 0;
      ui.flipApplied = false;
    }
  }

  function settle(ui, game, dt, now) {
    if (!ui || !game) return;
    ui.dt = dt;
    var spec = storySpec(game, now || Date.now(), false);
    var goal = camGoal(ui, spec);
    if (goal.x < 0.08) goal.x = 0.08;
    if (goal.x > 0.9) goal.x = 0.9;
    if (goal.y < 0.12) goal.y = 0.12;
    if (goal.y > 0.88) goal.y = 0.88;
    if (ui.camX == null) {
      ui.camX = goal.x;
      ui.camY = goal.y;
      ui.camZ = goal.z;
    }
    var looking = ui.menu === "scout";
    ui.camX = glideTo(ui, "camX", goal.x, dt, looking ? 860 : 700);
    ui.camY = glideTo(ui, "camY", goal.y, dt, looking ? 860 : 700);
    ui.camZ = glideTo(ui, "camZ", goal.z, dt, looking ? 940 : 760);
    var holding = ui.menu === "job" || ui.menu === "edu" || ui.menu === "lab" || ui.menu === "scout" || ui.menu === "journal" || ui.menu === "settings";
    if (holding) ui.holdMenu = ui.menu;
    if (ui.holdT == null) ui.holdT = 0;
    var step = (dt > 0 ? dt : 16) / 520;
    if (holding) ui.holdT = Math.min(1, ui.holdT + step);
    else ui.holdT = Math.max(0, ui.holdT - step);
    if (!holding && ui.holdT <= 0) ui.holdMenu = "";
    var key = shopArtKey(spec);
    if (!ui.artTo) {
      ui.artFrom = key;
      ui.artTo = key;
      ui.artT = 1;
    } else if (key !== ui.artTo) {
      ui.artFrom = ui.artT > 0.45 ? ui.artTo : ui.artFrom;
      ui.artTo = key;
      ui.artT = 0;
    }
    ui.artT = easeToward(ui.artT == null ? 1 : ui.artT, 1, dt, 520);
    var doorTarget = (!spec.dayOne && spec.opened && spec.hours !== "closed") ? 1 : 0;
    ui.door = easeToward(ui.door || 0, doorTarget, dt, 380);
    var cash = game.player ? game.player.capital : 0;
    if (ui.cashShown == null) ui.cashShown = cash;
    if (ui.cashHold != null && !ui.coin && !ui.payKind) ui.cashHold = null;
    if (ui.cashHold != null) {
      ui.cashShown = ui.cashHold;
      ui.cashFrom = ui.cashHold;
      ui.cashT = 0;
    } else {
      if (ui.cashGoal !== cash) {
        ui.cashFrom = ui.cashShown;
        ui.cashGoal = cash;
        ui.cashT = 0;
      }
      if ((ui.cashT || 0) < 1) {
        ui.cashT = (ui.cashT || 0) + (dt > 0 ? dt : 16) / 380;
        if (ui.cashT > 1) ui.cashT = 1;
      }
      var cashEase = easeOut(ui.cashT == null ? 1 : ui.cashT);
      var cashFrom = ui.cashFrom == null ? cash : ui.cashFrom;
      ui.cashShown = cashFrom + (cash - cashFrom) * cashEase;
      if (ui.cashT >= 1) ui.cashShown = cash;
    }
    var level = (game.player && game.player.level) || 1;
    if (ui.yearSeen == null) ui.yearSeen = level;
    if (level !== ui.yearSeen) {
      ui.yearSeen = level;
      ui.yearPop = 1;
    }
    if (ui.yearPop > 0) {
      ui.yearPop -= (dt > 0 ? dt : 16) / 280;
      if (ui.yearPop < 0) ui.yearPop = 0;
    }
    stepShelf(ui, game, dt);
    if (ui.coin) {
      ui.coin.t += dt > 0 ? dt : 16;
      if (ui.coin.t >= ui.coin.dur) {
        ui.coin.t = ui.coin.dur;
        if (!ui.coin.landed) {
          ui.coin.landed = true;
          ui.cashHold = null;
          ui.cashShown = cash;
          ui.cashFrom = cash;
          ui.cashGoal = cash;
          ui.cashT = 1;
          ui.coinPing = (ui.coinPing || 0) + 1;
        } else ui.coin = null;
      }
    }
    var selling = shopSelling(game);
    if (!ui.cust) ui.cust = { seen: game.pulse || 0, t: 1 };
    if (selling && game.pulse !== ui.cust.seen && ui.cust.t >= 1) {
      ui.cust.seen = game.pulse;
      ui.cust.t = 0;
    }
    if (!selling) ui.cust.seen = game.pulse || 0;
    if (ui.cust.t < 1) {
      ui.cust.t += (dt > 0 ? dt : 16) / 700;
      if (ui.cust.t > 1) ui.cust.t = 1;
    }
    var dimTarget = spec.dayOne ? 1 : 0;
    ui.dim = easeToward(ui.dim == null ? dimTarget : ui.dim, dimTarget, dt, 520);
    ui.cardOpen = easeToward(ui.cardOpen || 0, (game.flags && game.flags.shady) ? 1 : 0, dt, 460);
    ui.ink = easeToward(ui.ink || 0, inkFor(game, ui), dt, 640);
    advanceFlip(ui);
  }

  function placeOf(key, dest, fx, fy, fw, fh) {
    var img = painted(key);
    if (!img || !dest || !(dest.w > 0)) {
      return {
        x: (dest ? dest.x : 0) + fx * (dest ? dest.w : 1),
        y: (dest ? dest.y : 0) + fy * (dest ? dest.h : 1),
        w: fw * (dest ? dest.w : 1),
        h: fh * (dest ? dest.h : 1)
      };
    }
    var iw = img.naturalWidth;
    var ih = img.naturalHeight;
    var ir = iw / Math.max(1, ih);
    var r = dest.w / Math.max(1, dest.h);
    var sx = 0;
    var sy = 0;
    var sw = iw;
    var sh = ih;
    if (ir > r) {
      sw = ih * r;
      sx = (iw - sw) * SHOP_BIAS;
    } else {
      sh = iw / Math.max(0.01, r);
      sy = (ih - sh) * 0.28;
    }
    return {
      x: dest.x + ((fx * iw) - sx) / sw * dest.w,
      y: dest.y + ((fy * ih) - sy) / sh * dest.h,
      w: (fw * iw) / sw * dest.w,
      h: (fh * ih) / sh * dest.h
    };
  }

  function fitBox(box, rect) {
    var x = box.x;
    var y = box.y;
    var maxX = rect.x + rect.w - 6;
    var maxY = rect.y + rect.h - 6;
    if (x + box.w > maxX) x = maxX - box.w;
    if (y + box.h > maxY) y = maxY - box.h;
    if (x < rect.x + 4) x = rect.x + 4;
    if (y < rect.y + 4) y = rect.y + 4;
    return { x: x, y: y, w: box.w, h: box.h };
  }

  function sceneBoxes(rect, key) {
    return {
      window: fitBox(placeOf(key, rect, 0.08, 0.48, 0.28, 0.3), rect),
      door: fitBox(placeOf(key, rect, 0.4, 0.5, 0.1, 0.32), rect),
      up: fitBox(placeOf(key, rect, 0.16, 0.16, 0.12, 0.14), rect),
      juniper: fitBox(placeOf(key, rect, 0.68, 0.32, 0.16, 0.28), rect),
      counter: fitBox(placeOf(key, rect, 0.1, 0.68, 0.22, 0.06), rect)
    };
  }

  function boxCenter(box, rect, z) {
    return {
      x: (box.x + box.w * 0.5 - rect.x) / Math.max(1, rect.w),
      y: (box.y + box.h * 0.5 - rect.y) / Math.max(1, rect.h),
      z: z
    };
  }

  function personLean(about, now, salt) {
    var t = ((now || 0) / (about ? 380 : 980)) + (salt || 0);
    return {
      rot: Math.sin(t) * (about ? 0.08 : 0.018),
      x: Math.sin(t + 0.8) * (about ? 8 : 2)
    };
  }

  function paintPortrait(ctx, key, box, lean) {
    if (!box || box.w < 4 || box.h < 4) return;
    var img = painted(key);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.translate(box.x + box.w * 0.5 + (lean ? lean.x : 0), box.y + box.h);
    ctx.rotate(lean ? lean.rot : 0);
    if (img && img.naturalWidth) {
      var ir = img.naturalWidth / Math.max(1, img.naturalHeight);
      var bh = box.h;
      var bw = bh * ir;
      if (bw > box.w * 0.98) {
        bw = box.w * 0.98;
        bh = bw / ir;
      }
      ctx.fillStyle = "rgba(28,22,18,0.32)";
      ctx.beginPath();
      ctx.ellipse(0, -1, Math.max(7, bw * 0.36), Math.max(2.5, bh * 0.018), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(img, -bw * 0.5, -bh, bw, bh);
    } else drawFigure(ctx, 0, 0, box.h * 0.9, key);
    ctx.restore();
  }

  function paintSwungDoor(ctx, box, open) {
    if (!box || open < 0.04) return;
    var x = box.x;
    var y = box.y;
    var w = box.w;
    var h = box.h;
    var gap = w * Math.min(0.8, open);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#14110e";
    ctx.fillRect(x, y, gap, h);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function showPerson(spec, ui, id) {
    var places = (spec && spec.places) || {};
    var look = !!(ui && ui.menu === "scout" && ui.look === id);
    if (look) return true;
    if (id === "landlord") return places.landlord === "door";
    if (id === "hire") return places.hire === "counter" || places.hire === "upstairs";
    if (id === "sera") return places.sera === "counter";
    if (id === "juniper") return places.juniper === "across";
    return false;
  }

  function paintCast(ctx, rect, spec, who, ui, now) {
    var boxes = sceneBoxes(rect, shopArtKey(spec));
    var look = ui && ui.menu === "scout" ? (ui.look || "") : "";
    ctx.save();
    ctx.shadowBlur = 0;
    if (!spec.dayOne && !painted(shopArtKey(spec))) {
      paintSwungDoor(ctx, boxes.door, spec.doorOpen || 0);
      var trading = !!(spec.opened && spec.hours !== "closed");
      if (spec.lights && trading) {
        ctx.fillStyle = "rgba(240,195,106,0.32)";
        ctx.fillRect(boxes.window.x, boxes.window.y, boxes.window.w, boxes.window.h);
      } else if (spec.owned || spec.opened) {
        ctx.fillStyle = "rgba(10,8,6,0.38)";
        ctx.fillRect(boxes.window.x, boxes.window.y, boxes.window.w, boxes.window.h);
      }
      var real = !!spec.counter;
      var ch = real ? Math.max(7, boxes.window.h * 0.1) : 3;
      var cy = boxes.window.y + boxes.window.h - ch - 3;
      ctx.fillStyle = real ? "#4a301c" : "#6a5340";
      ctx.fillRect(boxes.window.x + 8, cy, boxes.window.w - 16, ch);
      if (spec.upstairs === "tutor" || spec.upstairs === "office") {
        ctx.fillStyle = spec.upstairs === "office" ? "rgba(240,195,106,0.4)" : "rgba(62,200,216,0.28)";
        ctx.fillRect(boxes.up.x, boxes.up.y, boxes.up.w, boxes.up.h);
      }
    }
    var hot = !!(spec.shady && (spec.heat || 0) >= 45);
    if (hot && !spec.dayOne) {
      ctx.fillStyle = "rgba(122,74,134,0.95)";
      ctx.beginPath();
      ctx.arc(boxes.window.x + boxes.window.w * 0.82, boxes.window.y + boxes.window.h * 0.22, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    function castOne(id, box) {
      if (!showPerson(spec, ui, id) || !box) return;
      var lean = personLean(who === id, now, id.length);
      paintPortrait(ctx, id, box, lean);
      var plan = ui && ui.plan;
      if (plan && plan.person && who === id) {
        var tw = Math.min(120, box.w - 4);
        var th = 32;
        var tx = box.x + 4;
        var ty = box.y + box.h - th - 4;
        drawTag(ctx, tx, ty, tw, th, shortChoice(plan.person.label), ui.hover === plan.person.id);
        pushWorld(ui, plan.person.id, tx, ty, tw, th);
      }
      if (!ui.menu || ui.menu === "scout") pushWorld(ui, "look:" + id, box.x, box.y, box.w, box.h);
    }
    var win = boxes.window;
    var doorBox = boxes.door;
    var fore = { x: rect.x + rect.w * 0.06, y: rect.y + rect.h * 0.16, w: rect.w * 0.28, h: rect.h * 0.74 };
    var seraBox = look === "sera" ? fore : { x: win.x + 2, y: win.y + win.h * 0.06, w: win.w * 0.5, h: win.h * 0.92 };
    var hireBox = (spec.places && spec.places.hire === "upstairs") ? boxes.up : { x: win.x + win.w * 0.48, y: win.y + win.h * 0.08, w: win.w * 0.48, h: win.h * 0.9 };
    if (look === "hire") hireBox = fore;
    if (look === "landlord") boxes = Object.assign({}, boxes, { door: fore });
    if (look === "juniper") boxes = Object.assign({}, boxes, { juniper: { x: rect.x + rect.w * 0.62, y: rect.y + rect.h * 0.16, w: rect.w * 0.28, h: rect.h * 0.74 } });
    castOne("juniper", boxes.juniper);
    castOne("sera", seraBox);
    castOne("hire", hireBox);
    castOne("landlord", boxes.door);
    if (!spec.dayOne && spec.places && spec.places.sera === "gone" && look !== "sera") {
      paintEmptyStool(ctx, win.x + win.w * 0.2, win.y + win.h * 0.8);
    }
    if (!spec.dayOne && spec.rentDue) {
      var nx = doorBox.x + doorBox.w * 0.12;
      var ny = doorBox.y + 8;
      var nw = Math.max(36, doorBox.w * 0.76);
      ctx.fillStyle = PAPER;
      ctx.fillRect(nx, ny, nw, 36);
      ctx.strokeStyle = INK;
      ctx.strokeRect(nx, ny, nw, 36);
      ctx.font = font(12, false, 700, true);
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Pay", nx + nw * 0.5, ny + 10);
      ctx.fillText("Stall", nx + nw * 0.5, ny + 26);
      pushWorld(ui, "rentpay", nx, ny, nw, 18);
      pushWorld(ui, "rentstall", nx, ny + 18, nw, 18);
      ctx.textAlign = "left";
    }
    if (!spec.dayOne && !spec.owned) {
      var rx = boxes.window.x;
      var ry = boxes.window.y - 22;
      drawTag(ctx, rx, ry, Math.min(110, boxes.window.w), 20, "Rent " + S.money(D.ROOM.rent), ui.hover === "room");
      pushWorld(ui, "room", rx, ry, Math.min(110, boxes.window.w), 20);
    }
    if (!spec.dayOne && spec.owned && ui && ui.menu === "job") {
      if (!spec.lights) pushWorld(ui, "upgrade:lights", boxes.window.x + boxes.window.w * 0.7, boxes.window.y, boxes.window.w * 0.28, boxes.window.h * 0.28);
      if (!spec.sign) {
        var sign = SIGN_BOX[shopArtKey(spec)] || SIGN_BOX.shopNoon;
        pushWorld(ui, "upgrade:sign", rect.x + rect.w * sign.x, rect.y + rect.h * sign.y, rect.w * sign.w, rect.h * sign.h);
      }
      if (!spec.counter) pushWorld(ui, "upgrade:counter", boxes.counter.x, boxes.counter.y, boxes.counter.w, boxes.counter.h);
      if (!spec.floor) pushWorld(ui, "floor", boxes.up.x, boxes.up.y, boxes.up.w, boxes.up.h);
    }
    var mark = screenSpot(rect, spec.spot);
    if (!spec.dayOne && spec.opened) paintPresence(ctx, mark.x, mark.y);
    ctx.restore();
  }

  function screenSpot(rect, spot) {
    var x = rect.x + rect.w * 0.22;
    var y = rect.y + rect.h * 0.62;
    if (spot === "door") {
      x = rect.x + rect.w * 0.45;
      y = rect.y + rect.h * 0.62;
    }
    if (spot === "upstairs") {
      x = rect.x + rect.w * 0.2;
      y = rect.y + rect.h * 0.22;
    }
    return { x: x, y: y };
  }

  function paintInkPage(ctx, x, y, w, h, fill, text) {
    if (!(fill > 0.01) || w < 8 || h < 8) return;
    var inkH = Math.max(4, h * fill);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(x, y, w, inkH);
    ctx.clip();
    ctx.fillStyle = "rgba(28,22,18,0.9)";
    var f = font(w < 160 ? 14 : 16, false, 700, true);
    var lines = wrapLines(ctx, f, text, w - 12, 8);
    ctx.font = f;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    var i;
    for (i = 0; i < 14; i++) {
      ctx.globalAlpha = 0.18;
      ctx.fillRect(x + 6, y + 20 + i * 16, w - 14, 1);
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < lines.length; i++) ctx.fillText(lines[i], x + 6, y + 6 + i * 18);
    ctx.restore();
  }

  function pageCurl(ctx, rect, flip) {
    if (!(flip > 0) || flip >= 1 || !rect) return;
    var t = flip < 0.5 ? (1 - flip * 2) : ((flip - 0.5) * 2);
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, Math.max(1, rect.w * t), rect.h);
    ctx.clip();
  }

  function drawScreenSlip(ctx, ui, w, line, plan) {
    if (!ui || ui.menu === "settings") return null;
    var narrow = w < 560;
    var slipW = Math.min(narrow ? 210 : 250, w * 0.46);
    var bodyFont = font(narrow ? 15 : 16, false, 500, true);
    var lines = wrapLines(ctx, bodyFont, line || "", slipW - 20, 2);
    var lineH = 18;
    var slipChoice = plan && plan.slip;
    var slipH = 16 + lines.length * lineH + (slipChoice ? 26 : 8);
    var slipX = 12;
    var slipY = 12;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.translate(slipX + 10, slipY + 8);
    ctx.rotate(-0.03);
    ctx.translate(-(slipX + 10), -(slipY + 8));
    ctx.fillStyle = "#d9cbb8";
    ctx.fillRect(slipX + 3, slipY + 3, slipW, slipH);
    ctx.fillStyle = PAPER;
    ctx.fillRect(slipX, slipY, slipW, slipH);
    ctx.fillStyle = BRICK;
    ctx.beginPath();
    ctx.arc(slipX + 12, slipY + 11, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = bodyFont;
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    var i;
    for (i = 0; i < lines.length; i++) ctx.fillText(lines[i], slipX + 10, slipY + 16 + i * lineH);
    if (slipChoice) {
      var ruleY = slipY + 16 + lines.length * lineH + 2;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(slipX + 10, ruleY);
      ctx.lineTo(slipX + slipW - 10, ruleY);
      ctx.stroke();
      var labelf = font(15, false, 700, true);
      ctx.font = labelf;
      ctx.fillStyle = ui.hover === slipChoice.id ? BRICK : INK;
      ctx.fillText(clipText(ctx, labelf, shortChoice(slipChoice.label), slipW - 20), slipX + 10, ruleY + 4);
    }
    ctx.restore();
    return { x: slipX, y: slipY, w: slipW, h: slipH };
  }

  function drawLedgerWork(ctx, game, ui, left, right, scroll) {
    var yL = left.y + 2 - scroll;
    var yR = right.y + 2 - scroll;
    var lh = 22;
    inkLine(ctx, ui, "shift", left.x, yL, left.w, lh, "Work the rush", false);
    yL += lh + 3;
    inkLine(ctx, ui, "rest", left.x, yL, left.w, lh, "Take a break", false);
    yL += lh + 3;
    inkLine(ctx, ui, "applicants", left.x, yL, left.w, lh, "Find people", false);
    yL += lh + 8;
    var i;
    for (i = 0; i < D.HOBBIES.length; i++) {
      var hobby = D.HOBBIES[i];
      var openH = S.hobbyOpen(game, hobby);
      var label = hobby.name + (openH ? "  " + S.money(hobby.pay) : "");
      inkLine(ctx, ui, "hobby:" + hobby.id, left.x, yL, left.w, lh, label, !openH);
      yL += lh + 3;
    }
    var focus = ui.focusSlot || 0;
    for (i = 0; i < D.JOBS.length; i++) {
      var spec = D.JOBS[i];
      var open = S.jobUnlocked(game, spec);
      var current = game.slots[focus] && game.slots[focus].jobId === spec.id;
      inkLine(ctx, ui, "apply:" + focus + ":" + spec.id, right.x, yR, right.w, lh, spec.name, !open, current);
      yR += lh + 3;
    }
    ui.contentH = Math.max(yL, yR) + 12 - left.y + scroll;
  }

  function drawLedgerShops(ctx, game, ui, left, right, scroll) {
    var y = left.y + 2 - scroll;
    var lh = 22;
    var span = right.x + right.w - left.x;
    var place = storySpec(game, ui.now || Date.now(), false);
    if (!place.dayOne && !place.owned) {
      inkLine(ctx, ui, "room", left.x, y, span, lh, "Rent the room  " + S.money(D.ROOM.rent), false);
      y += lh + 3;
    }
    if (!place.dayOne && place.owned) {
      if (!place.lights) {
        inkLine(ctx, ui, "upgrade:lights", left.x, y, span, lh, "Warm lights", false);
        y += lh + 3;
      }
      if (!place.sign) {
        inkLine(ctx, ui, "upgrade:sign", left.x, y, span, lh, "Paint a sign", false);
        y += lh + 3;
      }
      if (!place.counter) {
        inkLine(ctx, ui, "upgrade:counter", left.x, y, span, lh, "A real counter", false);
        y += lh + 3;
      }
      if (!place.floor) {
        inkLine(ctx, ui, "floor", left.x, y, span, lh, "The floor above", false);
        y += lh + 3;
      }
    }
    var i;
    for (i = 0; i < game.slots.length; i++) {
      var slot = game.slots[i];
      var job = D.jobById[slot.jobId];
      var name = "Shop " + (i + 1) + "  " + (job ? job.name : "Kiosk");
      inkLine(ctx, ui, "focus:" + i, left.x, y, span, lh, name, false);
      y += lh + 3;
      var emp = slot.employee ? slot.employee.name + "  " + S.money(slot.employee.salary) : "Nobody's working";
      inkLine(ctx, ui, "stock:" + i, left.x, y, span, lh, "Stock " + slot.stock + "  ·  " + emp, false);
      y += lh + 3;
      if (slot.employee) {
        inkLine(ctx, ui, "fire:" + i, left.x, y, span * 0.48, lh, "Fire " + slot.employee.name, false);
      }
      inkLine(ctx, ui, "cam:" + i, left.x + span * 0.5, y, span * 0.48, lh, slot.camera ? "Camera on" : "Add camera", !!slot.camera);
      y += lh + 6;
    }
    ui.contentH = y + 12 - left.y + scroll;
  }

  function drawLedgerAsks(ctx, game, ui, left, right, scroll) {
    var y = left.y + 2 - scroll;
    var lh = 22;
    var span = right.x + right.w - left.x;
    inkLine(ctx, ui, "applicants", left.x, y, span, lh, "Find people", false);
    y += lh + 6;
    var i;
    if (!game.resumes.length) {
      inkLine(ctx, ui, "applicants", left.x, y, span, lh, "Nobody's waiting", true);
      y += lh + 4;
    }
    for (i = 0; i < game.resumes.length; i++) {
      var card = game.resumes[i];
      var selected = ui.selected === card.id;
      inkLine(ctx, ui, "resume:" + card.id, left.x, y, span, lh, card.name + "  " + S.money(card.ask), !!card.dying);
      y += lh + 3;
      if (selected && !card.dying) {
        drawKeypad(ctx, ui, left.x, y, Math.min(280, span));
        y += 24 + 4 * 38 + 48;
      }
    }
    ui.contentH = y + 16 - left.y + scroll;
  }

  function bookPages(pose) {
    return {
      left: { x: pose.x + pose.w * 0.07, y: pose.y + pose.h * 0.14, w: pose.w * 0.4, h: pose.h * 0.72 },
      right: { x: pose.x + pose.w * 0.52, y: pose.y + pose.h * 0.14, w: pose.w * 0.4, h: pose.h * 0.72 }
    };
  }

  function drawLedger(ctx, game, ui, L) {
    if (ui.menu !== "job" && ui.holdMenu !== "job") return;
    var pose = objectPose(L, "job", ui.holdT || 0);
    var pages = bookPages(pose);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(28,22,18,0.28)";
    ctx.beginPath();
    ctx.ellipse(pose.x + pose.w * 0.5, pose.y + pose.h - 2, pose.w * 0.38, Math.max(4, pose.h * 0.03), 0, 0, Math.PI * 2);
    ctx.fill();
    if (!paintCut(ctx, "ledger", pose.x, pose.y, pose.w, pose.h)) {
      ctx.fillStyle = "#e6d3b4";
      ctx.fillRect(pose.x, pose.y, pose.w, pose.h);
    }
    ctx.save();
    pageCurl(ctx, pages.right, ui.flip && ui.flipKind === "job" ? ui.flip : 0);
    ctx.beginPath();
    ctx.rect(pages.left.x, pages.left.y, pages.right.x + pages.right.w - pages.left.x, pages.left.h);
    ctx.clip();
    ui.clip = { x: pages.left.x, y: pages.left.y, w: pages.right.x + pages.right.w - pages.left.x, h: pages.left.h };
    var page = ui.jobPage || 0;
    var scroll = ui.scroll || 0;
    if (page <= 0) drawLedgerWork(ctx, game, ui, pages.left, pages.right, scroll);
    else if (page === 1) drawLedgerShops(ctx, game, ui, pages.left, pages.right, scroll);
    else drawLedgerAsks(ctx, game, ui, pages.left, pages.right, scroll);
    ctx.restore();
    ui.clip = null;
    if (inkReady(ui)) {
      pushHit(ui, "page:prev", pose.x + 2, pose.y + pose.h * 0.38, 18, 36);
      pushHit(ui, "page:next", pose.x + pose.w - 20, pose.y + pose.h * 0.38, 18, 36);
      pushHit(ui, "close", pose.x + pose.w - 22, pose.y + 4, 18, 16);
    }
    ctx.restore();
    ctx.textAlign = "left";
    var max = (ui.contentH || 0) - pages.left.h;
    if (max < 0) max = 0;
    if (ui.scroll < 0) ui.scroll = 0;
    if (ui.scroll > max) ui.scroll = max;
  }

  function itemArt(cat) {
    if (cat === "idea") return "bulb";
    if (cat === "staff") return "plant";
    if (cat === "marketing") return "speaker";
    return "stock";
  }

  function drawShelf(ctx, game, ui, L, book) {
    var list = [];
    var i;
    for (i = 0; i < D.ITEMS.length; i++) {
      if (game.player.level >= D.ITEMS[i].level) list.push(D.ITEMS[i]);
    }
    if (!list.length || !inkReady(ui)) return;
    var zoneX = book.x + book.w + 12;
    var zoneW = L.w - zoneX - 10;
    var zoneY = book.y + 8;
    var zoneH = L.h - (L.dock || 96) - zoneY - 8;
    if (zoneW < 96) {
      zoneX = 10;
      zoneW = L.w - 20;
      zoneY = book.y + book.h + 8;
      zoneH = L.h - (L.dock || 96) - zoneY - 8;
    }
    if (zoneH < 48 || zoneW < 40) return;
    var cols = Math.max(1, Math.floor(zoneW / 62));
    var rows = Math.ceil(list.length / cols);
    var cell = Math.min(54, Math.floor(zoneW / cols) - 6);
    while (rows * (cell + 26) > zoneH && cols < list.length) {
      cols += 1;
      rows = Math.ceil(list.length / cols);
      cell = Math.min(54, Math.floor(zoneW / cols) - 6);
      if (cell < 28) break;
    }
    if (cell < 28) cell = 28;
    var gap = 6;
    for (i = 0; i < list.length; i++) {
      var item = list[i];
      var col = i % cols;
      var row = (i / cols) | 0;
      var ix = zoneX + col * (cell + gap);
      var iy = zoneY + row * (cell + 26);
      if (iy + cell > zoneY + zoneH) break;
      paintCut(ctx, itemArt(item.cat), ix, iy, cell, cell * 0.72);
      var owned = game.mats[item.id] || 0;
      var tag = item.fragment + (owned ? " " + owned : "") + " " + S.money(S.marketCost(game, item));
      var tw = cell + 4;
      drawTag(ctx, ix - 2, iy + cell * 0.72, tw, 20, tag, ui.hover === "buy:" + item.id);
      pushHit(ui, "buy:" + item.id, ix - 2, iy, tw, cell * 0.72 + 20);
    }
  }

  function drawNotebook(ctx, game, ui, L) {
    if (ui.menu !== "edu" && ui.holdMenu !== "edu") return;
    var pose = objectPose(L, "edu", ui.holdT || 0);
    var pages = bookPages(pose);
    var deg = (D.DEGREES || [])[ui.classPage || 0];
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(28,22,18,0.28)";
    ctx.beginPath();
    ctx.ellipse(pose.x + pose.w * 0.5, pose.y + pose.h - 2, pose.w * 0.38, Math.max(4, pose.h * 0.03), 0, 0, Math.PI * 2);
    ctx.fill();
    if (!paintCut(ctx, "notebook", pose.x, pose.y, pose.w, pose.h)) {
      ctx.fillStyle = "#efe6d4";
      ctx.fillRect(pose.x, pose.y, pose.w, pose.h);
    }
    ctx.save();
    pageCurl(ctx, pages.right, ui.flip && ui.flipKind === "edu" ? ui.flip : 0);
    if (deg) {
      inkLine(ctx, ui, "class", pages.left.x, pages.left.y, pages.left.w, 24, deg.name, true);
      var note = deg.text || "";
      var face = "italic 14px \"Liberation Serif\", Georgia, serif";
      var lines = wrapLines(ctx, face, note, pages.left.w - 6, 4);
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "multiply";
      ctx.font = face;
      ctx.fillStyle = "#2a2018";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      var ni;
      for (ni = 0; ni < lines.length; ni++) ctx.fillText(lines[ni], pages.left.x, pages.left.y + 30 + ni * 18);
      ctx.restore();
      var done = !!(game.degrees && game.degrees[deg.id]);
      var active = !!(game.degree && game.degree.id === deg.id);
      var fill = done ? 1 : (active ? (ui.ink || 0) : 0);
      paintInkPage(ctx, pages.right.x, pages.right.y, pages.right.w, pages.right.h, fill, done ? deg.name : (deg.name + ". " + (deg.text || "")));
      if (!done && !active && inkReady(ui)) {
        var tagW = Math.min(92, pages.right.w - 8);
        var tagX = pages.right.x + pages.right.w - tagW - 4;
        var tagY = pages.right.y + pages.right.h - 26;
        drawTag(ctx, tagX, tagY, tagW, 22, S.money(deg.cost), ui.hover === "deg:" + deg.id);
        pushHit(ui, "deg:" + deg.id, tagX, tagY, tagW, 22);
      }
    }
    ctx.restore();
    if (inkReady(ui)) {
      pushHit(ui, "page:prev", pose.x + 2, pose.y + pose.h * 0.4, 18, 34);
      pushHit(ui, "page:next", pose.x + pose.w - 20, pose.y + pose.h * 0.4, 18, 34);
      pushHit(ui, "close", pose.x + pose.w - 22, pose.y + 4, 18, 16);
    }
    drawShelf(ctx, game, ui, L, pose);
    ctx.restore();
    ctx.textAlign = "left";
    ui.scroll = 0;
  }

  function drawPeopleHold(ctx, game, ui, L) {
    if (ui.menu !== "scout") return;
    var unlocked = !!(game.nodes && game.nodes.charter);
    var tags = unlocked ? (D.SCOUTS || []) : [];
    var look = ui.look || "sera";
    var onRight = look === "juniper";
    var w = L.w;
    var tw = Math.min(108, w * 0.28);
    var th = 22;
    var x = onRight ? 14 : w - tw - 14;
    var y = onRight ? 128 : 52;
    var i;
    ctx.save();
    ctx.shadowBlur = 0;
    for (i = 0; i < tags.length; i++) {
      var scout = tags[i];
      drawTag(ctx, x, y, tw, th, scout.name, ui.hover === "scout:" + scout.id);
      pushHit(ui, "scout:" + scout.id, x, y, tw, th);
      y += th + 4;
    }
    if (game.scouts && game.scouts.length) {
      var mission = game.scouts[0];
      var def = D.scoutById[mission.id];
      var label = (def ? def.name : "Out") + " " + S.fmtMs(mission.left);
      drawTag(ctx, x, y, tw, th, label, false);
    }
    ctx.restore();
    ctx.textAlign = "left";
  }

  function drawCrateView(ctx, game, ui, L) {
    if (ui.menu !== "lab" && ui.holdMenu !== "lab") return;
    var w = L.w;
    var h = L.h;
    var place = game.player.place || {};
    var slot = game.slots && game.slots[0];
    var goods = [
      ["stock", "stock", "Stock " + (slot ? slot.stock : 0), "stock:0"],
      ["bulb", "bulb", place.lights ? "Lights" : "Warm lights", place.lights ? "" : "upgrade:lights"],
      ["cooler", "cooler", place.cooler ? "Cooler" : "Cooler", place.cooler ? "" : "upgrade:cooler"],
      ["safe", "safe", place.safe ? "Safe" : "Safe", place.safe ? "" : "upgrade:safe"],
      ["speaker", "speaker", place.speaker ? "Speaker" : "Speaker", place.speaker ? "" : "upgrade:speaker"],
      ["plant", "plant", place.plant ? "Plant" : "Plant", place.plant ? "" : "upgrade:plant"]
    ];
    var pose = objectPose(L, "lab", ui.holdT || 0);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(28,22,18,0.3)";
    ctx.beginPath();
    ctx.ellipse(pose.x + pose.w * 0.5, pose.y + pose.h - 2, pose.w * 0.4, Math.max(4, pose.h * 0.04), 0, 0, Math.PI * 2);
    ctx.fill();
    paintCut(ctx, "crate", pose.x, pose.y, pose.w, pose.h);
    if (inkReady(ui)) {
      var vpW = Math.min(72, pose.w * 0.7);
      drawTag(ctx, pose.x + 6, pose.y + pose.h - 26, vpW, 20, game.player.vp + " VP", false);
      pushHit(ui, "close", pose.x + pose.w - 20, pose.y + 2, 18, 16);
    }
    var gw = Math.min(48, Math.max(34, (Math.min(w, pose.w + 220)) / goods.length - 4));
    var gy = pose.y + 4;
    var gx = pose.x + pose.w + 8;
    var i;
    var ready = inkReady(ui);
    for (i = 0; i < goods.length; i++) {
      var g = goods[i];
      if (gx + gw > w - 8) {
        gx = 12;
        gy += gw + 8;
      }
      var lifted = ui.lift === g[0];
      var oy = lifted ? -16 : 0;
      paintCut(ctx, g[1], gx, gy + oy, gw, gw * 0.8);
      if (ready) pushHit(ui, "lift:" + g[0], gx, gy + oy, gw, gw * 0.8);
      if (lifted && g[3] && ready) {
        drawTag(ctx, gx - 4, gy + oy - 24, gw + 10, 20, g[2], ui.hover === g[3]);
        pushHit(ui, g[3], gx - 4, gy + oy - 24, gw + 10, 20);
      }
      gx += gw + 6;
    }
    var cardsX = Math.min(w - 16, pose.x + pose.w + 16);
    var cardsW = w - cardsX - 10;
    if (cardsW < 140) {
      cardsX = 12;
      cardsW = w - 24;
    }
    var cols = w < 560 ? 3 : 4;
    var cw = Math.min(92, (cardsW - 8) / cols - 6);
    var ch = 54;
    var cardsY = gy + gw + 12;
    if (cardsY < 120) cardsY = 120;
    for (i = 0; i < D.NODES.length; i++) {
      var node = D.NODES[i];
      var col = i % cols;
      var row = (i / cols) | 0;
      var cx = cardsX + col * (cw + 6);
      var cy = cardsY + row * (ch + 6);
      if (cy + ch > h - (L.dock || 96) - 70) continue;
      var shadyNode = node.line === "shady";
      var reveal = shadyNode ? (ui.cardOpen || 0) : 1;
      var faceDown = shadyNode && reveal < 0.5;
      var owned = !!game.nodes[node.id];
      ctx.save();
      ctx.translate(cx + cw * 0.5, cy + ch * 0.5);
      ctx.rotate((col - 1) * 0.03);
      ctx.scale(Math.max(0.05, Math.abs(Math.cos(reveal * Math.PI))), 1);
      ctx.translate(-(cx + cw * 0.5), -(cy + ch * 0.5));
      ctx.fillStyle = faceDown ? "#c4b49a" : "#efe6d4";
      ctx.fillRect(cx, cy, cw, ch);
      if (faceDown) {
        ctx.strokeStyle = "#8a7058";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx + 5, cy + 5, cw - 10, ch - 10);
      } else {
        ctx.fillStyle = owned ? BRICK : INK;
        ctx.font = font(12, false, 700, true);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(clipText(ctx, font(12, false, 700, true), node.name, cw - 8), cx + cw * 0.5, cy + 16);
        ctx.font = font(11, false, 500, true);
        ctx.fillStyle = "#5c5348";
        var sub = owned ? (node.id === "skim" ? "Skim" : (node.id === "score" ? "Big score" : "Open")) : (node.cost + " VP");
        ctx.fillText(sub, cx + cw * 0.5, cy + ch - 14);
      }
      ctx.restore();
      if (ready) {
        var nid = "node:" + node.id;
        if (owned && node.id === "skim") nid = "skim";
        if (owned && node.id === "score") nid = "score";
        pushHit(ui, nid, cx, cy, cw, ch);
      }
    }
    var mixY = h - (L.dock || 96) - 52;
    var cats = [["idea", "Idea"], ["staff", "Staff"], ["marketing", "Marketing"], ["asset", "Asset"]];
    var mixX = 12;
    if (ready) {
      var ci;
      var piece = Math.min(78, (w * 0.46) / 4);
      for (ci = 0; ci < cats.length; ci++) {
        var picked = ui.synth[cats[ci][0]];
        var mat = picked ? D.itemById[picked] : null;
        var lab = mat ? mat.fragment : cats[ci][1];
        drawTag(ctx, mixX + ci * (piece + 4), mixY, piece, 20, lab, ui.hover === "pick:" + cats[ci][0]);
        pushHit(ui, "pick:" + cats[ci][0], mixX + ci * (piece + 4), mixY, piece, 20);
      }
      drawTag(ctx, mixX, mixY + 24, 72, 20, "Mix it", ui.hover === "synth");
      pushHit(ui, "synth", mixX, mixY + 24, 72, 20);
      if (game.player.vp >= 1) {
        drawTag(ctx, mixX + 78, mixY + 24, 84, 20, "Research", ui.hover === "research");
        pushHit(ui, "research", mixX + 78, mixY + 24, 84, 20);
      }
      if (ui.pick) {
        var py = mixY - 24;
        var shown = 0;
        for (i = 0; i < D.ITEMS.length && shown < 3; i++) {
          var pocket = D.ITEMS[i];
          var count = game.mats[pocket.id] || 0;
          if (count <= 0) continue;
          drawTag(ctx, mixX, py, 140, 20, pocket.fragment + " ×" + count, ui.hover === "use:" + ui.pick + ":" + pocket.id);
          pushHit(ui, "use:" + ui.pick + ":" + pocket.id, mixX, py, 140, 20);
          py -= 24;
          shown += 1;
        }
      }
    }
    ctx.restore();
    ctx.textAlign = "left";
    ui.scroll = 0;
  }

  function drawWallNotes(ctx, game, ui, L) {
    var noteW = Math.min(320, L.w * 0.48);
    var noteH = Math.min(280, L.h * 0.46);
    var x = L.w - noteW - 14;
    var y = 14;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#e7dcc8";
    ctx.fillRect(x + 3, y + 4, noteW, noteH);
    ctx.fillStyle = PAPER;
    ctx.fillRect(x, y, noteW, noteH);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, noteW, noteH);
    ctx.fillStyle = BRICK;
    ctx.beginPath();
    ctx.arc(x + 14, y + 12, 4, 0, Math.PI * 2);
    ctx.fill();
    var body = { x: x + 8, y: y + 24, w: noteW - 16, h: noteH - 32 };
    ctx.save();
    ctx.beginPath();
    ctx.rect(body.x, body.y, body.w, body.h);
    ctx.clip();
    ui.clip = body;
    var cy = body.y - (ui.scroll || 0);
    ctx.font = font(14, false, 700, true);
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    if (!game.book.length) {
      ctx.fillText("Empty.", body.x, cy);
      cy += 22;
    }
    var i;
    for (i = 0; i < game.book.length; i++) {
      var key = game.book[i];
      var pair = key.indexOf("pair:") === 0 && D.pairById ? D.pairById[Number(key.slice(5))] : null;
      var legend = pair || D.recipeByKey[key];
      var name = legend ? legend.name : key;
      ctx.font = font(14, false, 700, true);
      ctx.fillStyle = INK;
      ctx.fillText(clipText(ctx, font(14, false, 700, true), name, body.w - 8), body.x, cy);
      cy += 18;
      button(ctx, ui, "craft:" + key, body.x, cy, Math.min(100, body.w), 24, "Craft", false, false);
      cy += 30;
    }
    ctx.restore();
    ui.clip = null;
    ui.contentH = cy - body.y + (ui.scroll || 0);
    pushHit(ui, "close", x + noteW - 26, y + 4, 22, 22);
    ctx.restore();
    var max = (ui.contentH || 0) - body.h;
    if (max < 0) max = 0;
    if (ui.scroll < 0) ui.scroll = 0;
    if (ui.scroll > max) ui.scroll = max;
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  function drawSlipBack(ctx, game, ui, L) {
    var cardW = Math.min(270, L.w - 24);
    var cardH = 236;
    var x = 12;
    var y = 12;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#d9cbb8";
    ctx.fillRect(x + 4, y + 4, cardW, cardH);
    ctx.fillStyle = "#e4d3bc";
    ctx.fillRect(x, y, cardW, cardH);
    ctx.strokeStyle = INK;
    ctx.strokeRect(x, y, cardW, cardH);
    ctx.fillStyle = BRICK;
    ctx.beginPath();
    ctx.arc(x + 16, y + 16, 4, 0, Math.PI * 2);
    ctx.fill();
    var yb = y + 28;
    button(ctx, ui, "opt:fx", x + 12, yb, cardW - 24, 28, "Bursts: " + (game.settings.highFX ? "On" : "Off"), game.settings.highFX, false);
    button(ctx, ui, "opt:fps", x + 12, yb + 34, cardW - 24, 28, "Draw cap: " + (game.settings.fpsCap === 30 ? "30" : "60"), false, false);
    button(ctx, ui, "opt:perf", x + 12, yb + 68, cardW - 24, 28, "Performance: " + (game.settings.performanceMode ? "On" : "Off"), game.settings.performanceMode, false);
    button(ctx, ui, ui.resetArm ? "reset:yes" : "reset", x + 12, yb + 110, cardW - 24, 28, ui.resetArm ? "Yes, wipe it" : "Reset save", false, false);
    if (ui.resetArm) {
      ctx.font = font(13, false, 500, true);
      ctx.fillStyle = INK;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("This deletes the save.", x + 12, yb + 146);
    }
    pushHit(ui, "close", x + cardW - 28, y + 6, 22, 22);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  function drawMenu(ctx, game, ui, L) {
    if (!ui.menu) return;
    drawSheet(ctx, game, ui, L, ui.menu);
    ui.clip = null;
    paperOn = false;
    buttonTone = "";
    sheetLock = false;
  }

  function menuFilter(menu) {
    if (menu === "job") return "shop";
    if (menu === "edu") return "class";
    if (menu === "scout") return "people";
    if (menu === "lab") return "stuff";
    return "";
  }

  function businessAnswers(game) {
    var slot = game.slots && game.slots[0];
    var open = !!(game.flags && game.flags.opened) && !doorClosed(game);
    return !!(open && slot && (slot.stock || 0) <= 0);
  }

  function peopleAnswers(game) {
    var w = game.world || {};
    if (w.rentDue > 0) return true;
    if (w.regular && w.regularDue) return true;
    if (w.rival && !w.truce) return true;
    if ((game.resumes || []).length) return true;
    var slots = game.slots || [];
    var i;
    for (i = 0; i < slots.length; i++) if (slots[i].employee && slots[i].employee.caught) return true;
    return false;
  }

  function drawDock(ctx, game, ui, L) {
    var items = [
      { id: "tab:chat", view: "chat", label: "Chat", icon: "star" },
      { id: "tab:job", view: "job", label: "Shop", icon: "shop" },
      { id: "tab:edu", view: "edu", label: "Class", icon: "cap" },
      { id: "tab:scout", view: "scout", label: "People", icon: "people" }
    ];
    var y = L.tabY;
    var bh = L.h - y;
    var gap = 6;
    var pad = 8;
    var cw = (L.w - pad * 2 - gap * 3) / 4;
    var current = ui.sceneView || "chat";
    var i;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#100e0c";
    ctx.fillRect(0, y, L.w, bh);
    var face = textFace(12, "title");
    for (i = 0; i < items.length; i++) {
      var item = items[i];
      var x = pad + i * (cw + gap);
      var on = item.view === current;
      var sink = pressSink(ui, item.id);
      ctx.fillStyle = on ? "#3a2e1c" : "#181410";
      ctx.fillRect(x, y + 6 + sink, cw, bh - 12);
      if (on) {
        ctx.fillStyle = LAMP;
        ctx.fillRect(x, y + 6 + sink, cw, 3);
      }
      icon(ctx, item.icon, x + cw * 0.5, y + 22 + sink, 18, on ? LAMP : "#8a8178");
      ctx.font = face;
      ctx.fillStyle = on ? LAMP : "#8a8178";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.label, x + cw * 0.5, y + bh - 16 + sink);
      var alert = !on && ((item.view === "job" && businessAnswers(game)) || (item.view === "scout" && peopleAnswers(game)));
      if (alert) {
        ctx.fillStyle = LAMP;
        ctx.beginPath();
        ctx.arc(x + cw - 10, y + 16, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      pushHit(ui, item.id, x, y, cw, bh);
    }
    ctx.restore();
    ctx.textAlign = "left";
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
      opened: !!(game.flags && game.flags.opened),
      hours: (place.shut || world.hours === "closed") ? "closed" : (chosen ? (world.hours || "") : ""),
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
    if (spec.dayOne) {
      paintCast(ctx, rect, spec, who, ui, now);
      return;
    }
    ctx.save();
    ctx.shadowBlur = 0;
    if (!painted(shopArtKey(spec))) {
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
      paintOtherShops(ctx, x, y, w, h, spec);
    }
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
    if (ui && spec.thinLine) {
      var rx = x + w - 150;
      var ry = y + 48;
      ctx.fillStyle = ui.rewind ? LAMP : PAPER;
      ctx.fillRect(rx, ry, 64, 22);
      ctx.strokeStyle = INK;
      ctx.strokeRect(rx, ry, 64, 22);
      ctx.fillStyle = INK;
      ctx.font = font(12, false, 700, true);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ui.rewind ? "Now" : "Replay", rx + 32, ry + 11);
      pushWorld(ui, "rewind", rx, ry, 64, 22);
      ctx.textAlign = "left";
    }
    ctx.restore();
    paintCast(ctx, rect, spec, who, ui, now);
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
    if (cashHeld) return;
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
    for (i = pops.length - 1; i >= 0; i--) {
      if (now - pops[i].born > pops[i].life) pops.splice(i, 1);
    }
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
    if (doorClosed(game)) {
      hero.alt = "door:open";
      hero.altLabel = "Open";
    } else if (game.flags.opened) {
      hero.alt = "door:close";
      hero.altLabel = "Close";
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
    if (!spec || !spec.opened || spec.hours === "closed") return "shopClosed";
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
    var fromKey = (ui && ui.artFrom) || key;
    var toKey = (ui && ui.artTo) || key;
    var fade = ui && ui.artT != null ? ui.artT : 1;
    if (fromKey === toKey || fade >= 0.999) {
      if (!blitCover(ctx, toKey, x, y, w, h, SHOP_BIAS)) {
        ctx.fillStyle = spec.phase === "night" ? NIGHT : "#cbbba6";
        ctx.fillRect(x, y, w, h);
      }
    } else {
      ctx.save();
      ctx.globalAlpha = 1 - fade;
      if (!blitCover(ctx, fromKey, x, y, w, h, SHOP_BIAS)) {
        ctx.fillStyle = "#8a7560";
        ctx.fillRect(x, y, w, h);
      }
      ctx.globalAlpha = fade;
      if (!blitCover(ctx, toKey, x, y, w, h, SHOP_BIAS)) {
        ctx.fillStyle = spec.phase === "night" ? NIGHT : "#cbbba6";
        ctx.fillRect(x, y, w, h);
      }
      ctx.restore();
    }
    var dim = spec.dim != null ? spec.dim : (dayOne ? 1 : 0);
    if (dim > 0.02 && !painted(key)) {
      ctx.fillStyle = "rgba(20,16,14," + (0.62 * dim).toFixed(3) + ")";
      ctx.fillRect(x, y, w, h);
    }
    if (spec.phase === "night" && !painted(key)) {
      if (closed && !dayOne) {
        ctx.fillStyle = "rgba(16,22,40,0.22)";
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeStyle = "rgba(239,230,212,0.35)";
      ctx.lineWidth = 1;
      var ri;
      var rainShift = ((now || 0) / 28) % (h + 20);
      for (ri = 0; ri < 22; ri++) {
        var rx = x + ((ri * 97) % 1000) / 1000 * w;
        var ry = y + ((ri * 53 + rainShift) % (h * 0.9));
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 3, ry + 11);
        ctx.stroke();
      }
    }
    if (!dayOne && spec.district && spec.district !== "downtown" && !painted(key)) {
      var nk = spec.district === "campus" ? "campus" : "night";
      blitContain(ctx, nk, x + w * 0.78, y + h * 0.3, w * 0.16, h * 0.2);
    }
    if (spec.rival && !dayOne && who !== "juniper" && !painted(key)) {
      blitContain(ctx, spec.phase === "night" ? "shopNight" : "shopNoon", x + w * 0.64, y + h * 0.26, w * 0.12, h * 0.16);
    }
    paintLiving(ctx, { x: x, y: y, w: w, h: h }, spec, who, ui, now);
    if (!(ui && ui.screenSlip)) {
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
    }
    if (plan.door && !(ui && ui.menu) && !(ui && ui.screenSlip)) {
      var doorW = Math.min(168, Math.max(96, w * 0.16));
      var doorH = 36;
      var doorX = x + w * 0.34;
      var doorY = y + h - (ui && ui.L && ui.L.dock ? ui.L.dock : 102) - doorH - 16;
      if (doorY < y + 8) doorY = y + 8;
      geo.door = { x: doorX, y: doorY, w: doorW, h: doorH };
      paintWords(ctx, doorX, doorY, doorW, doorH, shortChoice(plan.door.label), ui.hover === plan.door.id);
    }
    if (!dayOne && spec.sign && spec.shop) {
      var nameW = Math.min(240, w * 0.32);
      var nameH = 32;
      var nameX = x + (w - nameW) * 0.5;
      var nameY = y + 18;
      if (spec.rewind === 0) {
        ctx.fillStyle = "rgba(20,16,14,0.78)";
        ctx.fillRect(nameX, nameY, nameW, nameH);
      } else paintShopName(ctx, spec.shop, nameX, nameY, nameW, nameH);
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
    if (who && !(ui && ui.screenSlip)) {
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

    if (!(ui && ui.screenSlip)) {
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
    }

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
    if (ui.cashShown != null) spec.cash = ui.cashShown;
    spec.doorOpen = ui.door || 0;
    spec.dim = ui.dim;
    if (cashPulse && now - cashPulse < 420) spec.cashBump = -Math.sin((now - cashPulse) / 420 * Math.PI) * 6;
    var who = spec.dayOne ? "" : cardWho(lifeId, hero);
    var plan = choicePlan(who, hero);
    ui.plan = plan;
    ui.screenSlip = true;
    if (!ui.menu && !spec.dayOne) {
      pushHit(ui, "stand:register", w * 0.08, top + cardH * 0.78, Math.max(44, w * 0.1), Math.max(28, cardH * 0.08));
      pushHit(ui, "stand:door", w * 0.42, top + cardH * 0.78, Math.max(44, w * 0.1), Math.max(28, cardH * 0.08));
      if (spec.floor && w >= 560) pushHit(ui, "stand:upstairs", w * 0.36, top + cardH * 0.22, Math.max(36, w * 0.08), Math.max(22, cardH * 0.06));
    }
    bindCam(ui, w, cardH, top);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(0, top, w, cardH);
    ctx.clip();
    ctx.translate(ui.cam.fx, ui.cam.fy);
    ctx.scale(ui.cam.z, ui.cam.z);
    ctx.translate(-ui.cam.fx, -ui.cam.fy);
    var geo = drawStreet(ctx, { x: 0, y: top, w: w, h: cardH }, spec, who, plan, hero, ui, now);
    ctx.restore();
    ctx.globalAlpha = 1;
    var slip = ui.menu ? null : drawScreenSlip(ctx, ui, w, slipWords(hero, spec), plan);
    if (slip && plan.slip) pushHit(ui, plan.slip.id, slip.x, slip.y, slip.w, slip.h);
    if (slip) pushHit(ui, "hdr:settings", slip.x, slip.y, 22, 22);
    if (!ui.menu && plan.door && geo.door) {
      pushWorld(ui, plan.door.id, geo.door.x, geo.door.y, geo.door.w, geo.door.h);
      var doorHit = ui.hits[ui.hits.length - 1];
      var doorCx = doorHit.x + doorHit.w * 0.5;
      var doorCy = doorHit.y + doorHit.h * 0.5;
      if (doorCx < 8 || doorCy < 8 || doorCx > w - 8 || doorCy > cardH - 8) {
        var pinW = Math.min(150, w - 24);
        var pinH = 36;
        var pinX = 12;
        var pinY = cardH - (L.dock || 96) - 52;
        drawTag(ctx, pinX, pinY, pinW, pinH, plan.door.label, ui.hover === plan.door.id);
        pushHit(ui, plan.door.id, pinX, pinY, pinW, pinH);
      }
    }
    if (plan.person && geo.person) pushWorld(ui, plan.person.id, geo.person.x, geo.person.y, geo.person.w, geo.person.h);
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
    var sink = pressSink(ui, id);
    ctx.save();
    ctx.shadowBlur = 0;
    icon(ctx, kind, x + s * 0.5, y + sink + s * 0.5, s * 0.62, on ? LAMP : PAPER);
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
    if (game) {
      var offer = offerKey(game);
      if (logAnim.offer !== offer) {
        logAnim.offer = offer;
        logAnim.offerT = 0;
      } else if ((logAnim.offerT || 0) < 1) {
        logAnim.offerT += dt / 260;
        if (logAnim.offerT > 1) logAnim.offerT = 1;
      }
    }
    if (frameUi && game) feedClock(frameUi, game, dt);
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

  function offerKey(game) {
    var now = (game && game.lastReal) || 0;
    if (game.player && game.player.heldUntil && now < game.player.heldUntil) return "held";
    if (!game.flags || game.flags.chosen === false) return "dayone";
    var front = game.world && game.world.spine && game.world.spine[0];
    if (front) return "spine:" + front;
    if (game.world && game.world.showing) return "show:" + game.world.showing;
    return "log:" + (game.logHead || 0);
  }

  function currentHero(game, now) {
    var newest = game.logN - 1;
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
    return hero;
  }

  function readableLog(game, text) {
    var raw = String(text || "");
    var idm = raw.match(/life:\s*([a-z0-9_]+)/i);
    if (idm && S.lifeBeat) {
      var lived = S.lifeBeat(game, idm[1]);
      if (lived && lived.line) return lived.line;
    }
    if (raw.charAt(0) === "!" || raw.charAt(0) === "+" || raw.charAt(0) === "*") return raw.substring(1).replace(/^\s+/, "");
    return raw;
  }

  function idleStatus(game, now) {
    var bits = [];
    var phase = S.phaseAt(now);
    if (phase && phase.name) bits.push(phase.name);
    var opened = !!(game.flags && game.flags.opened);
    var world = game.world || {};
    var closed = doorClosed(game);
    var slot = game.slots && game.slots[0];
    if (!opened) bits.push("Not selling");
    else if (closed) bits.push("Shop closed");
    else if (S.registerCovered && !S.registerCovered(game)) bits.push("The register is empty");
    else if (slot && slot.stock <= 0) bits.push("Shop open. Shelf empty");
    else bits.push("Shop open. Selling");
    var hirePlace = S.personPlace ? S.personPlace(game, "hire") : "";
    if (hirePlace === "counter" && slot && slot.employee) {
      bits.push(slot.employee.caught ? "Busted" : (slot.employee.name + " on the register"));
    }
    if (opened && !closed && game.pulse && game.lastNet) bits.push("last " + S.money(game.lastNet));
    if (game.degree && game.degree.left != null) {
      var def = D.degreeById[game.degree.id];
      bits.push((def ? def.name : "Class") + " " + S.fmtMs(game.degree.left));
    }
    var missions = game.scouts || [];
    var i;
    for (i = 0; i < missions.length && i < 2; i++) {
      var mission = missions[i];
      var scout = D.scoutById[mission.id];
      bits.push((scout ? scout.name : "Scout") + " " + S.fmtMs(mission.left));
    }
    if (world.rival) bits.push(world.rival);
    if (game.flags && game.flags.shady && (game.player.heat || 0) > 0) bits.push("Heat " + Math.round(game.player.heat));
    if (world.regular && world.regular.name && world.regular.mood != null) bits.push(world.regular.name + " mood " + world.regular.mood);
    return bits.join("  ·  ");
  }


  function pressSink(ui, id) {
    var press = ui && ui.press;
    if (!press || press.id !== id) return 0;
    var age = (ui.now || 0) - press.at;
    if (age < 0 || age >= 140) return 0;
    var u = age / 140;
    var dip = u < 0.45 ? u / 0.45 : 1 - (u - 0.45) / 0.55;
    return dip * 2;
  }

  function shopSelling(game) {
    if (!game || !game.flags || !game.flags.opened) return false;
    if (doorClosed(game)) return false;
    var slot = game.slots && game.slots[0];
    return !!(slot && slot.stock > 0);
  }

  function lifeCardFocus(game) {
    if (!game || !game.flags || !game.flags.chosen) return false;
    var world = game.world;
    if (!world) return false;
    if (world.spine && world.spine.length) return true;
    return !!world.showing;
  }

  function drawTab(ctx, ui, id, x, y, w, h, label, on) {
    if (!id || w < 8 || h < 8) return;
    var hover = ui.hover === id;
    var sc = uiScale(ui, id);
    var cx = x + w * 0.5;
    var cy = y + h * 0.5;
    var sink = pressSink(ui, id);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.translate(cx, cy + sink);
    ctx.scale(sc, sc);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = on ? LAMP : (hover ? "#f7f1e4" : PAPER);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = INK;
    ctx.lineWidth = on ? 2 : 1;
    ctx.strokeRect(x, y, w, h);
    var f = font(w < 110 ? 13 : 15, false, 700, true);
    ctx.font = f;
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, f, label || "", w - 12), cx, cy);
    ctx.restore();
    pushHit(ui, id, x, y, w, h);
  }

  function drawChoice(ctx, ui, id, x, y, w, h, label) {
    if (!id) return;
    var press = ui.press && ui.press.id === id;
    var age = press ? ((ui.now || 0) - ui.press.at) : 9999;
    var answered = !!(press && age >= 0 && age < 220);
    drawTab(ctx, ui, id, x, y, w, h, label, answered);
  }

  function shopFlash(ui) {
    var flash = 0;
    if (ui && ui.payKind && !ui.coin) flash = ui.payKind === "shift" ? 0.55 : 0.28;
    if (ui && ui.coin) {
      var u = ui.coin.dur > 0 ? ui.coin.t / ui.coin.dur : 1;
      if (u < 0) u = 0;
      if (u > 1) u = 1;
      var hump = Math.sin(u * Math.PI);
      flash = ui.coin.small ? hump * 0.28 : hump * 0.55;
    }
    if (ui && ui.cust && ui.cust.t < 1) {
      var pulse = Math.sin(ui.cust.t * Math.PI) * 0.22;
      if (pulse > flash) flash = pulse;
    }
    return flash;
  }

  function drawShopFrame(ctx, game, spec, key, x, y, w, h, caption, dimRate) {
    var capH = h > 64 ? 16 : 0;
    var photoH = Math.max(8, h - capH);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(x, y, w, photoH);
    ctx.clip();
    ctx.fillStyle = "#14110e";
    ctx.fillRect(x, y, w, photoH);
    blitContain(ctx, key, x, y, w, photoH);
    if (spec.lights) {
      ctx.fillStyle = "rgba(240,195,106,0.16)";
      ctx.fillRect(x, y, w, photoH);
    }
    if (!dimRate) {
      ctx.beginPath();
      ctx.arc(x + w - 12, y + 12, 4, 0, Math.PI * 2);
      ctx.fillStyle = spec.lights ? LAMP : "#6a5a40";
      ctx.fill();
    }
    if (spec.sign) {
      var signW = Math.min(Math.max(28, w * 0.36), w - 16);
      ctx.fillStyle = LAMP;
      ctx.fillRect(x + 8, y + 8, signW, 10);
      if (spec.shop) {
        ctx.font = textFace(11, "title");
        ctx.fillStyle = INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(clipText(ctx, textFace(11, "title"), spec.shop, signW - 6), x + 8 + signW * 0.5, y + 13);
      }
    }
    if (spec.counter) {
      ctx.fillStyle = "rgba(239,230,212,0.75)";
      ctx.fillRect(x + w * 0.18, y + photoH - 12, Math.max(16, w * 0.22), 4);
    }
    var places = spec.places || {};
    if (places.hire === "counter") {
      var px = x + w * 0.56;
      var foot = y + photoH - 6;
      ctx.fillStyle = "#e4c2a4";
      ctx.beginPath();
      ctx.arc(px, foot - 22, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#243044";
      ctx.fillRect(px - 6, foot - 15, 12, 15);
    }
    if (spec.opened && spec.stock <= 0) {
      ctx.strokeStyle = "rgba(239,230,212,0.7)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 8, y + photoH - 22, Math.min(36, w * 0.28), 8);
    }
    ctx.restore();
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(239,230,212,0.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, photoH - 1);
    if (capH) {
      var rate = S.money((game && game.lastNet) || 0);
      var rateFace = textFace(11, "num");
      var rateW = measure(ctx, rateFace, rate);
      ctx.font = textFace(11, "body");
      ctx.fillStyle = dimRate ? "#6e665c" : PAPER;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(clipText(ctx, textFace(11, "body"), caption || "", Math.max(8, w - rateW - 10)), x + 2, y + photoH + 8);
      ctx.font = rateFace;
      ctx.fillStyle = dimRate ? "#6e665c" : LAMP;
      ctx.textAlign = "right";
      ctx.fillText(rate, x + w - 2, y + photoH + 8);
    }
    ctx.restore();
    return photoH;
  }

  function lifeMeasure(L) {
    var max = 560;
    var w = L.w - 16;
    if (w > max) w = max;
    w = Math.floor(w / 8) * 8;
    if (w < 160) w = Math.max(160, L.w - 16);
    var x = Math.round((L.w - w) * 0.5);
    return { x: x, w: w };
  }

  function choiceBag(hero) {
    var bag = {};
    function add(id, label) {
      if (id) bag["id:" + id] = 1;
      if (label) bag["lb:" + String(label).toLowerCase()] = 1;
    }
    if (!hero) return bag;
    add(hero.action, hero.label);
    add(hero.alt, hero.altLabel);
    return bag;
  }

  function choiceRepeats(bag, id, label) {
    if (bag["id:" + id]) return true;
    if (label && bag["lb:" + String(label).toLowerCase()]) return true;
    return false;
  }

  function choiceLines(ctx, label, width) {
    var face = textFace(15, "title");
    var lines = wrapLines(ctx, face, label || "", Math.max(48, width - 16), 3);
    var h = Math.max(40, lines.length * 20 + 16);
    h = Math.ceil(h / 8) * 8;
    return { lines: lines, h: h };
  }

  function chipControl(ctx, ui, id, x, y, w, h, lines, kind) {
    if (w < 8 || h < 8) return;
    var sink = pressSink(ui, id);
    var yy = y + sink;
    ctx.save();
    ctx.shadowBlur = 0;
    round(ctx, x, yy, w, h, 8);
    var ink = PAPER;
    if (kind === "lamp" || kind === "dim") {
      ctx.fillStyle = kind === "dim" ? "#6a5430" : LAMP;
      ctx.fill();
      ink = kind === "dim" ? "#2a2118" : INK;
    } else if (kind === "paper") {
      ctx.fillStyle = PAPER;
      ctx.fill();
      ink = INK;
    } else {
      ctx.fillStyle = "#14110e";
      ctx.fill();
      ctx.strokeStyle = "rgba(239,230,212,0.28)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ink = PAPER;
    }
    ctx.font = textFace(15, "title");
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var n = lines && lines.length ? lines.length : 1;
    var text = lines && lines.length ? lines : [""];
    var i;
    for (i = 0; i < n; i++) {
      ctx.fillText(text[i], x + w * 0.5, yy + h * 0.5 + (i - (n - 1) * 0.5) * 18);
    }
    ctx.restore();
    if (id && ui) pushHit(ui, id, x, y, w, h);
  }

  function paintStamp(ctx, text, x, y, color) {
    var chars = String(text || "").toUpperCase().split("");
    ctx.font = textFace(11, "title");
    ctx.fillStyle = color || LAMP;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    var pen = x;
    var i;
    for (i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], pen, y);
      pen += ctx.measureText(chars[i]).width + 1.5;
    }
  }

  function secondSlotState(game) {
    var slots = game.slots || [];
    var owned = slots.length > 1;
    var cap = S.slotCap ? S.slotCap(game) : 1;
    return { show: owned || cap < 2 || !!(game.world && game.world.secondLot), owned: owned };
  }

  function goalAction(goal) {
    if (!goal) return "";
    if (goal.id === "rent") return "rentpay";
    if (goal.id === "stock") return "stock:0";
    if (goal.id === "hire") return "applicants";
    if (goal.id.indexOf("deg:") === 0) return goal.id;
    return roomAction(goal.id);
  }

  function partMark(id) {
    if (id === "lights") return "bulb";
    if (id === "sign") return "star";
    if (id === "plant") return "drop";
    if (id === "speaker") return "flame";
    if (id === "room" || id === "floor") return "shop";
    if (id === "safe" || id === "cooler") return "box";
    return "key";
  }

  function miniHand(ctx, cx, cy, r, remain) {
    var left = remain;
    if (left < 0) left = 0;
    if (left > 1) left = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(239,230,212,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (left > 0.01) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
      ctx.strokeStyle = LAMP;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    var ang = -Math.PI / 2 + Math.PI * 2 * (1 - left);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * (r - 1), cy + Math.sin(ang) * (r - 1));
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function paintScrollFade(ctx, body, ui) {
    if (!body) return;
    var color = (ui && ui.ground) || "#1a2744";
    var scroll = ui.scroll || 0;
    var content = ui.contentH || 0;
    ctx.save();
    ctx.shadowBlur = 0;
    if (scroll > 4) {
      var g = ctx.createLinearGradient(0, body.y, 0, body.y + 24);
      g.addColorStop(0, color);
      g.addColorStop(1, hexA(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(body.x, body.y, body.w, 24);
    }
    if (content > body.h + scroll + 4) {
      var g2 = ctx.createLinearGradient(0, body.y + body.h - 24, 0, body.y + body.h);
      g2.addColorStop(0, hexA(color, 0));
      g2.addColorStop(1, color);
      ctx.fillStyle = g2;
      ctx.fillRect(body.x, body.y + body.h - 24, body.w, 24);
    }
    ctx.restore();
  }

  function drawSoundSwitch(ctx, ui, x, y, w, on) {
    var sink = pressSink(ui, "opt:sound");
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.font = textFace(15, "body");
    ctx.fillStyle = PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Sound", x, y + 16 + sink);
    var tw = 40;
    var th = 16;
    var tx = x + w - tw;
    var ty = y + 8 + sink;
    round(ctx, tx, ty, tw, th, 8);
    ctx.fillStyle = on ? LAMP : "#14110e";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = on ? LAMP : "rgba(239,230,212,0.35)";
    ctx.stroke();
    ctx.beginPath();
    var kx = on ? tx + tw - 14 : tx + 2;
    ctx.arc(kx + 6, ty + 8, 6, 0, Math.PI * 2);
    ctx.fillStyle = on ? INK : PAPER;
    ctx.fill();
    ctx.restore();
    if (ui) pushHit(ui, "opt:sound", x, y, w, 32);
  }

  function drawUpgradeRow(flow, game, ui) {
    var catalog = roomCatalog();
    var goal = screenGoal(game);
    var r = row(flow, 48);
    if (!r.on) return;
    var ctx = flow.ctx;
    var n = catalog.length;
    var gap = 8;
    var cell = (flow.w - gap * (n - 1)) / n;
    var i;
    ctx.save();
    ctx.shadowBlur = 0;
    for (i = 0; i < n; i++) {
      var id = catalog[i][0];
      var owned = partOwned(game, id);
      var next = !!(goal && goal.id === id && !owned);
      var x = flow.x + i * (cell + gap);
      ctx.globalAlpha = (!owned && !next) ? 0.28 : 1;
      round(ctx, x, r.y + 8, Math.max(8, cell), 32, 8);
      ctx.fillStyle = next ? LAMP : (owned ? PAPER : "#14110e");
      ctx.fill();
      icon(ctx, partMark(id), x + cell * 0.5, r.y + 24, Math.min(16, cell * 0.7), (next || owned) ? INK : PAPER);
      ctx.globalAlpha = 1;
      var act = roomAction(id);
      if (act && !owned && ui && partOpen(game, id)) pushHit(ui, act, x, r.y, Math.max(8, cell), 40);
    }
    ctx.restore();
  }

  function drawOwnedShelf(flow, game, ui) {
    var owned = [];
    var i;
    for (i = 0; i < D.ITEMS.length; i++) if ((game.mats[D.ITEMS[i].id] || 0) > 0) owned.push(D.ITEMS[i]);
    var nxt = nextShelfBuy(game);
    var count = owned.length + (nxt ? 1 : 0);
    if (!count) {
      darkNote(flow, "The shelf is empty.");
      return;
    }
    var gap = 8;
    var cell = (flow.w - gap * (count - 1)) / count;
    var iconH = 64;
    var r = row(flow, iconH + 8);
    if (!r.on) return;
    var ctx = flow.ctx;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#3a2a22";
    ctx.fillRect(flow.x, r.y + iconH - 6, flow.w, 6);
    var box = Math.min(56, Math.max(24, cell - 8));
    for (i = 0; i < owned.length; i++) {
      var ix = flow.x + i * (cell + gap);
      var bx = ix + (cell - box) * 0.5;
      if (!blitContain(ctx, itemArt(owned[i].cat), bx, r.y, box, box)) {
        ctx.fillStyle = "#241c16";
        ctx.fillRect(bx, r.y, box, box);
      }
    }
    if (nxt) {
      var ex = flow.x + owned.length * (cell + gap);
      var ebx = ex + (cell - box) * 0.5;
      ctx.strokeStyle = "rgba(239,230,212,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(ebx, r.y, box, box);
      var afford = !nxt.locked && (game.player.capital || 0) >= nxt.cost;
      ctx.font = textFace(13, "num");
      ctx.fillStyle = afford ? PAPER : "#6e665c";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var tag = nxt.locked ? "Locked" : S.money(nxt.cost);
      ctx.fillText(clipText(ctx, textFace(13, "num"), tag, Math.max(8, box - 4)), ebx + box * 0.5, r.y + box * 0.5);
      if (!nxt.locked && ui) pushHit(ui, "buy:" + nxt.item.id, ebx, r.y, box, box);
    }
    ctx.restore();
  }

  function drawShelfList(flow, game) {
    var cap = (game.player && game.player.capital) || 0;
    var i;
    for (i = 0; i < D.ITEMS.length; i++) {
      var item = D.ITEMS[i];
      if ((game.mats[item.id] || 0) > 0) continue;
      var cost = S.marketCost(game, item);
      var locked = (game.player.level || 1) < item.level;
      var price = locked ? ("Year " + item.level) : S.money(cost);
      darkLine(flow, locked ? "" : ("buy:" + item.id), item.name, price, locked || cap < cost);
    }
  }

function drawMiniShop(ctx, game, ui, x, y, w, h, now) {
    var spec = storySpec(game, now, false);
    var closed = !spec.opened || spec.hours === "closed";
    var key = closed ? "shopClosed" : phaseShopKey(spec);
    var job = spec.job;
    var cap = (game.player && game.player.shop) || (job && job.name) || ("Year " + (game.player.level || 1));
    var second = secondSlotState(game);
    var gap = 8;
    var capH = h > 64 ? 16 : 0;
    var photoH0 = Math.max(8, h - capH);
    var sideW = 0;
    var sidePhoto = 0;
    if (second.show && w >= 168 && photoH0 >= 64) {
      sidePhoto = Math.max(40, Math.round(photoH0 * 0.42 / 8) * 8);
      sideW = Math.round(sidePhoto * 16 / 9);
      if (sideW > w * 0.34) {
        sideW = Math.floor(w * 0.34 / 8) * 8;
        sidePhoto = Math.round(sideW * 9 / 16);
      }
      if (sideW < 48) sideW = 0;
    }
    var mainW = sideW ? w - sideW - gap : w;
    if (ui) ui.shopPt = { x: x + mainW * 0.5, y: y + photoH0 * 0.5 };
    var photoH = drawShopFrame(ctx, game, spec, key, x, y, mainW, h, cap, closed);
    if (ui && ui.cust && ui.cust.t < 1 && photoH > 16) {
      var u = ui.cust.t;
      var alpha = u < 0.12 ? u / 0.12 : (u > 0.82 ? (1 - u) / 0.18 : 1);
      var cx = x + 14 + Math.max(8, mainW - 28) * u;
      var foot = y + photoH - 4;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(cx, foot - 14, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 3, foot - 10, 6, 10);
      ctx.restore();
    }
    if (sideW) {
      var sx = x + mainW + gap;
      var secondH = sidePhoto + capH;
      var sy = y + (h - secondH);
      if (second.owned) drawShopFrame(ctx, game, spec, key, sx, sy, sideW, secondH, "Shop 2", closed);
      else {
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#14110e";
        ctx.fillRect(sx, sy, sideW, sidePhoto);
        ctx.strokeStyle = "rgba(239,230,212,0.45)";
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, sideW - 1, sidePhoto - 1);
        ctx.font = textFace(11, "body");
        ctx.fillStyle = "#6e665c";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Locked", sx + sideW * 0.5, sy + sidePhoto * 0.5);
        if (capH) ctx.fillText("Slot 2", sx + sideW * 0.5, sy + sidePhoto + 8);
        ctx.restore();
      }
    }
  }


  function drawEventCard(ctx, game, ui, hero, x, y, w, now) {
    var pad = 16;
    var railW = 8;
    var narrow = w < 480;
    var bodyFace = textFace(15, "body");
    var photoH = narrow ? 104 : 120;
    var photoW = narrow ? (w - pad * 2 - railW) : Math.round(photoH * 16 / 9);
    if (!narrow && photoW > Math.floor(w * 0.4)) photoW = Math.floor(w * 0.4 / 8) * 8;
    var textW = w - pad * 2 - railW - (narrow ? 0 : photoW + 8);
    var lines = wrapLines(ctx, bodyFace, hero.line || "", Math.max(80, textW), 5);
    var textH = 24 + lines.length * 22;
    var topH = narrow ? (textH + photoH + 8) : Math.max(textH, photoH);
    var inner = w - pad * 2 - railW;
    var half = (inner - 8) / 2;
    var mainM = hero.action ? choiceLines(ctx, hero.label, (narrow || !hero.alt) ? inner : half) : { h: 0, lines: [""] };
    var altM = hero.alt ? choiceLines(ctx, hero.altLabel, narrow ? inner : half) : { h: 0, lines: [""] };
    var ch = Math.max(mainM.h || 0, altM.h || 0);
    var choicesH = 0;
    if (hero.action && hero.alt) choicesH = narrow ? (ch * 2 + 8) : ch;
    else if (hero.action) choicesH = ch;
    var cardH = pad + topH + (choicesH ? 8 + choicesH : 0) + pad;
    cardH = Math.ceil(cardH / 8) * 8;
    ctx.save();
    ctx.shadowBlur = 0;
    round(ctx, x, y, w, cardH, 2);
    ctx.fillStyle = "#14110e";
    ctx.fill();
    ctx.fillStyle = hero.rail || LAMP;
    ctx.fillRect(x, y + 2, railW, Math.max(8, cardH - 4));
    if (hero.stamp) paintStamp(ctx, hero.stamp, x + railW + pad, y + pad, hero.rail || LAMP);
    ctx.font = bodyFace;
    ctx.fillStyle = PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    var textY = y + pad + 16;
    var i;
    for (i = 0; i < lines.length; i++) ctx.fillText(lines[i], x + railW + pad, textY + i * 22);
    var photoX = narrow ? (x + railW + pad) : (x + w - pad - photoW);
    var photoY = narrow ? (textY + lines.length * 22 + 8) : (y + pad);
    if (photoW > 16 && photoH > 16) drawMiniShop(ctx, game, ui, photoX, photoY, photoW, photoH, now);
    else if (ui) ui.shopPt = { x: x + w - 24, y: y + 28 };
    if (hero.action) {
      var by = y + pad + topH + 8;
      var bx = x + railW + pad;
      if (hero.alt) {
        if (narrow) {
          chipControl(ctx, ui, hero.action, bx, by, inner, ch, mainM.lines, "lamp");
          chipControl(ctx, ui, hero.alt, bx, by + ch + 8, inner, ch, altM.lines, "dark");
        } else {
          chipControl(ctx, ui, hero.action, bx, by, half, ch, mainM.lines, "lamp");
          chipControl(ctx, ui, hero.alt, bx + half + 8, by, half, ch, altM.lines, "dark");
        }
      } else chipControl(ctx, ui, hero.action, bx, by, inner, ch, mainM.lines, "lamp");
    }
    ctx.restore();
    return cardH;
  }


  function drawClicker(ctx, ui, game, hero, x, y, w) {
    var bag = choiceBag(hero);
    var tutor = D.hobbyById.tutor;
    var items = [
      { id: "shift", label: "Work the rush" },
      { id: "hobby", label: tutor ? tutor.name : "Tutor" },
      { id: "stock:0", label: "Restock" }
    ];
    var shown = [];
    var i;
    for (i = 0; i < items.length; i++) {
      if (choiceRepeats(bag, items[i].id, items[i].label)) continue;
      shown.push(items[i]);
    }
    if (!shown.length) return 0;
    var gap = 8;
    var bw = (w - gap * (shown.length - 1)) / shown.length;
    var metrics = [];
    var ch = 40;
    for (i = 0; i < shown.length; i++) {
      var block = choiceLines(ctx, shown[i].label, bw);
      metrics.push(block);
      if (block.h > ch) ch = block.h;
    }
    for (i = 0; i < shown.length; i++) {
      chipControl(ctx, ui, shown[i].id, x + i * (bw + gap), y, bw, ch, metrics[i].lines, "paper");
    }
    return ch;
  }


  function drawIdleBar(ctx, game, ui, x, y, w, now) {
    var text = idleStatus(game, now);
    var f = textFace(13, "body");
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(20, 16, 14, 0.55)";
    ctx.fillRect(x, y, w, 32);
    ctx.font = f;
    ctx.fillStyle = PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, f, text, w - 16), x + 8, y + 16);
    if (ui && ui.cust && ui.cust.t < 1) {
      var e = 1 - Math.pow(1 - ui.cust.t, 3);
      var px = x + 8 + Math.max(12, w - 28) * e;
      var alpha = ui.cust.t > 0.82 ? (1 - ui.cust.t) / 0.18 : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = LAMP;
      ctx.fillRect(px, y + 26, 10, 3);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }


  function drawLogPanel(ctx, game, ui, x, y, w, h) {
    var n = game.logN || 0;
    var maxBack = Math.max(0, n - 1);
    if ((ui.logScroll || 0) > maxBack) ui.logScroll = maxBack;
    if ((ui.logScroll || 0) < 0) ui.logScroll = 0;
    var back = ui.logPin === false ? (ui.logScroll || 0) : 0;
    var body = textFace(13, "body");
    var lineH = 24;
    var room = Math.max(1, Math.floor((h - 8) / lineH));
    if (room > 5) room = 5;
    var end = n - back;
    var from = Math.max(0, end - room);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(20, 16, 14, 0.55)";
    ctx.fillRect(x, y, w, h);
    if (!n) {
      ctx.font = body;
      ctx.fillStyle = "#8a8178";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("Quiet.", x + 8, y + Math.min(16, h * 0.5));
      ctx.restore();
      ui.logTop = y;
      ui.logBot = y + h;
      return;
    }
    var i;
    var row = 0;
    for (i = from; i < end && row < room; i++) {
      var text = readableLog(game, S.logLine(game, i) || "");
      var newest = i === n - 1 && back === 0;
      var fresh = newest && (logAnim.t || 1) < 1;
      var enter = fresh ? (1 - easeOut(logAnim.t)) * 8 : 0;
      ctx.globalAlpha = fresh ? (0.4 + 0.6 * easeOut(logAnim.t)) : 1;
      ctx.font = body;
      ctx.fillStyle = newest ? PAPER : "#8a8178";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(clipText(ctx, body, text, w - 16), x + 8, y + 12 + row * lineH + enter);
      row += 1;
    }
    ctx.restore();
    ui.logTop = y;
    ui.logBot = y + h;
  }


  function drawIdentity(ctx, game, ui, L) {
    var shown = ui.cashShown != null ? ui.cashShown : game.player.capital;
    var cash = S.money(shown);
    var narrow = L.w < 520;
    var numSize = narrow ? 18 : 28;
    var numFace = textFace(numSize, "num");
    var yearFace = textFace(narrow ? 15 : 18, "body");
    var goal = screenGoal(game);
    var base = narrow ? 36 : 40;
    var gear = 24;
    var gearX = L.w - 16 - gear;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(0, 0, L.w, L.header);
    ctx.clip();
    var yearLabel = "Year ";
    ctx.font = yearFace;
    ctx.fillStyle = PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(yearLabel, 16, base);
    var yearNum = String((game.player && game.player.level) || 1);
    ctx.font = numFace;
    ctx.fillStyle = ui.yearPop > 0 ? LAMP : PAPER;
    ctx.fillText(yearNum, 16 + measure(ctx, yearFace, yearLabel), base);
    ctx.font = numFace;
    ctx.fillStyle = PAPER;
    ctx.textAlign = "right";
    var cashRight = gearX - 8;
    var cashW = measure(ctx, numFace, cash);
    ctx.fillText(cash, cashRight, base);
    ui.cashX = cashRight - cashW * 0.5;
    ui.cashPt = { x: ui.cashX, y: base - numSize * 0.35 };
    if (goal) {
      var labelFace = textFace(13, "body");
      var price = goal.price || (goal.cost > 0 ? S.money(goal.cost) : "");
      var priceFace = textFace(13, "num");
      var trackX = 16;
      var trackW = L.w - 32;
      var trackH = 8;
      var trackY = L.header - 16;
      var labelY = trackY - 10;
      var fill = goal.cost > 0 ? shown / goal.cost : (goal.fill || 0);
      if (fill < 0) fill = 0;
      if (fill > 1) fill = 1;
      ctx.font = labelFace;
      ctx.fillStyle = PAPER;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(clipText(ctx, labelFace, goal.label || "", trackW), trackX, labelY);
      round(ctx, trackX, trackY, trackW, trackH, 2);
      ctx.fillStyle = "rgba(239,230,212,0.16)";
      ctx.fill();
      if (fill > 0) {
        ctx.save();
        round(ctx, trackX, trackY, trackW, trackH, 2);
        ctx.clip();
        ctx.fillStyle = LAMP;
        ctx.fillRect(trackX, trackY, Math.max(2, trackW * fill), trackH);
        ctx.restore();
      }
      if (price) {
        ctx.font = priceFace;
        ctx.fillStyle = fill > 0.72 ? INK : PAPER;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(price, trackX + trackW - 8, trackY + trackH * 0.5);
      }
    }
    ctx.restore();
    roundButton(ctx, ui, "hdr:settings", gearX, Math.max(8, base - gear), gear, "gear", ui.menu === "settings");
  }


  function feedClock(ui, game, dt) {
    if (!ui || !game) return;
    if (!ui.feed) ui.feed = { n: -1, head: -1, t: 1, freshIndex: -1, hard: false, held: {} };
    var f = ui.feed;
    if (!f.held) f.held = {};
    var n = game.logN || 0;
    var head = game.logHead || 0;
    if (f.n < 0) {
      f.n = n;
      f.head = head;
      f.freshIndex = -1;
      f.t = 1;
    } else if (f.n !== n || f.head !== head) {
      f.n = n;
      f.head = head;
      f.freshIndex = n - 1;
    }
    if (f.t >= 1 && f.freshIndex >= 0) f.held[f.freshIndex] = 1;
    if (ui.verdict && ui.verdict.t < 1) {
      ui.verdict.t += (dt > 0 ? dt : 16) / 640;
      if (ui.verdict.t > 1) ui.verdict.t = 1;
    }
    if (ui.verdict && ui.verdict.t >= 1 && !ui.verdict.saved) {
      ui.verdict.saved = true;
      if ((game.logN || 0) > (ui.verdict.before || 0)) {
        if (!ui.plateMemory) ui.plateMemory = [];
        ui.plateMemory.push({
          before: ui.verdict.before || 0,
          text: ui.verdict.text || "",
          art: ui.verdict.art || "",
          portrait: ui.verdict.portrait || "",
          object: ui.verdict.object || "",
          phase: ui.verdict.phase || "",
          bust: !!ui.verdict.bust,
          stamp: ui.verdict.stamp || "",
          notebook: !!ui.verdict.notebook,
          crate: !!ui.verdict.crate,
          slot2: !!ui.verdict.slot2
        });
        if (ui.plateMemory.length > 16) ui.plateMemory.shift();
      }
      ui.verdict = null;
    }
  }

  function pokeChoice(ui, game, id, now) {
    if (!ui || !game || !id) return;
    var hero = currentHero(game, now || Date.now());
    if (!hero) return;
    var taken = "";
    var other = "";
    if (hero.action === id) {
      taken = hero.label || "";
      other = hero.altLabel || "";
    } else if (hero.alt === id) {
      taken = hero.altLabel || "";
      other = hero.label || "";
    } else return;
    var pics = choicePictures(hero, game, now || Date.now());
    ui.verdict = {
      text: hero.line || "",
      taken: taken,
      other: other,
      before: game.logN || 0,
      t: 0,
      art: pics.art,
      portrait: pics.portrait,
      object: pics.object,
      phase: pics.phase,
      stamp: pics.bust ? "Busted" : (hero.stamp || ""),
      bust: pics.bust,
      notebook: pics.notebook,
      crate: pics.crate,
      slot2: pics.slot2
    };
  }

  function phaseMark(id) {
    if (id === "morning") return "sun";
    if (id === "lunch") return "noon";
    if (id === "night") return "moon";
    return "lamp";
  }

  function phaseInk(id, bust) {
    if (bust) return "#8a8178";
    if (id === "morning") return "#f6e2c4";
    if (id === "night") return "#c5d0e4";
    if (id === "evening") return "#f0d2c0";
    return PAPER;
  }

  function phaseTint(id) {
    if (id === "morning") return "rgba(240, 176, 96, 0.28)";
    if (id === "evening") return "rgba(120, 52, 28, 0.25)";
    if (id === "night") return "rgba(8, 12, 28, 0.22)";
    return "";
  }

  function drawMark(ctx, kind, x, y) {
    if (!kind) return;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.translate(x, y);
    ctx.strokeStyle = PAPER;
    ctx.fillStyle = PAPER;
    ctx.lineWidth = 1.25;
    ctx.lineCap = "round";
    var i;
    var a;
    if (kind === "sun") {
      ctx.beginPath();
      ctx.arc(0, 0, 2.3, 0, Math.PI * 2);
      ctx.fill();
      for (i = 0; i < 8; i++) {
        a = i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 3.5, Math.sin(a) * 3.5);
        ctx.lineTo(Math.cos(a) * 5.3, Math.sin(a) * 5.3);
        ctx.stroke();
      }
    } else if (kind === "noon") {
      ctx.beginPath();
      ctx.arc(0, -1.5, 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-5, 4.2);
      ctx.lineTo(5, 4.2);
      ctx.stroke();
    } else if (kind === "lamp") {
      ctx.beginPath();
      ctx.arc(0, -1.2, 2.8, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-2.8, -1.2);
      ctx.lineTo(-2.2, 1.6);
      ctx.lineTo(2.2, 1.6);
      ctx.lineTo(2.8, -1.2);
      ctx.stroke();
      ctx.fillRect(-1.1, 1.8, 2.2, 1.6);
    } else if (kind === "moon") {
      ctx.beginPath();
      ctx.arc(-0.6, 0, 4, 0.7, 5.6);
      ctx.arc(1.6, -0.8, 3.3, 4, 2.4, true);
      ctx.fill();
    } else if (kind === "coin") {
      ctx.beginPath();
      ctx.arc(0, 0, 4.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "700 8px " + MONO;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", 0, 0.4);
    } else if (kind === "heat") {
      ctx.beginPath();
      ctx.moveTo(0, -5.2);
      ctx.bezierCurveTo(3.4, -1.2, 3.6, 2.2, 0, 5);
      ctx.bezierCurveTo(-3.6, 2.2, -3.4, -1.2, 0, -5.2);
      ctx.fill();
    } else if (kind === "lock") {
      ctx.beginPath();
      ctx.arc(0, -1.3, 2.3, Math.PI, 0);
      ctx.stroke();
      ctx.strokeRect(-3.1, -1.2, 6.2, 5);
    }
    ctx.restore();
  }

  function drawRing(ctx, x, y, r, sweep) {
    var p = sweep;
    if (p < 0) p = 0;
    if (p > 1) p = 1;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(239,230,212,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (p > 0.01) {
      ctx.beginPath();
      ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
      ctx.strokeStyle = LAMP;
      ctx.stroke();
    }
    ctx.restore();
  }

  function feedLineH(line) {
    var h = 34;
    if (line.bust) return 58;
    if (line.art) h = 68;
    else if (line.portrait || line.object || line.notebook || line.crate || line.packs) h = 58;
    if (line.choices && line.choices.length) h += 30;
    return h;
  }

  function blankLine(text, extra) {
    var line = {
      text: text || "",
      stamp: "",
      phase: "",
      art: "",
      portrait: "",
      object: "",
      tags: ["day"],
      money: null,
      mark: "",
      packs: 0,
      notebook: false,
      crate: false,
      bust: false,
      hire: false,
      ring: null,
      slot2: false,
      choices: null,
      lock: false,
      fresh: false,
      rawIndex: null,
      verdict: false
    };
    var k;
    extra = extra || {};
    for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) line[k] = extra[k];
    if (line.lock) line.mark = "lock";
    else if (!line.mark && line.money != null) line.mark = "coin";
    return line;
  }

  function choiceTags(hero) {
    var blob = ((hero.action || "") + " " + (hero.alt || "") + " " + (hero.stamp || "") + " " + (hero.line || "")).toLowerCase();
    var tags = [];
    if (/sera|landlord|rentpay|rival|juniper|hire|greet|comp|truce|regular|favor|partner|look:/.test(blob)) tags.push("people");
    if (/class|deg:|hobby|tutor|school|certificate/.test(blob)) tags.push("class");
    if (/stock|upgrade:|buy:|cooler|plant|speaker|safe|room|floor|neon|bulb/.test(blob)) tags.push("stuff");
    if (/shift|hours|shop|rush|morning|lunch|evening|night|work the|day one/.test(blob)) tags.push("shop");
    if (!tags.length) tags.push("day");
    return tags;
  }

  function choicePictures(hero, game, now) {
    var stamp = String(hero.stamp || "").toUpperCase();
    var act = (hero.action || "") + " " + (hero.alt || "");
    var phase = S.phaseAt(now).id;
    var art = "";
    var portrait = "";
    var object = "";
    if (stamp === "MORNING") art = "shopMorning";
    else if (stamp === "LUNCH") art = "shopNoon";
    else if (stamp === "EVENING") art = "shopEvening";
    else if (stamp === "NIGHT") art = "shopNight";
    else if (stamp === "SLOW" || stamp === "DAY ONE") art = "shopClosed";
    if (stamp === "SERA" || stamp === "REGULAR" || stamp === "FAVOR") portrait = "sera";
    if (stamp === "RENT") portrait = "landlord";
    if (stamp === "RIVAL" || stamp === "TRUCE") portrait = "juniper";
    if (stamp === "HIRE") portrait = "hire";
    if (act.indexOf("upgrade:cooler") >= 0) object = "cooler";
    else if (act.indexOf("upgrade:safe") >= 0) object = "safe";
    else if (act.indexOf("upgrade:speaker") >= 0) object = "speaker";
    else if (act.indexOf("upgrade:plant") >= 0) object = "plant";
    else if (act.indexOf("upgrade:lights") >= 0) object = "bulb";
    else if (act.indexOf("stock:") >= 0) object = "stock";
    var held = game.player && game.player.heldUntil && now < game.player.heldUntil;
    return {
      art: art,
      portrait: held ? "hire" : portrait,
      object: object,
      notebook: act.indexOf("class") >= 0 || act.indexOf("deg:") >= 0 || stamp === "CLASS",
      crate: String(hero.line || "").toLowerCase().indexOf("scout") >= 0,
      bust: !!held,
      phase: art ? (stamp === "MORNING" ? "morning" : stamp === "LUNCH" ? "lunch" : stamp === "EVENING" ? "evening" : stamp === "NIGHT" ? "night" : phase) : (held ? "night" : ""),
      slot2: !!(art && game.slots && game.slots.length > 1)
    };
  }

  function heroLine(game, ui, now) {
    var hero = currentHero(game, now);
    if (!hero || !hero.line) return null;
    if (ui && ui.verdict && ui.verdict.t < 1 && (game.logN || 0) > (ui.verdict.before || 0) && hero.line !== ui.verdict.text) return null;
    var pics = choicePictures(hero, game, now);
    var choices = [];
    if (hero.action) choices.push({ id: hero.action, label: heatLabel(game, hero.action, String(hero.label || hero.action).replace(/\s+/g, " ").trim()) });
    if (hero.alt) choices.push({ id: hero.alt, label: heatLabel(game, hero.alt, String(hero.altLabel || hero.alt).replace(/\s+/g, " ").trim()) });
    var text = hero.line;
    var stamp = "";
    if (pics.bust) {
      text = "You're being held.";
      stamp = "Busted";
    }
    var money = S.moneyIn ? S.moneyIn(hero.label || "") : null;
    if (money == null && S.moneyIn) money = S.moneyIn(hero.altLabel || "");
    var lock = money != null && (game.player.capital || 0) < money;
    return blankLine(text, {
      stamp: pics.bust ? "Busted" : (hero.stamp || stamp),
      phase: pics.phase,
      art: pics.art,
      portrait: pics.portrait,
      object: pics.object,
      notebook: pics.notebook,
      crate: pics.crate,
      bust: pics.bust,
      slot2: pics.slot2,
      tags: choiceTags(hero),
      choices: choices,
      money: money,
      mark: pics.bust && (game.player.heat || 0) >= 45 ? "heat" : (lock ? "lock" : (money != null ? "coin" : phaseMark(pics.phase))),
      lock: lock,
      ring: pics.notebook ? 1 : null
    });
  }

  function logLines(game, filter) {
    var lines = [];
    var n = game.logN || 0;
    var i;
    for (i = 0; i < n; i++) {
      var raw = S.logLine(game, i) || "";
      if (!S.describeLine) break;
      var desc = S.describeLine(raw, game);
      if (!desc.text) continue;
      if (!game.flags || game.flags.chosen === false) {
        if (/zero dollars/i.test(desc.voice || desc.text)) continue;
      }
      if (filter && desc.tags.indexOf(filter) < 0) continue;
      if (lines.length && sameQuiet(lines[lines.length - 1].text, desc.text)) continue;
      desc.rawIndex = i;
      desc.choices = null;
      desc.lock = desc.mark === "lock";
      lines.push(desc);
    }
    return lines;
  }

  function hasAction(lines, id) {
    var i;
    var c;
    for (i = 0; i < lines.length; i++) {
      if (!lines[i].choices) continue;
      for (c = 0; c < lines[i].choices.length; c++) if (lines[i].choices[c].id === id) return true;
    }
    return false;
  }

  function pushChoice(lines, text, id, extra) {
    if (id && hasAction(lines, id)) return;
    var choices = id ? [{ id: id, label: shortChoice((extra && extra.label) || text) }] : null;
    var line = blankLine(text, extra || {});
    line.choices = choices;
    lines.push(line);
  }

  function standingLines(game, ui, now, filter, lines) {
    var cap = (game.player && game.player.capital) || 0;
    var phase = S.phaseAt(now);
    if (filter === "shop") {
      var packCost = D.STOCK_PACK * D.STOCK_PRICE;
      pushChoice(lines, "A pack for the shelf is " + S.money(packCost) + ".", "stock:0", {
        stamp: "Shop", tags: ["shop"], object: "stock", money: packCost, lock: cap < packCost, label: "Restock"
      });
      var shifted = false;
      var si;
      for (si = 0; si < lines.length; si++) if (String(lines[si].text || "").indexOf("shift paid") >= 0) shifted = true;
      if (!shifted && !hasAction(lines, "shift")) {
        pushChoice(lines, "The counter can take a shift.", "shift", { stamp: "Shop", tags: ["shop"], packs: 4, label: "Work the rush" });
      }
      var closed = doorClosed(game);
      pushChoice(lines, closed ? "The door is shut." : "The door is open.", closed ? "door:open" : "door:close", {
        stamp: phase.name || "Shop",
        tags: ["shop"],
        phase: phase.id,
        mark: phaseMark(phase.id),
        label: closed ? "Open" : "Close"
      });
      var hi;
      for (hi = 0; hi < D.HOBBIES.length; hi++) {
        var hobby = D.HOBBIES[hi];
        if (hobby.id === "tutor" || hobby.id === "nightclass") continue;
        var openH = S.hobbyOpen(game, hobby);
        if (!openH) continue;
        pushChoice(lines, hobby.name + ". " + S.money(hobby.pay) + ".", "hobby:" + hobby.id, {
          stamp: "Work", tags: ["shop"], money: hobby.pay, label: hobby.name
        });
      }
    } else if (filter === "class") {
      if (game.degree) {
        var def = D.degreeById[game.degree.id];
        var rest = game.degree.total ? (1 - game.degree.left / game.degree.total) : 0;
        lines.push(blankLine((def ? def.name : "Class") + " has " + S.fmtMs(game.degree.left) + " left.", {
          stamp: "Class", tags: ["class"], notebook: true, ring: rest
        }));
      }
      var next = nextDegree(game);
      if (next && !game.degree) {
        pushChoice(lines, next.name + " is " + S.money(next.cost) + ".", "deg:" + next.id, {
          stamp: "Class", tags: ["class"], notebook: true, ring: 1, money: next.cost, lock: cap < next.cost, label: next.name
        });
      }
      var classCost = 10;
      pushChoice(lines, "A night class is " + S.money(classCost) + ".", "class", {
        stamp: "Class", tags: ["class"], notebook: true, ring: 1, money: classCost, lock: cap < classCost, label: "Night class"
      });
      var tutor = D.hobbyById.tutor;
      if (tutor) pushChoice(lines, "Tutor a lesson. " + S.money(tutor.pay) + ".", "hobby:tutor", {
        stamp: "Class", tags: ["class"], notebook: true, money: tutor.pay, label: "Tutor"
      });
    } else if (filter === "people") {
      var cast = ["sera", "landlord", "juniper", "hire"];
      var pi;
      var any = false;
      for (pi = 0; pi < cast.length; pi++) {
        var who = cast[pi];
        if (!personHere(game, who)) continue;
        any = true;
        var choice = personChoice(game, who, ui);
        var busted = who === "hire" && choice && String(choice.line || "").indexOf("Busted") >= 0;
        var price = choice && choice.price ? (S.moneyIn ? S.moneyIn(choice.price) : null) : null;
        pushChoice(lines, busted ? "You're being held." : ((choice && choice.line) || personCaption(game, who, ui)), choice && choice.action && !choice.disabled ? choice.action : ("look:" + who), {
          stamp: busted ? "Busted" : personCaption(game, who, ui),
          tags: ["people"],
          portrait: who,
          bust: busted,
          phase: busted ? "night" : "",
          money: price,
          lock: !!(choice && choice.disabled),
          label: (choice && choice.label) || "Look"
        });
      }
      if (!any) lines.push(blankLine("Nobody is at the counter.", { stamp: "People", tags: ["people"] }));
      var resumes = game.resumes || [];
      var ri;
      for (ri = 0; ri < resumes.length; ri++) {
        var card = resumes[ri];
        pushChoice(lines, card.name + " asks " + S.money(card.ask) + ".", "resume:" + card.id, {
          stamp: "Hire", tags: ["people"], portrait: "hire", money: card.ask, lock: cap < card.floor, label: card.name
        });
      }
      var hired = false;
      var slots = game.slots || [];
      var si;
      for (si = 0; si < slots.length; si++) if (slots[si].employee) hired = true;
      if (!resumes.length && !hired) pushChoice(lines, "Somebody might want the counter.", "applicants", { stamp: "People", tags: ["people"], portrait: "hire", label: "Find people" });
    } else if (filter === "stuff") {
      var place = (game.player && game.player.place) || {};
      if (!place.owned) {
        pushChoice(lines, "The corner is " + S.money(D.ROOM.rent) + ".", "room", {
          stamp: "Stuff", tags: ["stuff"], money: D.ROOM.rent, lock: cap < D.ROOM.rent, label: "Rent the corner"
        });
      }
      var parts = [
        ["lights", "bulb", "Warm lights"],
        ["cooler", "cooler", "A cooler"],
        ["safe", "safe", "A safe"],
        ["speaker", "speaker", "A speaker"],
        ["plant", "plant", "A plant"]
      ];
      var bi;
      for (bi = 0; bi < parts.length; bi++) {
        if (!place.owned || place[parts[bi][0]]) continue;
        var cost = D.ROOM[parts[bi][0]];
        pushChoice(lines, parts[bi][2] + " is " + S.money(cost) + ".", "upgrade:" + parts[bi][0], {
          stamp: "Stuff", tags: ["stuff"], object: parts[bi][1], money: cost, lock: cap < cost, label: parts[bi][2]
        });
      }
      if (game.world && game.world.scoutJust) {
        lines.push(blankLine("A scout came back with a crate.", { stamp: "Scout", tags: ["stuff", "people"], crate: true }));
      }
      var ii;
      var shown = 0;
      for (ii = 0; ii < D.ITEMS.length && shown < 8; ii++) {
        var item = D.ITEMS[ii];
        if ((game.mats[item.id] || 0) > 0) continue;
        if ((game.player.level || 1) < item.level) continue;
        var itemCost = S.marketCost(game, item);
        pushChoice(lines, item.name + " is " + S.money(itemCost) + ".", "buy:" + item.id, {
          stamp: "Stuff", tags: ["stuff"], money: itemCost, lock: cap < itemCost, label: item.name
        });
        shown += 1;
      }
    }
  }

  function attachVerdict(lines, game, ui, now) {
    if (!ui || !ui.verdict) return;
    var hero = currentHero(game, now);
    if (hero && hero.line === ui.verdict.text) {
      ui.verdict = null;
      return;
    }
    if ((game.logN || 0) <= (ui.verdict.before || 0)) return;
    if (ui.verdict.t >= 1) return;
    var found = null;
    var i;
    for (i = 0; i < lines.length; i++) {
      if (lines[i].rawIndex == null || lines[i].rawIndex < ui.verdict.before) continue;
      if (!found) found = lines[i];
      if (lines[i].money != null) {
        found = lines[i];
        break;
      }
    }
    if (!found) return;
    var picks = [{ id: "", label: shortChoice(ui.verdict.taken || ""), taken: true }];
    if (ui.verdict.other) picks.push({ id: "", label: shortChoice(ui.verdict.other), strike: true });
    found.choices = picks;
    found.verdict = true;
  }

  function collectFeed(game, ui, now, filter) {
    var lines = logLines(game, filter);
    attachVerdict(lines, game, ui, now);
    var hero = heroLine(game, ui, now);
    if (hero && (!filter || hero.tags.indexOf(filter) >= 0)) {
      var last = lines[lines.length - 1];
      if (last && last.text === hero.text) {
        if (!last.choices) last.choices = hero.choices;
        if (!last.art) last.art = hero.art;
        if (!last.portrait) last.portrait = hero.portrait;
        if (!last.object) last.object = hero.object;
        last.bust = last.bust || hero.bust;
        last.notebook = last.notebook || hero.notebook;
        last.crate = last.crate || hero.crate;
      } else lines.push(hero);
    }
    if (filter) standingLines(game, ui, now, filter, lines);
    if (!lines.length) lines.push(blankLine("Quiet.", { stamp: filter === "class" ? "Class" : filter === "people" ? "People" : filter === "stuff" ? "Stuff" : filter === "shop" ? "Shop" : "Day" }));
    return lines;
  }

  function marginStamp(line) {
    if (!line) return "Day";
    if (line.bust) return "Busted";
    var s = String(line.stamp || "");
    var lowS = s.toLowerCase();
    var low = (s + " " + (line.text || "")).toLowerCase();
    if (line.phase === "morning" || lowS.indexOf("morning") >= 0) return "Morning";
    if (line.phase === "lunch" || lowS.indexOf("lunch") >= 0) return "Lunch";
    if (line.phase === "evening" || lowS.indexOf("evening") >= 0) return "Evening";
    if (line.phase === "night" || lowS.indexOf("night") >= 0) return "Night";
    if (line.phase === "standard" || lowS.indexOf("watch") >= 0 || lowS.indexOf("standard") >= 0) return "Watch";
    if (lowS.indexOf("day one") >= 0) return "Day";
    if (s && s.length <= 8) return s;
    if (s) return s.split(" ")[0];
    if (line.hire || low.indexOf("register") >= 0) return "Hire";
    if (low.indexOf("took in") >= 0 || low.indexOf("shift paid") >= 0) return "Sale";
    if (low.indexOf("thin") >= 0 || low.indexOf("shelf") >= 0 || low.indexOf("pack") >= 0) return "Shelf";
    if (low.indexOf("quiet") >= 0) return "Night";
    if (line.notebook || low.indexOf("class") >= 0) return "Class";
    if (line.portrait) return "Here";
    if (line.object) return "Room";
    if (low.indexOf("hobby") >= 0) return "Hobby";
    return "Day";
  }

  function chatTailKey(line) {
    if (!line) return "";
    var text = String(line.text || "").replace(/\d+s left/g, "s left");
    if (line.rawIndex != null) return "i:" + line.rawIndex;
    return "h:" + text;
  }

  function sameQuiet(a, b) {
    function q(t) {
      var s = String(t || "").toLowerCase();
      return s === "quiet." || s.indexOf("street is quiet") >= 0 || s.indexOf("nothing is selling") >= 0 || s.indexOf("counter is quiet") >= 0 || s.indexOf("shop is still dark") >= 0 || s.indexOf("the door is shut") >= 0;
    }
    return a === b || (q(a) && q(b));
  }

  function heatLabel(game, id, label) {
    if (id !== "skim" && id !== "score") return label;
    var n = S.heatQuote ? S.heatQuote(game, id) : 0;
    if (!n) return label;
    if (String(label).indexOf("Heat") >= 0) return label;
    return label + "  Heat +" + n;
  }

  function stepShelf(ui, game, dt) {
    if (!ui || !game) return;
    var slot = game.slots && game.slots[0];
    var stock = slot ? (slot.stock || 0) : 0;
    if (!ui.shelf) ui.shelf = { n: stock, wait: 0 };
    if (ui.shelf.n == null) ui.shelf.n = stock;
    if (ui.shelf.n === stock) {
      ui.shelf.wait = 0;
      return;
    }
    ui.shelf.wait = (ui.shelf.wait || 0) + (dt > 0 ? dt : 16);
    if (ui.shelf.wait < 180) return;
    ui.shelf.wait = 0;
    if (ui.shelf.n > stock) ui.shelf.n -= 1;
    else ui.shelf.n += 1;
  }

  function linePhaseId(line) {
    if (!line) return "";
    if (line.phase === "morning" || line.phase === "lunch" || line.phase === "evening" || line.phase === "night" || line.phase === "standard") return line.phase;
    if (line.art === "shopMorning") return "morning";
    if (line.art === "shopEvening") return "evening";
    if (line.art === "shopNight") return "night";
    var s = String(line.text || "");
    if (s.indexOf("Morning Rush") >= 0) return "morning";
    if (s.indexOf("Lunch Hour") >= 0) return "lunch";
    if (s.indexOf("Evening Trade") >= 0) return "evening";
    if (s.indexOf("Night Drift") >= 0) return "night";
    if (s.indexOf("Standard Watch") >= 0) return "standard";
    return "";
  }

  function phaseTitle(id) {
    if (id === "morning") return "Morning Rush";
    if (id === "lunch") return "Lunch Hour";
    if (id === "evening") return "Evening Trade";
    if (id === "night") return "Night Drift";
    if (id === "standard") return "Standard Watch";
    return "";
  }

  function toneFromKey(key) {
    if (key === "shopMorning") return "morning";
    if (key === "shopEvening") return "evening";
    if (key === "shopNight" || key === "shopClosed") return "night";
    if (key === "shopNoon") return "lunch";
    return "";
  }

  function plateFill(phase, bright, rent) {
    if (rent && bright) return "#6e4c32";
    var map = {
      morning: ["#32241e", "#5c4032"],
      lunch: ["#1c2a30", "#2c424c"],
      evening: ["#321e18", "#5a3428"],
      standard: ["#22202a", "#3a3644"],
      night: ["#141c2c", "#2a3c58"]
    };
    var pair = map[phase] || ["#1a1612", "#2e2822"];
    return pair[bright ? 1 : 0];
  }

  function lineIsRent(line) {
    var t = ((line && line.text) || "").toLowerCase();
    var s = ((line && line.stamp) || "").toLowerCase();
    return s === "rent" || t.indexOf("rent is") >= 0 || t.indexOf("rent due") >= 0;
  }

  function wantsShelf(line) {
    if (!line) return false;
    if (line.packs) return true;
    var t = (line.text || "").toLowerCase();
    if (t.indexOf("in the drawer") >= 0) return false;
    if (t.indexOf("shelf") >= 0 || t.indexOf("stock") >= 0 || t.indexOf("pack") >= 0) return true;
    if (t.indexOf("shift paid") >= 0 || t.indexOf("took in") >= 0) return true;
    return false;
  }

  function doorClosed(game) {
    if (game && game.player && game.player.place && game.player.place.shut) return true;
    return !!(game && game.world && game.world.hours === "closed");
  }

  function shopArtNow(game, now, line) {
    var open = !!(game && game.flags && game.flags.opened) && !doorClosed(game);
    var low = ((line && line.text) || "").toLowerCase();
    if (!open || low.indexOf("still dark") >= 0 || low.indexOf("door is shut") >= 0 || low.indexOf("nothing is selling") >= 0) return "shopClosed";
    var phase = (line && line.phase) || S.phaseAt(now).id;
    if (phase === "morning") return "shopMorning";
    if (phase === "evening") return "shopEvening";
    if (phase === "night") return "shopNight";
    return "shopNoon";
  }

  function platePicture(line, game, now) {
    var pic = { kind: "", key: "", shelf: false, bust: !!(line && line.bust) };
    if (!line) return pic;
    if (line.bust) {
      pic.kind = "portrait";
      pic.key = line.portrait || "hire";
      return pic;
    }
    if (line.portrait && !line.art) {
      pic.kind = "portrait";
      pic.key = line.portrait;
      return pic;
    }
    if (line.art || line.packs || wantsShelf(line)) {
      pic.kind = "shop";
      pic.key = line.art || shopArtNow(game, now, line);
      if (!openShopArt(pic.key)) pic.key = shopArtNow(game, now, line);
      pic.shelf = wantsShelf(line);
      return pic;
    }
    if (line.object) {
      pic.kind = "object";
      pic.key = line.object;
      pic.shelf = wantsShelf(line);
      return pic;
    }
    if (line.notebook) {
      pic.kind = "object";
      pic.key = "notebook";
      return pic;
    }
    if (line.crate) {
      pic.kind = "object";
      pic.key = "crate";
      return pic;
    }
    return pic;
  }

  function openShopArt(key) {
    return key === "shopMorning" || key === "shopNoon" || key === "shopEvening" || key === "shopNight" || key === "shopClosed";
  }

  function secondFrame(game) {
    var slots = (game && game.slots) || [];
    if (slots.length > 1) return { owned: true };
    var cap = S.slotCap ? S.slotCap(game) : 1;
    if (cap < 2) {
      var cost = D.degreeById && D.degreeById.bach ? D.degreeById.bach.cost : 0;
      return { owned: false, price: cost };
    }
    return null;
  }

  function plateSentence(line) {
    var text = (line && line.text) || "";
    if (line && line.bust && text.toLowerCase().indexOf("busted") < 0) text = "Busted. " + text;
    return text;
  }

  function chatColumn(L) {
    var maxW = 520;
    var w = L.w - 24;
    if (w > maxW) w = maxW;
    if (w < 160) w = Math.max(120, L.w - 12);
    return { x: Math.round((L.w - w) * 0.5), w: w };
  }

  function choiceUnaffordable(pick) {
    var g = frameGame;
    if (!g || !pick || !pick.label) return false;
    var n = S.moneyIn ? S.moneyIn(pick.label) : null;
    if (n == null || n < 0) return false;
    return (g.player.capital || 0) < n;
  }

  function measurePlateChoices(ctx, line, width) {
    var picks = [];
    var i;
    if (!line || !line.choices) return null;
    for (i = 0; i < line.choices.length; i++) if (line.choices[i] && line.choices[i].label) picks.push(line.choices[i]);
    if (!picks.length) return null;
    var narrow = picks.length < 2 || width < 360;
    var gap = 8;
    var face = textFace(15, "title");
    var bw = narrow ? width : (width - gap * (picks.length - 1)) / picks.length;
    var maxH = 48;
    var blocks = [];
    for (i = 0; i < picks.length; i++) {
      var lines = wrapLines(ctx, face, picks[i].label, Math.max(48, bw - 20), 3);
      var bh = Math.max(48, lines.length * 20 + 16);
      if (bh > maxH) maxH = bh;
      blocks.push(lines);
    }
    var total = narrow ? maxH * picks.length + gap * (picks.length - 1) : maxH;
    return { picks: picks, blocks: blocks, bw: bw, bh: maxH, h: total, narrow: narrow, gap: gap, face: face };
  }

  function splicePlateMemory(lines, ui) {
    var mem = (ui && ui.plateMemory) || [];
    var m;
    var i;
    for (m = 0; m < mem.length; m++) {
      var item = mem[m];
      if (!item || !item.text) continue;
      var dup = false;
      for (i = 0; i < lines.length; i++) if (lines[i].text === item.text) dup = true;
      if (dup) continue;
      var plate = blankLine(item.text, {
        stamp: item.stamp || "",
        phase: item.phase || "",
        art: item.art || "",
        portrait: item.portrait || "",
        object: item.object || "",
        notebook: !!item.notebook,
        crate: !!item.crate,
        bust: !!item.bust,
        slot2: !!item.slot2
      });
      plate.choices = null;
      var at = lines.length;
      for (i = 0; i < lines.length; i++) {
        if (lines[i].rawIndex != null && lines[i].rawIndex >= (item.before || 0)) {
          at = i;
          break;
        }
      }
      lines.splice(at, 0, plate);
    }
  }

  function stepChatIn(ui, lines) {
    if (ui && ui.muteHits) return ui.feed || { t: 1, tailKey: null, saw: false, held: {} };
    var f = ui.feed || (ui.feed = { t: 1, tailKey: null, saw: false, held: {} });
    if (!f.held) f.held = {};
    var tail = lines.length ? lines[lines.length - 1] : null;
    var key = chatTailKey(tail);
    if (!f.saw) {
      f.saw = true;
      f.tailKey = key;
      f.t = 1;
    } else if (key !== f.tailKey) {
      f.tailKey = key;
      f.t = 0;
    } else if ((f.t || 0) < 1) {
      var dt = ui.dt > 0 ? ui.dt : 16;
      f.t += dt / 520;
      if (f.t > 1) f.t = 1;
    }
    if (f.t >= 1 && key) f.held[key] = 1;
    return f;
  }

  function collectChat(game, ui, now) {
    var lines = logLines(game, "");
    var i;
    for (i = 0; i < lines.length; i++) lines[i].choices = null;
    var verdict = ui && ui.verdict;
    if (verdict && verdict.t < 1) {
      var kept = [];
      for (i = 0; i < lines.length; i++) {
        if (lines[i].rawIndex != null && lines[i].rawIndex >= (verdict.before || 0)) continue;
        kept.push(lines[i]);
      }
      var picks = [{ id: "", label: String(verdict.taken || "").replace(/\s+/g, " ").trim(), taken: true }];
      if (verdict.other) picks.push({ id: "", label: String(verdict.other).replace(/\s+/g, " ").trim(), strike: true });
      var prompt = blankLine(verdict.text, {
        stamp: verdict.stamp || "",
        phase: verdict.phase || "",
        art: verdict.art || "",
        portrait: verdict.portrait || "",
        object: verdict.object || "",
        notebook: !!verdict.notebook,
        crate: !!verdict.crate,
        bust: !!verdict.bust,
        slot2: !!verdict.slot2,
        verdict: true,
        choices: picks
      });
      var last = kept[kept.length - 1];
      if (last && last.text === prompt.text) {
        last.choices = picks;
        last.verdict = true;
        if (!last.art) last.art = prompt.art;
        if (!last.portrait) last.portrait = prompt.portrait;
        if (!last.object) last.object = prompt.object;
        last.bust = last.bust || prompt.bust;
      } else kept.push(prompt);
      if (!kept.length) kept.push(prompt);
      return kept;
    }
    splicePlateMemory(lines, ui);
    var hero = heroLine(game, ui, now);
    if (hero) {
      var tail = lines[lines.length - 1];
      if (tail && tail.text === hero.text) {
        tail.choices = hero.choices;
        if (!tail.art) tail.art = hero.art;
        if (!tail.portrait) tail.portrait = hero.portrait;
        if (!tail.object) tail.object = hero.object;
        tail.bust = tail.bust || hero.bust;
        tail.notebook = tail.notebook || hero.notebook;
        tail.crate = tail.crate || hero.crate;
        if (!tail.stamp) tail.stamp = hero.stamp;
        if (!tail.phase) tail.phase = hero.phase;
      } else lines.push(hero);
    }
    if (!lines.length) lines.push(blankLine("Quiet.", { stamp: "Day" }));
    var latest = lines.length - 1;
    for (i = 0; i < lines.length; i++) if (i !== latest) lines[i].choices = null;
    return lines;
  }

  function shopMarkPhase(game, ui, now) {
    var lines = collectChat(game, ui, now);
    var i;
    for (i = lines.length - 1; i >= 0; i--) {
      var pic = platePicture(lines[i], game, now);
      if (pic.kind === "shop" && pic.key && pic.key !== "shopClosed") {
        if (pic.key === "shopMorning") return "morning";
        if (pic.key === "shopEvening") return "evening";
        if (pic.key === "shopNight") return "night";
        if (lines[i].phase) return lines[i].phase;
        return S.phaseAt(now).id;
      }
    }
    return S.phaseAt(now).id;
  }

  function paintFigure(ctx, key, x, y, w, h, alpha, slide) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = "#14110e";
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    var img = painted(key);
    if (img) {
      var ir = img.naturalWidth / Math.max(1, img.naturalHeight);
      var dh = h;
      var dw = dh * ir;
      if (dw > w) {
        dw = w;
        dh = dw / ir;
      }
      var dx = x + (w - dw) * 0.5 + (slide || 0);
      var dy = y + (h - dh);
      ctx.drawImage(img, dx, dy, dw, dh);
    }
    ctx.restore();
  }

  function paintShopCard(ctx, game, key, x, y, w, h, opts) {
    opts = opts || {};
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = "#14110e";
    ctx.fillRect(x, y, w, h);
    var heat = (game && game.player && game.player.heat) || 0;
    var dim = 0;
    if (game && game.flags && game.flags.shady && heat >= 20) {
      dim = Math.min(0.55, (heat - 20) / 120);
      if (heat >= 45) dim = Math.max(dim, 0.42);
    }
    ctx.globalAlpha = 1 - dim;
    if (!blitCover(ctx, key || "shopClosed", x, y, w, h, 0.32, 0.4)) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#14110e";
      ctx.fillRect(x, y, w, h);
    }
    ctx.globalAlpha = 1;
    var place = (game && game.player && game.player.place) || {};
    if (place.lights) {
      ctx.fillStyle = LAMP;
      ctx.beginPath();
      ctx.arc(x + Math.max(14, w * 0.18), y + h * 0.46, Math.max(3, Math.min(7, w * 0.02)), 0, Math.PI * 2);
      ctx.fill();
    }
    var shop = (game.slots && game.slots[0] && game.slots[0].name) || place.name || "";
    if (shop && w >= 200 && h > 48) {
      var sw = Math.min(Math.max(72, w * 0.46), Math.max(16, w - 16));
      var signFace = textFace(w < 160 ? 13 : 15, "title");
      ctx.fillStyle = "rgba(20,16,14,0.82)";
      ctx.fillRect(x + 8, y + 8, sw, 22);
      ctx.font = signFace;
      ctx.fillStyle = place.sign ? LAMP : PAPER;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(clipText(ctx, signFace, shop, sw - 12), x + 8 + sw * 0.5, y + 19);
    }
    if (game && S.hireAtRegister && S.hireAtRegister(game)) {
      var pw = Math.max(28, Math.min(w * 0.22, 72));
      var ph = Math.max(64, h * 0.7);
      paintFigure(ctx, "hire", x + w * 0.1, y + h - ph - 2, pw, ph, 1, 0);
    }
    if (opts.camera) {
      var cx = x + w - 26;
      var cy = y + 12;
      ctx.strokeStyle = LAMP;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx, cy, 14, 10);
      ctx.beginPath();
      ctx.arc(cx + 7, cy + 5, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = LAMP;
      ctx.fill();
    }
    if (opts.name) {
      var barH = opts.sub ? 46 : 30;
      ctx.fillStyle = "#1c1612";
      ctx.fillRect(x, y + h - barH, w, barH);
      ctx.font = textFace(15, "title");
      ctx.fillStyle = PAPER;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(clipText(ctx, textFace(15, "title"), opts.name, w - 20), x + 10, y + h - barH + (opts.sub ? 15 : barH * 0.5));
      if (opts.sub) {
        ctx.font = textFace(15, "body");
        ctx.fillStyle = opts.dimSub ? "#6e665c" : LAMP;
        ctx.fillText(clipText(ctx, textFace(15, "body"), opts.sub, w - 20), x + 10, y + h - 14);
      }
    }
    ctx.restore();
  }

  function paintEmptyFrame(ctx, x, y, w, h, price) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#100e0c";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#3a342c";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, Math.max(1, w - 4), Math.max(1, h - 4));
    if (price) {
      ctx.font = textFace(15, "num");
      ctx.fillStyle = "#8a8178";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(S.money(price), x + w * 0.5, y + h * 0.5);
    }
    ctx.restore();
  }

  function paintShelf(ctx, x, y, w, count) {
    var slots = 8;
    var gap = 6;
    var cell = Math.floor((w - gap * (slots - 1)) / slots);
    if (cell < 10) return 0;
    var h = Math.min(34, cell);
    var shown = count < 0 ? 0 : count;
    var i;
    ctx.save();
    ctx.shadowBlur = 0;
    for (i = 0; i < slots; i++) {
      var cx = x + i * (cell + gap);
      ctx.fillStyle = "#100e0c";
      ctx.fillRect(cx, y, cell, h);
      if (i < shown) {
        if (!blitCover(ctx, "stock", cx, y, cell, h, 0.5, 0.45)) {
          ctx.fillStyle = "#14110e";
          ctx.fillRect(cx, y, cell, h);
        }
      }
    }
    if (shown > slots) {
      ctx.font = textFace(15, "num");
      ctx.fillStyle = PAPER;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(shown), x + (slots - 1) * (cell + gap) + cell * 0.5, y + h * 0.5);
    }
    ctx.restore();
    return h;
  }

  function shelfCount(line, ui, newest) {
    if (newest && ui && ui.shelf && ui.shelf.n != null) return ui.shelf.n;
    if (line && line.packs) return line.packs;
    var t = ((line && line.text) || "").toLowerCase();
    if (t.indexOf("empty") >= 0 || t.indexOf("sold out") >= 0) return 0;
    if (t.indexOf("thin") >= 0) return 2;
    return 0;
  }

  function measureChat(ctx, line, width, game, now, headerText, colorPhase) {
    var photo = platePicture(line, game, now);
    var side = photo.kind === "shop" ? secondFrame(game) : null;
    var photoH = 0;
    var sideW = 0;
    if (photo.kind === "shop") {
      photoH = Math.round(Math.min(210, width * 9 / 16));
      if (photoH < 96) photoH = 96;
      if (side) {
        sideW = Math.round(Math.min(width * 0.3, photoH * 16 / 9));
        if (sideW < 68) sideW = 0;
      }
    } else if (photo.kind === "portrait") {
      photoH = Math.min(340, Math.max(240, Math.round(width * 0.72)));
    } else if (photo.kind === "object") {
      photoH = Math.round(Math.min(168, width * 0.52));
    }
    if (frameUi && frameUi.stageChat) {
      if (photo.kind === "shop" || photo.kind === "object") {
        photoH = 0;
        sideW = 0;
      } else if (photo.kind === "portrait") photoH = 78;
    }
    var stage = !!(frameUi && frameUi.stageChat);
    var padX = stage ? 18 : 14;
    var textW = Math.max(80, width - padX * 2);
    var face = textFace(stage ? 18 : 15, stage ? "title" : "body");
    var lineH = stage ? 24 : 22;
    var sentence = plateSentence(line);
    var words = wrapLines(ctx, face, sentence, textW, 8);
    var textH = Math.max(lineH, words.length * lineH);
    var shelfH = photo.shelf ? 42 : 0;
    var choice = null;
    var choiceH = 0;
    if (line.choices && line.choices.length) {
      choice = measurePlateChoices(ctx, line, textW);
      if (choice && stage && choice.bh < 56) {
        var grow = 56 - choice.bh;
        choice.bh = 56;
        choice.h += choice.narrow ? grow * choice.picks.length : grow;
      }
      if (choice) choiceH = choice.h;
    }
    var headerH = headerText ? 28 : 0;
    var inner = photoH + (shelfH ? 10 + shelfH : 0) + 12 + textH + (choiceH ? 10 + choiceH : 0) + 14;
    var tone = colorPhase || toneFromKey(photo && photo.key);
    return {
      h: headerH + inner + 12,
      headerH: headerH,
      headerText: headerText || "",
      inner: inner,
      photoH: photoH,
      sideW: sideW,
      side: sideW ? side : null,
      shelfH: shelfH,
      words: words,
      face: face,
      lineH: lineH,
      textW: textW,
      padX: padX,
      choice: choice,
      photo: photo,
      w: width,
      phase: tone,
      rent: lineIsRent(line)
    };
  }

  function drawPlateChoices(ctx, ui, line, metrics, x, y, strikeT) {
    if (!metrics) return;
    var strike = line.verdict ? easeOut(strikeT || 0) : 0;
    var i;
    for (i = 0; i < metrics.picks.length; i++) {
      var pick = metrics.picks[i];
      var bx = metrics.narrow ? x : x + i * (metrics.bw + metrics.gap);
      var by = metrics.narrow ? y + i * (metrics.bh + metrics.gap) : y;
      var fade = pick.strike ? (1 - strike) : 1;
      if (fade < 0.04) continue;
      var sink = pick.taken ? 2 : pressSink(ui, pick.id);
      var dim = !pick.taken && choiceUnaffordable(pick);
      var main = i === 0;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = main ? (dim ? "#6a5430" : LAMP) : "#1a120e";
      ctx.fillRect(bx, by + sink, metrics.bw, metrics.bh);
      ctx.font = metrics.face;
      ctx.fillStyle = main ? (dim ? "#2a2118" : INK) : (dim ? "#6e665c" : PAPER);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var lines = metrics.blocks[i];
      var n = lines.length || 1;
      var li;
      for (li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], bx + metrics.bw * 0.5, by + sink + metrics.bh * 0.5 + (li - (n - 1) * 0.5) * 18);
      }
      if (pick.strike && strike > 0.02) {
        ctx.strokeStyle = main ? INK : PAPER;
        ctx.globalAlpha = Math.max(0.2, fade);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx + 14, by + sink + metrics.bh * 0.5);
        ctx.lineTo(bx + metrics.bw - 14, by + sink + metrics.bh * 0.5);
        ctx.stroke();
      }
      ctx.restore();
      if (pick.id && ui && fade > 0.35) pushHit(ui, pick.id, bx, by, metrics.bw, metrics.bh);
    }
  }

  function canBuyPack(game) {
    var slot = game.slots && game.slots[0];
    if (!slot) return false;
    var room = S.stockCap(game) - (slot.stock || 0);
    var n = D.STOCK_PACK;
    if (n > room) n = room;
    if (n <= 0) return false;
    return (game.player.capital || 0) >= n * D.STOCK_PRICE;
  }

  function paintCustomers(ctx, x, y, w, h, n) {
    if (!n || w < 40 || h < 36) return;
    var spots = [0.32, 0.5, 0.68];
    var i;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for (i = 0; i < n && i < 3; i++) {
      var cx = x + w * spots[i];
      var foot = y + h * 0.84;
      var fh = Math.max(16, Math.min(48, h * 0.36));
      ctx.fillStyle = i === 1 ? "#14110e" : "#2a2118";
      ctx.fillRect(cx - fh * 0.09, foot - fh * 0.46, fh * 0.07, fh * 0.46);
      ctx.fillRect(cx + fh * 0.03, foot - fh * 0.46, fh * 0.07, fh * 0.46);
      ctx.fillRect(cx - fh * 0.14, foot - fh * 0.78, fh * 0.28, fh * 0.34);
      ctx.beginPath();
      ctx.arc(cx, foot - fh * 0.9, Math.max(3, fh * 0.11), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawChatMessage(ctx, ui, game, line, x, y, box, dy, strikeT, newest, ease) {
    var drawY = y + (dy || 0);
    var arrive = newest && ease < 1;
    var wipe = arrive ? ease : 1;
    if (wipe < 0) wipe = 0;
    if (wipe > 1) wipe = 1;
    ctx.save();
    ctx.shadowBlur = 0;
    if (box.headerText) {
      ctx.font = textFace(15, "title");
      ctx.fillStyle = "#b7b0a6";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(box.headerText, x, drawY + 12);
    }
    var plateY = drawY + box.headerH;
    var plateH = box.inner;
    var bright = !!newest;
    ctx.fillStyle = plateFill(box.phase, bright, !!(box.rent && newest));
    round(ctx, x, plateY, box.w, plateH, ui && ui.stageChat ? 12 : 8);
    ctx.fill();
    if (ui && ui.stageChat) {
      ctx.fillStyle = bright ? LAMP : "#5c5348";
      ctx.fillRect(x, plateY + 8, 4, Math.max(8, plateH - 16));
    }
    var photo = box.photo;
    var photoY = plateY;
    if (photo && photo.kind === "portrait" && photo.key && box.photoH > 8) {
      var slide = arrive ? (1 - ease) * -72 : 0;
      if (ui && ui.stageChat) {
        var fw = Math.min(box.w * 0.34, box.photoH * 0.72);
        paintCutout(ctx, photo.key, x + 8 + slide, photoY, fw, box.photoH);
      } else paintFigure(ctx, photo.key, x, photoY, box.w, box.photoH, line.bust ? 0.4 : 1, slide);
    } else if (photo && box.photoH > 8 && (photo.kind === "shop" || photo.kind === "object")) {
      var mainW = box.sideW ? box.w - box.sideW - 8 : box.w;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, photoY, Math.max(1, box.w * wipe), box.photoH);
      ctx.clip();
      if (photo.kind === "shop") {
        var slot0 = game.slots && game.slots[0];
        paintShopCard(ctx, game, photo.key, x, photoY, mainW, box.photoH, { camera: !!(slot0 && slot0.camera) });
        if (box.side) {
          var sx = x + mainW + 8;
          if (box.side.owned) paintShopCard(ctx, game, photo.key, sx, photoY, box.sideW, box.photoH, {});
          else paintEmptyFrame(ctx, sx, photoY, box.sideW, box.photoH, box.side.price);
          if (ui && box.side.owned) pushHit(ui, "shop:open:1", sx, photoY, box.sideW, box.photoH);
        }
        if (newest && photo.key !== "shopClosed" && !doorClosed(game) && game.flags && game.flags.opened) {
          var crowdWhen = (ui && ui.presentAt) || (ui && ui.now) || Date.now();
          var crowdN = S.rushCrowd ? S.rushCrowd(S.phaseAt(crowdWhen)) : 0;
          if (crowdN) paintCustomers(ctx, x, photoY, mainW, box.photoH, crowdN);
        }
        if (ui) pushHit(ui, "shop:open:0", x, photoY, mainW, box.photoH);
      } else {
        ctx.fillStyle = "#14110e";
        ctx.fillRect(x, photoY, mainW, box.photoH);
        if (!blitCover(ctx, photo.key, x, photoY, mainW, box.photoH, 0.5, 0.45)) {
          ctx.fillStyle = "#14110e";
          ctx.fillRect(x, photoY, mainW, box.photoH);
        }
      }
      ctx.restore();
      if (newest && photo.kind === "shop") ui.shopPt = { x: x + mainW * 0.5, y: photoY + box.photoH * 0.45 };
    }
    if (newest && (!ui.shopPt || photo.kind !== "shop")) {
      ui.shopPt = { x: x + box.w * 0.5, y: photoY + Math.max(16, box.photoH * 0.4) };
    }
    var cursor = photoY + box.photoH;
    if (photo && photo.shelf) {
      cursor += 10;
      paintShelf(ctx, x + box.padX, cursor, box.textW, shelfCount(line, ui, newest));
      if (newest && ui && canBuyPack(game)) pushHit(ui, "stock:0", x + box.padX, cursor, box.textW, box.shelfH);
      cursor += box.shelfH - 10;
    }
    cursor += 12;
    ctx.font = box.face;
    ctx.fillStyle = line.bust ? "#8a8178" : (newest ? PAPER : "#b7b0a6");
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    var ti;
    var lineH = box.lineH || 22;
    for (ti = 0; ti < box.words.length; ti++) ctx.fillText(box.words[ti], x + box.padX, cursor + ti * lineH);
    cursor += box.words.length * lineH;
    if (box.choice) drawPlateChoices(ctx, ui, line, box.choice, x + box.padX, cursor + 10, strikeT);
    if (photo && photo.kind === "portrait" && line.portrait && !line.bust && ui && box.photoH > 8) {
      var who = line.portrait;
      if (who === "sera" || who === "landlord" || who === "juniper" || who === "hire") pushHit(ui, "look:" + who, x, photoY, box.w, box.photoH);
    }
    ctx.restore();
  }

  function paintColumnFade(ctx, L) {
    if (frameUi && frameUi.stageChat) {
      ctx.save();
      ctx.shadowBlur = 0;
      var veil = ctx.createLinearGradient(0, L.tabY - 36, 0, L.tabY);
      veil.addColorStop(0, "rgba(12,10,8,0)");
      veil.addColorStop(1, "rgba(12,10,8,0.35)");
      ctx.fillStyle = veil;
      ctx.fillRect(0, L.tabY - 36, L.w, 36);
      ctx.restore();
      return;
    }
    var color = (frameUi && frameUi.ground) || "#1a2744";
    var top = L.header;
    var bot = L.tabY;
    ctx.save();
    ctx.shadowBlur = 0;
    var g = ctx.createLinearGradient(0, top, 0, top + 28);
    g.addColorStop(0, color);
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, top, L.w, 28);
    var g2 = ctx.createLinearGradient(0, bot - 36, 0, bot);
    g2.addColorStop(0, hexA(color, 0));
    g2.addColorStop(1, color);
    ctx.fillStyle = g2;
    ctx.fillRect(0, bot - 36, L.w, 36);
    ctx.restore();
  }

  function drawFeed(ctx, game, ui, L, now) {
    frameUi = ui;
    var lines = collectChat(game, ui, now);
    var logN = game.logN || 0;
    if (ui.chatLogN == null) ui.chatLogN = logN;
    else if (logN > ui.chatLogN && ui.logPin === false) ui.logScroll = (ui.logScroll || 0) + (logN - ui.chatLogN);
    ui.chatLogN = logN;
    var maxBack = Math.max(0, lines.length - 1);
    if ((ui.logScroll || 0) > maxBack) ui.logScroll = maxBack;
    if ((ui.logScroll || 0) < 0) ui.logScroll = 0;
    if ((ui.logScroll || 0) <= 0) {
      ui.logScroll = 0;
      ui.logPin = true;
    }
    var back = ui.logPin === false ? (ui.logScroll || 0) : 0;
    var f = stepChatIn(ui, lines);
    var ease = easeOut(f.t == null ? 1 : f.t);
    var viewH = L.tabY - L.header;
    ui.logTop = L.header;
    ui.logBot = L.tabY;
    ui.clip = { x: 0, y: L.header, w: L.w, h: viewH };
    var col = chatColumn(L);
    var boxes = [];
    var group = "";
    var i;
    for (i = 0; i < lines.length; i++) {
      var ph = linePhaseId(lines[i]);
      var header = "";
      if (ph && ph !== group) {
        header = phaseTitle(ph);
        group = ph;
      }
      boxes.push(measureChat(ctx, lines[i], col.w, game, now, header, ph || group));
    }
    var end = lines.length - back;
    if (end < 1) end = lines.length ? 1 : 0;
    if (end > lines.length) end = lines.length;
    var y = L.tabY - 8;
    var rows = [];
    var used = 0;
    var viewInner = Math.max(40, viewH - 16);
    i = end - 1;
    while (i >= 0) {
      var h = boxes[i].h;
      if (rows.length && used + h > viewInner) break;
      y -= h;
      rows.push({ i: i, y: y });
      used += h;
      i -= 1;
    }
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(0, L.header, L.w, viewH);
    ctx.clip();
    var strikeT = ui.verdict ? ui.verdict.t : 1;
    var r;
    for (r = rows.length - 1; r >= 0; r--) {
      var row = rows[r];
      var newest = row.i === lines.length - 1 && back === 0;
      var rowEase = newest ? ease : 1;
      var dy = newest && rowEase < 1 ? (1 - rowEase) * 24 : 0;
      drawChatMessage(ctx, ui, game, lines[row.i], col.x, row.y, boxes[row.i], dy, strikeT, newest, rowEase);
    }
    ctx.restore();
    paintColumnFade(ctx, L);
    ui.clip = null;
  }

  function drawLifeBody(ctx, game, ui, L, now) {
    drawFeed(ctx, game, ui, L, now);
  }

  function mastHeight(game) {
    var goal = screenGoal(game);
    var pin = goal && goal.id && goal.id !== "clear";
    return pin ? 136 : 104;
  }

  function clockSpeedOf(game) {
    var speed = game && game.settings && game.settings.clock;
    if (speed === 0 || speed === 2) return speed;
    return 1;
  }

  function paintMastButton(ctx, ui, id, x, y, w, h, label, on) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = on ? LAMP : "rgba(20,16,14,0.45)";
    ctx.fillRect(x, y, w, h);
    var face = textFace(13, "title");
    ctx.font = face;
    ctx.fillStyle = on ? INK : PAPER;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, face, label, w - 6), x + w * 0.5, y + h * 0.5);
    ctx.restore();
    if (ui) pushHit(ui, id, x, y, w, h);
  }

  function drawClockLine(ctx, game, ui, L, now) {
    var phase = S.phaseAt(now);
    var shown = ui.cashShown != null ? ui.cashShown : (game.player.capital || 0);
    var cash = S.money(Math.round(shown));
    var heat = (game.player && game.player.heat) || 0;
    var markPhase = (ui && ui.markPhase) || phase.id;
    var mark = (game.flags && game.flags.shady && heat >= 45) ? "heat" : phaseMark(markPhase);
    var chapter = S.chapterNow ? S.chapterNow(game) : { label: "" };
    var ledger = S.dayLedger ? S.dayLedger(game) : { inn: 0, out: 0, left: Math.round(game.player.capital || 0), from: "" };
    var goal = screenGoal(game);
    var pin = goal && goal.id && goal.id !== "clear";
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(0, 0, L.w, L.header);
    ctx.clip();
    var gear = 22;
    var gearX = L.w - 10 - gear;
    var y1 = 28;
    drawMark(ctx, mark, 16, y1 - 4);
    var chapterFace = textFace(15, "title");
    ctx.font = chapterFace;
    ctx.fillStyle = PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    var numFace = font(30, true, 700, false);
    ctx.font = numFace;
    var cashW = measure(ctx, numFace, cash);
    var cashRight = gearX - 8;
    var chapterX = 30;
    var chapterW = Math.max(48, cashRight - cashW - chapterX - 10);
    ctx.font = chapterFace;
    ctx.fillText(clipText(ctx, chapterFace, chapter.label || "", chapterW), chapterX, y1);
    ctx.font = numFace;
    ctx.fillStyle = LAMP;
    ctx.textAlign = "right";
    ctx.fillText(cash, cashRight, y1);
    ui.cashPt = { x: cashRight - cashW * 0.5, y: y1 };
    ui.cashX = ui.cashPt.x;
    var controls = [
      { id: "clock:pause", label: "Pause", on: clockSpeedOf(game) === 0 },
      { id: "clock:1", label: "1×", on: clockSpeedOf(game) === 1 },
      { id: "clock:2", label: "2×", on: clockSpeedOf(game) === 2 },
      { id: "clock:sleep", label: "Sleep", on: false }
    ];
    var gap = 4;
    var btnH = 26;
    var btnY = 50;
    var widths = [];
    var total = 0;
    var bi;
    var btnFace = textFace(13, "title");
    for (bi = 0; bi < controls.length; bi++) {
      var bw = Math.max(36, measure(ctx, btnFace, controls[bi].label) + 14);
      widths.push(bw);
      total += bw;
    }
    total += gap * (controls.length - 1);
    var btnX = Math.max(8, L.w - 10 - total);
    var stampFace = textFace(13, "body");
    ctx.font = stampFace;
    ctx.fillStyle = PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    var stamp = S.clockLabel(now) + "  " + (phase.name || "");
    ctx.fillText(clipText(ctx, stampFace, stamp, Math.max(40, btnX - 16)), 12, btnY + btnH * 0.5);
    for (bi = 0; bi < controls.length; bi++) {
      paintMastButton(ctx, ui, controls[bi].id, btnX, btnY, widths[bi], btnH, controls[bi].label, controls[bi].on);
      btnX += widths[bi] + gap;
    }
    var ledgerFace = textFace(13, "body");
    var ledgerNum = textFace(13, "num");
    var bits = [
      ["In", S.money(ledger.inn || 0)],
      ["Out", S.money(ledger.out || 0)],
      ["Left", S.money(ledger.left != null ? ledger.left : (game.player.capital || 0))]
    ];
    var lx = 12;
    var ly = 86;
    var li;
    for (li = 0; li < bits.length; li++) {
      ctx.font = ledgerFace;
      ctx.fillStyle = "#b7b0a6";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(bits[li][0], lx, ly);
      lx += measure(ctx, ledgerFace, bits[li][0]) + 4;
      ctx.font = ledgerNum;
      ctx.fillStyle = PAPER;
      ctx.fillText(bits[li][1], lx, ly);
      lx += measure(ctx, ledgerNum, bits[li][1]) + 14;
    }
    if (pin) {
      var labelFace = textFace(13, "body");
      var price = goal.price || (goal.cost > 0 ? S.money(goal.cost) : "");
      var priceFace = textFace(13, "num");
      var trackX = 12;
      var trackW = L.w - 24;
      var trackH = 16;
      var trackY = L.header - 22;
      var cap = game.player.capital || 0;
      var fill = goal.cost > 0 ? cap / goal.cost : (goal.fill || 0);
      if (fill < 0) fill = 0;
      if (fill > 1) fill = 1;
      ctx.font = labelFace;
      ctx.fillStyle = PAPER;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      var priceW = price ? measure(ctx, priceFace, price) + 8 : 0;
      ctx.fillText(clipText(ctx, labelFace, goal.label || "", Math.max(40, trackW - priceW)), trackX, trackY - 4);
      ctx.fillStyle = "rgba(239,230,212,0.16)";
      ctx.fillRect(trackX, trackY, trackW, trackH);
      if (fill > 0) {
        ctx.fillStyle = LAMP;
        ctx.fillRect(trackX, trackY, Math.max(2, trackW * fill), trackH);
      }
      if (price) {
        ctx.font = priceFace;
        ctx.fillStyle = fill > 0.72 ? INK : PAPER;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(price, trackX + trackW - 6, trackY + trackH * 0.5);
      }
    }
    ctx.restore();
    roundButton(ctx, ui, "hdr:settings", gearX, 6, gear, "gear", ui.menu === "settings");
  }

  function paintChatStreet(ctx, game, ui, L, now) {
    var phase = S.phaseAt(now);
    var key = "shopNoon";
    if (!game.flags || !game.flags.opened || doorClosed(game)) key = "shopClosed";
    else if (phase.id === "morning") key = "shopMorning";
    else if (phase.id === "evening") key = "shopEvening";
    else if (phase.id === "night") key = "shopNight";
    else if (phase.id === "standard") key = "shopNoon";
    var col = chatColumn(L);
    var bw = Math.round(Math.min(240, col.w * 0.58));
    var bh = Math.round(bw * 9 / 16);
    var areaTop = L.header + 8;
    var areaH = Math.max(40, L.tabY - areaTop - 8);
    if (bh > areaH * 0.55) {
      bh = Math.round(areaH * 0.55);
      bw = Math.round(bh * 16 / 9);
    }
    var x = Math.round(col.x + (col.w - bw) * 0.5);
    var y = Math.round(areaTop + (areaH - bh) * 0.34);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.26;
    if (!blitContain(ctx, key, x, y, bw, bh)) {
      ctx.fillStyle = "#14110e";
      ctx.fillRect(x, y, bw, bh);
    }
    ctx.restore();
  }

  function sheetTitle(which) {
    if (which === "job") return "Work";
    if (which === "edu") return "School";
    if (which === "scout") return "People";
    if (which === "lab") return "Stuff";
    if (which === "journal") return "The book";
    return "Settings";
  }

  function drawSheet(ctx, game, ui, L, which) {
    if (which === "job" || which === "edu" || which === "scout" || which === "lab" || which === "settings" || which === "journal") {
      drawTabGround(ctx, game, ui, L, which);
      return;
    }
    var x = 8;
    var y = L.header + 6;
    var w = L.w - 16;
    var h = L.tabY - y - 6;
    if (w < 40 || h < 80) return;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(20, 16, 14, 0.55)";
    ctx.fillRect(0, L.header, L.w, L.tabY - L.header);
    ctx.fillStyle = PAPER;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = BRICK;
    ctx.fillRect(x, y, 6, h);
    ctx.font = font(18, false, 700, true);
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(sheetTitle(which), x + 18, y + 22);
    button(ctx, ui, "close", x + w - 96, y + 8, 84, 28, "Close", false, false);
    var body = { x: x, y: y + 44, w: w, h: h - 52 };
    ui.clip = body;
    var flow = openFlow(ctx, ui, body, ui.scroll || 0);
    if (which === "journal") drawJournal(flow, game, ui);
    else if (which === "settings") drawSettings(flow, game, ui);
    ui.contentH = flow.cy + 12;
    ctx.restore();
    ui.clip = null;
    var max = (ui.contentH || 0) - body.h;
    if (max < 0) max = 0;
    if (ui.scroll < 0) ui.scroll = 0;
    if (ui.scroll > max) ui.scroll = max;
    ctx.restore();
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }


  function launchPay(ui, L) {
    if (!ui || !ui.payKind || ui.coin) return;
    var from = ui.shopPt || { x: Math.min(120, (L.w || 200) * 0.7), y: (L.header || 40) + 48 };
    var to = ui.cashPt || { x: (L.w || 200) - 70, y: 20 };
    var small = ui.payKind !== "shift";
    ui.coin = {
      sx: from.x,
      sy: from.y,
      tx: to.x,
      ty: to.y,
      t: 0,
      dur: small ? 280 : 520,
      r: small ? 5 : 8,
      small: small,
      landed: false,
      w: ui.w || (L && L.w) || 0,
      h: ui.h || (L && L.h) || 0
    };
    ui.payKind = "";
  }

  function coinSpot(coin) {
    var u = coin.dur > 0 ? coin.t / coin.dur : 1;
    if (u < 0) u = 0;
    if (u > 1) u = 1;
    var e = 1 - Math.pow(1 - u, 3);
    var x = coin.sx + (coin.tx - coin.sx) * e;
    var y = coin.sy + (coin.ty - coin.sy) * e;
    x -= Math.sin(e * Math.PI) * (coin.small ? 20 : 46);
    var pad = (coin.r || 6) + 3;
    if (x < pad) x = pad;
    if (y < pad) y = pad;
    if (coin.w > pad * 2 && x > coin.w - pad) x = coin.w - pad;
    if (coin.h > pad * 2 && y > coin.h - pad) y = coin.h - pad;
    return { x: x, y: y };
  }

  var ROOM_SPOT = {
    sign: { u: 0.12, v: 0.18, w: 0.30, h: 0.08 },
    lights: { u: 0.10, v: 0.27, w: 0.36, h: 0.06 },
    door: { u: 0.14, v: 0.38, w: 0.14, h: 0.30 },
    counter: { u: 0.32, v: 0.48, w: 0.16, h: 0.12 },
    cooler: { u: 0.32, v: 0.58, w: 0.09, h: 0.12 },
    safe: { u: 0.42, v: 0.56, w: 0.08, h: 0.12 },
    speaker: { u: 0.46, v: 0.38, w: 0.08, h: 0.09 },
    neon: { u: 0.44, v: 0.32, w: 0.10, h: 0.06 },
    plant: { u: 0.05, v: 0.64, w: 0.09, h: 0.14 },
    stock: { u: 0.24, v: 0.66, w: 0.11, h: 0.12 }
  };

  var PERSON_SPOT = {
    sera: { u: 0.40, v: 0.76 },
    landlord: { u: 0.20, v: 0.76 },
    juniper: { u: 0.72, v: 0.78 },
    hire: { u: 0.34, v: 0.74 }
  };

  function viewBias(view) {
    if (view === "job") return { x: 0.16, y: 0.46 };
    if (view === "edu") return { x: 0.20, y: 0.0 };
    if (view === "scout") return { x: 0.30, y: 0.40 };
    return { x: 0.38, y: 0.32 };
  }

  function viewRank(view) {
    if (view === "job") return 1;
    if (view === "edu") return 2;
    if (view === "scout") return 3;
    return 0;
  }

  function paintCutout(ctx, key, x, y, w, h) {
    var img = painted(key);
    if (!img || w < 2 || h < 2) return false;
    ctx.save();
    ctx.shadowBlur = 0;
    var ir = img.naturalWidth / Math.max(1, img.naturalHeight);
    var dh = h;
    var dw = dh * ir;
    if (dw > w) {
      dw = w;
      dh = dw / ir;
    }
    ctx.drawImage(img, x + (w - dw) * 0.5, y + (h - dh), dw, dh);
    ctx.restore();
    return true;
  }

  function stageFrame(key, rect, biasX, biasY) {
    var img = painted(key);
    var bx = biasX == null ? 0.5 : biasX;
    var by = biasY == null ? 0.28 : biasY;
    if (!img) {
      return {
        map: function (u, v) {
          return { x: rect.x + u * rect.w, y: rect.y + v * rect.h };
        },
        box: function (u, v, w, h) {
          return { x: rect.x + u * rect.w, y: rect.y + v * rect.h, w: w * rect.w, h: h * rect.h };
        }
      };
    }
    var ir = img.naturalWidth / img.naturalHeight;
    var r = rect.w / Math.max(1, rect.h);
    var sx = 0;
    var sy = 0;
    var sw = img.naturalWidth;
    var sh = img.naturalHeight;
    if (ir > r) {
      sw = sh * r;
      sx = (img.naturalWidth - sw) * bx;
    } else {
      sh = sw / r;
      sy = (img.naturalHeight - sh) * by;
    }
    return {
      img: img,
      sx: sx,
      sy: sy,
      sw: sw,
      sh: sh,
      map: function (u, v) {
        return {
          x: rect.x + ((u * img.naturalWidth - sx) / sw) * rect.w,
          y: rect.y + ((v * img.naturalHeight - sy) / sh) * rect.h
        };
      },
      box: function (u, v, w, h) {
        var a = this.map(u, v);
        var b = this.map(u + w, v + h);
        return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
      }
    };
  }

  function spotBox(frame, spot) {
    return frame.box(spot.u, spot.v, spot.w, spot.h);
  }

  function boxOnStage(box, rect) {
    if (!box || box.w < 10 || box.h < 10) return false;
    var x1 = Math.max(box.x, rect.x);
    var y1 = Math.max(box.y, rect.y);
    var x2 = Math.min(box.x + box.w, rect.x + rect.w);
    var y2 = Math.min(box.y + box.h, rect.y + rect.h);
    return x2 - x1 > 12 && y2 - y1 > 12;
  }

  function paintStamp(ctx, box, text, lamp) {
    if (!text || !box || box.w < 16) return;
    var face = textFace(13, "num");
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.font = face;
    var tw = Math.min(box.w - 4, measure(ctx, face, text) + 12);
    var th = 18;
    var x = box.x + (box.w - tw) * 0.5;
    var y = box.y + box.h - th - 2;
    if (y < box.y) y = box.y;
    ctx.fillStyle = "rgba(20,16,14,0.78)";
    ctx.fillRect(x, y, tw, th);
    ctx.fillStyle = lamp ? LAMP : "#b7b0a6";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, face, text, tw - 8), x + tw * 0.5, y + th * 0.5);
    ctx.restore();
  }

  function paintShopStage(ctx, game, rect, view) {
    var now = (frameUi && (frameUi.presentAt || frameUi.now)) || Date.now();
    var key = shopArtNow(game, now, null);
    var bias = viewBias(view);
    var frame = stageFrame(key, rect, bias.x, bias.y);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#14110e";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    var heat = (game && game.player && game.player.heat) || 0;
    var dim = 0;
    if (game && game.flags && game.flags.shady && heat >= 20) {
      dim = Math.min(0.55, (heat - 20) / 120);
      if (heat >= 45) dim = Math.max(dim, 0.42);
    }
    ctx.globalAlpha = 1 - dim;
    if (frame.img) ctx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    return frame;
  }

  function paintDoorLeaf(ctx, box, openT) {
    if (!box || openT > 0.94) return;
    var leaf = box.w * (0.1 + 0.9 * (1 - openT));
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    ctx.fillStyle = "#16120e";
    ctx.fillRect(box.x, box.y, leaf, box.h);
    ctx.fillStyle = LAMP;
    ctx.fillRect(box.x + Math.max(2, leaf - 7), box.y + box.h * 0.52, 3, Math.max(6, box.h * 0.08));
    ctx.restore();
  }

  function paintSignPlate(ctx, box, name, owned) {
    if (!box) return;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = owned ? "rgba(28,18,10,0.9)" : "rgba(20,16,14,0.75)";
    ctx.fillRect(box.x, box.y, box.w, box.h);
    var face = textFace(box.h > 32 ? 15 : 13, "title");
    ctx.font = face;
    ctx.fillStyle = owned ? LAMP : PAPER;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, face, name || "The Corner", Math.max(8, box.w - 10)), box.x + box.w * 0.5, box.y + box.h * 0.5);
    ctx.restore();
  }

  function paintLampRow(ctx, box) {
    if (!box || box.w < 20) return;
    var n = 4;
    var i;
    ctx.save();
    ctx.shadowBlur = 0;
    for (i = 0; i < n; i++) {
      var cx = box.x + box.w * (0.18 + i * 0.2);
      var cy = box.y + box.h * 0.45;
      var g = ctx.createRadialGradient(cx, cy, 1, cx, cy, 16);
      g.addColorStop(0, "rgba(240,195,106,0.9)");
      g.addColorStop(1, "rgba(240,195,106,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function hoverStroke(ctx, ui, id, box) {
    if (!ui || !box || ui.hover !== id) return;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = LAMP;
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x + 1, box.y + 1, Math.max(1, box.w - 2), Math.max(1, box.h - 2));
    ctx.restore();
  }

  function paintProp(ctx, ui, box, art, owned, price, id) {
    if (!boxOnStage(box, { x: -9999, y: -9999, w: 99999, h: 99999 })) return;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    ctx.globalAlpha = owned ? 1 : 0.4;
    if (art) blitCover(ctx, art, box.x, box.y, box.w, box.h, 0.5, 0.45);
    else {
      ctx.fillStyle = owned ? PAPER : "#3a342c";
      ctx.fillRect(box.x + 2, box.y + box.h * 0.42, Math.max(4, box.w - 4), Math.max(4, box.h * 0.22));
    }
    ctx.restore();
    if (owned) {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = LAMP;
      ctx.fillRect(box.x, box.y, box.w, 3);
      ctx.restore();
    }
    if (price) paintStamp(ctx, box, price, owned);
    if (id && ui) pushHit(ui, id, box.x, box.y, box.w, box.h);
    hoverStroke(ctx, ui, id, box);
  }

  function paintPersonAt(ctx, key, frame, u, v, rect) {
    var foot = frame.map(u, v);
    var ph = Math.min(rect.h * 0.5, 460);
    var pw = ph * 0.34;
    var minX = rect.x + pw * 0.55 + 8;
    var maxX = rect.x + rect.w - pw * 0.55 - 60;
    if (maxX < minX) maxX = rect.x + rect.w * 0.5;
    if (foot.x < minX) foot.x = minX;
    if (foot.x > maxX) foot.x = maxX;
    var floorY = rect.y + rect.h * 0.58;
    if (foot.y > floorY) foot.y = floorY;
    if (foot.y < rect.y + ph * 0.85) foot.y = rect.y + rect.h * 0.56;
    var x = foot.x - pw * 0.5;
    var y = foot.y - ph;
    paintCutout(ctx, key, x, y, pw, ph);
    return { x: x, y: y, w: pw, h: ph };
  }

  function paintHead(ctx, key, x, y, w, h) {
    var img = painted(key);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#14110e";
    ctx.fillRect(x, y, w, h);
    if (img) {
      var sh = img.naturalHeight * 0.22;
      ctx.drawImage(img, 0, 0, img.naturalWidth, sh, x, y, w, h);
    }
    ctx.restore();
  }

  function focusSlot(game, ui) {
    var slots = game.slots || [];
    var focus = ui && ui.focusSlot != null ? ui.focusSlot : 0;
    if (!slots[focus]) focus = 0;
    return { focus: focus, slot: slots[focus] || null, slots: slots };
  }

  function nextRoomKey(place) {
    var keys = ["lights", "sign", "counter", "cooler", "safe", "speaker", "plant", "neon"];
    var i;
    if (!place || !place.owned) return "";
    for (i = 0; i < keys.length; i++) if (!place[keys[i]]) return keys[i];
    return "";
  }

  function paintWalkers(ctx, game, ui, frame, rect) {
    var open = !!(game.flags && game.flags.opened) && !doorClosed(game);
    var phase = S.phaseAt((ui && ui.presentAt) || Date.now());
    var n = open && S.rushCrowd ? S.rushCrowd(phase) : 0;
    if (!n) return;
    var walk = easeOut(ui.walkT == null ? 1 : ui.walkT);
    var who = ["hire", "sera", "hire"];
    var i;
    for (i = 0; i < n && i < 3; i++) {
      var u = (0.78 - i * 0.06) + ((0.34 + i * 0.05) - (0.78 - i * 0.06)) * walk;
      var bob = Math.sin(walk * Math.PI) * 4;
      var foot = frame.map(u, 0.62);
      var ph = Math.min(rect.h * 0.32, 240);
      var pw = ph * 0.34;
      if (foot.x < rect.x + 8) foot.x = rect.x + rect.w * (0.3 + i * 0.12);
      if (foot.x > rect.x + rect.w - 8) foot.x = rect.x + rect.w * (0.7 - i * 0.08);
      if (foot.y > rect.y + rect.h * 0.62) foot.y = rect.y + rect.h * 0.52;
      paintCutout(ctx, who[i], foot.x - pw * 0.5, foot.y - ph - bob, pw, ph);
    }
  }

  function stepWalk(ui, game, now) {
    if (!ui || ui.muteHits) return;
    var lines = collectChat(game, ui, now);
    var tail = lines.length ? lines[lines.length - 1] : null;
    var key = tail ? String(tail.text || "") : "";
    if (ui.walkKey !== key) {
      ui.walkKey = key;
      ui.walkT = 0;
    } else if ((ui.walkT || 0) < 1) {
      ui.walkT += (ui.dt || 16) / 880;
      if (ui.walkT > 1) ui.walkT = 1;
    }
  }

  function drawChatScene(ctx, game, ui, L, rect, now) {
    ui.stageChat = true;
    var frame = paintShopStage(ctx, game, rect, "chat");
    var place = (game.player && game.player.place) || {};
    var sign = spotBox(frame, ROOM_SPOT.sign);
    var slot = game.slots && game.slots[0];
    if (boxOnStage(sign, rect)) paintSignPlate(ctx, sign, (slot && slot.name) || place.name || "The Corner", !!place.sign);
    if (place.lights) paintLampRow(ctx, spotBox(frame, ROOM_SPOT.lights));
    paintDoorLeaf(ctx, spotBox(frame, ROOM_SPOT.door), ui.doorT == null ? 1 : ui.doorT);
    if (place.plant) paintProp(ctx, null, spotBox(frame, ROOM_SPOT.plant), "plant", true, "", "");
    if (place.cooler) paintProp(ctx, null, spotBox(frame, ROOM_SPOT.cooler), "cooler", true, "", "");
    stepWalk(ui, game, now);
    paintWalkers(ctx, game, ui, frame, rect);
    var veil = ctx.createLinearGradient(0, rect.y + rect.h * 0.2, 0, rect.y + rect.h);
    veil.addColorStop(0, "rgba(8,6,4,0)");
    veil.addColorStop(1, "rgba(8,6,4,0.78)");
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = veil;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    if (!ui.muteHits) {
      var spot = frame.map(0.38, 0.55);
      ui.shopPt = { x: spot.x + (ui.hitOx || 0), y: spot.y };
    }
    drawFeed(ctx, game, ui, L, now);
  }

  function paintRackCard(ctx, ui, x, y, w, h, card, cap) {
    var owned = !!card.owned;
    var afford = !(card.cost > 0) || cap >= card.cost;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = card.dim ? 0.4 : 1;
    ctx.fillStyle = owned ? "#2a2118" : "#14110e";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = owned ? LAMP : (card.id && afford ? LAMP : "#3a342c");
    ctx.fillRect(x, y, 4, h);
    var side = Math.min(36, h - 16);
    var ix = x + 12;
    var iy = y + (h - side) * 0.5;
    ctx.fillStyle = "#100e0c";
    ctx.fillRect(ix, iy, side, side);
    if (card.art) blitCover(ctx, card.art, ix, iy, side, side, 0.5, 0.45);
    else icon(ctx, card.icon || "box", ix + side * 0.5, iy + side * 0.5, side * 0.72, owned ? LAMP : PAPER);
    var textX = ix + side + 8;
    var pillW = Math.min(76, w * 0.28);
    var textW = Math.max(24, w - (textX - x) - pillW - 16);
    ctx.font = textFace(14, "title");
    ctx.fillStyle = PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, textFace(14, "title"), card.name, textW), textX, y + 18);
    var fill = owned ? 1 : (card.cost > 0 ? cap / card.cost : 0);
    if (fill < 0) fill = 0;
    if (fill > 1) fill = 1;
    ctx.fillStyle = "rgba(239,230,212,0.16)";
    ctx.fillRect(textX, y + h - 16, textW, 8);
    if (fill > 0) {
      ctx.fillStyle = LAMP;
      ctx.globalAlpha = card.dim ? 0.4 : (owned || afford ? 1 : 0.55);
      ctx.fillRect(textX, y + h - 16, Math.max(2, textW * fill), 8);
      ctx.globalAlpha = card.dim ? 0.4 : 1;
    }
    var pillH = 28;
    var px = x + w - pillW - 8;
    var py = y + (h - pillH) * 0.5;
    var label = owned ? "On" : (card.cost > 0 ? S.money(card.cost) : (card.meta || "Go"));
    ctx.fillStyle = owned ? "#3a3024" : (card.id && afford ? LAMP : "#241c14");
    ctx.fillRect(px, py, pillW, pillH);
    ctx.font = textFace(13, "num");
    ctx.fillStyle = owned ? LAMP : (card.id && afford ? INK : "#8a8178");
    ctx.textAlign = "center";
    ctx.fillText(clipText(ctx, textFace(13, "num"), label, pillW - 8), px + pillW * 0.5, py + pillH * 0.5);
    ctx.restore();
    if (card.id && ui && !card.dim) pushHit(ui, card.id, x, y, w, h);
  }

  function tycoonCards(game, ui) {
    var place = (game.player && game.player.place) || {};
    var pack = focusSlot(game, ui);
    var slot = pack.slot;
    var cards = [];
    var ownedRoom = !!place.owned;
    if (!ownedRoom) {
      cards.push({ id: "room", name: "Rent the corner", cost: D.ROOM.rent || 0, icon: "shop" });
    } else {
      cards.push({
        id: doorClosed(game) ? "door:open" : "door:close",
        name: "Door",
        meta: doorClosed(game) ? "Shut" : "Open",
        owned: !doorClosed(game),
        icon: "shop"
      });
    }
    var parts = [
      ["lights", "Lights", "bulb", "flame"],
      ["sign", "Sign", "", "star"],
      ["counter", "Counter", "", "box"],
      ["cooler", "Cooler", "cooler", "box"],
      ["safe", "Safe", "safe", "box"],
      ["speaker", "Speaker", "speaker", "box"],
      ["plant", "Plant", "plant", "box"],
      ["neon", "Neon", "", "flame"]
    ];
    var i;
    for (i = 0; i < parts.length; i++) {
      var key = parts[i][0];
      var owned = !!place[key];
      cards.push({
        id: owned || !ownedRoom ? "" : ("upgrade:" + key),
        name: parts[i][1],
        art: parts[i][2],
        icon: parts[i][3],
        cost: owned ? 0 : (D.ROOM[key] || 0),
        owned: owned,
        dim: !ownedRoom
      });
    }
    if (slot && ownedRoom) {
      var limit = S.stockCap(game);
      var have = slot.stock || 0;
      var buyN = D.STOCK_PACK;
      var room = limit - have;
      if (buyN > room) buyN = room;
      cards.push({
        id: buyN > 0 ? ("stock:" + pack.focus) : "",
        name: "Stock " + have + "/" + limit,
        art: "crate",
        cost: buyN > 0 ? buyN * D.STOCK_PRICE : 0,
        owned: have > 0 && buyN <= 0,
        icon: "box"
      });
      var emp = slot.employee;
      if (emp) {
        cards.push({
          id: "fire:" + pack.focus,
          name: emp.caught ? "Busted" : emp.name,
          meta: emp.caught ? "Held" : "Fire",
          icon: "people"
        });
      } else {
        cards.push({ id: "applicants", name: "Hire", meta: "Find", icon: "people" });
      }
      var offer = nextJobOffer(game, slot);
      if (offer && offer.open) {
        cards.push({
          id: "apply:" + pack.focus + ":" + offer.spec.id,
          name: offer.spec.name,
          meta: "Job",
          icon: "cap"
        });
      }
    }
    var node = nextTreeNode(game);
    if (node) {
      cards.push({
        id: "node:" + node.id,
        name: node.name,
        meta: node.cost + " VP",
        icon: "brain"
      });
    }
    return cards;
  }

  function drawTycoonRack(ctx, game, ui, rect) {
    var cards = tycoonCards(game, ui);
    if (!cards.length) return;
    var cap = (game.player && game.player.capital) || 0;
    var gap = 6;
    var cols = rect.w >= 520 ? 2 : 1;
    var rackW = Math.min(rect.w - 16, 640);
    var cellW = (rackW - gap * (cols - 1)) / cols;
    var cellH = 58;
    var rows = Math.ceil(cards.length / cols);
    var rackH = rows * cellH + (rows - 1) * gap + 28;
    var maxH = rect.h * 0.58;
    if (rackH > maxH) {
      cellH = Math.max(50, Math.floor((maxH - 28 - gap * (rows - 1)) / rows));
      rackH = rows * cellH + (rows - 1) * gap + 28;
    }
    var x0 = rect.x + (rect.w - rackW) * 0.5;
    var y0 = rect.y + rect.h - rackH - 6;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(8,6,4,0.82)";
    ctx.fillRect(x0 - 6, y0 - 4, rackW + 12, rackH + 8);
    ctx.font = textFace(13, "title");
    ctx.fillStyle = LAMP;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    var slot = (game.slots && game.slots[0]) || {};
    ctx.fillText(clipText(ctx, textFace(13, "title"), (slot.name || "The Corner") + "  ·  stations", rackW - 8), x0, y0 + 10);
    ctx.restore();
    var i;
    for (i = 0; i < cards.length; i++) {
      var col = i % cols;
      var row = (i / cols) | 0;
      paintRackCard(ctx, ui, x0 + col * (cellW + gap), y0 + 22 + row * (cellH + gap), cellW, cellH, cards[i], cap);
    }
  }

  function drawJobScene(ctx, game, ui, L, rect, now) {
    var frame = paintShopStage(ctx, game, rect, "job");
    var pack = focusSlot(game, ui);
    var slot = pack.slot;
    var place = (game.player && game.player.place) || {};
    var cap = (game.player && game.player.capital) || 0;
    var nextKey = nextRoomKey(place);
    var sign = spotBox(frame, ROOM_SPOT.sign);
    var door = spotBox(frame, ROOM_SPOT.door);
    var name = (slot && slot.name) || place.name || "The Corner";
    if (ui && ui.naming) name = ui.nameBuf ? ui.nameBuf : "Type a name";
    if (boxOnStage(sign, rect)) {
      paintSignPlate(ctx, sign, name, !!place.sign);
      if (ui && place.owned) {
        var signId = place.sign && slot ? nameCycleId(slot, pack.focus) : "upgrade:sign";
        pushHit(ui, signId, sign.x, sign.y, sign.w, sign.h);
        hoverStroke(ctx, ui, signId, sign);
        if (!place.sign && nextKey === "sign") paintStamp(ctx, sign, S.money(D.ROOM.sign || 0), cap >= (D.ROOM.sign || 0));
        var pen = { x: sign.x + sign.w - 26, y: sign.y + sign.h + 4, w: 26, h: 22 };
        if (boxOnStage(pen, rect)) {
          ctx.save();
          ctx.shadowBlur = 0;
          ctx.fillStyle = ui.naming ? LAMP : "rgba(20,16,14,0.8)";
          ctx.fillRect(pen.x, pen.y, pen.w, pen.h);
          ctx.font = textFace(13, "title");
          ctx.fillStyle = ui.naming ? INK : PAPER;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("Aa", pen.x + pen.w * 0.5, pen.y + pen.h * 0.5);
          ctx.restore();
          pushHit(ui, "name:type", pen.x, pen.y, pen.w, pen.h);
        }
      }
    }
    if (place.lights) paintLampRow(ctx, spotBox(frame, ROOM_SPOT.lights));
    paintDoorLeaf(ctx, door, ui.doorT == null ? 1 : ui.doorT);
    if (boxOnStage(door, rect) && ui) {
      var doorId = !place.owned ? "room" : (doorClosed(game) ? "door:open" : "door:close");
      pushHit(ui, doorId, door.x, door.y, door.w, door.h);
      hoverStroke(ctx, ui, doorId, door);
      if (!place.owned) {
        var rw = Math.min(door.w + 36, 160);
        var rh = 48;
        var rx = door.x + (door.w - rw) * 0.5;
        var ry = door.y + door.h * 0.28;
        var afford = cap >= (D.ROOM.rent || 0);
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(16,12,10,0.9)";
        ctx.fillRect(rx, ry, rw, rh);
        ctx.fillStyle = afford ? LAMP : "#8a8178";
        ctx.fillRect(rx, ry, rw, 3);
        ctx.font = textFace(15, "title");
        ctx.fillStyle = afford ? LAMP : PAPER;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Rent  " + S.money(D.ROOM.rent || 0), rx + rw * 0.5, ry + rh * 0.55);
        ctx.restore();
        pushHit(ui, "room", rx, ry, rw, rh);
      }
    }
    var props = [
      ["lights", "bulb"],
      ["counter", ""],
      ["cooler", "cooler"],
      ["safe", "safe"],
      ["speaker", "speaker"],
      ["plant", "plant"],
      ["neon", ""]
    ];
    var i;
    for (i = 0; i < props.length; i++) {
      var key = props[i][0];
      var owned = !!place[key];
      if (!owned && !place.owned) continue;
      var box = spotBox(frame, ROOM_SPOT[key]);
      if (!boxOnStage(box, rect)) continue;
      var pid = owned || !place.owned ? "" : ("upgrade:" + key);
      var price = !owned && key === nextKey ? S.money(D.ROOM[key] || 0) : "";
      paintProp(ctx, ui, box, props[i][1], owned, price, pid);
    }
    if (slot && place.owned) {
      var stockBox = spotBox(frame, ROOM_SPOT.stock);
      if (boxOnStage(stockBox, rect)) {
        var limit = S.stockCap(game);
        var have = slot.stock || 0;
        var buyN = D.STOCK_PACK;
        var room = limit - have;
        if (buyN > room) buyN = room;
        var cost = buyN * D.STOCK_PRICE;
        var stockId = buyN > 0 ? ("stock:" + pack.focus) : "";
        paintProp(ctx, ui, stockBox, "crate", have > 0, have + "/" + limit, stockId);
        if (buyN > 0) paintStamp(ctx, stockBox, S.money(cost), cap >= cost);
      }
    }
    if (S.hireAtRegister && S.hireAtRegister(game)) {
      var body = paintPersonAt(ctx, "hire", frame, 0.3, 0.74, rect);
      if (ui) pushHit(ui, "look:hire", body.x, body.y, body.w, body.h * 0.62);
    } else if (game.flags && game.flags.opened && !doorClosed(game)) {
      var who = S.registerWatch ? S.registerWatch(game) : { id: "you" };
      if (who.id === "nobody") paintStamp(ctx, spotBox(frame, ROOM_SPOT.counter), "Nobody", false);
    }
    if (slot && !slot.camera && game.nodes && game.nodes.camera) {
      var cam = frame.box(0.06, 0.12, 0.08, 0.08);
      if (boxOnStage(cam, rect)) {
        paintStamp(ctx, cam, S.money(D.CAM_COST), cap >= D.CAM_COST);
        if (ui) pushHit(ui, "cam:" + pack.focus, cam.x, cam.y, cam.w, cam.h);
      }
    }
    if (place.owned && !(game.world && game.world.floor) && roomPartsOwned(place)) {
      var floorBox = frame.box(0.18, 0.8, 0.16, 0.08);
      if (boxOnStage(floorBox, rect)) {
        paintStamp(ctx, floorBox, "Floor  " + S.money(D.ROOM.floor || 0), cap >= (D.ROOM.floor || 0));
        if (ui) pushHit(ui, "floor", floorBox.x, floorBox.y, floorBox.w, floorBox.h);
      }
    }
    var node = nextTreeNode(game);
    if (node && ui) {
      var chip = { x: rect.x + 10, y: rect.y + rect.h - 42, w: Math.min(200, rect.w * 0.42), h: 32 };
      var afford = (game.player.vp || 0) >= node.cost;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(20,16,14,0.82)";
      ctx.fillRect(chip.x, chip.y, chip.w, chip.h);
      ctx.font = textFace(13, "title");
      ctx.fillStyle = afford ? LAMP : "#8a8178";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(clipText(ctx, textFace(13, "title"), node.name + "  " + node.cost, chip.w - 8), chip.x + chip.w * 0.5, chip.y + chip.h * 0.5);
      ctx.restore();
      pushHit(ui, "node:" + node.id, chip.x, chip.y, chip.w, chip.h);
    }
    if (slot) {
      var job = D.jobById[slot.jobId];
      var offer = nextJobOffer(game, slot);
      var jobId = "";
      var jobText = job ? job.name : "Job";
      if (offer && offer.open) {
        jobId = "apply:" + pack.focus + ":" + offer.spec.id;
        jobText = offer.spec.name;
      }
      var jobBox = { x: rect.x + rect.w - Math.min(168, rect.w * 0.4) - 10, y: rect.y + rect.h - 42, w: Math.min(168, rect.w * 0.4), h: 32 };
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(20,16,14,0.82)";
      ctx.fillRect(jobBox.x, jobBox.y, jobBox.w, jobBox.h);
      ctx.font = textFace(13, "title");
      ctx.fillStyle = jobId ? LAMP : PAPER;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(clipText(ctx, textFace(13, "title"), jobText, jobBox.w - 8), jobBox.x + jobBox.w * 0.5, jobBox.y + jobBox.h * 0.5);
      ctx.restore();
      if (jobId && ui) pushHit(ui, jobId, jobBox.x, jobBox.y, jobBox.w, jobBox.h);
    }
    var slots = pack.slots;
    if (slots.length > 1 || (S.slotCap && S.slotCap(game) < 2)) {
      var thumb = { x: rect.x + rect.w - 78, y: rect.y + 10, w: 68, h: 40 };
      if (slots.length > 1) {
        paintShopCard(ctx, game, shopArtNow(game, now, null), thumb.x, thumb.y, thumb.w, thumb.h, {});
        if (ui) pushHit(ui, "focus:" + (pack.focus === 0 ? 1 : 0), thumb.x, thumb.y, thumb.w, thumb.h);
      } else {
        var cost = D.degreeById && D.degreeById.bach ? D.degreeById.bach.cost : 0;
        paintEmptyFrame(ctx, thumb.x, thumb.y, thumb.w, thumb.h, cost);
      }
    }
    drawTycoonRack(ctx, game, ui, rect);
    if (!ui.muteHits) {
      var pay = frame.map(0.38, 0.55);
      ui.shopPt = { x: pay.x + (ui.hitOx || 0), y: pay.y };
    }
  }

  function schoolOffer(game) {
    var running = game.degree;
    var def = running && D.degreeById ? D.degreeById[running.id] : null;
    var remain = 0;
    if (def && running.total) remain = running.left / running.total;
    if (remain < 0) remain = 0;
    if (remain > 1) remain = 1;
    var offer = null;
    if (!running) {
      var next = nextDegree(game);
      if (next) {
        var locked = (game.player.level || 1) < next.level;
        var afford = (game.player.capital || 0) >= next.cost;
        offer = {
          id: locked ? "" : ("deg:" + next.id),
          name: next.name,
          meta: locked ? ("Year " + next.level) : S.money(next.cost),
          dim: locked || !afford
        };
      } else {
        var hobby = null;
        var i;
        for (i = 0; i < D.HOBBIES.length; i++) {
          var item = D.HOBBIES[i];
          if (!(item.need > 0)) continue;
          if (!S.hobbyOpen(game, item)) { hobby = item; break; }
        }
        if (hobby) offer = { id: "", name: hobby.name, meta: (hobby.needSkill || hobby.skill) + " " + hobby.need, dim: true };
        else {
          var classCost = 10;
          offer = {
            id: "class",
            name: "Night class",
            meta: S.money(classCost),
            dim: (game.player.capital || 0) < classCost
          };
        }
      }
    } else {
      var later = nextDegree(game);
      if (later) offer = { id: "", name: later.name, meta: "After this", dim: true };
    }
    return { def: def, remain: remain, offer: offer };
  }

  function drawEduScene(ctx, game, ui, L, rect, now) {
    paintShopStage(ctx, game, rect, "edu");
    var offer = schoolOffer(game);
    var key = (game.degree && game.degree.id) || (offer.offer && offer.offer.name) || "school";
    if (!ui.muteHits) {
      if (ui.classKey == null) {
        ui.classKey = key;
        ui.pageT = 1;
      } else if (ui.classKey !== key) {
        ui.classKey = key;
        ui.pageT = 0;
      } else if ((ui.pageT || 0) < 1) {
        ui.pageT += (ui.dt || 16) / 420;
        if (ui.pageT > 1) ui.pageT = 1;
      }
    }
    var deskY = rect.y + rect.h * 0.4;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#2c1e14";
    ctx.fillRect(rect.x, deskY, rect.w, rect.y + rect.h - deskY);
    ctx.fillStyle = "#4a3020";
    ctx.fillRect(rect.x, deskY, rect.w, 10);
    ctx.restore();
    var nbW = Math.min(rect.w * 0.56, 460);
    var nbH = nbW * 609 / 924;
    if (nbH > rect.h * 0.5) {
      nbH = rect.h * 0.5;
      nbW = nbH * 924 / 609;
    }
    var nbX = rect.x + rect.w * 0.18;
    var nbY = deskY + 18;
    if (!blit(ctx, "notebook", nbX, nbY, nbW, nbH)) {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = PAPER;
      ctx.fillRect(nbX, nbY, nbW, nbH);
      ctx.restore();
    }
    var pageT = ui.pageT == null ? 1 : ui.pageT;
    if (pageT < 1) {
      var wipe = easeOut(pageT);
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.rect(nbX, nbY, Math.max(1, nbW * wipe), nbH);
      ctx.clip();
      ctx.fillStyle = "#f4efe4";
      ctx.fillRect(nbX, nbY, nbW, nbH);
      ctx.restore();
    }
    var title = offer.def ? offer.def.name : "School";
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.font = textFace(15, "title");
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var pageLines = wrapLines(ctx, textFace(15, "title"), title, nbW * 0.4, 3);
    var pi;
    for (pi = 0; pi < pageLines.length; pi++) {
      ctx.fillText(pageLines[pi], nbX + nbW * 0.28, nbY + nbH * 0.38 + (pi - (pageLines.length - 1) * 0.5) * 18);
    }
    if (offer.def) {
      ctx.font = textFace(13, "num");
      ctx.fillText(S.fmtMs(game.degree.left), nbX + nbW * 0.28, nbY + nbH * 0.62);
    }
    ctx.restore();
    var ringR = Math.min(34, nbH * 0.18);
    var hand = offer.def ? (1 - offer.remain) : dayHand(now);
    paintClock(ctx, nbX + nbW * 0.72, nbY + nbH * 0.48, ringR, offer.def ? offer.remain : hand);
    var book = offer.offer;
    if (book) {
      var bw = Math.min(nbW * 0.42, 150);
      var bh = bw * 609 / 924;
      var bx = nbX + nbW + 16;
      if (bx + bw > rect.x + rect.w - 8) bx = rect.x + rect.w - bw - 12;
      var by = nbY + 8;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = book.dim ? 0.82 : 1;
      ctx.translate(bx + bw * 0.5, by + bh * 0.5);
      ctx.rotate(-0.08);
      if (!blit(ctx, "notebook", -bw * 0.5, -bh * 0.5, bw, bh)) {
        ctx.fillStyle = PAPER;
        ctx.fillRect(-bw * 0.5, -bh * 0.5, bw, bh);
      }
      ctx.rotate(0.08);
      ctx.globalAlpha = 1;
      ctx.font = textFace(13, "title");
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(clipText(ctx, textFace(13, "title"), book.name, bw - 8), 0, -6);
      ctx.font = textFace(13, "num");
      ctx.fillStyle = book.dim ? "#6e665c" : "#6a4a12";
      ctx.fillText(clipText(ctx, textFace(13, "num"), book.meta || "", bw - 8), 0, 12);
      ctx.restore();
      if (book.id && ui) pushHit(ui, book.id, bx, by, bw, bh + 8);
      hoverStroke(ctx, ui, book.id, { x: bx, y: by, w: bw, h: bh });
    }
    paintClassCard(ctx, ui, game, rect, offer);
  }

  function paintClassCard(ctx, ui, game, rect, offer) {
    var book = offer && offer.offer;
    var running = offer && offer.def;
    var w = Math.min(480, rect.w - 20);
    var h = 96;
    var x = rect.x + (rect.w - w) * 0.5;
    var y = rect.y + rect.h - h - 10;
    var title = running ? running.name : (book ? book.name : "Class");
    var meta = running && game.degree ? S.fmtMs(game.degree.left) : (book ? (book.meta || "") : "");
    var fill = running ? (1 - offer.remain) : 0;
    if (fill < 0) fill = 0;
    if (fill > 1) fill = 1;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(12,9,7,0.92)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = LAMP;
    ctx.fillRect(x, y, 4, h);
    ctx.font = textFace(18, "title");
    ctx.fillStyle = PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, textFace(18, "title"), title, w - 24), x + 16, y + 24);
    ctx.fillStyle = "rgba(239,230,212,0.16)";
    ctx.fillRect(x + 16, y + 44, w - 32, 10);
    if (running && fill > 0) {
      ctx.fillStyle = LAMP;
      ctx.fillRect(x + 16, y + 44, Math.max(2, (w - 32) * fill), 10);
    }
    var label = running ? meta : (book ? (book.id ? meta : meta) : "");
    if (!running && book) label = book.dim ? (book.meta || "Locked") : (book.meta || "Start");
    if (running) label = meta || "In class";
    ctx.font = textFace(15, "num");
    ctx.fillStyle = book && book.id && !book.dim ? INK : PAPER;
    if (book && book.id && !book.dim) {
      ctx.fillStyle = LAMP;
      ctx.fillRect(x + 16, y + 60, w - 32, 28);
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.fillText(clipText(ctx, textFace(15, "title"), "Start  " + (book.meta || ""), w - 48), x + w * 0.5, y + 74);
      if (ui) pushHit(ui, book.id, x + 16, y + 60, w - 32, 28);
    } else {
      ctx.fillStyle = LAMP;
      ctx.textAlign = "left";
      ctx.fillText(clipText(ctx, textFace(15, "num"), label, w - 32), x + 16, y + 74);
    }
    ctx.restore();
  }

  function paintKeypad(ctx, ui, x, y, w) {
    var keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "<"];
    var gap = 6;
    var bw = (w - gap * 2) / 3;
    var bh = 30;
    var i;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.font = textFace(13, "num");
    ctx.fillStyle = PAPER;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Offer  " + (ui.offer ? S.money(Number(ui.offer)) : "$—"), x, y + 10);
    for (i = 0; i < keys.length; i++) {
      var col = i % 3;
      var line = (i / 3) | 0;
      var id = keys[i] === "C" ? "dc" : (keys[i] === "<" ? "db" : "d" + keys[i]);
      var kx = x + col * (bw + gap);
      var ky = y + 22 + line * (bh + gap);
      ctx.fillStyle = "#1a120e";
      ctx.fillRect(kx, ky, bw, bh);
      ctx.fillStyle = PAPER;
      ctx.textAlign = "center";
      ctx.fillText(keys[i], kx + bw * 0.5, ky + bh * 0.5);
      if (ui) pushHit(ui, id, kx, ky, bw, bh);
    }
    var oy = y + 22 + 4 * (bh + gap);
    ctx.fillStyle = LAMP;
    ctx.fillRect(x, oy, w, 30);
    ctx.fillStyle = INK;
    ctx.font = textFace(13, "title");
    ctx.fillText("Make the offer", x + w * 0.5, oy + 15);
    if (ui) pushHit(ui, "dok", x, oy, w, 30);
    ctx.restore();
  }

  function drawPeopleScene(ctx, game, ui, L, rect, now) {
    var frame = paintShopStage(ctx, game, rect, "scout");
    var place = (game.player && game.player.place) || {};
    var sign = spotBox(frame, ROOM_SPOT.sign);
    var slot0 = game.slots && game.slots[0];
    if (boxOnStage(sign, rect)) paintSignPlate(ctx, sign, (slot0 && slot0.name) || "The Corner", !!place.sign);
    if (place.lights) paintLampRow(ctx, spotBox(frame, ROOM_SPOT.lights));
    paintDoorLeaf(ctx, spotBox(frame, ROOM_SPOT.door), ui.doorT == null ? 1 : ui.doorT);
    var cast = ["sera", "landlord", "juniper", "hire"];
    var look = ui && ui.look;
    if (!look || cast.indexOf(look) < 0) look = spokeWho(game) || "sera";
    var spot = PERSON_SPOT[look] || PERSON_SPOT.sera;
    var hireIdx = hireSlot(game, ui);
    var emp = game.slots && game.slots[hireIdx] && game.slots[hireIdx].employee;
    var busted = look === "hire" && !!(emp && emp.caught);
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = busted ? 0.45 : 1;
    var body = paintPersonAt(ctx, look, frame, spot.u, spot.v, rect);
    ctx.restore();
    var edgeRight = look !== "juniper";
    var head = 46;
    var gap = 6;
    var ex = edgeRight ? rect.x + rect.w - head - 8 : rect.x + 8;
    var ey = rect.y + 10;
    var i;
    for (i = 0; i < cast.length; i++) {
      var hy = ey + i * (head + gap);
      if (hy + head > rect.y + rect.h - 168) break;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = cast[i] === look ? 1 : 0.4;
      paintHead(ctx, cast[i], ex, hy, head, head);
      ctx.restore();
      if (cast[i] === look) {
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.fillStyle = LAMP;
        ctx.fillRect(ex, hy, head, 3);
        ctx.restore();
      }
      if (ui) pushHit(ui, "look:" + cast[i], ex, hy, head, head);
    }
    var choice = personChoice(game, look, ui);
    var card = null;
    if (look === "hire" && !emp) {
      var resumes = game.resumes || [];
      if (ui && ui.selected != null) {
        for (i = 0; i < resumes.length; i++) if (resumes[i].id === ui.selected) card = resumes[i];
      }
      if (!card && resumes.length) card = resumes[0];
    }
    var plateW = Math.min(460, rect.w - 70);
    var plateH = 148;
    var px = rect.x + (rect.w - plateW) * 0.5;
    var py = rect.y + rect.h - plateH - 8;
    if (card && ui && ui.selected === card.id) {
      paintKeypad(ctx, ui, px, py - 186, Math.min(280, plateW));
    }
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(16,12,10,0.9)";
    round(ctx, px, py, plateW, plateH, 8);
    ctx.fill();
    var caption = busted ? "Busted" : personCaption(game, look, ui);
    ctx.font = textFace(20, "title");
    ctx.fillStyle = busted ? "#8a8178" : PAPER;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(clipText(ctx, textFace(20, "title"), caption, plateW - 24), px + plateW * 0.5, py + 26);
    var fact = look ? peopleFact(game, look) : "";
    ctx.font = textFace(14, "body");
    ctx.fillStyle = "#b7b0a6";
    ctx.fillText(clipText(ctx, textFace(14, "body"), fact, plateW - 24), px + plateW * 0.5, py + 52);
    var rel = 0.2;
    if (choice && choice.fill != null) rel = choice.fill;
    else if (look === "sera" && game.world && game.world.regular) {
      var mood = game.world.regular.mood || 0;
      rel = (mood + 5) / 10;
    }
    if (rel < 0) rel = 0;
    if (rel > 1) rel = 1;
    ctx.fillStyle = "rgba(239,230,212,0.16)";
    ctx.fillRect(px + 16, py + 68, plateW - 32, 10);
    ctx.fillStyle = LAMP;
    ctx.fillRect(px + 16, py + 68, Math.max(2, (plateW - 32) * rel), 10);
    var actId = "";
    var actLabel = "";
    var dim = false;
    if (card && !(ui && ui.selected === card.id)) {
      actId = "resume:" + card.id;
      actLabel = card.name + "  " + S.money(card.ask);
      dim = (game.player.capital || 0) < (card.floor || 0);
    } else if (choice && choice.action && !(card && ui && ui.selected === card.id)) {
      actId = choice.disabled ? "" : choice.action;
      actLabel = choice.label || "";
      if (choice.price) actLabel += "  " + choice.price;
      dim = !!choice.disabled;
    }
    if (!actLabel) {
      actId = "applicants";
      actLabel = "Find people";
    }
    if (actLabel) {
      var sink = pressSink(ui, actId);
      ctx.fillStyle = dim ? "#3a342c" : LAMP;
      ctx.fillRect(px + 12, py + 88 + sink, plateW - 24, 48);
      ctx.font = textFace(16, "title");
      ctx.fillStyle = dim ? "#8a8178" : INK;
      ctx.fillText(clipText(ctx, textFace(16, "title"), actLabel, plateW - 40), px + plateW * 0.5, py + 112 + sink);
      if (actId && ui) pushHit(ui, actId, px + 12, py + 88, plateW - 24, 48);
    }
    ctx.restore();
    if (body && ui && look) pushHit(ui, "look:" + look, body.x, body.y, body.w, Math.max(20, body.h * 0.5));
  }

  function stepScene(ui, view) {
    if (ui.sceneView == null) {
      ui.sceneView = view;
      ui.sceneFrom = view;
      ui.sceneT = 1;
      return;
    }
    if (view !== ui.sceneView) {
      ui.sceneFrom = ui.sceneView;
      ui.sceneView = view;
      ui.sceneT = 0;
    }
    if ((ui.sceneT || 0) < 1) {
      ui.sceneT += (ui.dt || 16) / 460;
      if (ui.sceneT > 1) ui.sceneT = 1;
    }
  }

  function paintOneScene(ctx, game, ui, L, rect, view, ox, now) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.translate(ox || 0, 0);
    ui.hitOx = ox || 0;
    ui.stageChat = view === "chat";
    if (view === "job") drawJobScene(ctx, game, ui, L, rect, now);
    else if (view === "edu") drawEduScene(ctx, game, ui, L, rect, now);
    else if (view === "scout") drawPeopleScene(ctx, game, ui, L, rect, now);
    else drawChatScene(ctx, game, ui, L, rect, now);
    ctx.restore();
    ui.hitOx = 0;
    ui.stageChat = false;
  }

  function paintScenes(ctx, game, ui, L, now) {
    var rect = { x: 0, y: L.header, w: L.w, h: Math.max(40, L.tabY - L.header) };
    var from = ui.sceneFrom || ui.sceneView || "chat";
    var to = ui.sceneView || "chat";
    var t = ui.sceneT == null ? 1 : ui.sceneT;
    var e = easeOut(t);
    var dir = viewRank(to) >= viewRank(from) ? 1 : -1;
    var travel = Math.min(L.w * 0.28, 180);
    if (t < 1 && from !== to) {
      ui.muteHits = true;
      paintOneScene(ctx, game, ui, L, rect, from, -dir * travel * e, now);
      ui.muteHits = false;
      paintOneScene(ctx, game, ui, L, rect, to, dir * travel * (1 - e), now);
    } else {
      ui.muteHits = false;
      paintOneScene(ctx, game, ui, L, rect, to, 0, now);
    }
    ui.hitOx = 0;
    ui.muteHits = false;
    ui.stageChat = false;
  }

  function drawCoin(ctx, coin) {
    if (!coin) return;
    var spot = coinSpot(coin);
    var x = spot.x;
    var y = spot.y;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x, y, coin.r, 0, Math.PI * 2);
    ctx.fillStyle = LAMP;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.5, coin.r * 0.45), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw(ctx, game, ui, now) {
    var w = ui.w;
    var h = ui.h;
    if (w < 2 || h < 2) return;
    frameGame = game;
    ui.now = now;
    cashHeld = !!(ui && ui.cashHold != null);
    var dpr = ui.dpr || 1;
    if (shakeLeft > 0) shakeLeft = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ui.hits.length = 0;
    ui.clip = null;
    ui.logTop = null;
    ui.logBot = null;
    ui.screenSlip = false;
    buttonTone = "";
    sheetLock = false;
    var shownNow = (ui && ui.presentAt) || now;
    var phaseNow = S.phaseAt(shownNow);
    var ground = phaseGround(phaseNow && phaseNow.id);
    ui.ground = ground;
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, w, h);
    var L = layout(w, h);
    L.header = mastHeight(game);
    L.b0 = L.header;
    ui.L = L;
    frameUi = ui;
    ui.markPhase = shopMarkPhase(game, ui, shownNow);
    drawClockLine(ctx, game, ui, L, shownNow);
    var doorTarget = doorClosed(game) ? 0 : 1;
    if (ui.doorT == null) ui.doorT = doorTarget;
    ui.doorT = easeToward(ui.doorT, doorTarget, ui.dt || 16, 380);
    var overlay = ui.menu === "lab" || ui.menu === "settings" || ui.menu === "journal";
    var view = "chat";
    if (ui.menu === "job" || ui.menu === "edu" || ui.menu === "scout") view = ui.menu;
    if (!overlay) stepScene(ui, view);
    else if (ui.sceneView == null) ui.sceneView = "chat";
    paintScenes(ctx, game, ui, L, now);
    if (overlay) {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(12,10,8,0.86)";
      ctx.fillRect(0, L.header, L.w, Math.max(0, L.tabY - L.header));
      ctx.restore();
      drawMenu(ctx, game, ui, L);
    }
    ui.hitOx = 0;
    ui.muteHits = false;
    ui.stageChat = false;
    drawDock(ctx, game, ui, L);
    launchPay(ui, L);
    drawCoin(ctx, ui.coin);
    noteCash(game, now, Math.max(140, (ui.cashX || w - 180) - 170), Math.max(28, L.header * 0.45));
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

  function drawTacks(ctx, ui, L) {
    if (!ui || ui.menu === "journal") return;
    var x = L.w - 48;
    var y = 14;
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PAPER;
    ctx.fillRect(x, y, 32, 26);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 32, 26);
    ctx.fillStyle = BRICK;
    ctx.beginPath();
    ctx.arc(x + 8, y + 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    pushHit(ui, "hdr:journal", x, y, 32, 26);
  }

  root.VoidRender = {
    draw: draw,
    hitTest: hitTest,
    tickParts: tickParts,
    tick: tick,
    settle: settle,
    pokeChoice: pokeChoice,
    spawn: spawn,
    burst: burst,
    shake: shake,
    layout: layout
  };
})(typeof window !== "undefined" ? window : globalThis);
