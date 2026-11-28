(function () {
  var NODES = window.ERAS_NODES, STAGES = window.ERAS_STAGES, ORDER = window.ERAS_ORDER;
  var Store = window.ERAS_STORE, CFG = window.ERAS_CONFIG;
  var $ = function (id) { return document.getElementById(id); };

  var state = { id: null, history: [], clip: 0, speaking: false, rate: 1 };
  try { if (localStorage.getItem('eras_rate') === '0.85') state.rate = 0.85; } catch (e) {}
  var track = { node: null, sec: 0, vsec: 0, lastActivity: Date.now(), lastTick: Date.now(), lastVideoTime: null };

  /* ───────── 登入 ───────── */
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  $('inDate').value = todayStr();

  /* 外部試用版：只需輸入病歷號，不需姓名與日期。trialMrn = '*' 表示任何病歷號都可登入（2026-11-15 使用者要求不限制），
     其他值表示只接受該測試病歷號。 */
  var anyMrn = CFG.trialMrn === '*';
  if (CFG.trialMrn) {
    ['inName', 'inDate'].forEach(function (id) { $(id).closest('.field').classList.add('hidden'); });
    $('inMrn').placeholder = anyMrn ? '請輸入病歷號（試用請用自編號碼）' : '請輸入試用病歷號';
    $('privacyNote').innerHTML = anyMrn
      ? '<strong>試用版：</strong>可輸入任何病歷號（英文字母或數字 4～20 碼），例如 12345。紀錄只存在您這台裝置的瀏覽器；請勿輸入真實病人的病歷號。'
      : '<strong>試用版：</strong>請輸入 ERAS 團隊提供的測試病歷號。紀錄只存在您這台裝置的瀏覽器，請勿輸入真實病人資料。';
  }
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
      if (!anyMrn && $('inMrn').value.trim() !== CFG.trialMrn) { $('loginErr').textContent = '病歷號不正確，試用版請輸入 ERAS 團隊提供的測試病歷號。'; return; }
      $('inName').value = '測試病人'; $('inDate').value = todayStr();
    }
    /* 病歷號自動整理：去掉空格與減號、全形轉半形、轉大寫（照卡片抄寫常見的差異） */
    var rawMrn = $('inMrn').value.replace(/[！-～]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[\s\-－—_]/g, '').toUpperCase();
    $('inMrn').value = rawMrn;
    /* 高齡友善：只需病歷號；姓名可空白（個管師以病歷號辨識），門診日期自動帶今天 */
    var name = $('inName').value.trim(), mrn = rawMrn, date = $('inDate').value || todayStr();
    if (!name) { $('loginErr').textContent = '請輸入姓名。'; $('inName').focus(); return; }
    if (!mrn) { $('loginErr').textContent = '請輸入病歷號。'; $('inMrn').focus(); return; }
    if (!/^[A-Z0-9]{4,20}$/.test(mrn)) { $('loginErr').textContent = '病歷號格式不正確，請輸入 4～20 碼英文字母或數字（不含中文）。'; return; }
    $('loginErr').textContent = '';
    var btn = this.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = '登入中…';
    var key = String(mrn).trim().toUpperCase();   // 以病歷號辨識同一位病人（見 store.js）
    var pull = window.ERAS_CLOUD ? window.ERAS_CLOUD.pullPatient(key, mrn) : Promise.resolve(false);
    pull.then(function () {
      btn.disabled = false; btn.textContent = '開始觀看';
      /* 第一次使用這個病歷號（本機與後台都沒有紀錄）→ 再確認一次，避免打錯號碼建立新病人 */
      var known = Store.listPatients().some(function (x) { return x.key === key; });
      if (!known && !CFG.trialMrn && !window.confirm('這是您第一次使用這個 App。\n\n請再確認病歷號：' + mrn + '\n姓名：' + name +
        '\n\n正確請按「確定」；要修改請按「取消」。')) { $('inMrn').focus(); return; }
      Store.login(name, mrn, date);
      start(true);
      if (window.ERAS_CLOUD) window.ERAS_CLOUD.sync();
    });
  });

  /* 病人一開始輸入病歷號，登入頁右上角「ERAS團隊」就鎖住，避免病人誤按進入團隊登入 */
  (function () {
    var corner = document.querySelector('#loginOverlay .team-link-corner');
    if (!corner) return;
    function lockTeam() {
      var on = !!$('inMrn').value.trim();
      corner.classList.toggle('locked', on);
      corner.setAttribute('aria-disabled', on ? 'true' : 'false');
      corner.tabIndex = on ? -1 : 0;
    }
    corner.addEventListener('click', function (e) { if (corner.classList.contains('locked')) { e.preventDefault(); e.stopPropagation(); } });
    $('inMrn').addEventListener('input', lockTeam);
    lockTeam();
  })();

  $('btnLogout').addEventListener('click', function (e) {
    /* 避免誤按：先確認（進度已自動儲存，下次用同一病歷號登入可接續） */
    if (!window.confirm('確定要登出嗎？\n您的學習進度已自動儲存，下次用同一個病歷號登入就能接續。')) { e.preventDefault(); return; }
    flushTime();
    Store.flush();
    stopMedia();
    Store.logout();
    location.reload();
  });

  /* fromLogin：剛登入時一律從 ERAS 簡介第一項開始；同一次使用中重新整理頁面，才接續上次看到的項目 */
  function start(fromLogin) {
    var p = Store.current();
    if (!p) { $('loginOverlay').classList.remove('hidden'); return; }
    $('loginOverlay').classList.add('hidden');
    $('whoami').textContent = (p.name ? p.name + '｜' : '') + '病歷號 ' + p.mrn +
      (p.lastUser && p.lastUser !== p.name ? '（' + p.lastUser + ' 操作）' : '');
    var last = p.path.length ? p.path[p.path.length - 1].node : null;
    var first = (!fromLogin && last && NODES[last]) ? last : ORDER[0];
    /* 分次學習：已看完 ERAS 簡介的病人，再次登入直接從第一個「尚未完成」的項目接續（2026-11-28） */
    if (fromLogin && Store.isDone(p, ORDER[0])) {
      first = ORDER.filter(function (k) { return NODES[k].main && !Store.isDone(p, k); })[0] || 'closing';
    }
    // APAIS 前測須在衛教介入前完成：未完成前不進入任何衛教項目（不播放、不計觀看）
    if (window.ERAS_APAIS && window.ERAS_APAIS.gate && window.ERAS_APAIS.needBaseline()) {
      window.ERAS_APAIS.gate(function () { goTo(first, false, fromLogin); });
      return;
    }
    /* 第一次使用：先顯示 3 步驟說明，按「我知道了」才開始播放（這一下點擊也讓手機允許有聲播放） */
    var firstTime = fromLogin && p.logins <= 1 && !Object.keys(p.nodes || {}).some(function (k) { return p.nodes[k].views > 0; });
    if (firstTime) { goTo(first, false, false); showOnboard(); return; }
    goTo(first, false, fromLogin);
  }
  function showOnboard() {
    var ov = $('onboard'); if (!ov) return;
    /* 一次只顯示一步，並朗讀出來（長輩不必一次讀完一大段） */
    var steps = ov.querySelectorAll('.onboard-steps li'), i = 0;
    function show() {
      steps.forEach(function (li, k) { li.classList.toggle('hidden', k !== i); });
      $('onboardPg').textContent = (i + 1) + ' / ' + steps.length;
      $('onboardGo').textContent = i < steps.length - 1 ? '下一步 ▶' : '我知道了，開始看影片 ▶';
      try { ttsStop(); speak(steps[i].textContent); } catch (e) {}
    }
    ov.classList.remove('hidden'); show();
    $('onboardGo').onclick = function () {
      if (i < steps.length - 1) { i++; show(); return; }
      try { ttsStop(); } catch (e) {}
      ov.classList.add('hidden'); playCurrent();
    };
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
  /* autoplay：由引導按鈕進入時自動開始播放影片（或朗讀），一項一項帶病人往下學 */
  function goTo(id, push, autoplay) {
    if (!NODES[id]) return;
    flushTime();
    stopMedia();
    if (push !== false && state.id) state.history.push(state.id);
    state.id = id; state.clip = 0;
    track.node = id; track.lastActivity = Date.now(); track.lastTick = Date.now(); track.lastVideoTime = null;
    Store.enterNode(id);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (autoplay) playCurrent();
  }
  function playCurrent() {
    var n = NODES[state.id];
    if (n.videos && n.videos.length && !video.classList.contains('hidden')) tryPlay();   // 從目前段落（可能是上次停下處）繼續
    else if (n.script || n.corePoint) speak($('voiceText').textContent);
  }
  function replayCurrent() {
    var n = NODES[state.id];
    window.scrollTo({ top: 0, behavior: 'smooth' });
    clearResume(state.id);
    if (n.videos && n.videos.length && !video.classList.contains('hidden')) loadClip(0, true); else speak($('voiceText').textContent);
  }
  /* 自動播放被瀏覽器擋下（常見於 iPhone）時，在影片上顯示大按鈕「請按這裡開始播放」 */
  function tryPlay() {
    var p = video.play();
    if (p && p.catch) p.catch(function () { var h = $('playHint'); if (h && !video.classList.contains('hidden')) h.classList.remove('hidden'); });
  }
  /* 記住每個項目看到第幾段、第幾秒，回來時從停下的地方繼續。
     2026-11-28：同時存進病人紀錄（p.resume，會同步到後台），換手機也能接著看。 */
  function resumeAll() {
    var p = Store.current(), loc = null;
    try { loc = (JSON.parse(localStorage.getItem('eras_resume_v1')) || {})[p ? p.key : '']; } catch (e) {}
    return loc || (p && p.resume) || {};
  }
  function saveResumeAll(m) {
    var p = Store.current(); if (!p) return;
    try { var all = JSON.parse(localStorage.getItem('eras_resume_v1')) || {}; all[p.key] = m; localStorage.setItem('eras_resume_v1', JSON.stringify(all)); } catch (e) {}
    if (Store.setResume) Store.setResume(m);
  }
  function getResume(id) { return resumeAll()[id] || null; }
  function setResume(id, c, t) { var m = resumeAll(); m[id] = { c: c, t: Math.round(t) }; saveResumeAll(m); }
  function clearResume(id) { var m = resumeAll(); if (m[id]) { delete m[id]; saveResumeAll(m); } }
  /* 下一個「尚未完成」的主線項目（跳過已完成的）；分支項目先回到其主線 */
  function nextUnfinished(fromId) {
    var p = Store.current() || { nodes: {} };
    var n = NODES[fromId], primary = (n.options || []).filter(function (o) { return o.primary; })[0];
    var start = n.next || (primary && primary.target);
    if (!start) return null;
    var i = ORDER.indexOf(start);
    for (; i < ORDER.length; i++) { var k = ORDER[i]; if (NODES[k].main && !Store.isDone(p, k)) return k; }
    return 'closing';
  }
  /* 影片或朗讀結束：完成 → 跳完成視窗；未完成 → 跳提醒 */
  function onMediaEnd() {
    var p = Store.current(); if (!p) return;
    var sv = $('svOverlay'), ask = $('askOverlay');
    if ((sv && !sv.classList.contains('hidden')) || (ask && !ask.classList.contains('hidden'))) return; // 正在填問卷或提問時不跳提醒
    if (Store.isDone(p, state.id) && !pendingTasks(NODES[state.id]).some(function (t) { return t.el !== 'checkCard'; })) afterItemDone(NODES[state.id]);
    else remind('ended');
  }

  $('btnBack').addEventListener('click', function () {
    var prev = state.history.pop();
    if (prev) goTo(prev, false);
  });
  $('btnNext').addEventListener('click', function () {
    var n = NODES[state.id];
    if (!n.next) return;
    /* 自我檢核未完成時先提醒（不強制，病人可選擇稍後再回來） */
    var hasUnchecked = pendingTasks(n).some(function (t) { return t.el === 'checkCard'; });
    if (hasUnchecked && remind('next', function () { goTo(n.next, true, true); })) return;
    goTo(n.next, true, true);
  });

  /* ───────── 畫面 ───────── */
  function render() {
    var n = NODES[state.id];
    var stage = STAGES.filter(function (s) { return s.id === n.stage; })[0];
    $('nodeTag').textContent = (stage ? stage.name : '') + (n.branch ? '｜補充說明' : '');
    $('nodeTag').className = 'tag' + (n.branch ? ' branch' : '');
    $('nodeTitle').textContent = n.title;
    $('nodeCore').textContent = n.corePoint || '';

    /* 衛教圖卡（2026-11-28）：放在重點文字下方，點一下放大 */
    var gal = $('nodeImgs');
    if (!gal) { gal = document.createElement('div'); gal.id = 'nodeImgs'; gal.className = 'node-imgs'; $('nodeCore').insertAdjacentElement('afterend', gal); }
    gal.innerHTML = '';
    (n.images || []).forEach(function (im) {
      var img = document.createElement('img');
      img.src = im.src; img.alt = im.alt || ''; img.loading = 'lazy';
      img.addEventListener('click', function () { img.classList.toggle('zoom'); });
      gal.appendChild(img);
    });
    gal.classList.toggle('hidden', !(n.images && n.images.length));

    var flag = $('nodeFlag');
    if (n.redFlag) { flag.classList.remove('hidden'); flag.querySelector('span').textContent = n.redFlag; }
    else flag.classList.add('hidden');

    // 媒體
    var hasVideo = n.videos && n.videos.length;
    $('video').classList.toggle('hidden', !hasVideo);
    $('voiceCard').classList.toggle('hidden', !!hasVideo);
    $('btnRate').classList.remove('hidden');   /* 影片也能放慢（高齡友善） */
    $('btnRewind').classList.toggle('hidden', !hasVideo);
    $('videoErr').classList.add('hidden');
    $('playHint').classList.add('hidden');
    clearTimeout(state.dwell);
    if (hasVideo) {
      var rs = getResume(state.id);
      if (rs && rs.c < n.videos.length && (rs.c > 0 || rs.t > 3)) {
        loadClip(rs.c, false, rs.t);
        toast('⏯ 從上次停下的地方繼續' + (n.videos.length > 1 ? '（第 ' + (rs.c + 1) + ' 段）' : ''));
      } else loadClip(0, false);
    }
    else {
      /* 純文字項目：聽完朗讀，或停留閱讀一段時間（依字數，12～60 秒）後，才開放自我檢核 */
      var txt = n.script || n.corePoint || '';
      state.readSecs = Math.max(12, Math.min(60, Math.round(txt.length / 5)));
      var pp = Store.current();
      if (pp && !(pp.nodes[state.id] && pp.nodes[state.id].videoDone)) {
        var at = state.id;
        state.dwell = setTimeout(function () { if (state.id === at) markVideoDone(at); }, state.readSecs * 1000);
      }
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
      b.addEventListener('click', function () {
        /* 按「繼續」類的主要選項離開本項時，若自我檢核還沒勾完，先提醒（看分支說明則不攔） */
        var unchecked = o.primary && pendingTasks(n).some(function (t) { return t.el === 'checkCard'; });
        if (unchecked && remind('next', function () { goTo(o.target, true, true); })) return;
        goTo(o.target, true, true);
      });
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
    var watched = ORDER.filter(function (k) { return NODES[k].main && Store.isDone(p, k); }).length;
    var mains = ORDER.filter(function (k) { return NODES[k].main; }).length;
    var d = document.createElement('div');
    d.className = 'done-box card';
    d.innerHTML = '<div class="big">恭喜完成衛教</div><div>主要項目已完成 <b></b> / ' + mains + ' 項，累計觀看約 <b></b> 分鐘</div>' +
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
      if (s.extra && s.id !== 'intro') return; // 上方階段列：ERAS 簡介＋五個衛教階段（結語不列）；「我的學習進度」仍只計五個衛教階段
      var mains = ORDER.filter(function (k) { return NODES[k].stage === s.id && NODES[k].main; });
      var seen = mains.filter(function (k) { return Store.isDone(p, k); }).length;
      var el = document.createElement('div');
      el.className = 'stage' + (s.id === cur ? ' active' : '');
      el.innerHTML = '<div class="bar"><i></i></div><span></span>';
      el.querySelector('i').style.width = (mains.length ? seen / mains.length * 100 : 0) + '%';
      el.querySelector('span').textContent = (mains.length && seen === mains.length ? '✓ ' : '') + (s.short || s.name);
      el.title = '跳到「' + s.name + '」';
      /* 點階段 → 跳到該階段第一個還沒完成的項目（全部完成則到第一項） */
      el.setAttribute('role', 'button'); el.tabIndex = 0;
      var jump = function () {
        var target = mains.filter(function (k) { return !Store.isDone(Store.current(), k); })[0] || mains[0];
        if (target && target !== state.id) goTo(target, true, true);
      };
      el.addEventListener('click', jump);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); } });
      $('stages').appendChild(el);
    });
    renderProgress(p);
  }

  /* 我的學習進度：各階段完成數與尚待完成之項目（11/19 計畫書：病人端可查看已完成之階段及尚待確認之項目） */
  function renderProgress(p) {
    var box = $('progList'); if (!box) return;
    box.innerHTML = '';
    window.ERAS_EDU_STAGES.forEach(function (s, i) {
      var mains = ORDER.filter(function (k) { return NODES[k].stage === s.id && NODES[k].main; });
      var fin = mains.filter(function (k) { return Store.isDone(p, k); });
      var row = document.createElement('div'); row.className = 'prog-row' + (fin.length === mains.length ? ' done' : '');
      var h = document.createElement('div'); h.className = 'prog-h';
      h.innerHTML = '<b></b><span></span>';
      h.firstChild.textContent = '第' + '一二三四五'[i] + '階段　' + s.name;
      h.lastChild.textContent = fin.length === mains.length ? '✓ 已完成' : fin.length + ' / ' + mains.length;
      row.appendChild(h);
      /* 2026-11-28：列出全部項目，依狀態用不同顏色：已完成（綠✓）、已看未完成（橘…）、未看（灰○） */
      var ul = document.createElement('ul'); ul.className = 'prog-left prog-all';
      mains.forEach(function (k) {
        var seen = p.nodes && p.nodes[k] && p.nodes[k].views > 0, fin = Store.isDone(p, k);
        var stt = fin ? 'st-done' : (seen ? 'st-seen' : 'st-new');
        var li = document.createElement('li'); li.className = stt + (k === state.id ? ' cur' : '');
        li.innerHTML = '<i></i><span></span>';
        li.firstChild.textContent = fin ? '✓' : (seen ? '…' : '○');
        li.lastChild.textContent = NODES[k].title;
        li.title = fin ? '已完成' : (seen ? '已看過，自我檢核尚未完成' : '尚未觀看');
        li.addEventListener('click', function () { if (k !== state.id) goTo(k, true, true); });
        ul.appendChild(li);
      });
      row.appendChild(ul);
      box.appendChild(row);
    });
    if (!$('progLegend')) {
      var lg = document.createElement('div'); lg.id = 'progLegend'; lg.className = 'prog-legend';
      lg.innerHTML = '<span class="st-done"><i>✓</i>已完成</span><span class="st-seen"><i>…</i>已看、待打勾</span><span class="st-new"><i>○</i>尚未觀看</span>';
      box.parentNode.insertBefore(lg, box);
    }
  }

  /* ───────── 自我檢核全部打勾後：提示完成，並自動捲回「下一步」（或本段的選項）讓病人繼續 ───────── */
  function toast(msg) {
    var t = $('doneToast');
    if (!t) { t = document.createElement('div'); t.id = 'doneToast'; t.className = 'done-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  /* 自我檢核全部打勾 → 跳出視窗讓病人選擇：前往下一項／再看一次（尚有選項或工具未完成時，另提供「先點選下方」） */
  function afterItemDone(n) {
    var pending = pendingTasks(n).filter(function (t) { return t.el !== 'checkCard'; });
    var nextId = nextUnfinished(state.id);
    var ov = $('doneOverlay');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'doneOverlay'; ov.className = 'remind-ov hidden';
      ov.innerHTML = '<div class="remind-box done-box2" role="dialog"><div class="done-h">✓ 本項完成！</div><div class="done-sub"></div><div class="remind-btns"></div></div>';
      document.body.appendChild(ov);
    }
    /* 整個階段完成：恭喜並提醒可以分次學習 */
    var stageDone = false, stageName = '';
    var st = STAGES.filter(function (s) { return s.id === n.stage; })[0];
    if (st && n.main) {
      var p0 = Store.current();
      stageDone = ORDER.filter(function (k) { return NODES[k].stage === n.stage && NODES[k].main; }).every(function (k) { return Store.isDone(p0, k); });
      stageName = st.name;
    }
    /* 已設定「自動前往下一項」：沒有其他待辦、也不是剛完成整個階段時，直接倒數前往 */
    if (autoNextOn() && !pending.length && !stageDone && nextId && NODES[nextId]) { autoAdvance(nextId); return; }
    ov.querySelector('.done-h').textContent = stageDone ? '🎉「' + stageName + '」這一段完成了！' : '✓ 本項完成！';
    ov.querySelector('.done-sub').textContent = pending.length ? '還有一步：' + pending[0].text.replace(/^回答問題：/, '請回答下方問題 ')
      : stageDone ? '可以先休息一下；下次登入會自動從還沒看的地方接續。' : '您想要：';
    var btns = ov.querySelector('.remind-btns'); btns.innerHTML = '';
    function add(label, cls, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn-wide ' + (cls || ''); b.textContent = label; b.onclick = function () { ov.classList.add('hidden'); fn(); }; btns.appendChild(b); }
    if (pending.length) add('👇 先點選下方' + (pending[0].el === 'nodeOptions' ? '選項' : '內容'), '', function () {
      var el = $(pending[0].el); if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
    });
    if (nextId && NODES[nextId]) add((nextId === 'closing' ? '🎉 全部完成，前往結語' : '➡ 繼續下一項：' + NODES[nextId].title), pending.length ? 'btn-demo' : '', function () { goTo(nextId, true, true); });
    add('🔁 再看一次', 'btn-demo', replayCurrent);
    if (stageDone) add('☕ 先休息，下次再繼續', 'btn-demo', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    /* 選項：之後自動前往下一項，不再詢問（存在本機，隨時可在此取消） */
    if (!pending.length && nextId) {
      var lab = document.createElement('label'); lab.className = 'auto-next';
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = autoNextOn();
      cb.onchange = function () { try { localStorage.setItem('eras_autonext', cb.checked ? '1' : ''); } catch (e) {} };
      lab.appendChild(cb); lab.appendChild(document.createTextNode(' 之後完成就自動前往下一項，不再詢問'));
      btns.appendChild(lab);
    }
    ov.classList.remove('hidden');
  }
  function autoNextOn() { try { return localStorage.getItem('eras_autonext') === '1'; } catch (e) { return false; } }
  /* 自動前往：顯示 3 秒倒數提示，可按「取消」留在本頁 */
  function autoAdvance(nextId) {
    var from = state.id, left = 3;
    var t = $('doneToast');
    if (!t) { t = document.createElement('div'); t.id = 'doneToast'; t.className = 'done-toast'; document.body.appendChild(t); }
    t.innerHTML = ''; t.style.pointerEvents = 'auto';
    var msg = document.createElement('span'), cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'toast-cancel'; cancel.textContent = '取消';
    t.appendChild(msg); t.appendChild(cancel); t.classList.add('show');
    var timer = setInterval(function () {
      if (state.id !== from) { clearInterval(timer); t.classList.remove('show'); return; }
      if (left <= 0) { clearInterval(timer); t.classList.remove('show'); goTo(nextId, true, true); return; }
      msg.textContent = '✓ 本項完成！' + left + ' 秒後前往：' + NODES[nextId].title.split('：')[0] + ' ';
      left--;
    }, 1000);
    msg.textContent = '✓ 本項完成！3 秒後前往：' + NODES[nextId].title.split('：')[0] + ' ';
    cancel.onclick = function () { clearInterval(timer); t.classList.remove('show'); };
  }

  /* ───────── 提醒：影片下方還要點選的部分（2026-11-28） ───────── */
  function pendingTasks(n) {
    var p = Store.current() || { nodes: {} }, r = (p.nodes && p.nodes[state.id]) || {}, out = [];
    if (n.checklist && n.checklist.length && !r.done) {
      var left = n.checklist.filter(function (_, i) { return !(r.checks && r.checks[i]); }).length;
      if (left) out.push({ el: 'checkCard', text: '「我的理解自我檢核」還有 ' + left + ' 項要打勾' });
    }
    if (n.question && n.options && n.options.length) out.push({ el: 'nodeOptions', text: '回答問題：「' + n.question.replace(/[：:]\s*$/, '') + '」' });
    if (n.tool === 'fasting') out.push({ el: 'toolFasting', text: '用「禁食試算器」輸入手術時間，記下截止時間' });
    if (n.tool === 'ankle') out.push({ el: 'toolAnkle', text: '跟著「踝幫浦運動」計數器練習' });
    /* 出院滿意度問卷不列入提醒：術前衛教時病人尚未住院手術，問卷請於出院前再填（2026-11-28） */
    return out;
  }
  function remind(reason, onSkip) {
    var n = NODES[state.id], tasks = pendingTasks(n);
    if (!tasks.length) return false;
    var ov = $('remindOverlay');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'remindOverlay'; ov.className = 'remind-ov hidden';
      ov.innerHTML = '<div class="remind-box" role="dialog" aria-live="assertive"><div class="remind-h"></div><ul class="remind-list"></ul>' +
        '<div class="remind-btns"><button type="button" class="btn-wide" id="remindGo">👇 帶我去完成</button>' +
        '<button type="button" class="btn-wide btn-demo" id="remindReplay">🔁 再看一次</button>' +
        '<button type="button" class="btn-wide btn-demo" id="remindSkip"></button></div></div>';
      document.body.appendChild(ov);
    }
    ov.querySelector('.remind-h').textContent = reason === 'next' ? '📌 這一項還沒完成喔！請先完成：' : '📌 看完了！請繼續完成下方：';
    var ul = ov.querySelector('.remind-list'); ul.innerHTML = '';
    tasks.forEach(function (t) { var li = document.createElement('li'); li.textContent = t.text; ul.appendChild(li); });
    var skip = $('remindSkip');
    skip.textContent = reason === 'next' ? '先到下一項，稍後再回來' : '稍後再完成';
    $('remindReplay').onclick = function () { ov.classList.add('hidden'); replayCurrent(); };
    $('remindGo').onclick = function () {
      ov.classList.add('hidden');
      var el = $(tasks[0].el);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
    };
    skip.onclick = function () { ov.classList.add('hidden'); if (onSkip) onSkip(); };
    ov.classList.remove('hidden');
    return true;
  }

  function renderToc() {
    var p = Store.current() || { nodes: {} };
    var ul = $('toc'); ul.innerHTML = '';
    STAGES.forEach(function (s) {
      var h = document.createElement('li'); h.className = 'stg'; h.textContent = s.name; ul.appendChild(h);
      ORDER.filter(function (k) { return NODES[k].stage === s.id; }).forEach(function (k) {
        var li = document.createElement('li');
        li.className = (NODES[k].branch ? 'sub' : '') + (k === state.id ? ' cur' : '');
        var seen = p.nodes[k] && p.nodes[k].views > 0, fin = Store.isDone(p, k);
        li.innerHTML = '<span class="mk"></span><span></span>';
        li.firstChild.textContent = fin ? '✓' : (seen ? '…' : '');
        if (seen && !fin) { li.firstChild.classList.add('part'); li.title = '已觀看，尚未完成影片或自我檢核'; }
        li.lastChild.textContent = NODES[k].title;
        li.addEventListener('click', function () { if (k !== state.id) goTo(k, true, true); });
        ul.appendChild(li);
      });
    });
  }

  /* 影片看完（或沒有影片的項目進入即可）→ 才能勾選行動檢核表 → 全部勾選才算完成 */
  function hasVideo(n) { return !!(n.videos && n.videos.length); }
  function markVideoDone(id) {
    var p = Store.current(); if (!p) return;
    if (p.nodes[id] && p.nodes[id].videoDone) return;
    Store.setProgress(id, function (r) { r.videoDone = true; });
    if (id === state.id) { renderChecklist(NODES[id]); renderStages(); renderToc(); }
  }
  function renderChecklist(n) {
    var card = $('checkCard'), box = $('checklist'), st = $('checkStatus');
    var p = Store.current(), id = state.id;
    /* （2026-11-28 起純文字項目不再一進入就開放打勾，需聽完朗讀或閱讀一段時間，見 render 的 dwell 計時） */
    var r = (p && p.nodes[id]) || {};
    if (!n.checklist || !n.checklist.length) {
      card.classList.add('hidden');
      $('btnNext').classList.remove('pending'); $('btnNext').textContent = '下一步 →';
      return;
    }
    card.classList.remove('hidden');
    // 舊版勾選紀錄（另存的 key）併入
    if (!r.checks && p) {
      var old = null; try { old = JSON.parse(localStorage.getItem('eras_check_' + p.key + '_' + id)); } catch (e) {}
      if (old && old.length) { Store.setProgress(id, function (x) { x.checks = old; }); p = Store.current(); r = p.nodes[id]; }
    }
    var saved = (r.checks || []).slice();
    var open = !!r.videoDone;
    box.innerHTML = '';
    var tip = document.createElement('p'); tip.className = 'check-tip';
    var isText = !hasVideo(n) || video.classList.contains('hidden');
    tip.textContent = open ? '請想一想自己是否了解下列每一項（可以試著用自己的話說給家人聽），了解了再打勾。'
      : isText ? '請先按上方「▶ 朗讀」聽完，或自己慢慢讀完上方內容（約 ' + (state.readSecs || 20) + ' 秒），就可以打勾。'
      : '請先看完上方影片，看完就可以打勾。';
    if (!open) tip.textContent = '🔒 還不能打勾：' + tip.textContent;   /* 鎖住的原因放最上面、醒目 */
    tip.classList.toggle('locked-tip', !open);
    box.appendChild(tip);
    n.checklist.forEach(function (text, i) {
      var row = document.createElement('label'); row.className = 'check' + (open ? '' : ' locked');
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!saved[i]; cb.disabled = !open;
      cb.addEventListener('change', function () {
        var wasDone = Store.isDone(Store.current(), id);
        saved[i] = cb.checked;
        Store.setProgress(id, function (x) { x.checks = saved.slice(); });
        renderChecklist(n); renderStages(); renderToc();
        if (!wasDone && Store.isDone(Store.current(), id) && id === state.id) afterItemDone(n);
      });
      var sp = document.createElement('span'); sp.textContent = text;
      row.appendChild(cb); row.appendChild(sp); box.appendChild(row);
    });
    var left = n.checklist.filter(function (_, i) { return !saved[i]; }).length;
    /* 一次打勾：病人看過每一項後，可按「以上我都了解了」一次勾完（減少逐項點選的負擔） */
    if (open && !r.done && left > 1) {
      var all = document.createElement('button'); all.type = 'button'; all.className = 'btn-wide check-all';
      all.textContent = '✔ 以上 ' + n.checklist.length + ' 項我都了解了';
      all.addEventListener('click', function () {
        var wasDone = Store.isDone(Store.current(), id);
        Store.setProgress(id, function (x) { x.checks = n.checklist.map(function () { return true; }); });
        renderChecklist(n); renderStages(); renderToc();
        if (!wasDone && Store.isDone(Store.current(), id) && id === state.id) afterItemDone(n);
      });
      box.appendChild(all);
    }
    if (r.done) { st.textContent = '✓ 本項衛教已完成'; st.className = 'check-st ok'; }
    else if (!open) { st.textContent = isText ? '🔒 聽完朗讀或讀完內容後即可打勾' : '🔒 看完影片後即可打勾'; st.className = 'check-st locked-st'; }
    else { st.textContent = '還有 ' + left + ' 項未打勾，全部打勾才算完成本項'; st.className = 'check-st'; }
    /* 「下一步」在本項還沒完成時顯示為灰色並寫出原因，避免按了才被提醒 */
    var nb = $('btnNext');
    if (nb) { var pend = !r.done; nb.classList.toggle('pending', pend); nb.textContent = pend ? (open ? '先打勾，再按下一步 →' : '看完影片後，再按下一步 →') : '下一步 →'; }
    // 本頁自我檢核屬病人自評；teach-back 由 ERAS 個管師另行確認（團隊端理解查核表）
  }

  /* ───────── 影片 ───────── */
  var video = $('video');
  function loadClip(i, autoplay, startAt) {
    var n = NODES[state.id];
    state.clip = i;
    video.src = encodeURI(n.videos[i]);
    try { video.defaultPlaybackRate = video.playbackRate = state.rate < 1 ? 0.85 : 1; } catch (e) {}
    if (startAt > 0) video.addEventListener('loadedmetadata', function seek() { video.removeEventListener('loadedmetadata', seek); try { video.currentTime = Math.min(startAt, Math.max(0, video.duration - 1)); } catch (e) {} });
    track.lastVideoTime = null;
    $('clipLabel').textContent = n.videos.length > 1 ? '第 ' + (i + 1) + ' / ' + n.videos.length + ' 段' : '';
    var dots = $('clipDots'); dots.innerHTML = '';
    if (n.videos.length > 1) n.videos.forEach(function (_, k) {
      var s = document.createElement('span'); if (k <= i) s.className = 'on'; dots.appendChild(s);
    });
    $('btnPlay').textContent = '▶ 播放';
    if (autoplay) tryPlay();
  }
  /* 倒退 10 秒（漏聽一句時不必整段重看） */
  $('btnRewind').addEventListener('click', function () {
    if (video.classList.contains('hidden')) return;
    if (video.currentTime > 2) video.currentTime = Math.max(0, video.currentTime - 10);
    else if (state.clip > 0) loadClip(state.clip - 1, true, 9999);
    track.lastActivity = Date.now();
  });
  $('playHint').addEventListener('click', function () { this.classList.add('hidden'); tryPlay(); });
  video.addEventListener('playing', function () { $('playHint').classList.add('hidden'); });
  /* 每 2 秒記一次看到哪裡 */
  var lastResumeSave = 0;
  video.addEventListener('timeupdate', function () {
    if (Date.now() - lastResumeSave > 2000 && !video.paused) { lastResumeSave = Date.now(); setResume(state.id, state.clip, video.currentTime); }
  });
  $('btnRetry').addEventListener('click', function () {
    $('videoErr').classList.add('hidden'); $('voiceCard').classList.add('hidden'); $('btnRate').classList.add('hidden');
    video.classList.remove('hidden'); ttsStop(); state.speaking = false;
    loadClip(state.clip, true, video.currentTime || 0);
  });
  /* 已移除影片內建控制列（避免與下方大按鈕重複）：點影片畫面即可播放／暫停，下方細條顯示播放進度 */
  video.addEventListener('click', function () { if (video.paused) video.play().catch(function () {}); else video.pause(); });
  function vprog() { var b = $('vprogBar'); if (b) b.style.width = (video.duration ? Math.min(100, video.currentTime / video.duration * 100) : 0) + '%'; }
  video.addEventListener('timeupdate', vprog);
  video.addEventListener('loadedmetadata', vprog);
  video.addEventListener('emptied', vprog);
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
  video.addEventListener('play', function () {
    $('btnPlay').textContent = '❚❚ 暫停';
    // 影片觀看次數：從第一段開頭開始播放算一次，並記錄觀看日期（App 使用紀錄）
    if (state.clip === 0 && video.currentTime < 1) {
      var d = new Date(), day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      Store.setProgress(state.id, function (r) { r.plays = (r.plays || 0) + 1; r.playDates = r.playDates || []; if (r.playDates.indexOf(day) < 0) r.playDates.push(day); });
    }
  });
  video.addEventListener('ended', function () {
    var n = NODES[state.id];
    if (n.videos && state.clip < n.videos.length - 1) loadClip(state.clip + 1, true);
    else { clearResume(state.id); markVideoDone(state.id); setTimeout(onMediaEnd, 400); }
  });
  video.addEventListener('error', function () {
    // 影片載入失敗時改顯示文字與語音；提示另外顯示（不會被念出來），並可重新載入影片
    var n = NODES[state.id];
    if (!n || !n.videos || !n.videos.length) return;
    video.classList.add('hidden');
    $('playHint').classList.add('hidden');
    $('voiceCard').classList.remove('hidden');
    $('btnRate').classList.remove('hidden');
    $('videoErr').classList.remove('hidden');
    $('voiceText').textContent = n.script || n.corePoint || '';
    $('btnPlay').textContent = '▶ 朗讀';
    $('btnRewind').classList.add('hidden');
    /* 影片無法播放時，比照純文字項目：聽完朗讀或閱讀一段時間後開放打勾 */
    state.readSecs = Math.max(12, Math.min(60, Math.round(($('voiceText').textContent || '').length / 5)));
    clearTimeout(state.dwell);
    var at = state.id; state.dwell = setTimeout(function () { if (state.id === at) markVideoDone(at); }, state.readSecs * 1000);
    renderChecklist(n);
  });

  /* ───────── 語音 ───────── */
  /* 朗讀跟讀標示（2026-11-28）：正在念的字以深橘底白字標示，所在句子淡黃底，已念過的字轉灰，加深病人印象。
     瀏覽器有回報朗讀位置（onboundary）時依實際位置；沒有時依語速估算（標點處停頓較久）。 */
  var tts = { spans: [], timer: null, exact: false, last: -1 };
  function ttsRender(text) {
    var box = $('voiceText'); box.innerHTML = ''; tts.spans = [];
    for (var i = 0; i < text.length; i++) { var s = document.createElement('span'); s.textContent = text[i]; box.appendChild(s); tts.spans.push(s); }
    tts.last = -1; tts.exact = false;
  }
  function ttsMark(idx, len) {
    var sp = tts.spans; if (!sp.length || idx < 0 || idx >= sp.length) return;
    len = Math.max(1, len || 1);
    var stop = /[。！？；!?;\n]/;
    var a = idx; while (a > 0 && !stop.test(sp[a - 1].textContent)) a--;
    var b = idx; while (b < sp.length - 1 && !stop.test(sp[b].textContent)) b++;
    for (var i = 0; i < sp.length; i++) {
      sp[i].className = (i >= idx && i < idx + len) ? 'tts-now' : (i >= a && i <= b) ? 'tts-sent' : (i < idx ? 'tts-done' : '');
    }
    if (idx !== tts.last && sp[idx].scrollIntoView && idx % 12 === 0) { try { sp[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }
    tts.last = idx;
  }
  function ttsClear() {
    clearInterval(tts.timer); tts.timer = null;
    tts.spans.forEach(function (s) { s.className = ''; });
  }
  function ttsEstimate(text, rate, off) {
    off = off || 0;
    /* 估算：每字 1 單位，逗號頓號 2.5、句號問號 4；標準語速約每秒 4.2 單位 */
    var t = [], acc = 0;
    for (var i = 0; i < text.length; i++) { t.push(acc); var c = text[i]; acc += /[，、,：:]/.test(c) ? 2.5 : /[。！？；!?;]/.test(c) ? 4 : /\s/.test(c) ? 0.3 : 1; }
    var ups = 4.2 * rate, start = Date.now();
    clearInterval(tts.timer);
    tts.timer = setInterval(function () {
      if (tts.exact) { clearInterval(tts.timer); return; }
      var u = (Date.now() - start) / 1000 * ups, i = 0;
      while (i < t.length - 1 && t[i + 1] <= u) i++;
      ttsMark(off + i, 1);
    }, 120);
  }
  /* 朗讀（2026-11-28 改為逐句朗讀）：
     Chrome 的語音合成對「一次念很長的段落」可能約 15 秒後中斷或無聲，cancel() 後立刻 speak() 也可能被吞掉；
     因此把文字切成句子依序念，並在開始前稍等，跟讀標示依各句在全文中的位置繼續。 */
  var ttsSeq = 0;
  function ttsChunks(text) {
    var out = [], re = /[^。！？；!?\n]+[。！？；!?\n]*/g, m;
    while ((m = re.exec(text))) {
      var s = m[0], off = m.index;
      while (s.length > 70) {                       // 太長的句子再依逗號切開
        var cut = s.lastIndexOf('，', 70); if (cut < 20) cut = 70; else cut += 1;
        out.push({ text: s.slice(0, cut), off: off }); off += cut; s = s.slice(cut);
      }
      if (s.trim()) out.push({ text: s, off: off });
    }
    return out.length ? out : [{ text: text, off: 0 }];
  }
  function ttsStop() { ttsSeq++; if ('speechSynthesis' in window) speechSynthesis.cancel(); ttsClear(); }
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    ttsStop();
    ttsRender(text);
    var seq = ttsSeq, nodeAt = state.id, chunks = ttsChunks(text), idx = 0;
    function zhVoice() { return speechSynthesis.getVoices().filter(function (x) { return /zh[-_]TW/i.test(x.lang); })[0]; } // 語音清單可能稍後才載入，每句再找一次
    function finish() {
      ttsClear();
      state.speaking = false; $('btnPlay').textContent = '▶ 朗讀';
      if (video.classList.contains('hidden') && nodeAt === state.id) markVideoDone(nodeAt); // 影片無法播放時，聽完朗讀視同看完
      if (nodeAt === state.id) setTimeout(onMediaEnd, 400);                                  // 朗讀結束：完成→完成視窗；未完成→提醒
    }
    function next() {
      if (seq !== ttsSeq) return;                   // 已停止或換了項目
      if (idx >= chunks.length) { finish(); return; }
      var c = chunks[idx++];
      var u = new SpeechSynthesisUtterance(c.text);
      u.lang = 'zh-TW'; u.rate = state.rate * 0.9; var v = zhVoice(); if (v) u.voice = v;
      u.onstart = function () { if (seq === ttsSeq) ttsEstimate(c.text, state.rate * 0.9, c.off); };
      u.onboundary = function (e) {
        if (seq !== ttsSeq || typeof e.charIndex !== 'number') return;
        if (e.charIndex > 0) tts.exact = true;
        if (tts.exact) ttsMark(c.off + e.charIndex, e.charLength || 1);
      };
      u.onend = function () { if (seq === ttsSeq) next(); };
      u.onerror = function (e) {
        if (seq !== ttsSeq || (e && (e.error === 'interrupted' || e.error === 'canceled'))) return;
        next();                                     // 單句出錯就跳下一句，不讓整段卡住
      };
      speechSynthesis.speak(u);
    }
    state.speaking = true; $('btnPlay').textContent = '■ 停止';
    setTimeout(next, 150);
  }
  function stopMedia() {
    /* 離開前記下看到哪一段、哪一秒（影片已播完則不記） */
    try {
      if (state.id && NODES[state.id] && NODES[state.id].videos && !video.classList.contains('hidden') && video.currentSrc && !video.ended && (state.clip > 0 || video.currentTime > 3))
        setResume(state.id, state.clip, video.currentTime);
    } catch (e) {}
    try { video.pause(); } catch (e) {}
    ttsStop();
    state.speaking = false;
    stopAnkle();
  }
  $('btnPlay').addEventListener('click', function () {
    track.lastActivity = Date.now();
    if (!video.classList.contains('hidden')) {
      if (video.paused) video.play().catch(function () {}); else video.pause();
      return;
    }
    if (state.speaking) { ttsStop(); state.speaking = false; $('btnPlay').textContent = '▶ 朗讀'; }
    else speak($('voiceText').textContent);
  });
  $('btnRate').addEventListener('click', function () {
    state.rate = state.rate < 1 ? 1.0 : 0.85;
    this.textContent = state.rate < 1 ? '🐇 正常速度' : '🐢 放慢';
    try { video.playbackRate = state.rate; } catch (e) {}
    try { localStorage.setItem('eras_rate', String(state.rate)); } catch (e) {}
  });

  /* ───────── 大字體 ───────── */
  /* 按鈕文字顯示「按下去會變成什麼」：目前標準字 → 顯示「大字體」；目前大字 → 顯示「標準字體」 */
  function fontLabel() { $('btnFont').textContent = document.documentElement.classList.contains('large') ? '標準字體' : '大字體'; }
  $('btnFont').addEventListener('click', function () {
    document.documentElement.classList.toggle('large');
    try { localStorage.setItem('eras_large', document.documentElement.classList.contains('large') ? '1' : ''); } catch (e) {}
    fontLabel();
  $('btnRate').textContent = state.rate < 1 ? '🐇 正常速度' : '🐢 放慢';
  });
  /* 高齡友善：預設大字體；只有病人自己按過「標準字體」才用標準字 */
  try { var lg = localStorage.getItem('eras_large'); if (lg === null || lg) document.documentElement.classList.add('large'); } catch (e) { document.documentElement.classList.add('large'); }
  fontLabel();
  $('btnRate').textContent = state.rate < 1 ? '🐇 正常速度' : '🐢 放慢';

  /* ───────── 禁食試算 ───────── */
  function fmt(mins) {
    var prefix = '當日 ';
    if (mins === 0) return '前一日 24:00（午夜 12 點）';
    if (mins < 0) { mins += 1440; prefix = '前一日 '; }
    return prefix + String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  }
  /* 手術時間未確定：以最早可能的手術時間計算（ERAS_CONFIG.earliestSurgery，預設 08:00，待院內確認） */
  function calcFasting() {
    var unknown = !!document.querySelector('input[name=surgMode][value=unknown]:checked');
    var earliest = CFG.earliestSurgery || '08:00';
    $('surgKnown').classList.toggle('hidden', unknown);
    $('surgUnknown').classList.toggle('hidden', !unknown);
    $('earliestTxt').textContent = earliest;
    var v = ((unknown ? earliest : $('surgTime').value) || '08:00').split(':').map(Number);
    var t = v[0] * 60 + v[1];
    $('cutSolid').textContent = fmt(t - 480);
    $('cutLiquid').textContent = fmt(t - 120);
  }
  $('surgTime').addEventListener('change', calcFasting);
  document.querySelectorAll('input[name=surgMode]').forEach(function (r) { r.addEventListener('change', calcFasting); });

  /* ───────── 踝幫浦跟練 ───────── */
  /* 踝幫浦跟練（2026-11-28）：每秒一拍，勾腳尖 5 秒 → 壓腳背 5 秒 ＝ 1 下。
     語音數拍（勾腳尖、一、二…）＋提示音（換動作時音較高），畫面顯示大數字、5 個點與腳的動作。 */
  var ankle = { timer: null, step: 0, count: 0, target: 10, ac: null };
  var NUM = ['一', '二', '三', '四', '五'];
  function ankleSoundOn() { var c = $('ankleSound'); return !c || c.checked; }
  function beep(high) {
    if (!ankleSoundOn()) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ankle.ac = ankle.ac || new AC(); var ac = ankle.ac;
      var o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = high ? 880 : 600; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.18);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.2);
    } catch (e) {}
  }
  function sayBeat(text) {
    if (!ankleSoundOn() || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text); u.lang = 'zh-TW'; u.rate = 1.1;
    var v = speechSynthesis.getVoices().filter(function (x) { return /zh[-_]TW/i.test(x.lang); })[0]; if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  function ankleShow(phase, beat) {
    var foot = $('ankleFoot'), stage = $('ankleStage');
    foot.className = 'ankle-foot ' + (phase === 0 ? 'up' : 'down');
    stage.className = 'ankle-stage ' + (phase === 0 ? 'up' : 'down');
    $('ankleCue').textContent = phase === 0 ? '⬆ 腳尖用力往身體勾' : '⬇ 腳背往下壓';
    $('ankleBeat').textContent = beat;
    [].forEach.call($('ankleDots').children, function (d, i) { d.className = i < beat ? 'on' : ''; });
  }
  function stopAnkle(finished) {
    clearInterval(ankle.timer); ankle.timer = null;
    $('btnAnkle').textContent = finished ? '再做一組' : '開始跟練';
    $('ankleFoot').className = 'ankle-foot'; $('ankleStage').className = 'ankle-stage';
    $('ankleBeat').textContent = '';
    [].forEach.call($('ankleDots').children, function (d) { d.className = ''; });
    $('ankleCue').textContent = finished ? '🎉 做完 ' + ankle.target + ' 下了，很棒！每小時記得再做一組。' : '按下開始，跟著節拍一起做';
  }
  $('ankleTarget').addEventListener('change', function () { ankle.target = +this.value; $('ankleTotal').textContent = this.value; });
  $('btnAnkle').addEventListener('click', function () {
    if (ankle.timer) { stopAnkle(false); ttsStop(); return; }
    ankle.step = 0; ankle.count = 0; ankle.target = +$('ankleTarget').value;
    $('ankleCount').textContent = '0'; $('ankleTotal').textContent = ankle.target;
    this.textContent = '■ 停止';
    if (ankle.ac && ankle.ac.state === 'suspended') ankle.ac.resume();
    var tick = function () {
      var phase = Math.floor(ankle.step / 5) % 2, beat = (ankle.step % 5) + 1;
      ankleShow(phase, beat);
      if (beat === 1) { beep(true); sayBeat((phase === 0 ? '勾腳尖，' : '壓腳背，') + NUM[0]); }
      else { beep(false); sayBeat(NUM[beat - 1]); }
      track.lastActivity = Date.now();
      ankle.step += 1;
      if (ankle.step % 10 === 0) {
        ankle.count += 1; $('ankleCount').textContent = ankle.count;
        if (ankle.count >= ankle.target) {
          clearInterval(ankle.timer); ankle.timer = null;
          setTimeout(function () { stopAnkle(true); beep(true); sayBeat('做完了，很棒！'); }, 900);
        }
      }
    };
    tick();
    ankle.timer = setInterval(tick, 1000);
  });

  window.ERAS_APP = { currentNode: function () { return state.id; }, stopMedia: stopMedia };
  start();
})();
