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
  var POPS_PER_LEVEL = 8;

  var CHEERS = ['太棒了！', '好厉害！', '继续加油！', '完美！', '漂亮！', '就是这个键！'];

  /* ============================== DOM ============================== */

  var $ = function (id) { return document.getElementById(id); };

  var dom = {
    field: $('field'),
    layerBubbles: $('layerBubbles'),
    layerFx: $('layerFx'),
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
    bestLine: $('bestLine')
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
    level: 1,
    levelProgress: 0,
    elapsed: 0,
    spawnTimer: 0,
    lastTs: 0,
    raf: 0,
    bubbles: [],
    nextChar: '',
    sound: true,
    fieldW: 0,
    fieldH: 0,
    busy: false
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
    pop: function (pitch) {
      var base = 620 + (pitch || 0) * 40;
      tone(base, 0.1, 'sine', 0.13, 0);
      tone(base * 1.5, 0.12, 'sine', 0.08, 0.03);
    },
    wrong: function () {
      tone(170, 0.14, 'square', 0.055, 0, 120);
    },
    escape: function () {
      tone(240, 0.24, 'sawtooth', 0.05, 0, 90);
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

  function updateHud() {
    dom.score.textContent = state.score;
    dom.combo.textContent = '×' + state.combo;
    dom.levelText.textContent = '第 ' + state.level + ' 关';
    dom.levelCount.textContent = state.levelProgress + ' / ' + POPS_PER_LEVEL;
    dom.levelFill.style.width = (state.levelProgress / POPS_PER_LEVEL * 100) + '%';
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
    var base = Math.max(760, cfg.spawn - (state.level - 1) * 105);
    return base * rand(0.85, 1.15);
  }

  function spawnBubble(offsetY) {
    var cfg = MODES[state.mode];
    if (state.bubbles.length >= cfg.maxOnScreen + Math.floor((state.level - 1) / 3)) return;

    var isWord = !!cfg.words;
    var text = '';

    if (isWord) {
      var usedW = activeWords();
      var pool = cfg.words.filter(function (w) { return !usedW[w]; });
      if (!pool.length) return;
      text = pick(pool);
    } else {
      var usedL = activeLetters();
      var poolL = cfg.letters.filter(function (c) { return !usedL[c]; });
      if (!poolL.length) return;
      text = pick(poolL);
    }

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

    dom.layerBubbles.appendChild(el);

    var w = el.offsetWidth;
    var h = el.offsetHeight;
    measureField();

    var pad = w / 2 + 14;
    var slice = Math.max(1, state.fieldW - pad * 2);

    var bubble = {
      el: el,
      charsEl: charsEl,
      word: isWord ? text : null,
      char: isWord ? text[0] : text,
      typed: 0,
      x: rand(pad, pad + slice),
      baseX: 0,
      y: state.fieldH + h / 2 + (offsetY || 0) + rand(6, 30),
      w: w,
      h: h,
      phase: rand(0, Math.PI * 2),
      speed: (cfg.speed + (state.level - 1) * 6.5) * rand(0.9, 1.12) * (isWord ? 0.92 : 1)
    };
    bubble.baseX = bubble.x;

    state.bubbles.push(bubble);
    positionBubble(bubble, 0);
    if (isWord) markWordChars(bubble);
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

  function removeBubble(b) {
    var idx = state.bubbles.indexOf(b);
    if (idx > -1) state.bubbles.splice(idx, 1);
    b.el.remove();
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
      dom.fingerTip.textContent = '等泡泡飘上来';
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
      if (need === k) {
        if (!target) target = b;
        else if (b.typed > 0 && target.typed === 0) target = b;
        else if (target.typed === 0 && b.typed === 0 && b.y < target.y) target = b;
      }
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
        state.score += Math.round(base * mult * 0.4);
        SFX.pop(buble.typed);
        flashKey(key);
        bump(dom.score);
        updateHud();
        refreshHint();
        return;
      }
      base = 10 + buble.word.length * 6;
    } else {
      base = 10;
    }

    state.score += Math.round(base * mult);
    state.pops += 1;
    state.levelProgress += 1;

    flashKey(key);
    SFX.pop(Math.min(state.combo, 8));
    bump(dom.score);
    bump(dom.combo);
    popBubble(buble, hand);

    if (state.combo % 10 === 0) {
      showToast(state.combo + ' 连击！' + pick(CHEERS), 'good');
    } else if (state.combo > 0 && state.combo % 5 === 0) {
      showToast(pick(CHEERS) + ' ×' + mult.toFixed(1), 'good');
    }

    if (state.levelProgress >= POPS_PER_LEVEL) {
      state.levelProgress = 0;
      state.level += 1;
      SFX.level();
      showToast('进入第 ' + state.level + ' 关！泡泡变快了', 'good');
    }

    updateHud();
    refreshHint();
  }

  function registerMiss(key) {
    state.misses += 1;
    state.combo = 0;
    SFX.wrong();
    flashKey(key, 'is-wrong');
    dom.field.classList.remove('shake');
    void dom.field.offsetWidth;
    dom.field.classList.add('shake');
    updateHud();
  }

  function loseLife() {
    if (!state.running) return;
    state.lives -= 1;
    state.combo = 0;
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
    state.spawnTimer -= dt * 1000;

    if (state.spawnTimer <= 0) {
      spawnBubble();
      state.spawnTimer = nextSpawnDelay();
    }

    for (var i = state.bubbles.length - 1; i >= 0; i--) {
      var b = state.bubbles[i];
      b.y -= b.speed * dt;
      positionBubble(b, state.elapsed);

      if (b.y - b.h / 2 < 120) b.el.classList.add('is-warn');
      else b.el.classList.remove('is-warn');

      if (b.y + b.h / 2 < -6) {
        removeBubble(b);
        state.escaped += 1;
        SFX.escape();
        showToast('泡泡跑掉了…', 'bad');
        loseLife();
      }
    }

    refreshHint();
  }

  /* ============================== 游戏流程 ============================== */

  function resetState() {
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.hits = 0;
    state.misses = 0;
    state.pops = 0;
    state.escaped = 0;
    state.lives = LIVES;
    state.level = 1;
    state.levelProgress = 0;
    state.elapsed = 0;
    state.spawnTimer = 900;
    state.lastTs = 0;
    state.nextChar = '';
    state.bubbles.forEach(function (b) { b.el.remove(); });
    state.bubbles = [];
    dom.layerFx.innerHTML = '';
    dom.toast.className = 'toast';
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
    spawnBubble(0);
    spawnBubble(120);
    spawnBubble(250);
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
    SFX.over();
    state.bubbles.forEach(function (b) { b.el.remove(); });
    state.bubbles = [];

    var total = state.hits + state.misses;
    var accuracy = total ? Math.round((state.hits / total) * 100) : 100;
    var minutes = Math.max(state.elapsed / 60, 1 / 60);
    var cpm = Math.round(state.hits / minutes);

    dom.endScore.textContent = state.score;
    dom.endCombo.textContent = state.maxCombo;
    dom.endAccuracy.textContent = total ? accuracy + '%' : '—';
    dom.endCpm.textContent = cpm;
    dom.endPops.textContent = state.pops;

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

    show(dom.endScreen);
    refreshHint();
  }

  function backToStart() {
    state.running = false;
    state.paused = false;
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
      var storeKey = 'beach-typing-best-' + state.mode;
      var best = parseInt(readStore(storeKey, '0'), 10) || 0;
      dom.bestLine.textContent = '最好成绩：' + best + ' 分';
    });

    dom.resumeBtn.addEventListener('click', function () { togglePause(false); });
    dom.restartBtn.addEventListener('click', function () {
      hide(dom.pauseScreen);
      startGame();
    });
    dom.homeBtn.addEventListener('click', backToStart);
    dom.againBtn.addEventListener('click', startGame);
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
        if (!dom.startScreen.classList.contains('hidden')) startGame();
        else if (!dom.endScreen.classList.contains('hidden')) startGame();
        return;
      }
      if (e.key === ' ' || e.key === 'Spacebar') e.preventDefault();
      if (e.repeat) return;

      var k = e.key;
      if (!k || k.length !== 1) return;
      k = k.toLowerCase();
      if (!/^[a-z]$/.test(k)) return;

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
    renderHearts();
    updateHud();
    refreshHint();

    state.sound = readStore('beach-typing-sound', '1') !== '0';
    dom.soundBtn.classList.toggle('is-muted', !state.sound);

    var best = parseInt(readStore('beach-typing-best-home', '0'), 10) || 0;
    dom.bestLine.textContent = '最好成绩：' + best + ' 分';

    window.setTimeout(measureField, 60);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measureField);
    }
  }

  init();
})();
