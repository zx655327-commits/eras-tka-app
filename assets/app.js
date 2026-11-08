(function () {
  var NODES = window.ERAS_NODES, STAGES = window.ERAS_STAGES, ORDER = window.ERAS_ORDER;
  var Store = window.ERAS_STORE, CFG = window.ERAS_CONFIG;
  var $ = function (id) { return document.getElementById(id); };

  var state = { id: null, history: [], clip: 0, speaking: false, rate: 0.85 };
  var track = { node: null, sec: 0, vsec: 0, lastActivity: Date.now(), lastTick: Date.now(), lastVideoTime: null };

  /* ───────── 登入 ───────── */
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  $('inDate').value = todayStr();

  /* 外部試用版：只接受測試病歷號（trialMrn），不需輸入姓名與日期 */
  if (CFG.trialMrn) {
    ['inName', 'inDate'].forEach(function (id) { $(id).closest('.field').classList.add('hidden'); });
    $('inMrn').placeholder = '請輸入試用病歷號';
    $('privacyNote').innerHTML = '<strong>試用版：</strong>請輸入 ERAS 團隊提供的測試病歷號。紀錄只存在您這台裝置的瀏覽器，請勿輸入真實病人資料。';
  }
  if (CFG.demo) $('lnkAdmin').classList.remove('hidden');
  if (CFG.demo && !CFG.trialMrn) {
    $('btnDemo').classList.remove('hidden');
    if (CFG.adminHref) $('lnkAdmin').setAttribute('href', CFG.adminHref);
    $('privacyNote').innerHTML = '<strong>展示版：請勿輸入真實病人資料。</strong>可直接按「以模擬身分直接試用」。紀錄只存在您這台裝置的瀏覽器。';
    $('btnDemo').addEventListener('click', function () {
      $('inName').value = '模擬試用者';
      $('inMrn').value = 'DEMO0001';
      $('loginForm').requestSubmit ? $('loginForm').requestSubmit() : $('loginForm').dispatchEvent(new Event('submit', { cancelable: true }));
    });
  }

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (CFG.trialMrn) {
      if ($('inMrn').value.trim() !== CFG.trialMrn) { $('loginErr').textContent = '病歷號不正確，試用版請輸入 ERAS 團隊提供的測試病歷號。'; return; }
      $('inName').value = '測試病人'; $('inDate').value = todayStr();
    }
    var name = $('inName').value.trim(), mrn = $('inMrn').value.trim(), date = $('inDate').value;
    if (!name || !mrn || !date) { $('loginErr').textContent = '請完整填寫姓名、病歷號與門診日期。'; return; }
    if (!/^[A-Za-z0-9-]{4,20}$/.test(mrn)) { $('loginErr').textContent = '病歷號格式不正確，請只輸入英文字母或數字。'; return; }
    Store.login(name, mrn, date);
    start();
  });

  $('btnLogout').addEventListener('click', function () {
    flushTime();
    Store.flush();
    stopMedia();
    Store.logout();
    location.reload();
  });

  function start() {
    var p = Store.current();
    if (!p) { $('loginOverlay').classList.remove('hidden'); return; }
    $('loginOverlay').classList.add('hidden');
    $('whoami').textContent = p.name + '｜門診日期 ' + p.clinicDate;
    var last = p.path.length ? p.path[p.path.length - 1].node : null;
    goTo(last && NODES[last] ? last : ORDER[0], false);
  }

  /* ───────── 觀看時間計算 ─────────
     觀看時間：項目畫面顯示在前景，且（3 分鐘內有操作，或影片／語音正在播放）的秒數。
     影片秒數：影片實際播放的秒數。 */
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, function () { track.lastActivity = Date.now(); }, { passive: true });
  });
  function isActive() {
    if (document.visibilityState !== 'visible') return false;
    var video = $('video');
    var playing = !video.paused && !video.ended && !video.classList.contains('hidden');
    var idle = (Date.now() - track.lastActivity) / 1000 > CFG.idleSeconds;
    return !idle || playing || state.speaking;
  }
  /* 依實際經過時間累計（不足 1 秒也計入），兩次判斷間隔過長（例如手機休眠）則不計 */
  function accrue() {
    var now = Date.now(), dt = (now - track.lastTick) / 1000;
    track.lastTick = now;
    if (track.node && dt > 0 && dt < 5 && isActive()) track.sec += dt;
  }
  setInterval(function () {
    accrue();
    if (track.sec >= 5) flushTime();
  }, 1000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { flushTime(); Store.flush(); }
  });
  window.addEventListener('pagehide', function () { flushTime(); Store.flush(); });

  function flushTime() {
    if (!track.node) return;
    accrue();
    Store.addTime(track.node, track.sec, track.vsec);
    track.sec = 0; track.vsec = 0;
  }

  /* ───────── 導覽 ───────── */
  function goTo(id, push) {
    if (!NODES[id]) return;
    flushTime();
    stopMedia();
    if (push !== false && state.id) state.history.push(state.id);
    state.id = id; state.clip = 0;
    track.node = id; track.lastActivity = Date.now(); track.lastTick = Date.now(); track.lastVideoTime = null;
    Store.enterNode(id);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('btnBack').addEventListener('click', function () {
    var prev = state.history.pop();
    if (prev) goTo(prev, false);
  });
  $('btnNext').addEventListener('click', function () {
    var n = NODES[state.id];
    if (n.next) goTo(n.next);
  });

  /* ───────── 畫面 ───────── */
  function render() {
    var n = NODES[state.id];
    var stage = STAGES.filter(function (s) { return s.id === n.stage; })[0];
    $('nodeTag').textContent = (stage ? stage.name : '') + (n.branch ? '｜補充說明' : '');
    $('nodeTag').className = 'tag' + (n.branch ? ' branch' : '');
    $('nodeTitle').textContent = n.title;
    $('nodeCore').textContent = n.corePoint || '';

    var flag = $('nodeFlag');
    if (n.redFlag) { flag.classList.remove('hidden'); flag.querySelector('span').textContent = n.redFlag; }
    else flag.classList.add('hidden');

    // 媒體
    var hasVideo = n.videos && n.videos.length;
    $('video').classList.toggle('hidden', !hasVideo);
    $('voiceCard').classList.toggle('hidden', !!hasVideo);
    $('btnRate').classList.toggle('hidden', !!hasVideo);
    if (hasVideo) loadClip(0, false);
    else {
      $('voiceText').textContent = n.script || n.corePoint || '';
      $('clipLabel').textContent = '';
      $('clipDots').innerHTML = '';
      $('btnPlay').textContent = '▶ 朗讀';
    }

    // 問題與選項
    var q = $('nodeQuestion'), box = $('nodeOptions');
    box.innerHTML = '';
    if (n.question) { q.textContent = n.question; q.classList.remove('hidden'); } else q.classList.add('hidden');
    (n.options || []).forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt' + (o.primary ? ' primary' : '') + (o.danger ? ' danger' : '');
      b.textContent = o.label;
      b.addEventListener('click', function () { goTo(o.target); });
      box.appendChild(b);
    });
    if (n.end) box.appendChild(doneBox());

    // 下一步按鈕：有 next 且沒有「主要選項」時顯示
    var hasPrimaryOpt = (n.options || []).some(function (o) { return o.primary; });
    $('btnNext').classList.toggle('hidden', !n.next || hasPrimaryOpt);
    $('btnBack').classList.toggle('hidden', !state.history.length);

    // 檢核表
    renderChecklist(n);
    // 工具
    $('toolFasting').classList.toggle('hidden', n.tool !== 'fasting');
    $('toolAnkle').classList.toggle('hidden', n.tool !== 'ankle');
    if (n.tool === 'fasting') calcFasting();
    $('surveyCard').classList.toggle('hidden', !n.survey);
    if (n.survey && window.ERAS_SURVEY && window.ERAS_SURVEY.renderCard) window.ERAS_SURVEY.renderCard();
    if (window.ERAS_APAIS && window.ERAS_APAIS.renderCard) window.ERAS_APAIS.renderCard();

    renderStages();
    renderToc();
  }

  function doneBox() {
    var p = Store.current();
    var watched = ORDER.filter(function (k) { return NODES[k].main && p.nodes[k] && p.nodes[k].views > 0; }).length;
    var mains = ORDER.filter(function (k) { return NODES[k].main; }).length;
    var d = document.createElement('div');
    d.className = 'done-box card';
    d.innerHTML = '<div class="big">恭喜完成衛教</div><div>主要項目已看 <b></b> / ' + mains + ' 項，累計觀看約 <b></b> 分鐘</div>' +
      '<div style="font-size:.8em;color:var(--muted);margin-top:6px">可從右側目錄重看任何一段；有問題請聯絡個管師。</div>';
    var bs = d.querySelectorAll('b');
    bs[0].textContent = watched;
    bs[1].textContent = Math.max(1, Math.round(Store.totalSeconds(p) / 60));
    return d;
  }

  function renderStages() {
    var p = Store.current() || { nodes: {} };
    var cur = NODES[state.id].stage;
    $('stages').innerHTML = '';
    STAGES.forEach(function (s) {
      var mains = ORDER.filter(function (k) { return NODES[k].stage === s.id && NODES[k].main; });
      var seen = mains.filter(function (k) { return p.nodes[k] && p.nodes[k].views > 0; }).length;
      var el = document.createElement('div');
      el.className = 'stage' + (s.id === cur ? ' active' : '');
      el.innerHTML = '<div class="bar"><i></i></div><span></span>';
      el.querySelector('i').style.width = (mains.length ? seen / mains.length * 100 : 0) + '%';
      el.querySelector('span').textContent = s.name;
      $('stages').appendChild(el);
    });
  }

  function renderToc() {
    var p = Store.current() || { nodes: {} };
    var ul = $('toc'); ul.innerHTML = '';
    STAGES.forEach(function (s) {
      var h = document.createElement('li'); h.className = 'stg'; h.textContent = s.name; ul.appendChild(h);
      ORDER.filter(function (k) { return NODES[k].stage === s.id; }).forEach(function (k) {
        var li = document.createElement('li');
        li.className = (NODES[k].branch ? 'sub' : '') + (k === state.id ? ' cur' : '');
        var seen = p.nodes[k] && p.nodes[k].views > 0;
        li.innerHTML = '<span class="mk"></span><span></span>';
        li.firstChild.textContent = seen ? '✓' : '';
        li.lastChild.textContent = NODES[k].title;
        li.addEventListener('click', function () { if (k !== state.id) goTo(k); });
        ul.appendChild(li);
      });
    });
  }

  function renderChecklist(n) {
    var card = $('checkCard'), box = $('checklist');
    if (!n.checklist || !n.checklist.length) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    var p = Store.current();
    var key = 'eras_check_' + (p ? p.key : '') + '_' + state.id;
    var saved = [];
    try { saved = JSON.parse(localStorage.getItem(key)) || []; } catch (e) {}
    box.innerHTML = '';
    n.checklist.forEach(function (text, i) {
      var row = document.createElement('label'); row.className = 'check';
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!saved[i];
      cb.addEventListener('change', function () {
        saved[i] = cb.checked;
        try { localStorage.setItem(key, JSON.stringify(saved)); } catch (e) {}
      });
      var sp = document.createElement('span'); sp.textContent = text;
      row.appendChild(cb); row.appendChild(sp); box.appendChild(row);
    });
  }

  /* ───────── 影片 ───────── */
  var video = $('video');
  function loadClip(i, autoplay) {
    var n = NODES[state.id];
    state.clip = i;
    video.src = encodeURI(n.videos[i]);
    track.lastVideoTime = null;
    $('clipLabel').textContent = n.videos.length > 1 ? '第 ' + (i + 1) + ' / ' + n.videos.length + ' 段' : '';
    var dots = $('clipDots'); dots.innerHTML = '';
    if (n.videos.length > 1) n.videos.forEach(function (_, k) {
      var s = document.createElement('span'); if (k <= i) s.className = 'on'; dots.appendChild(s);
    });
    $('btnPlay').textContent = '▶ 播放';
    if (autoplay) video.play().catch(function () {});
  }
  video.addEventListener('timeupdate', function () {
    if (video.paused) { track.lastVideoTime = null; return; }
    var t = video.currentTime;
    if (track.lastVideoTime !== null) {
      var d = t - track.lastVideoTime;
      if (d > 0 && d < 2) track.vsec += d;
    }
    track.lastVideoTime = t;
    track.lastActivity = Date.now();
  });
  video.addEventListener('pause', function () { track.lastVideoTime = null; $('btnPlay').textContent = '▶ 播放'; });
  video.addEventListener('play', function () { $('btnPlay').textContent = '❚❚ 暫停'; });
  video.addEventListener('ended', function () {
    var n = NODES[state.id];
    if (n.videos && state.clip < n.videos.length - 1) loadClip(state.clip + 1, true);
  });
  video.addEventListener('error', function () {
    // 影片載入失敗時改顯示文字與語音
    var n = NODES[state.id];
    video.classList.add('hidden');
    $('voiceCard').classList.remove('hidden');
    $('btnRate').classList.remove('hidden');
    $('voiceText').textContent = '（影片暫時無法播放）' + (n.script || n.corePoint || '');
    $('btnPlay').textContent = '▶ 朗讀';
  });

  /* ───────── 語音 ───────── */
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-TW'; u.rate = state.rate;
    var v = speechSynthesis.getVoices().filter(function (x) { return /zh[-_]TW/i.test(x.lang); })[0];
    if (v) u.voice = v;
    u.onend = u.onerror = function () { state.speaking = false; $('btnPlay').textContent = '▶ 朗讀'; };
    state.speaking = true; $('btnPlay').textContent = '■ 停止';
    speechSynthesis.speak(u);
  }
  function stopMedia() {
    try { video.pause(); } catch (e) {}
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    state.speaking = false;
    stopAnkle();
  }
  $('btnPlay').addEventListener('click', function () {
    track.lastActivity = Date.now();
    if (!video.classList.contains('hidden')) {
      if (video.paused) video.play().catch(function () {}); else video.pause();
      return;
    }
    if (state.speaking) { speechSynthesis.cancel(); state.speaking = false; $('btnPlay').textContent = '▶ 朗讀'; }
    else speak($('voiceText').textContent);
  });
  $('btnRate').addEventListener('click', function () {
    state.rate = state.rate < 1 ? 1.0 : 0.85;
    this.textContent = '語速：' + (state.rate < 1 ? '慢' : '標準');
  });

  /* ───────── 大字體 ───────── */
  $('btnFont').addEventListener('click', function () {
    document.documentElement.classList.toggle('large');
    try { localStorage.setItem('eras_large', document.documentElement.classList.contains('large') ? '1' : ''); } catch (e) {}
  });
  try { if (localStorage.getItem('eras_large')) document.documentElement.classList.add('large'); } catch (e) {}

  /* ───────── 禁食試算 ───────── */
  function fmt(mins) {
    var prefix = '當日 ';
    if (mins < 0) { mins += 1440; prefix = '前一日 '; }
    return prefix + String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  }
  function calcFasting() {
    var v = ($('surgTime').value || '08:00').split(':').map(Number);
    var t = v[0] * 60 + v[1];
    $('cutSolid').textContent = fmt(t - 480);
    $('cutLiquid').textContent = fmt(t - 120);
  }
  $('surgTime').addEventListener('change', calcFasting);

  /* ───────── 踝幫浦跟練 ───────── */
  var ankle = { timer: null, step: 0, count: 0 };
  function stopAnkle() {
    clearInterval(ankle.timer); ankle.timer = null;
    $('btnAnkle').textContent = '開始跟練';
    $('ankleCue').textContent = '按下開始，跟著節拍一起做';
  }
  $('btnAnkle').addEventListener('click', function () {
    if (ankle.timer) { stopAnkle(); return; }
    ankle.step = 0;
    this.textContent = '停止';
    var tick = function () {
      var phase = Math.floor(ankle.step / 5) % 2, sec = 5 - (ankle.step % 5);
      $('ankleCue').textContent = (phase === 0 ? '腳尖用力往身體勾' : '腳背往下壓') + '　' + sec;
      track.lastActivity = Date.now();
      ankle.step += 1;
      if (ankle.step % 10 === 0) { ankle.count += 1; $('ankleCount').textContent = ankle.count; }
    };
    tick();
    ankle.timer = setInterval(tick, 1000);
  });

  window.ERAS_APP = { currentNode: function () { return state.id; }, stopMedia: stopMedia };
  start();
})();
