/* ------------------------------------------------------------------
   海滩打字小勇士 · 儿童键盘指法练习游戏
   单页实现，无任何外部依赖
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  /* ============================== 配置 ============================== */

  var MODES = {
    home: {
      key: 'home',
      label: '基准键',
      letters: 'asdfjkl'.split(''),
      speed: 42,
      spawn: 1500,
      maxOnScreen: 5
    },
    all: {
      key: 'all',
      label: '全部字母',
      letters: 'abcdefghijklmnopqrstuvwxyz'.split(''),
      speed: 49,
      spawn: 1250,
      maxOnScreen: 6
    },
    word: {
      key: 'word',
      label: '单词',
      words: [
        'cat', 'dog', 'sun', 'sea', 'bee', 'egg', 'map', 'toy', 'cup', 'hat',
        'fish', 'star', 'ball', 'cake', 'milk', 'jump', 'tree', 'bird', 'hand',
        'moon', 'rain', 'ship', 'book', 'sand', 'wave', 'kite', 'frog', 'crab',
        'beach', 'cloud', 'happy', 'smile', 'water', 'shell', 'light', 'dream',
        'sunny', 'pearl', 'ocean'
      ],
      speed: 38,
      spawn: 2400,
      maxOnScreen: 3
    }
  };

  var FINGERS = {
    q: '左手小指', a: '左手小指', z: '左手小指',
    w: '左手无名指', s: '左手无名指', x: '左手无名指',
    e: '左手中指', d: '左手中指', c: '左手中指',
    r: '左手食指', f: '左手食指', v: '左手食指', t: '左手食指', g: '左手食指', b: '左手食指',
    y: '右手食指', h: '右手食指', n: '右手食指', u: '右手食指', j: '右手食指', m: '右手食指',
    i: '右手中指', k: '右手中指',
    o: '右手无名指', l: '右手无名指',
    p: '右手小指'
  };

  var ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  var HOME_KEYS = 'asdfjkl';
  var LIVES = 5;

  /* 波次节奏 */
  var WAVE_SECONDS = 18;    // 一波持续多久
  var BREAK_TIME = 4;       // 波与波之间的喘息（秒）
  var MAX_WAVE_SPEED = 1.95; // 泡泡速度相对基础值的上限倍率

  /* 螃蟹 */
  var CRAB_LIMIT = 5;       // 攒够几只螃蟹就涨潮

  /* 连击分级 */
  var COMBO_HOT = 5;
  var COMBO_BLAZE = 10;
  var COMBO_HALO = 15;

  /* 连击音阶（C 大调，跨两个八度） */
  var SCALE = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5,
    1174.66, 1318.51, 1396.91, 1567.98, 1760];

  var CHEERS = ['太棒了！', '好厉害！', '继续加油！', '完美！', '漂亮！', '就是这个键！'];

  /* 物理键映射：用 e.code 而不是 e.key。
     中文输入法组词时 e.key 会变成 "Process"，e.code 仍然是 KeyA 这样的物理键名。 */
  var CODE_TO_KEY = {};
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach(function (c) {
    CODE_TO_KEY['Key' + c.toUpperCase()] = c;
  });


  /* ============================== DOM ============================== */

  var $ = function (id) { return document.getElementById(id); };

  var dom = {
    field: $('field'),
    layerBubbles: $('layerBubbles'),
    layerFx: $('layerFx'),
    layerCrabs: $('layerCrabs'),
    layerSky: $('layerSky'),
    waveBanner: $('waveBanner'),
    tideFlash: $('tideFlash'),
    tideLine: $('tideLine'),
    toast: $('toast'),
    score: $('score'),
    combo: $('combo'),
    levelText: $('levelText'),
    levelCount: $('levelCount'),
    levelFill: $('levelFill'),
    hearts: $('hearts'),
    soundBtn: $('soundBtn'),
    pauseBtn: $('pauseBtn'),
    keyboard: $('keyboard'),
    nextKey: $('nextKey'),
    fingerTip: $('fingerTip'),
    startScreen: $('screenStart'),
    pauseScreen: $('screenPause'),
    endScreen: $('screenEnd'),
    modeList: $('modeList'),
    startBtn: $('startBtn'),
    resumeBtn: $('resumeBtn'),
    restartBtn: $('restartBtn'),
    homeBtn: $('homeBtn'),
    againBtn: $('againBtn'),
    backBtn: $('backBtn'),
    endScore: $('endScore'),
    endCombo: $('endCombo'),
    endAccuracy: $('endAccuracy'),
    endCpm: $('endCpm'),
    endPops: $('endPops'),
    endTitle: $('endTitle'),
    endEyebrow: $('endEyebrow'),
    newBest: $('newBest'),
    bestLine: $('bestLine'),
    weakLine: $('weakLine')
  };

  /* ============================== 状态 ============================== */

  var state = {
    mode: 'home',
    running: false,
    paused: false,
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    misses: 0,
    pops: 0,
    escaped: 0,
    lives: LIVES,
    wave: 1,
    wavePhase: 'spawning',   // spawning 进行中 / break 喘息
    waveElapsed: 0,
    wavePops: 0,
    breakTimer: 0,
    crabs: 0,
    elapsed: 0,
    spawnTimer: 0,
    lastTs: 0,
    raf: 0,
    bubbles: [],
    nextChar: '',
    sound: true,
    fieldW: 0,
    fieldH: 0
  };

  /* ============================== 音效 ============================== */

  var audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { audioCtx = new AC(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') {
      try { audioCtx.resume(); } catch (e) { /* ignore */ }
    }
    return audioCtx;
  }

  function tone(freq, duration, type, gainValue, delay, slideTo) {
    if (!state.sound) return;
    var ctx = ensureAudio();
    if (!ctx) return;
    var t0 = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainValue || 0.12, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  var SFX = {
    pop: function (combo) {
      var idx = clamp(Math.floor(((combo || 1) - 1) / 2), 0, SCALE.length - 1);
      var f = SCALE[idx];
      tone(f, 0.1, 'triangle', 0.12, 0);
      tone(f * 1.5, 0.09, 'sine', 0.055, 0.015);
      if ((combo || 0) >= COMBO_BLAZE) tone(f * 2, 0.07, 'square', 0.026, 0.03);
    },
    wrong: function () {
      tone(170, 0.14, 'square', 0.055, 0, 120);
    },
    escape: function () {
      tone(240, 0.24, 'sawtooth', 0.05, 0, 90);
    },
    crab: function () {
      tone(330, 0.07, 'square', 0.035, 0, 190);
    },
    tide: function () {
      tone(220, 0.24, 'sawtooth', 0.06, 0, 108);
      tone(164.81, 0.3, 'square', 0.05, 0.08, 82);
      tone(110, 0.4, 'triangle', 0.06, 0.18, 74);
    },
    level: function () {
      tone(523, 0.12, 'triangle', 0.1, 0);
      tone(659, 0.12, 'triangle', 0.1, 0.1);
      tone(784, 0.2, 'triangle', 0.1, 0.2);
    },
    start: function () {
      tone(440, 0.1, 'sine', 0.09, 0);
      tone(554, 0.1, 'sine', 0.09, 0.09);
      tone(659, 0.16, 'sine', 0.09, 0.18);
    },
    over: function () {
      tone(392, 0.18, 'triangle', 0.09, 0);
      tone(330, 0.18, 'triangle', 0.09, 0.16);
      tone(262, 0.3, 'triangle', 0.09, 0.32);
    }
  };

  /* ============================== 工具 ============================== */

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function readStore(key, fallback) {
    try {
      var v = window.localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) { return fallback; }
  }

  function writeStore(key, value) {
    try { window.localStorage.setItem(key, String(value)); } catch (e) { /* ignore */ }
  }

  function measureField() {
    state.fieldW = dom.field.clientWidth;
    state.fieldH = dom.field.clientHeight;
  }

  /* --------------------------------------------------------------
     可取消的定时器。
     开局、重开、回首页时必须清掉，否则上一局排队的回调会在新局里执行
     （典型症状：重开后秒涨潮扣血）。
     -------------------------------------------------------------- */

  var gameTimers = {};

  function later(fn, ms) {
    var id = window.setTimeout(function () {
      delete gameTimers[id];
      fn();
    }, ms);
    gameTimers[id] = true;
    return id;
  }

  function clearGameTimers() {
    Object.keys(gameTimers).forEach(function (id) {
      window.clearTimeout(id);
    });
    gameTimers = {};
  }

  /* ============================== 弱键记忆 ==============================
     记录每个键敲错的次数，出题时给弱键加权。
     打对时缓慢衰减，所以最近的表现占主导，练好了会自动退出弱键名单。
     -------------------------------------------------------------------- */

  var WEAK = {};
  var WEAK_KEY = 'beach-typing-weak';

  function loadWeak() {
    WEAK = {};
    try {
      var obj = JSON.parse(readStore(WEAK_KEY, '{}'));
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach(function (k) {
        var v = Number(obj[k]);
        if (/^[a-z]$/.test(k) && isFinite(v) && v > 0) WEAK[k] = Math.min(6, v);
      });
    } catch (e) { WEAK = {}; }
  }

  var weakSaveTimer = 0;

  function saveWeak() {
    try { window.localStorage.setItem(WEAK_KEY, JSON.stringify(WEAK)); } catch (e) { /* ignore */ }
  }

  /* 连续敲错时不逐键同步写盘，合并成一次；局末再强制落盘 */
  function scheduleWeakSave() {
    if (weakSaveTimer) return;
    weakSaveTimer = window.setTimeout(function () {
      weakSaveTimer = 0;
      saveWeak();
    }, 1500);
  }

  function flushWeakSave() {
    if (weakSaveTimer) {
      window.clearTimeout(weakSaveTimer);
      weakSaveTimer = 0;
    }
    saveWeak();
  }

  function markWeak(ch) {
    WEAK[ch] = Math.min(6, (WEAK[ch] || 0) + 1);
    scheduleWeakSave();
  }

  function easeWeak(ch) {
    if (!WEAK[ch]) return;
    WEAK[ch] = WEAK[ch] - 0.18;
    if (WEAK[ch] <= 0.01) delete WEAK[ch];
    scheduleWeakSave();
  }

  function keyWeight(ch) {
    var m = WEAK[ch] || 0;
    if (m <= 0) return 1;
    if (m < 2) return 1.5;
    return 2;
  }

  function weightedPick(pool, weightOf) {
    if (!pool.length) return null;
    var total = 0;
    var i;
    for (i = 0; i < pool.length; i++) total += weightOf(pool[i]);
    var r = Math.random() * total;
    for (i = 0; i < pool.length; i++) {
      r -= weightOf(pool[i]);
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function wordWeight(w) {
    var sum = 1;
    for (var i = 0; i < w.length; i++) sum += (keyWeight(w[i]) - 1) * 0.6;
    return sum;
  }

  function hasWeakChar(w) {
    for (var i = 0; i < w.length; i++) {
      if (keyWeight(w[i]) > 1) return true;
    }
    return false;
  }

  function topWeakKeys(n) {
    return Object.keys(WEAK)
      .map(function (k) { return { k: k, v: WEAK[k] }; })
      .filter(function (o) { return o.v >= 0.5; })
      .sort(function (a, b) { return b.v - a.v; })
      .slice(0, n);
  }

  /* ============================== 虚拟键盘 ============================== */

  function buildKeyboard() {
    ROWS.forEach(function (row) {
      var rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      row.split('').forEach(function (ch) {
        var key = document.createElement('button');
        key.type = 'button';
        key.className = 'key';
        key.dataset.key = ch;
        key.dataset.hand = 'qwertasdfgzxcvb'.indexOf(ch) > -1 ? 'left' : 'right';
        if (HOME_KEYS.indexOf(ch) > -1) key.classList.add('is-home');
        key.textContent = ch.toUpperCase();
        key.tabIndex = -1;
        key.addEventListener('mousedown', function (e) {
          e.preventDefault();
          if (state.running && !state.paused) handleKey(ch);
        });
        rowEl.appendChild(key);
      });
      dom.keyboard.appendChild(rowEl);
    });
  }

  function keyEl(ch) {
    return dom.keyboard.querySelector('.key[data-key="' + ch + '"]');
  }

  function flashKey(ch, cls) {
    var el = keyEl(ch);
    if (!el) return;
    el.classList.add(cls || 'is-press');
    window.setTimeout(function () { el.classList.remove(cls || 'is-press'); }, 130);
  }

  function renderHearts() {
    var html = '';
    for (var i = 0; i < LIVES; i++) {
      var lost = i >= state.lives;
      html += '<svg class="heart' + (lost ? ' is-lost' : '') + '" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M12 21s-7.6-4.9-9.5-9.2C1 8.4 3 5 6.4 5c2 0 3.6 1.1 4.6 2.7l1 1.6 1-1.6C14 6.1 15.6 5 17.6 5 21 5 23 8.4 21.5 11.8 19.6 16.1 12 21 12 21z"/></svg>';
    }
    dom.hearts.innerHTML = html;
  }

  /* ============================== HUD ============================== */

  function bump(el) {
    el.classList.add('bump');
    window.setTimeout(function () { el.classList.remove('bump'); }, 140);
  }

  var lastBarPct = -1;

  function updateWaveBar() {
    var pct = state.wavePhase === 'break'
      ? 100
      : Math.round(clamp(state.waveElapsed / WAVE_SECONDS, 0, 1) * 200) / 2;
    if (pct === lastBarPct) return;
    lastBarPct = pct;
    dom.levelFill.style.width = pct + '%';
  }

  function updateHud() {
    dom.score.textContent = state.score;
    dom.combo.textContent = '×' + state.combo;
    dom.levelText.textContent = state.wavePhase === 'break' ? '休息中' : '第 ' + state.wave + ' 波';
    dom.levelCount.textContent = state.wavePops + ' 个';
    updateWaveBar();
  }

  /* ============================== 打击反馈 ============================== */

  function floatScore(x, y, text, big) {
    var el = document.createElement('b');
    el.className = 'score-float' + (big ? ' is-big' : '');
    el.textContent = text;
    el.style.left = (x + rand(-16, 16)).toFixed(0) + 'px';
    el.style.top = (y + rand(-10, 10)).toFixed(0) + 'px';
    dom.layerFx.appendChild(el);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 840);
  }

  function jolt() {
    dom.field.classList.remove('jolt');
    void dom.field.offsetWidth;
    dom.field.classList.add('jolt');
  }

  var haloEl = null;

  function comboHalo() {
    if (!haloEl) {
      haloEl = document.createElement('div');
      haloEl.className = 'combo-halo';
      dom.field.appendChild(haloEl);
    }
    return haloEl;
  }

  function refreshComboSkin() {
    var tier = comboLevel();
    state.bubbles.forEach(applyComboSkin);
    comboHalo().classList.toggle('is-on', tier >= 3);
  }

  function comboLevel() {
    if (state.combo >= COMBO_HALO) return 3;
    if (state.combo >= COMBO_BLAZE) return 2;
    if (state.combo >= COMBO_HOT) return 1;
    return 0;
  }

  function applyComboSkin(b) {
    var tier = comboLevel();
    b.el.classList.toggle('is-hot', tier >= 1);
    b.el.classList.toggle('is-blaze', tier >= 2);
  }

  function clearComboSkin() {
    state.bubbles.forEach(function (b) {
      b.el.classList.remove('is-hot', 'is-blaze');
    });
    comboHalo().classList.remove('is-on');
  }

  function showToast(text, type) {
    dom.toast.textContent = text;
    dom.toast.className = 'toast is-on' + (type ? ' is-' + type : '');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () {
      dom.toast.className = 'toast';
    }, 700);
  }

  /* ============================== 泡泡 ============================== */

  function activeLetters() {
    var used = {};
    state.bubbles.forEach(function (b) {
      if (!b.word) used[b.char] = true;
    });
    return used;
  }

  function activeWords() {
    var used = {};
    state.bubbles.forEach(function (b) {
      if (b.word) used[b.word] = true;
    });
    return used;
  }

  function nextSpawnDelay() {
    var cfg = MODES[state.mode];
    var base = Math.max(760, cfg.spawn - (state.wave - 1) * 105);
    var d = base * rand(0.85, 1.15);
    // 场上泡泡太少就加快补充，让打得快的人不至于干等
    if (state.bubbles.length < 2) d *= 0.35;
    else if (state.bubbles.length < 3) d *= 0.6;
    // 连击越高，泡泡来得越密，正反馈
    if (state.combo >= COMBO_BLAZE) d *= 0.62;
    else if (state.combo >= COMBO_HOT) d *= 0.8;
    return d;
  }

  function spawnBubble(offsetY) {
    var cfg = MODES[state.mode];
    if (state.bubbles.length >= cfg.maxOnScreen + Math.floor((state.wave - 1) / 3)) return false;

    var isWord = !!cfg.words;
    var text = '';

    if (isWord) {
      var usedW = activeWords();
      var pool = cfg.words.filter(function (w) { return !usedW[w]; });
      if (!pool.length) return false;
      var weakW = pool.filter(hasWeakChar);
      var anyWeakWord = cfg.words.some(function (w) { return usedW[w] && hasWeakChar(w); });
      text = (weakW.length && !anyWeakWord) ? pick(weakW) : weightedPick(pool, wordWeight);
    } else {
      var usedL = activeLetters();
      var poolL = cfg.letters.filter(function (c) { return !usedL[c]; });
      if (!poolL.length) return false;
      var weakL = poolL.filter(function (c) { return keyWeight(c) > 1; });
      var anyWeak = cfg.letters.some(function (c) { return usedL[c] && keyWeight(c) > 1; });
      text = (weakL.length && !anyWeak) ? pick(weakL) : weightedPick(poolL, keyWeight);
    }
    if (!text) return false;

    var el = document.createElement('div');
    el.className = 'bubble ' + (isWord ? 'bubble--word' : 'bubble--letter');
    var hand = 'qwertasdfgzxcvb'.indexOf(text[0]) > -1 ? 'left' : 'right';
    if (hand === 'left') {
      el.style.setProperty('--ring', '#3aa6d8');
      el.style.setProperty('--fill1', '#e2f6ff');
      el.style.setProperty('--fill2', '#b6e4f6');
    } else {
      el.style.setProperty('--ring', '#f0834f');
      el.style.setProperty('--fill1', '#fff2e8');
      el.style.setProperty('--fill2', '#ffd5bd');
    }
    el.style.setProperty('--hand', hand);

    var charsEl = null;
    if (isWord) {
      var wrap = document.createElement('span');
      wrap.className = 'word-chars';
      text.split('').forEach(function (ch) {
        var s = document.createElement('span');
        s.className = 'wc';
        s.textContent = ch;
        wrap.appendChild(s);
      });
      el.appendChild(wrap);
      charsEl = wrap;
    } else {
      var c = document.createElement('span');
      c.className = 'bubble-char';
      c.textContent = text.toUpperCase();
      el.appendChild(c);
    }

    // 先按住入场动画：此时还没有 --pos，动画会在原点播放，泡泡会从左上角飞过来
    el.style.animation = 'none';
    dom.layerBubbles.appendChild(el);

    var w = el.offsetWidth;
    var h = el.offsetHeight;
    measureField();

    var pad = w / 2 + 14;
    var slice = Math.max(1, state.fieldW - pad * 2);

    var speedBase = Math.min(cfg.speed * MAX_WAVE_SPEED, cfg.speed + (state.wave - 1) * 6.5);
    var startY = state.fieldH - h * 0.5 - (offsetY || 0) + rand(0, 10);

    var startX = rand(pad, pad + slice);
    for (var g = 0; g < 12; g++) {
      var clash = state.bubbles.some(function (o) {
        return Math.abs(o.x - startX) < (o.w + w) * 0.46 && Math.abs(o.y - startY) < 130;
      });
      if (!clash) break;
      startX = rand(pad, pad + slice);
    }

    var bubble = {
      el: el,
      charsEl: charsEl,
      word: isWord ? text : null,
      char: isWord ? text[0] : text,
      typed: 0,
      x: startX,
      baseX: 0,
      y: startY,
      w: w,
      h: h,
      phase: rand(0, Math.PI * 2),
      speed: speedBase * rand(0.9, 1.12) * (isWord ? 0.92 : 1)
    };
    bubble.baseX = bubble.x;

    state.bubbles.push(bubble);
    positionBubble(bubble, 0);
    void el.offsetWidth;
    el.style.animation = '';
    if (isWord) markWordChars(bubble);
    applyComboSkin(bubble);
    return true;
  }

  function positionBubble(b, t) {
    b.x = clamp(
      b.baseX + Math.sin((state.elapsed + b.phase) * 0.8) * 13,
      b.w / 2 + 6,
      Math.max(b.w / 2 + 6, state.fieldW - b.w / 2 - 6)
    );
    var pos = 'translate3d(' + (b.x - b.w / 2).toFixed(1) + 'px,' + (b.y - b.h / 2).toFixed(1) + 'px,0)';
    b.el.style.setProperty('--pos', pos);
    b.el.style.transform = pos;
  }

  function markWordChars(b) {
    if (!b.charsEl) return;
    var spans = b.charsEl.children;
    for (var i = 0; i < spans.length; i++) {
      spans[i].className = 'wc' + (i < b.typed ? ' is-done' : (i === b.typed ? ' is-next' : ''));
    }
  }

  function splash(x, y, hand) {
    var color = hand === 'left' ? '#59c2ec' : '#ffa07c';
    for (var i = 0; i < 8; i++) {
      var d = document.createElement('i');
      d.className = 'drop';
      var ang = (Math.PI * 2 * i) / 8 + rand(-0.3, 0.3);
      var dist = rand(38, 92);
      d.style.left = (x - 5) + 'px';
      d.style.top = (y - 5) + 'px';
      d.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(0) + 'px');
      d.style.setProperty('--dy', (Math.sin(ang) * dist - 18).toFixed(0) + 'px');
      d.style.setProperty('--c', i % 2 ? color : '#ffffff');
      d.style.width = rand(6, 12).toFixed(0) + 'px';
      d.style.height = d.style.width;
      dom.layerFx.appendChild(d);
      (function (node) {
        window.setTimeout(function () { node.remove(); }, 680);
      })(d);
    }
  }

  function popBubble(b, byHand) {
    var idx = state.bubbles.indexOf(b);
    if (idx > -1) state.bubbles.splice(idx, 1);
    b.el.classList.add('is-pop');
    splash(b.x, b.y, byHand);
    window.setTimeout(function () { b.el.remove(); }, 330);
  }

  /* ============================== 输入处理 ============================== */

  function urgentBubble() {
    var best = null;
    for (var i = 0; i < state.bubbles.length; i++) {
      var b = state.bubbles[i];
      if (b.typed > 0 && (!best || b.y < best.y)) best = b;
    }
    if (best) return best;
    for (var j = 0; j < state.bubbles.length; j++) {
      if (!best || state.bubbles[j].y < best.y) best = state.bubbles[j];
    }
    return best;
  }

  function currentHintChar() {
    var b = urgentBubble();
    if (!b) return '';
    return b.word ? b.word[b.typed] : b.char;
  }

  function refreshHint() {
    var ch = state.running && !state.paused ? currentHintChar() : '';
    if (ch === state.nextChar) return;
    state.nextChar = ch;

    Array.prototype.forEach.call(dom.keyboard.querySelectorAll('.key.is-next'), function (el) {
      el.classList.remove('is-next');
    });

    if (!ch) {
      dom.nextKey.textContent = '—';
      dom.fingerTip.textContent = state.wavePhase === 'break' ? '休息一下，马上开始' : '等泡泡飘上来';
      return;
    }

    var el = keyEl(ch);
    if (el) el.classList.add('is-next');
    dom.nextKey.textContent = ch.toUpperCase();
    dom.fingerTip.textContent = FINGERS[ch] || '';
    dom.nextKey.classList.remove('bump');
    void dom.nextKey.offsetWidth;
    dom.nextKey.classList.add('bump');
  }

  function handleKey(k) {
    if (!state.running || state.paused) return;

    var target = null;
    for (var i = 0; i < state.bubbles.length; i++) {
      var b = state.bubbles[i];
      var need = b.word ? b.word[b.typed] : b.char;
      if (need !== k) continue;

      if (!target) { target = b; continue; }

      // 已经开始打词的优先，同为进行中的看谁更靠上（更快掉出去）
      var bStarted = b.typed > 0 ? 1 : 0;
      var tStarted = target.typed > 0 ? 1 : 0;
      if (bStarted > tStarted) target = b;
      else if (bStarted === tStarted && b.y < target.y) target = b;
    }

    if (!target) {
      registerMiss(k);
      return;
    }

    registerHit(target, k);
  }

  function registerHit(buble, key) {
    var hand = 'qwertasdfgzxcvb'.indexOf(key) > -1 ? 'left' : 'right';

    state.hits += 1;
    state.combo += 1;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    easeWeak(key);

    var mult = 1 + Math.min(4, Math.floor(state.combo / 5)) * 0.5;
    var base;

    if (buble.word) {
      buble.typed += 1;
      base = 8;
      if (buble.typed < buble.word.length) {
        markWordChars(buble);
        buble.el.classList.remove('is-hit');
        void buble.el.offsetWidth;
        buble.el.classList.add('is-hit');
        var part = Math.round(base * mult * 0.4);
        state.score += part;
        SFX.pop(state.combo);
        flashKey(key);
        bump(dom.score);
        floatScore(buble.x, buble.y, '+' + part, false);
        updateHud();
        refreshHint();
        return;
      }
      base = 10 + buble.word.length * 6;
    } else {
      base = 10;
    }

    var gain = Math.round(base * mult);
    state.score += gain;
    state.pops += 1;
    state.wavePops += 1;

    flashKey(key);
    SFX.pop(state.combo);
    bump(dom.score);
    bump(dom.combo);
    popBubble(buble, hand);
    floatScore(buble.x, buble.y, '+' + gain, state.combo >= COMBO_BLAZE);
    jolt();
    refreshComboSkin();

    if (state.combo % 10 === 0) {
      showToast(state.combo + ' 连击！' + pick(CHEERS), 'good');
    } else if (state.combo > 0 && state.combo % 5 === 0) {
      showToast(pick(CHEERS) + ' ×' + mult.toFixed(1), 'good');
    }

    updateHud();
    refreshHint();
  }

  function registerMiss(key) {
    state.misses += 1;
    state.combo = 0;
    markWeak(key);
    SFX.wrong();
    flashKey(key, 'is-wrong');
    dom.field.classList.remove('shake');
    void dom.field.offsetWidth;
    dom.field.classList.add('shake');
    clearComboSkin();
    updateHud();
  }

  /* ============================== 螃蟹与涨潮 ============================== */

  var CRAB_SVG =
    '<svg viewBox="0 0 64 48" aria-hidden="true">' +
      '<g stroke="#bf4a26" stroke-width="3.6" stroke-linecap="round" fill="none">' +
        '<path d="M19 31 L11 40"/><path d="M21 35 L15 43"/>' +
        '<path d="M45 31 L53 40"/><path d="M43 35 L49 43"/>' +
      '</g>' +
      '<path d="M16 24 q-9 -7 -11 1 q-2 7 7 7 q5 0 5 -5 z" fill="#e86a3d"/>' +
      '<path d="M48 24 q9 -7 11 1 q2 7 -7 7 q-5 0 -5 -5 z" fill="#e86a3d"/>' +
      '<ellipse cx="32" cy="28" rx="17" ry="12" fill="#e86a3d"/>' +
      '<ellipse cx="32" cy="25" rx="16.5" ry="10.5" fill="#ff8f5f"/>' +
      '<circle cx="26" cy="21" r="5" fill="#fff"/>' +
      '<circle cx="38" cy="21" r="5" fill="#fff"/>' +
      '<circle cx="26.6" cy="21.6" r="2.4" fill="#2b1a12"/>' +
      '<circle cx="38.6" cy="21.6" r="2.4" fill="#2b1a12"/>' +
      '<path d="M27 31 q5 4 10 0" stroke="#a83a17" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
    '</svg>';

  function updateTideLine() {
    dom.tideLine.classList.toggle('is-danger', state.crabs >= CRAB_LIMIT - 2);
  }

  function addCrab(x) {
    var el = document.createElement('div');
    el.className = 'crab is-scuttle';
    if (state.crabs >= CRAB_LIMIT - 1) el.classList.add('is-trigger');
    el.innerHTML = CRAB_SVG;
    var half = 28;
    el.style.left = clamp(x, half + 6, Math.max(half + 6, state.fieldW - half - 6)) + 'px';
    dom.layerCrabs.appendChild(el);
    state.crabs += 1;
    return el;
  }

  /* 漏掉的泡泡落到沙滩上变成螃蟹 */
  function landBubble(b) {
    var idx = state.bubbles.indexOf(b);
    if (idx > -1) state.bubbles.splice(idx, 1);
    b.el.classList.add('is-pop');
    window.setTimeout(function () { b.el.remove(); }, 330);

    state.escaped += 1;
    state.combo = 0;
    clearComboSkin();
    updateHud();

    addCrab(b.x);
    SFX.crab();
    updateTideLine();

    if (state.crabs >= CRAB_LIMIT) {
      later(tideRush, 240);
    } else if (state.crabs === 1 || state.crabs >= CRAB_LIMIT - 1) {
      showToast('泡泡破了，螃蟹上岸！（' + state.crabs + '/' + CRAB_LIMIT + '）', 'bad');
    }
  }

  /* 螃蟹攒够了，涨潮冲上岸。暂停时挂起，恢复后再执行，不会在暂停画面背后扣血 */
  function tideRush() {
    if (!state.running) return;
    if (state.paused) {
      later(tideRush, 400);
      return;
    }
    SFX.tide();

    dom.tideFlash.classList.remove('is-on');
    void dom.tideFlash.offsetWidth;
    dom.tideFlash.classList.add('is-on');

    Array.prototype.forEach.call(dom.layerCrabs.children, function (c) {
      c.classList.add('is-rush');
    });
    window.setTimeout(function () { dom.layerCrabs.innerHTML = ''; }, 600);

    state.crabs = 0;
    state.combo = 0;
    clearComboSkin();
    updateTideLine();
    showToast('涨潮了！螃蟹冲上岸', 'bad');
    loseLife();
  }

  /* ============================== 波次 ============================== */

  var bannerTimer = 0;

  function showWaveBanner(text, isRest) {
    dom.waveBanner.textContent = text;
    dom.waveBanner.classList.toggle('is-rest', !!isRest);
    dom.waveBanner.classList.add('is-on');
    window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(function () {
      dom.waveBanner.classList.remove('is-on');
    }, 2200);
  }

  var GULL_SVG =
    '<svg viewBox="0 0 80 34" aria-hidden="true">' +
      '<path d="M4 25 Q18 4 32 21 Q46 4 60 25" fill="none" stroke="#4a7f8e" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M4 25 Q18 4 32 21 Q46 4 60 25" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  function spawnGull() {
    var el = document.createElement('div');
    el.className = 'gull';
    el.innerHTML = GULL_SVG;
    el.style.top = rand(Math.round(state.fieldH * 0.34), Math.max(200, Math.round(state.fieldH * 0.62))).toFixed(0) + 'px';
    el.style.left = '-70px';
    el.style.setProperty('--dur', rand(3.8, 5.4).toFixed(2) + 's');
    dom.layerSky.appendChild(el);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 6000);
  }

  function beginWave(n, prefill) {
    state.wave = n;
    state.wavePhase = 'spawning';
    state.waveElapsed = 0;
    state.wavePops = 0;
    state.spawnTimer = 520;
    lastBarPct = -1;

    showWaveBanner('第 ' + n + ' 波');
    SFX.level();
    updateHud();

    if (prefill) {
      // 按游戏区高度算能塞下几个：既要错开，又不能一开局就压到警戒线
      var step = clamp(state.fieldH * 0.2, 56, 108);
      var fit = Math.max(1, Math.floor((state.fieldH - 242) / step) + 1);
      var count = Math.min(prefill, fit);
      for (var i = 0; i < count; i++) spawnBubble(i * step);
    }
  }

  function endWave() {
    state.wavePhase = 'break';
    state.breakTimer = BREAK_TIME;
    updateHud();
    showWaveBanner('喘口气', true);
    spawnGull();
    if (state.crabs > 0) {
      showToast('沙滩上还有 ' + state.crabs + ' 只螃蟹', 'bad');
    } else {
      showToast('清得干干净净！', 'good');
    }
  }

  function loseLife() {
    if (!state.running) return;
    state.lives -= 1;
    state.combo = 0;
    clearComboSkin();
    renderHearts();
    var hearts = dom.hearts.querySelectorAll('.heart');
    var node = hearts[state.lives];
    if (node) {
      node.classList.add('is-breaking');
      window.setTimeout(function () { node.classList.remove('is-breaking'); }, 460);
    }
    updateHud();

    if (state.lives <= 0) {
      endGame();
    }
  }

  /* ============================== 主循环 ============================== */

  function tick(ts) {
    state.raf = window.requestAnimationFrame(tick);

    if (!state.lastTs) state.lastTs = ts;
    var dt = Math.min(48, ts - state.lastTs) / 1000;
    state.lastTs = ts;

    if (!state.running || state.paused) return;

    state.elapsed += dt;

    if (state.wavePhase === 'break') {
      state.breakTimer -= dt;
      if (state.breakTimer <= 0) beginWave(state.wave + 1);
    } else {
      state.waveElapsed += dt;
      state.spawnTimer -= dt * 1000;
      if (state.spawnTimer <= 0) {
        spawnBubble();
        state.spawnTimer = nextSpawnDelay();
      }
      if (state.waveElapsed >= WAVE_SECONDS) endWave();
    }
    updateWaveBar();

    // 休息期泡泡原地停住：说好喘口气就不该还在扣血
    if (state.wavePhase !== 'break') {
      for (var i = state.bubbles.length - 1; i >= 0; i--) {
        var b = state.bubbles[i];
        b.y -= b.speed * dt;
        positionBubble(b, state.elapsed);

        if (b.y - b.h / 2 < 132) b.el.classList.add('is-warn');
        else b.el.classList.remove('is-warn');

        if (b.y + b.h / 2 < -6) landBubble(b);
      }
    }

    refreshHint();
  }

  function stopLoop() {
    if (state.raf) {
      window.cancelAnimationFrame(state.raf);
      state.raf = 0;
    }
  }

  /* ============================== 游戏流程 ============================== */

  function resetState() {
    clearGameTimers();
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.hits = 0;
    state.misses = 0;
    state.pops = 0;
    state.escaped = 0;
    state.lives = LIVES;
    state.wave = 1;
    state.wavePhase = 'spawning';
    state.waveElapsed = 0;
    state.wavePops = 0;
    state.breakTimer = 0;
    state.crabs = 0;
    state.elapsed = 0;
    state.spawnTimer = 520;
    state.lastTs = 0;
    state.nextChar = '';
    lastBarPct = -1;
    state.bubbles.forEach(function (b) { b.el.remove(); });
    state.bubbles = [];
    dom.layerFx.innerHTML = '';
    dom.layerCrabs.innerHTML = '';
    dom.layerSky.innerHTML = '';
    dom.waveBanner.classList.remove('is-on', 'is-rest');
    dom.tideFlash.classList.remove('is-on');
    dom.toast.className = 'toast';
    comboHalo().classList.remove('is-on');
    updateTideLine();
    renderHearts();
    updateHud();
    refreshHint();
  }

  function startGame() {
    measureField();
    resetState();
    state.running = true;
    state.paused = false;
    state.lastTs = 0;
    hide(dom.startScreen);
    hide(dom.endScreen);
    hide(dom.pauseScreen);
    ensureAudio();
    SFX.start();
    showToast('准备好了吗？开始！', 'good');
    beginWave(1, 3);
    if (!state.raf) state.raf = window.requestAnimationFrame(tick);
  }

  function togglePause(force) {
    if (!state.running) return;
    var next = typeof force === 'boolean' ? force : !state.paused;
    if (next === state.paused) return;
    state.paused = next;
    if (state.paused) {
      show(dom.pauseScreen);
    } else {
      hide(dom.pauseScreen);
      state.lastTs = 0;
    }
    refreshHint();
  }

  function endGame() {
    state.running = false;
    state.paused = false;
    stopLoop();
    clearGameTimers();
    SFX.over();
    state.bubbles.forEach(function (b) { b.el.remove(); });
    state.bubbles = [];
    dom.layerCrabs.innerHTML = '';
    dom.layerSky.innerHTML = '';
    dom.waveBanner.classList.remove('is-on');
    state.crabs = 0;
    clearComboSkin();
    updateTideLine();

    var total = state.hits + state.misses;
    var accuracy = total ? Math.round((state.hits / total) * 100) : 100;
    var minutes = Math.max(state.elapsed / 60, 1 / 60);
    var cpm = Math.round(state.hits / minutes);

    dom.endScore.textContent = state.score;
    dom.endCombo.textContent = state.maxCombo;
    dom.endAccuracy.textContent = total ? accuracy + '%' : '—';
    dom.endCpm.textContent = cpm;
    dom.endPops.textContent = state.pops;

    dom.levelText.textContent = '本轮结束';
    dom.levelCount.textContent = '共 ' + state.pops + ' 个';
    dom.levelFill.style.width = '100%';

    var storeKey = 'beach-typing-best-' + state.mode;
    var best = parseInt(readStore(storeKey, '0'), 10) || 0;
    if (state.score > best) {
      best = state.score;
      writeStore(storeKey, best);
      dom.newBest.classList.remove('hidden');
    } else {
      dom.newBest.classList.add('hidden');
    }
    dom.bestLine.textContent = '最好成绩：' + best + ' 分';

    if (accuracy >= 90 && state.pops >= 10) {
      dom.endTitle.textContent = '手指好准！';
      dom.endEyebrow.textContent = '正确率超过 90%';
    } else if (state.pops >= 8) {
      dom.endTitle.textContent = '打得不错！';
      dom.endEyebrow.textContent = '本轮结束';
    } else {
      dom.endTitle.textContent = '再来一次会更好';
      dom.endEyebrow.textContent = '慢慢来，手指会记住的';
    }

    var weak = topWeakKeys(3);
    if (weak.length) {
      var html = '最需要练的键：';
      weak.forEach(function (o) { html += '<b>' + o.k.toUpperCase() + '</b>'; });
      dom.weakLine.innerHTML = html;
      dom.weakLine.classList.remove('hidden');
    } else {
      dom.weakLine.classList.add('hidden');
    }
    flushWeakSave();

    show(dom.endScreen);
    refreshHint();
  }

  function backToStart() {
    state.running = false;
    state.paused = false;
    stopLoop();
    flushWeakSave();
    resetState();
    hide(dom.endScreen);
    hide(dom.pauseScreen);
    show(dom.startScreen);
  }

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  /* ============================== 事件 ============================== */

  function bindEvents() {
    dom.startBtn.addEventListener('click', function () {
      // 按钮被 Enter 激活时会和 window 的 keydown 抢着开一局，用界面状态兜住
      if (dom.startScreen.classList.contains('hidden')) return;
      ensureAudio();
      startGame();
    });

    dom.modeList.addEventListener('click', function (e) {
      var card = e.target.closest('.mode-card');
      if (!card) return;
      Array.prototype.forEach.call(dom.modeList.children, function (c) {
        c.classList.remove('is-active');
      });
      card.classList.add('is-active');
      state.mode = card.dataset.mode;
      writeStore('beach-typing-mode', state.mode);
      var storeKey = 'beach-typing-best-' + state.mode;
      var best = parseInt(readStore(storeKey, '0'), 10) || 0;
      dom.bestLine.textContent = '最好成绩：' + best + ' 分';
    });

    dom.resumeBtn.addEventListener('click', function () { togglePause(false); });
    dom.restartBtn.addEventListener('click', function () {
      if (dom.pauseScreen.classList.contains('hidden')) return;
      hide(dom.pauseScreen);
      startGame();
    });
    dom.homeBtn.addEventListener('click', backToStart);
    dom.againBtn.addEventListener('click', function () {
      if (dom.endScreen.classList.contains('hidden')) return;
      startGame();
    });
    dom.backBtn.addEventListener('click', backToStart);
    dom.pauseBtn.addEventListener('click', function () { togglePause(); });

    dom.soundBtn.addEventListener('click', function () {
      state.sound = !state.sound;
      writeStore('beach-typing-sound', state.sound ? '1' : '0');
      dom.soundBtn.classList.toggle('is-muted', !state.sound);
      if (state.sound) { ensureAudio(); SFX.pop(2); }
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (state.running) togglePause();
        return;
      }
      if (e.key === 'Enter' && !state.running) {
        // 焦点在按钮上时 Enter 会同时触发默认点击，必须挡掉，否则开两局
        e.preventDefault();
        if (!dom.startScreen.classList.contains('hidden')) startGame();
        else if (!dom.endScreen.classList.contains('hidden')) startGame();
        return;
      }
      if (e.key === ' ' || e.key === 'Spacebar') e.preventDefault();
      if (e.repeat) return;

      // 优先用物理键名：中文输入法组词时 e.key 会变成 "Process"
      var k = CODE_TO_KEY[e.code];
      if (!k) {
        var raw = e.key;
        if (!raw || raw.length !== 1) return;
        k = raw.toLowerCase();
        if (!/^[a-z]$/.test(k)) return;
      }

      if (!state.running) return;
      if (state.paused) { togglePause(false); return; }

      e.preventDefault();
      handleKey(k);
    });

    window.addEventListener('blur', function () {
      if (state.running && !state.paused) togglePause(true);
    });

    window.addEventListener('resize', function () {
      measureField();
      state.bubbles.forEach(function (b) { positionBubble(b, state.elapsed); });
    });
  }

  /* ============================== 初始化 ============================== */

  function init() {
    buildKeyboard();
    bindEvents();
    measureField();
    loadWeak();
    renderHearts();
    updateHud();
    refreshHint();

    state.sound = readStore('beach-typing-sound', '1') !== '0';
    dom.soundBtn.classList.toggle('is-muted', !state.sound);

    // 恢复上次选中的模式
    var savedMode = readStore('beach-typing-mode', 'home');
    if (MODES[savedMode]) {
      state.mode = savedMode;
      Array.prototype.forEach.call(dom.modeList.children, function (c) {
        c.classList.toggle('is-active', c.dataset.mode === savedMode);
      });
    }

    var best = parseInt(readStore('beach-typing-best-' + state.mode, '0'), 10) || 0;
    dom.bestLine.textContent = '最好成绩：' + best + ' 分';

    window.setTimeout(measureField, 60);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measureField);
    }
  }

  init();
})();
