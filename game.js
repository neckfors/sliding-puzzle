(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $('board'), slotsEl = $('slots'), tilesEl = $('tiles');
  var STEPS = { 3: 140, 4: 240, 5: 380 };

  function load(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var n = parseInt(load('shuffle15_size', '4'), 10);
  if (!STEPS[n]) n = 4;
  var sound = load('shuffle15_sound', '1') === '1';
  var cells = [];      // cells[pos] = tile number, 0 = empty
  var els = {};        // tile number -> element
  var moves = 0, secs = 0, timer = null, started = false, won = false, locked = false;

  function fmt(s) { var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }

  var actx = null;
  function beep(f, d) {
    if (!sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.08, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d);
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + d);
    } catch (e) {}
  }

  function solved() {
    for (var i = 0; i < n * n - 1; i++) if (cells[i] !== i + 1) return false;
    return cells[n * n - 1] === 0;
  }

  function place(num, pos) {
    var el = els[num];
    el.style.left = (pos % n) * 100 / n + '%';
    el.style.top = Math.floor(pos / n) * 100 / n + '%';
  }
  function placeAll() { for (var i = 0; i < cells.length; i++) if (cells[i]) place(cells[i], i); }

  function sizeFont() {
    var w = tilesEl.clientWidth;
    boardEl.style.setProperty('--fs', Math.max(12, Math.round(w / n * (n > 4 ? 0.36 : 0.4))) + 'px');
  }

  // Progress feedback: which tiles are home, which rows are complete.
  var rowsDone = [];
  function isOk(pos) { return pos === n * n - 1 ? cells[pos] === 0 : cells[pos] === pos + 1; }
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function refresh(anim) {
    var ev = { tiles: 0, rows: [], ok: 0, rowCount: 0 }, r, c;
    for (var pos = 0; pos < n * n; pos++) {
      var num = cells[pos]; if (!num) continue;
      var el = els[num], was = el.classList.contains('ok');
      if (isOk(pos)) {
        ev.ok++;
        if (!was) { el.classList.add('ok'); if (anim) { ev.tiles++; restart(el, 'pop'); } }
      } else el.classList.remove('ok');
    }
    for (r = 0; r < n; r++) {
      var d = true;
      for (c = 0; c < n; c++) if (!isOk(r * n + c)) { d = false; break; }
      if (d) ev.rowCount++;
      if (anim && d && !rowsDone[r]) ev.rows.push(r);
      rowsDone[r] = d;
    }
    return ev;
  }
  function toast(txt) { var t = $('toast'); t.textContent = txt; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
  function sweep(r) {
    for (var c = 0; c < n; c++) {
      var num = cells[r * n + c]; if (!num) continue;
      els[num].style.setProperty('--d', c * 70 + 'ms'); restart(els[num], 'flash');
    }
  }
  function confetti() {
    var cols = ['#f2b441', '#f6e7c6', '#4f7bd9', '#ff8a5c', '#7be0a4'];
    for (var i = 0; i < 70; i++) {
      var p = document.createElement('div'); p.className = 'cf';
      p.style.left = Math.random() * 100 + 'vw'; p.style.background = cols[i % cols.length];
      p.style.animationDuration = 1.6 + Math.random() * 1.6 + 's'; p.style.animationDelay = Math.random() * 0.5 + 's';
      document.body.appendChild(p);
      (function (x) { setTimeout(function () { x.remove(); }, 3800); })(p);
    }
  }

  function build() {
    slotsEl.innerHTML = ''; tilesEl.innerHTML = ''; els = {};
    var s = 100 / n + '%';
    for (var i = 0; i < n * n; i++) {
      var sl = document.createElement('div');
      sl.className = 'slot'; sl.style.width = s; sl.style.height = s;
      sl.style.left = (i % n) * 100 / n + '%'; sl.style.top = Math.floor(i / n) * 100 / n + '%';
      slotsEl.appendChild(sl);
    }
    for (var t = 1; t < n * n; t++) {
      var el = document.createElement('div');
      el.className = 'tile'; el.style.width = s; el.style.height = s;
      el.dataset.n = t;
      var inner = document.createElement('div'); inner.textContent = t;
      el.appendChild(inner); tilesEl.appendChild(el); els[t] = el;
    }
    sizeFont();
  }

  function updateStats() {
    $('moves').textContent = moves;
    $('time').textContent = fmt(secs);
    var b = null;
    try { b = JSON.parse(load('shuffle15_best_' + n, 'null')); } catch (e) {}
    var who = b && b.name ? ' · ' + b.name : '';
    $('bestMoves').textContent = b ? 'Best ' + b.moves + who : '--';
    $('bestTime').textContent = b ? 'Best ' + fmt(b.time) + who : '--';
  }

  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  // A new record is saved at once; the name typed in the win panel is attached to it afterwards (and remembered).
  var pendingRec = false;
  function commitName() {
    if (!pendingRec) return;
    pendingRec = false;
    var nm = $('name').value.trim().slice(0, 12);
    save('shuffle15_name', nm);
    try {
      var b = JSON.parse(load('shuffle15_best_' + n, 'null'));
      if (b) { b.name = nm; save('shuffle15_best_' + n, JSON.stringify(b)); }
    } catch (e) {}
    updateStats();
  }

  function shuffle() {
    commitName();
    stopTimer();
    boardEl.classList.remove('won');
    $('win').hidden = true;
    cells = [];
    for (var i = 1; i < n * n; i++) cells.push(i);
    cells.push(0);
    var e = n * n - 1, prev = -1, steps = STEPS[n];
    for (var k = 0; k < steps || solved(); k++) {
      var opts = [], r = Math.floor(e / n), c = e % n;
      if (r > 0) opts.push(e - n);
      if (r < n - 1) opts.push(e + n);
      if (c > 0) opts.push(e - 1);
      if (c < n - 1) opts.push(e + 1);
      opts = opts.filter(function (p) { return p !== prev; });
      var p = opts[Math.floor(Math.random() * opts.length)];
      cells[e] = cells[p]; cells[p] = 0; prev = e; e = p;
    }
    moves = 0; secs = 0; started = false; won = false; locked = false;
    for (var q in els) els[q].classList.remove('ok', 'pop', 'flash');
    rowsDone = [];
    placeAll(); refresh(false); updateStats();
  }

  function startTimer() {
    started = true;
    timer = setInterval(function () { secs++; $('time').textContent = fmt(secs); }, 1000);
  }

  // Slide every tile between the empty cell and the tapped cell (same row or column).
  function tap(pos) {
    if (won || locked) return false;
    var e = cells.indexOf(0);
    var pr = Math.floor(pos / n), pc = pos % n, er = Math.floor(e / n), ec = e % n;
    if (pos === e || (pr !== er && pc !== ec)) return false;
    var step = pr === er ? (pc < ec ? 1 : -1) : (pr < er ? n : -n);
    if (pr === er && step < 0) step = -1;
    var cur = e;
    while (cur !== pos) {
      var from = cur - (pr === er ? (pc < ec ? 1 : -1) : (pr < er ? n : -n));
      cells[cur] = cells[from]; cells[from] = 0; place(cells[cur], cur); cur = from;
    }
    if (!started) startTimer();
    moves++; $('moves').textContent = moves;
    var ev = refresh(true);
    if (solved()) win();
    else if (ev.rows.length) {
      ev.rows.forEach(sweep);
      toast(ev.rows.length > 1 ? 'ROWS DONE!' : 'ROW ' + (ev.rows[0] + 1) + ' DONE');
      var b0 = 440 * (1 + 0.15 * ev.rowCount);
      beep(b0, 0.18); setTimeout(function () { beep(b0 * 1.25, 0.18); }, 90); setTimeout(function () { beep(b0 * 1.5, 0.3); }, 180);
    }
    else if (ev.tiles) beep(380 + ev.ok * 28, 0.14);
    else beep(260, 0.05);
    return true;
  }

  // Direction the tiles should move (dr, dc): the tile on the opposite side of the empty cell slides in.
  function dir(dr, dc) {
    var e = cells.indexOf(0), r = Math.floor(e / n) - dr, c = e % n - dc;
    if (r < 0 || r >= n || c < 0 || c >= n) return;
    tap(r * n + c);
  }

  function win() {
    won = true; stopTimer();
    boardEl.classList.add('won');
    boardEl.classList.remove('pulse'); void boardEl.offsetWidth; boardEl.classList.add('pulse');
    var b = null, rec = false;
    try { b = JSON.parse(load('shuffle15_best_' + n, 'null')); } catch (e) {}
    if (!b || moves < b.moves || (moves === b.moves && secs < b.time)) { rec = true; }
    var nm = load('shuffle15_name', '');
    if (rec) { save('shuffle15_best_' + n, JSON.stringify({ moves: moves, time: secs, name: nm })); pendingRec = true; }
    updateStats();
    for (var pos = 0; pos < n * n - 1; pos++) { els[pos + 1].style.setProperty('--d', pos * 55 + 'ms'); restart(els[pos + 1], 'flash'); }
    toast('SOLVED!');
    [523, 659, 784, 1047, 1319].forEach(function (f, i) { setTimeout(function () { beep(f, 0.3); }, 150 + i * 140); });
    setTimeout(confetti, 300);
    setTimeout(function () {
      $('winSub').textContent = n + '×' + n + ' board';
      $('rec').hidden = !rec;
      $('name').hidden = !rec; $('name').value = nm;
      $('winMoves').textContent = moves; $('winTime').textContent = fmt(secs);
      $('win').hidden = false;
    }, 1900);
  }

  function setSize(s) {
    n = s; save('shuffle15_size', String(s));
    var bs = document.querySelectorAll('#sizes button');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', parseInt(bs[i].dataset.size, 10) === s);
    build(); shuffle();
  }

  // Input
  tilesEl.addEventListener('click', function (ev) {
    var t = ev.target.closest('.tile');
    if (t) { var num = parseInt(t.dataset.n, 10); tap(cells.indexOf(num)); }
  });
  var sx = 0, sy = 0, sTile = null;
  boardEl.addEventListener('pointerdown', function (ev) { sx = ev.clientX; sy = ev.clientY; sTile = ev.target.closest('.tile'); });
  boardEl.addEventListener('pointerup', function (ev) {
    var dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    ev.preventDefault();
    if (Math.abs(dx) > Math.abs(dy)) dir(0, dx > 0 ? 1 : -1); else dir(dy > 0 ? 1 : -1, 0);
  });
  $('name').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { commitName(); this.blur(); } });
  document.addEventListener('keydown', function (ev) {
    if (ev.target && ev.target.id === 'name') return;
    var k = ev.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') dir(-1, 0);
    else if (k === 'arrowdown' || k === 's') dir(1, 0);
    else if (k === 'arrowleft' || k === 'a') dir(0, -1);
    else if (k === 'arrowright' || k === 'd') dir(0, 1);
    else return;
    ev.preventDefault();
  });

  $('shuffleBtn').addEventListener('click', shuffle);
  $('again').addEventListener('click', shuffle);
  $('closeWin').addEventListener('click', function () { commitName(); $('win').hidden = true; });
  var sizeBtns = document.querySelectorAll('#sizes button');
  for (var i = 0; i < sizeBtns.length; i++) sizeBtns[i].addEventListener('click', function () { setSize(parseInt(this.dataset.size, 10)); });
  $('soundBtn').addEventListener('click', function () {
    sound = !sound; save('shuffle15_sound', sound ? '1' : '0');
    this.classList.toggle('off', !sound);
  });
  $('soundBtn').classList.toggle('off', !sound);
  window.addEventListener('resize', sizeFont);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopTimer(); else if (started && !won && !timer) timer = setInterval(function () { secs++; $('time').textContent = fmt(secs); }, 1000);
  });

  setSize(n);
})();
