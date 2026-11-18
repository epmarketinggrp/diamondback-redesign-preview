/* Diamondback Lock & Key redesign preview: motion layer.
   The page is complete without this file. Everything here is decoration or convenience:
   the unlock intro, the mark that is built on scroll, sparks and arcs, counters, the radar map.
   One requestAnimationFrame loop drives all of it; with "reduce motion" on, only the static helpers run. */
(function () {
  'use strict';
  window.DBK = 1;
  var doc = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HOVER = matchMedia('(hover:hover) and (pointer:fine)').matches;
  var TAU = Math.PI * 2;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var c01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var eOut = function (k) { return 1 - Math.pow(1 - k, 3); };
  var eIO = function (k) { return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  var eBack = function (k) { var c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

  var hdr = $('#hdr'), nav = $('#nav'), burger = $('#burger');
  var W = window.innerWidth, H = window.innerHeight, sy = window.scrollY, docH = 1, hh = 74;

  /* ---------- static helpers (run even with reduced motion) ---------- */
  var clocks = $$('.clock');
  var clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Phoenix', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  function tickClock() { var t = clockFmt.format(new Date()); clocks.forEach(function (c) { c.textContent = t; }); }
  tickClock(); setInterval(tickClock, 1000);

  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
  });

  // today's row in the hours table, by the shop's own clock
  var today = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Phoenix', weekday: 'long' }).format(new Date());
  $$('.hours tr').forEach(function (tr) { if (tr.firstElementChild && tr.firstElementChild.textContent.trim() === today) tr.classList.add('today'); });

  // the form is a design sample: nothing is sent
  var form = $('#quote'), note = $('#quoteNote');
  if (form) {
    var need = $$('input,select', form);
    var fill = function () {
      var n = need.filter(function (f) { return f.value.trim(); }).length;
      form.style.setProperty('--fill', (n / need.length).toFixed(2));
    };
    form.addEventListener('input', fill); form.addEventListener('change', fill);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var phone = ($('.btn-call') || {}).textContent || '';
      note.textContent = 'Design preview: this form is switched off. To reach us now, call ' + phone.trim() + '.';
      if (!RM) { var r = e.submitter ? e.submitter.getBoundingClientRect() : form.getBoundingClientRect(); spark(r.left + r.width / 2, r.top + r.height / 2, 30, { max: 7 }); }
    });
  }

  $$('.shot').forEach(function (el, i) { el.style.setProperty('--sd', (-i * 2.6) + 's'); });
  $$('.chk li').forEach(function (el, i) { el.style.setProperty('--i', i % 4); });

  // scroll progress in the header and the active nav link
  var spy = $$('#nav a').map(function (a) { return { a: a, el: $(a.getAttribute('href')), top: 0 }; }).filter(function (s) { return s.el; });
  var lastSpy = null, lastSy = -1;
  function onScrollWrite() {
    if (sy === lastSy) return; lastSy = sy;
    hdr.style.setProperty('--sp', c01(sy / Math.max(1, docH - H)).toFixed(4));
    var cur = null, line = sy + H * .38;
    for (var i = 0; i < spy.length; i++) if (spy[i].top <= line && (!cur || spy[i].top > cur.top)) cur = spy[i];
    if (cur !== lastSpy) { if (lastSpy) lastSpy.a.classList.remove('act'); if (cur) cur.a.classList.add('act'); lastSpy = cur; }
  }

  var rail = $('#rail'), railT = $('#railT');

  /* ---------- everything below is motion ---------- */
  var fx = $('#fx'), bgc = $('#bg'), fc = fx.getContext('2d'), bc = bgc.getContext('2d');
  var DPR = 1, K = 1;
  var sparks = [], bolts = [], rings = [], heads = [], fxDirty = false;

  function spark(x, y, n, o) {
    if (RM) return; o = o || {};
    n = Math.max(1, Math.round(n * K));
    for (var i = 0; i < n; i++) {
      if (sparks.length > 420) sparks.shift();
      var a = o.dir == null ? rnd(0, TAU) : o.dir + rnd(-1, 1) * (o.spread == null ? .6 : o.spread);
      var v = rnd(.2, 1) * (o.max || 5);
      sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(.45, 1) * (o.life || 520), warm: Math.random() < (o.warm == null ? .2 : o.warm), g: o.g == null ? .11 : o.g, w: rnd(.7, 1.7) });
    }
  }
  function jag(ax, ay, bx, by, d) {
    var pts = [[ax, ay], [bx, by]], disp = d;
    for (var k = 0; k < 5; k++) {
      for (var i = pts.length - 1; i > 0; i--) {
        var p = pts[i - 1], q = pts[i], nx = -(q[1] - p[1]), ny = q[0] - p[0], l = Math.hypot(nx, ny) || 1, o = rnd(-1, 1) * disp;
        pts.splice(i, 0, [(p[0] + q[0]) / 2 + nx / l * o, (p[1] + q[1]) / 2 + ny / l * o]);
      }
      disp *= .52;
    }
    return pts;
  }
  function rejag(b) {
    b.pts = jag(b.ax, b.ay, b.bx, b.by, b.d); b.forks = [];
    var len = Math.hypot(b.bx - b.ax, b.by - b.ay), base = Math.atan2(b.by - b.ay, b.bx - b.ax);
    for (var i = 0; i < b.nf; i++) {
      var p = b.pts[3 + ((Math.random() * (b.pts.length - 8)) | 0)], a = base + rnd(-.9, .9), l = rnd(.14, .36) * len;
      b.forks.push(jag(p[0], p[1], p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l, l * .2));
    }
  }
  function bolt(ax, ay, bx, by, o) {
    if (RM) return; o = o || {};
    var len = Math.hypot(bx - ax, by - ay);
    var b = { ax: ax, ay: ay, bx: bx, by: by, d: o.d == null ? len * .15 : o.d, life: 0, max: o.life || 260, w: o.w || 1.5, nf: o.forks || 0, re: 0 };
    rejag(b); bolts.push(b);
  }
  function ring(x, y, r0, r1, life) { if (!RM) rings.push({ x: x, y: y, r0: r0, r1: r1, life: 0, max: life || 500 }); }
  var flashEl = $('#flash');
  function flash(x, y) {
    if (RM) return;
    flashEl.style.setProperty('--fx', (x / W * 100).toFixed(1) + '%'); flashEl.style.setProperty('--fy', (y / H * 100).toFixed(1) + '%');
    flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go');
  }
  function strokePts(pts) { fc.beginPath(); fc.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) fc.lineTo(pts[i][0], pts[i][1]); fc.stroke(); }
  function drawFx(dt) {
    if (!sparks.length && !bolts.length && !rings.length && !heads.length) { if (fxDirty) { fc.clearRect(0, 0, W, H); fxDirty = false; } return; }
    fxDirty = true;
    var f = dt / 16.7, i, a;
    fc.clearRect(0, 0, W, H);
    fc.globalCompositeOperation = 'lighter'; fc.lineCap = 'round'; fc.lineJoin = 'round';
    for (i = bolts.length - 1; i >= 0; i--) {
      var b = bolts[i]; b.life += dt; b.re += dt;
      if (b.life >= b.max) { bolts.splice(i, 1); continue; }
      if (b.re > 55) { b.re = 0; rejag(b); }
      a = (1 - b.life / b.max) * (Math.random() < .12 ? .35 : 1);
      fc.strokeStyle = 'rgba(46,163,244,' + (a * .32).toFixed(3) + ')'; fc.lineWidth = b.w * 6; strokePts(b.pts);
      fc.strokeStyle = 'rgba(127,212,240,' + (a * .6).toFixed(3) + ')'; fc.lineWidth = b.w * 2.4; strokePts(b.pts);
      fc.strokeStyle = 'rgba(240,250,255,' + a.toFixed(3) + ')'; fc.lineWidth = b.w; strokePts(b.pts);
      fc.lineWidth = b.w * .6;
      for (var j = 0; j < b.forks.length; j++) strokePts(b.forks[j]);
    }
    for (i = rings.length - 1; i >= 0; i--) {
      var r = rings[i]; r.life += dt;
      if (r.life >= r.max) { rings.splice(i, 1); continue; }
      var k = r.life / r.max, rr = r.r0 + (r.r1 - r.r0) * eOut(k);
      fc.strokeStyle = 'rgba(127,212,240,' + ((1 - k) * .8).toFixed(3) + ')'; fc.lineWidth = 1.5 + (1 - k) * 2;
      fc.beginPath(); fc.moveTo(r.x, r.y - rr); fc.lineTo(r.x + rr, r.y); fc.lineTo(r.x, r.y + rr); fc.lineTo(r.x - rr, r.y); fc.closePath(); fc.stroke();
    }
    for (i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i]; s.life += dt;
      if (s.life >= s.max) { sparks.splice(i, 1); continue; }
      s.vy += s.g * f; s.vx *= Math.pow(.985, f); s.vy *= Math.pow(.985, f); s.x += s.vx * f; s.y += s.vy * f;
      a = 1 - s.life / s.max;
      fc.strokeStyle = (s.warm ? 'rgba(255,190,110,' : 'rgba(222,244,255,') + a.toFixed(3) + ')'; fc.lineWidth = s.w;
      fc.beginPath(); fc.moveTo(s.x, s.y); fc.lineTo(s.x - s.vx * 2.4, s.y - s.vy * 2.4); fc.stroke();
    }
    for (i = 0; i < heads.length; i++) {
      var h = heads[i];
      fc.fillStyle = 'rgba(46,163,244,.28)'; fc.beginPath(); fc.arc(h.x, h.y, 11, 0, TAU); fc.fill();
      fc.fillStyle = 'rgba(160,225,255,.5)'; fc.beginPath(); fc.arc(h.x, h.y, 5, 0, TAU); fc.fill();
      fc.fillStyle = '#fff'; fc.beginPath(); fc.arc(h.x, h.y, 2, 0, TAU); fc.fill();
    }
    heads.length = 0;
    fc.globalCompositeOperation = 'source-over';
  }

  // pulses that run along the page grid (88px, same as the CSS background)
  var G = 88, pulses = [];
  function newPulse(any) {
    var h = Math.random() < .5, span = h ? W : H, dir = Math.random() < .5 ? 1 : -1;
    return { h: h, line: Math.round(rnd(0, (h ? H : W) / G)) * G + .5, dir: dir, pos: any ? rnd(0, span) : (dir > 0 ? -160 : span + 160), v: rnd(90, 280), len: rnd(60, 170) };
  }
  function seedBg() { pulses = []; for (var i = 0, n = W < 700 ? 6 : 14; i < n; i++) pulses.push(newPulse(true)); }
  function drawBg(dt) {
    bc.clearRect(0, 0, W, H); bc.lineWidth = 1;
    for (var i = 0; i < pulses.length; i++) {
      var p = pulses[i]; p.pos += p.dir * p.v * dt / 1000;
      var span = p.h ? W : H;
      if (p.pos < -200 || p.pos > span + 200) { pulses[i] = newPulse(false); continue; }
      var a = p.pos, b = p.pos - p.dir * p.len;
      var g = p.h ? bc.createLinearGradient(a, 0, b, 0) : bc.createLinearGradient(0, a, 0, b);
      g.addColorStop(0, 'rgba(228,246,255,.85)'); g.addColorStop(.12, 'rgba(46,163,244,.5)'); g.addColorStop(1, 'rgba(46,163,244,0)');
      bc.strokeStyle = g; bc.beginPath();
      if (p.h) { bc.moveTo(a, p.line); bc.lineTo(b, p.line); } else { bc.moveTo(p.line, a); bc.lineTo(p.line, b); }
      bc.stroke();
    }
  }

  /* ---------- the mark: three pieces that can be traced, filled and moved ---------- */
  function Mark(svg) {
    if (!svg) return null;
    var ps = ['.mk-l', '.mk-r', '.mk-k'].map(function (sel) {
      var p = $(sel, svg), s = $('.s', p), len = 0;
      try { len = s.getTotalLength(); } catch (e) { len = 0; }
      return { p: p, s: s, len: len, tf: '', v: '' };
    });
    return {
      svg: svg, ps: ps,
      // d = how much of the outline is still undrawn, so = outline opacity, fo = fill opacity, go = blueprint opacity
      set: function (i, d, so, fo, go) {
        var key = d.toFixed(3) + '|' + so.toFixed(2) + '|' + fo.toFixed(2) + '|' + go.toFixed(2), q = ps[i];
        if (key === q.v) return; q.v = key;
        var st = q.p.style; st.setProperty('--d', d.toFixed(3)); st.setProperty('--so', so.toFixed(2)); st.setProperty('--fo', fo.toFixed(2)); st.setProperty('--go', go.toFixed(2));
      },
      move: function (i, x, y, r, sx) {
        var t = (x || y || r || (sx != null && sx !== 1)) ? 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) rotate(' + (r || 0).toFixed(2) + 'deg) scale(' + (sx == null ? 1 : sx).toFixed(3) + ',1)' : '';
        if (t !== ps[i].tf) { ps[i].tf = t; ps[i].p.style.transform = t; }
      },
      // screen position of the point that is fraction t along a piece's outline
      head: function (i, t) {
        var q = ps[i]; if (!q.len) return null;
        var pt = q.s.getPointAtLength(q.len * c01(t)), m = q.s.getScreenCTM(); if (!m) return null;
        return { x: pt.x * m.a + pt.y * m.c + m.e, y: pt.x * m.b + pt.y * m.d + m.f };
      },
      box: function (i) { return ps[i].p.getBoundingClientRect(); },
      clear: function () { ps.forEach(function (q) { q.p.removeAttribute('style'); q.tf = ''; q.v = ''; }); }
    };
  }
  function traceSparks(M, i, tr, hot) {
    if (tr <= 0 || tr >= 1) return;
    var h = M.head(i, tr); if (!h) return;
    heads.push(h);
    if (hot || Math.random() < .3) spark(h.x, h.y, hot ? 2 : 1, { max: hot ? 4.6 : 2.4, life: 430, warm: .32 });
  }

  /* ---------- the unlock ---------- */
  var vault = $('#vault'), VM = Mark($('#vaultMk')), hdrMk = $('#hdrMk'), vaultSt = $('#vaultSt'), lockSt = $('#lockSt'), introS = null;
  function startIntro(replay) {
    if (!VM) { doc.classList.remove('intro', 'hold'); return; }
    VM.svg.style.transform = '';
    for (var i = 0; i < 3; i++) { VM.set(i, 1, 0, 0, .6); VM.move(i, 0, 0, 0, 1); }
    vaultSt.textContent = 'LOCKED'; if (lockSt) lockSt.textContent = 'LOCKED';
    if (replay) {
      vault.classList.add('open', 'shut'); doc.classList.add('intro'); void vault.offsetWidth; vault.classList.remove('open');
    }
    introS = { t0: performance.now() + (replay ? 430 : 160), strike: 0, open: 0, dx: 0, dy: 0, s: 1 };
  }
  function endIntro() {
    doc.classList.remove('intro', 'hold'); vault.classList.remove('open', 'shake', 'shut');
    VM.svg.style.transform = ''; hdrMk.style.opacity = '';
    var b = hdrMk.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
    spark(x, y, 26, { max: 5, life: 520 }); ring(x, y, 6, 46, 420);
    if (lockSt) lockSt.textContent = 'UNLOCKED';
    introS = null;
  }
  function stepIntro(now) {
    var I = introS, t = now - I.t0; if (t < 0) return;
    var trT = c01(t / 620), trK = c01((t - 200) / 680), fiT = c01((t - 620) / 150), fiK = c01((t - 880) / 110);
    VM.set(0, 1 - trT, trT > 0 ? 1 - fiT : 0, fiT, .6 * (1 - fiT));
    VM.set(1, 1 - trT, trT > 0 ? 1 - fiT : 0, fiT, .6 * (1 - fiT));
    VM.set(2, 1 - trK, trK > 0 ? 1 - fiK : 0, fiK, .6 * (1 - fiK));
    var turn = 1, ex = 0;
    if (t >= 1000) {
      if (!I.strike) {
        I.strike = 1;
        var kb = VM.box(2), cx = kb.left + kb.width / 2, cy = kb.top + kb.height * .42;
        bolt(cx + rnd(-180, 180), -30, cx, cy, { life: 460, w: 2.8, forks: 3 });
        bolt(cx + rnd(-260, 260), -30, cx, cy, { life: 300, w: 1.3, forks: 1 });
        flash(cx, cy); spark(cx, cy, 80, { max: 10, life: 850 }); ring(cx, cy, 12, Math.min(W, H) * .42, 700);
        vault.classList.add('shake'); vaultSt.textContent = 'UNLOCKED';
      }
      // the key turns in the lock: a half turn about its own length
      turn = Math.cos(Math.PI * eIO(c01((t - 1000) / 250)));
    }
    if (t >= 1260) {
      if (!I.open) {
        I.open = 1; vault.classList.remove('shake', 'shut');
        var a = VM.svg.getBoundingClientRect(), b = hdrMk.getBoundingClientRect();
        I.dx = b.left - a.left; I.dy = b.top - a.top; I.s = b.width / a.width;
        vault.classList.add('open'); doc.classList.remove('hold'); hdrMk.style.opacity = '0';
        for (var i = 0; i < 4; i++) bolt(W / 2 + rnd(-8, 8), rnd(0, H * .3), W / 2 + rnd(-8, 8), rnd(H * .6, H), { life: rnd(260, 460), w: 1.3, d: 24 });
        for (i = 0; i < 9; i++) spark(W / 2, rnd(0, H), 5, { max: 6, life: 600 });
      }
      var k = eIO(c01((t - 1260) / 880));
      VM.svg.style.transform = 'translate(' + (I.dx * k).toFixed(1) + 'px,' + (I.dy * k).toFixed(1) + 'px) scale(' + (1 + (I.s - 1) * k).toFixed(4) + ')';
      turn = -Math.cos(Math.PI * k); ex = Math.sin(k * Math.PI) * 16;
      if (t - 1260 >= 880) { VM.move(0, 0, 0, 0, 1); VM.move(1, 0, 0, 0, 1); VM.move(2, 0, 0, 0, 1); endIntro(); return; }
    }
    VM.move(0, -ex, 0, 0, 1); VM.move(1, ex, 0, 0, 1); VM.move(2, 0, 0, 0, turn);
    if (t < 620) { traceSparks(VM, 0, trT, true); traceSparks(VM, 1, trT, true); }
    if (t > 200 && t < 880) traceSparks(VM, 2, trK, true);
  }

  /* ---------- the mark, built on scroll ---------- */
  var show = $('#mark'), stage = $('#showStage'), SM = Mark($('#showMk'));
  var ghostPs = [], lbls = [], steps = $$('#showSteps li'), showPct = $('#showPct'), showBar = $('#showBar'), showHint = $('.show-hint');
  // per piece: a..b trace, b..c fill, c..e slide home; off = where it is built (x, y, turn)
  var SCH = [{ a: .03, b: .19, c: .23, e: .33, off: [-36, 0, -16] }, { a: .29, b: .45, c: .49, e: .59, off: [36, 0, 16] }, { a: .55, b: .76, c: .80, e: .90, off: [0, 54, 22] }];
  var LOCK = .92, showTop = 0, showTravel = 1, spv = -1, spPrev = 0, imp = 0, keyT = 0, nextArc = 0, mx = -999, my = -999, lastPct = -1, lastStep = -1, lastLb = '';
  if (SM && !RM) {
    var g = SM.svg.cloneNode(true); g.removeAttribute('id'); g.classList.add('mk-ghost'); stage.insertBefore(g, SM.svg);
    ghostPs = $$('.mk-p', g);
    lbls = [$('.lbl.l', stage), $('.lbl.r', stage), $('.lbl.k', stage)];
    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest('a')) return;
      if (spv >= LOCK) { imp = 20; keyT = performance.now(); lockArcs(false); } else spark(e.clientX, e.clientY, 12, { max: 5 });
    });
  }
  function lockArcs(big) {
    var r = stage.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, a = SM.box(0), b = SM.box(1), k = SM.box(2), kx = k.left + k.width / 2;
    bolt(a.right, a.top, kx, k.top + k.height * .3, { life: 380, w: 1.6, forks: 1 }); bolt(b.left, b.top, kx, k.top + k.height * .3, { life: 380, w: 1.6, forks: 1 });
    bolt(a.right, a.bottom, kx, k.bottom - k.height * .2, { life: 320, w: 1.2 }); bolt(b.left, b.bottom, kx, k.bottom - k.height * .2, { life: 320, w: 1.2 });
    ring(cx, cy, 16, r.width * (big ? .56 : .4), big ? 760 : 520);
    spark(cx, cy, big ? 80 : 40, { max: big ? 11 : 8, life: 900 });
    if (big) { flash(cx, cy); ring(cx, cy, 8, r.width * .34, 520); }
  }
  function stepShow(now, dt) {
    var target = c01((sy + hh - showTop) / showTravel);
    if (spv < 0) { spv = target; spPrev = target; }
    spPrev = spv; spv += (target - spv) * Math.min(1, dt / 16.7 * .16);
    if (Math.abs(target - spv) < .0004) spv = target;
    var near = sy + H > showTop - 200 && sy < showTop + show.offsetHeight + 200;
    if (!near) return;
    var p = spv, hot = Math.abs(spv - spPrev) > .0006, i, s;
    for (i = 0; i < 3; i++) {
      s = SCH[i];
      var tr = c01((p - s.a) / (s.b - s.a)), fi = c01((p - s.b) / (s.c - s.b)), sl = c01((p - s.c) / (s.e - s.c)), k = 1 - eIO(sl);
      SM.set(i, 1 - tr, tr > 0 ? 1 - fi : 0, fi, 0);
      if (p < LOCK) SM.move(i, s.off[0] * k, s.off[1] * k, s.off[2] * k, 1);
      if (ghostPs[i]) { var go = sl >= 1 ? '0' : '1'; if (ghostPs[i].style.opacity !== go) ghostPs[i].style.opacity = go; }
      traceSparks(SM, i, tr, hot);
      // the moment a piece lands
      if (spPrev < s.e && p >= s.e) { var b = SM.box(i), x = b.left + b.width / 2, y = b.top + b.height / 2; spark(x, y, 34, { max: 8, life: 700 }); ring(x, y, 8, b.height * .7, 460); imp = 8; }
    }
    if (spPrev < LOCK && p >= LOCK) { imp = 22; keyT = now; lockArcs(true); }
    if (p >= LOCK) {
      // alive once locked: the triangles breathe, open toward the pointer, and jump when struck
      var idle = c01((p - LOCK) / .04), r = stage.getBoundingClientRect(), prox = 0;
      if (mx > r.left && mx < r.right && my > r.top && my < r.bottom) prox = 1 - c01(Math.hypot(mx - (r.left + r.width / 2), my - (r.top + r.height / 2)) / (r.width * .5));
      var ex = (2.2 + 1.8 * Math.sin(now / 620) + prox * 11) * idle + imp;
      var turn = keyT ? Math.cos(TAU * eIO(c01((now - keyT) / 900))) : 1;
      SM.move(0, -ex, 0, 0, 1); SM.move(1, ex, 0, 0, 1); SM.move(2, 0, -imp * .2, 0, turn);
      if (now > nextArc && r.bottom > 0 && r.top < H) {
        nextArc = now + rnd(900, 2600);
        var a = SM.box(0), c = SM.box(1), top = Math.random() < .5;
        bolt(a.right, top ? a.top : a.bottom, c.left, top ? c.top : c.bottom, { life: 200, w: 1.1, d: 9 });
        spark(top ? a.right : c.left, top ? a.top : c.bottom, 4, { max: 3 });
      }
    }
    imp *= Math.pow(.9, dt / 16.7); if (imp < .05) imp = 0;
    var pct = Math.round(p * 100);
    if (pct !== lastPct) { lastPct = pct; showPct.textContent = ('00' + pct).slice(-3); showBar.style.setProperty('--p', p.toFixed(3)); showHint.style.opacity = p > .04 ? '0' : ''; }
    var st = p < SCH[0].e ? 0 : p < SCH[1].e ? 1 : p < SCH[2].e ? 2 : 3;
    if (st !== lastStep) { lastStep = st; steps.forEach(function (li, n) { li.classList.toggle('on', n === st || (st === 3 && n < 3)); }); }
    var lb = (p >= SCH[0].e ? '1' : '0') + (p >= SCH[1].e ? '1' : '0') + (p >= SCH[2].e ? '1' : '0');
    if (lb !== lastLb) { lastLb = lb; lbls.forEach(function (el, n) { el.style.setProperty('--o', lb[n]); el.style.pointerEvents = lb[n] === '1' ? '' : 'none'; }); }
  }

  /* ---------- the Instagram tile: the white mark snaps together when it scrolls in ---------- */
  var IM = Mark($('#igMk')), igS = null, IGOFF = [[-24, 0, -20], [24, 0, 20], [0, 28, 0]];
  function stepIg(now) {
    var t = now - igS.t0, tr = c01(t / 520), fi = c01((t - 520) / 140), sl = c01((t - 600) / 360), k = 1 - eBack(sl);
    for (var i = 0; i < 3; i++) { IM.set(i, 1 - tr, tr > 0 ? 1 - fi : 0, fi, 0); IM.move(i, IGOFF[i][0] * k, IGOFF[i][1] * k, IGOFF[i][2] * k, 1); traceSparks(IM, i, tr, true); }
    if (t >= 960) {
      IM.clear(); igS = null;
      var b = IM.svg.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
      spark(x, y, 36, { max: 7, life: 700 }); ring(x, y, 10, b.width * 1.1, 520);
    }
  }

  /* ---------- small text effects ---------- */
  var GL = 'ABCDEF0123456789<>/=+#';
  function scramble(el) {
    var n = Array.prototype.filter.call(el.childNodes, function (c) { return c.nodeType === 3 && c.nodeValue.trim(); }).pop();
    if (!n || n._s) return; n._s = 1;
    var txt = n.nodeValue, t0 = performance.now(), dur = 420 + txt.length * 16;
    (function tick(now) {
      var k = c01((now - t0) / dur), cut = Math.floor(k * txt.length), o = txt.slice(0, cut);
      for (var i = cut; i < txt.length; i++) o += txt[i] === ' ' ? ' ' : GL[(Math.random() * GL.length) | 0];
      n.nodeValue = o;
      if (k < 1) requestAnimationFrame(tick); else { n.nodeValue = txt; n._s = 0; }
    })(t0);
  }
  function countUp(el) {
    var to = parseFloat(el.dataset.count), from = parseFloat(el.dataset.from || 0), dec = +el.dataset.dec || 0, sep = el.dataset.sep, t0 = performance.now();
    (function tick(now) {
      var k = c01((now - t0) / 1500), v = from + (to - from) * eOut(k);
      el.textContent = dec ? v.toFixed(dec) : sep ? Math.round(v).toLocaleString('en-US') : String(Math.round(v));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }
  function typed() {
    var el = $('#typed'); if (!el) return;
    var list = ['car key replacement', 'rekeying', 'lock repair', 'lockout service', 'emergency callouts run 24/7'], n = list.length - 1, pos = list[n].length, del = true;
    (function step() {
      var w = list[n];
      if (del) { pos--; if (pos <= 0) { del = false; n = (n + 1) % list.length; pos = 0; } } else { pos++; if (pos >= w.length) { del = true; el.textContent = w; return setTimeout(step, 1700); } }
      el.textContent = list[n].slice(0, pos);
      setTimeout(step, del ? 20 : 46);
    })();
  }

  /* ---------- floating tools, measured once, moved on scroll ---------- */
  var fts = $$('.ft').map(function (el) { return { el: el, s: +el.dataset.s || 0, r: +el.dataset.r || 0, spin: +el.dataset.spin || 0, sec: el.closest('section'), top: 0, h: 1, tf: '' }; });
  function stepFts(now) {
    var mid = sy + H / 2, t = now / 1000;
    for (var i = 0; i < fts.length; i++) {
      var f = fts[i]; if (f.top > sy + H + 150 || f.top + f.h < sy - 150) continue;
      var q = (mid - (f.top + f.h / 2)) / H, tf = 'translate3d(0,' + (-q * f.s).toFixed(1) + 'px,0) rotate(' + (q * f.r + f.spin * t).toFixed(1) + 'deg)';
      if (tf !== f.tf) { f.tf = tf; f.el.style.transform = tf; }
    }
  }

  /* ---------- hero scope: a key's cuts scrolling past a reader ---------- */
  var scope = $('#scope'), sx2 = scope ? scope.getContext('2d') : null, cuts = [], scOff = 0, heroH = 800;
  for (var ci = 0; ci < 60; ci++) cuts.push((Math.random() * 5) | 0);
  function drawScope(dt) {
    var w = scope.width, h = scope.height, st = 14 * DPR, i, x, y;
    scOff += dt * .03 * DPR; while (scOff >= st) { scOff -= st; cuts.push(cuts.shift()); }
    sx2.clearRect(0, 0, w, h);
    sx2.strokeStyle = 'rgba(127,212,240,.18)'; sx2.lineWidth = 1; sx2.beginPath();
    for (i = 1; i < 5; i++) { sx2.moveTo(0, h * i / 5); sx2.lineTo(w, h * i / 5); } sx2.stroke();
    sx2.strokeStyle = '#7fd4f0'; sx2.lineWidth = 1.5 * DPR; sx2.lineJoin = 'round'; sx2.beginPath();
    for (i = 0; i * st - scOff < w + st; i++) {
      x = i * st - scOff; y = h * (.2 + cuts[i % cuts.length] * .14);
      if (i === 0) sx2.moveTo(x, y); else sx2.lineTo(x + st * .28, y);
      sx2.lineTo(x + st * .72, y);
    }
    sx2.stroke();
    var rx = w * .72;
    sx2.strokeStyle = 'rgba(255,255,255,.85)'; sx2.lineWidth = DPR; sx2.beginPath(); sx2.moveTo(rx, 0); sx2.lineTo(rx, h); sx2.stroke();
    sx2.fillStyle = 'rgba(46,163,244,.14)'; sx2.fillRect(rx, 0, w - rx, h);
  }

  /* ---------- service area radar ---------- */
  var map = $('#map'), sweep = $('#sweep'), swBase = sweep ? sweep.getAttribute('transform') : '', swA = rnd(0, 360), mapOn = false, pts = {}, ptList = [];
  if (map) {
    $$('.pt', map).forEach(function (el) { var c = el.dataset.c; pts[c] = { el: el, a: +el.dataset.a, wire: $('.mw[data-c="' + c + '"]', map), link: $('.acols a[data-c="' + c + '"]'), t: 0 }; ptList.push(pts[c]); });
    var hot = function (c, on, zap) {
      var p = pts[c]; if (!p) return;
      p.el.classList.toggle('on', on); if (p.wire) p.wire.classList.toggle('on', on); if (p.link) p.link.classList.toggle('on', on);
      if (on && zap && !RM) {
        var a = $('.shop-d', map).getBoundingClientRect(), b = $('.pt-d', p.el).getBoundingClientRect();
        if (b.bottom > 0 && b.top < H) { bolt(a.left + a.width / 2, a.top + a.height / 2, b.left + b.width / 2, b.top + b.height / 2, { life: 300, w: 1.3, d: 12 }); spark(b.left + b.width / 2, b.top + b.height / 2, 10, { max: 4 }); }
      }
    };
    ptList.forEach(function (p) {
      var c = p.el.dataset.c;
      if (p.link) { ['mouseenter', 'focus'].forEach(function (ev) { p.link.addEventListener(ev, function () { hot(c, true, true); }); }); ['mouseleave', 'blur'].forEach(function (ev) { p.link.addEventListener(ev, function () { hot(c, false); }); }); }
      p.el.addEventListener('mouseenter', function () { hot(c, true, false); }); p.el.addEventListener('mouseleave', function () { hot(c, false); });
    });
  }
  function stepMap(now, dt) {
    var prev = swA, step = dt * .042; swA = (swA + step) % 360;
    sweep.setAttribute('transform', swBase + ' rotate(' + swA.toFixed(1) + ')');
    for (var i = 0; i < ptList.length; i++) {
      var p = ptList[i];
      if (p.t && now > p.t) { p.t = 0; p.el.classList.remove('pg'); }
      if (((p.a - prev + 360) % 360) < step) { p.el.classList.add('pg'); p.t = now + 1100; }
    }
  }

  /* ---------- emergency storm ---------- */
  var emg = $('#emergency'), emgOn = false, nextStorm = 0;
  function stepStorm(now) {
    if (now < nextStorm) return; nextStorm = now + rnd(2400, 5200);
    var r = emg.getBoundingClientRect(), y0 = Math.max(r.top, hh), y1 = Math.min(r.bottom, H);
    if (y1 - y0 < 160) return;
    var x = rnd(r.left + r.width * .08, r.right - r.width * .08), ye = y0 + (y1 - y0) * rnd(.45, .92), xe = x + rnd(-180, 180);
    bolt(x, y0, xe, ye, { life: 360, w: 2, forks: 2 }); spark(xe, ye, 16, { max: 6, life: 600 });
    emg.classList.add('lit'); setTimeout(function () { emg.classList.remove('lit'); }, 130);
  }

  /* ---------- key cutter sparks in the automotive diagram ---------- */
  var wheel = $('.dia-auto .wheel'), autoSvc = $('#svc-auto'), frameN = 0;
  function stepWheel() {
    if (!autoSvc.classList.contains('live') || frameN % 3) return;
    if (+getComputedStyle(wheel).opacity < .8) return;
    var r = wheel.getBoundingClientRect(); if (r.bottom < 0 || r.top > H) return;
    spark(r.left + r.width / 2, r.bottom - 1, 2, { dir: -2.5, spread: .5, max: 4.2, life: 380, warm: .65 });
  }

  /* ---------- measure, resize ---------- */
  var needMeasure = true;
  function measure() {
    needMeasure = false;
    W = window.innerWidth; H = window.innerHeight; sy = window.scrollY; docH = doc.scrollHeight;
    hh = parseFloat(getComputedStyle(doc).getPropertyValue('--hh')) || 74;
    spy.forEach(function (s) { s.top = s.el.getBoundingClientRect().top + sy; });
    if (show) { showTop = show.getBoundingClientRect().top + sy; showTravel = Math.max(1, show.offsetHeight - $('.show-pin').offsetHeight); }
    fts.forEach(function (f) { var r = f.sec.getBoundingClientRect(); f.top = r.top + sy; f.h = r.height; });
    var hero = $('.hero'); if (hero) heroH = hero.offsetHeight + 120;
    lastSy = -1;
  }
  function size() {
    W = window.innerWidth; H = window.innerHeight; DPR = Math.min(window.devicePixelRatio || 1, 1.5); K = W < 700 ? .55 : 1;
    [fx, bgc].forEach(function (c) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); });
    fc.setTransform(DPR, 0, 0, DPR, 0, 0); bc.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (scope) { scope.width = Math.round(scope.clientWidth * DPR) || 300; scope.height = Math.round(scope.clientHeight * DPR) || 46; }
    seedBg(); needMeasure = true;
  }

  /* ---------- reduced motion: static helpers only ---------- */
  if (RM) {
    doc.classList.remove('intro', 'hold');
    if (rail) rail.style.overflowX = 'auto';
    measure(); onScrollWrite();
    var ticking = false;
    window.addEventListener('scroll', function () { if (ticking) return; ticking = true; requestAnimationFrame(function () { ticking = false; sy = window.scrollY; onScrollWrite(); }); }, { passive: true });
    window.addEventListener('resize', function () { measure(); onScrollWrite(); });
    return;
  }

  /* ---------- wiring ---------- */
  // review rail and footer ticker loop by carrying a second copy
  if (railT) { $$('.rev', railT).forEach(function (el) { var c = el.cloneNode(true); c.setAttribute('aria-hidden', 'true'); railT.appendChild(c); }); railT.classList.add('go'); }
  var ftick = $('#ftick'); if (ftick) ftick.innerHTML += ftick.innerHTML;

  // reveal on scroll, with a stagger between neighbours
  var rvs = $$('.rv');
  function onReveal(el) {
    $$('[data-count]', el).forEach(countUp);
    if (el.matches('.eyebrow')) scramble(el); $$('.eyebrow', el).forEach(scramble); $$('.tagc', el).forEach(scramble);
    if (IM && el.contains(IM.svg)) igS = { t0: performance.now() + 150 };
  }
  if ('IntersectionObserver' in window) {
    var tops = rvs.map(function (el) { return el.getBoundingClientRect().top; });
    rvs.forEach(function (el, i) { if (tops[i] > H * .94) el.classList.add('pre'); });
    var io = new IntersectionObserver(function (es) {
      var n = 0;
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target; io.unobserve(el);
        if (el.classList.contains('pre')) { el.style.transitionDelay = (n++ * 80) + 'ms'; el.classList.remove('pre'); setTimeout(function () { el.style.transitionDelay = ''; }, 1400); }
        onReveal(el);
      });
    }, { rootMargin: '0px 0px -7% 0px', threshold: .06 });
    rvs.forEach(function (el) { io.observe(el); });

    var flag = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var el = e.target, on = e.isIntersecting;
        if (el === map) mapOn = on; else if (el === emg) { emgOn = on; if (on) nextStorm = performance.now() + 500; }
        else if (el.id === 'heroVid') { if (on) { var p = el.play(); if (p && p.catch) p.catch(function () {}); } else el.pause(); }
        else el.classList.toggle('live', on);
      });
    }, { threshold: .15 });
    $$('.svc').forEach(function (el) { flag.observe(el); });
    if (map) flag.observe(map); if (emg) flag.observe(emg);
    var vid = $('#heroVid'); if (vid) flag.observe(vid);
  }
  if (IM) { for (var q = 0; q < 3; q++) IM.set(q, 1, 0, 0, 0); }

  // pointer: ring cursor, a faint trail, a discharge on click, arcs along buttons
  var cursor = $('#cursor'), cxp = -99, cyp = -99, pmx = 0, pmy = 0, seen = false;
  window.addEventListener('pointermove', function (e) {
    mx = e.clientX; my = e.clientY;
    if (HOVER && e.pointerType === 'mouse') { if (!seen) { seen = true; cxp = mx; cyp = my; cursor.classList.add('on'); } cursor.classList.toggle('hot', !!e.target.closest('a,button,summary,input,select,textarea')); }
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    if (e.target.closest('input,select,textarea,#showStage')) return;
    var x = e.clientX, y = e.clientY;
    spark(x, y, 14, { max: 5.5 }); ring(x, y, 4, 36, 380);
    for (var i = 0; i < 3; i++) { var a = rnd(0, TAU), l = rnd(26, 62); bolt(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, { life: 170, w: 1, d: 7 }); }
  }, { passive: true });
  if (HOVER) {
    $$('.btn,.remote,.soc').forEach(function (b) {
      b.addEventListener('pointerenter', function () {
        var r = b.getBoundingClientRect();
        bolt(r.left, r.top, r.right, r.top, { life: 220, w: 1.1, d: 5 }); bolt(r.right, r.bottom, r.left, r.bottom, { life: 220, w: 1.1, d: 5 });
        spark(r.right, r.top, 5, { max: 3.5 }); spark(r.left, r.bottom, 5, { max: 3.5 });
      });
    });
    $$('.brand').forEach(function (b) {
      b.addEventListener('pointerenter', function () { var r = $('.mk', b).getBoundingClientRect(); spark(r.left + r.width / 2, r.top + r.height / 2, 16, { max: 4.5 }); bolt(r.left, r.top + r.height / 2, r.right, r.top + r.height / 2, { life: 200, w: 1, d: 6 }); });
    });
    $$('.tile').forEach(function (b) { b.addEventListener('pointerenter', function () { var r = b.getBoundingClientRect(); spark(r.left + 14, r.top + r.height / 2, 6, { max: 3 }); }); });
  }
  var replay = $('#replay'); if (replay) replay.addEventListener('click', function () { if (!introS) startIntro(true); });

  window.addEventListener('resize', size);
  if ('ResizeObserver' in window) new ResizeObserver(function () { needMeasure = true; }).observe(document.body);
  window.addEventListener('load', function () { needMeasure = true; });
  size(); measure(); typed();
  if (doc.classList.contains('intro')) startIntro(false);

  // header mark: now and then a small arc jumps tip to tip across the key
  var nextGlint = performance.now() + 5200;

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(50, now - last); last = now; frameN++;
    sy = window.scrollY;
    if (needMeasure) measure();
    onScrollWrite();
    if (introS) stepIntro(now);
    if (SM) stepShow(now, dt);
    if (igS && now >= igS.t0) stepIg(now);
    stepFts(now);
    if (mapOn) stepMap(now, dt);
    if (emgOn) stepStorm(now);
    if (wheel) stepWheel();
    if (scope && sy < heroH && !(frameN % 2)) drawScope(dt * 2);
    if (now > nextGlint) {
      nextGlint = now + rnd(4200, 8200);
      if (!introS) { var r = hdrMk.getBoundingClientRect(); if (r.bottom > 0) { bolt(r.left + r.width * .38, r.top + r.height * .1, r.left + r.width * .62, r.top + r.height * .1, { life: 180, w: .9, d: 4 }); spark(r.left + r.width / 2, r.top + r.height * .1, 5, { max: 2.6, life: 380 }); } }
    }
    if (seen) {
      cxp += (mx - cxp) * .32; cyp += (my - cyp) * .32;
      cursor.style.transform = 'translate3d(' + cxp.toFixed(1) + 'px,' + cyp.toFixed(1) + 'px,0)';
      var sp = Math.hypot(mx - pmx, my - pmy); if (sp > 26) spark(mx, my, 1, { max: 1.8, life: 300, warm: .1 });
    }
    pmx = mx; pmy = my;
    drawBg(dt); drawFx(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
