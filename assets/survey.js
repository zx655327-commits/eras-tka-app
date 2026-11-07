/*
 * 出院滿意度問卷（病人端填寫、ERAS 團隊端查看共用）
 *
 * 題目照院內現行「術後加速康復療程(ERAS)病人滿意度調查表」（ERAS滿意度問卷.docx，2026-11-01 提供），文字不改。
 * 網頁版的處理方式（原表未規定，屬網頁設定）：
 *   - 計分：非常滿意 5、滿意 4、普通 3、不滿意 2、非常不滿意 1。
 *   - 院區預設「高雄」、手術預設「關節置換手術」，病人可改。
 *   - 第 5 題（得知 ERAS 的來源）可複選。
 *   - 第 15 題答「有」才出現第 16 題。
 * 填寫後會自動在 ERAS 照護清單「出院當天 4.出院病人滿意度」記一筆「已執行：滿意度填寫」。
 */
(function () {
  var KEY = 'eras_survey_v2', CARE_KEY = 'eras_care_records_v1';
  var SCALE = ['非常滿意', '滿意', '普通', '不滿意', '非常不滿意']; // 顯示順序同原表
  var SCORE = { '非常滿意': 5, '滿意': 4, '普通': 3, '不滿意': 2, '非常不滿意': 1 };

  var TITLE = '術後加速康復療程(ERAS)病人滿意度調查表';
  var INTRO = '親愛的女士/先生您好\n感謝您選擇我們的醫療團隊為您提供術後加速康復療程(ERAS)，為了提高療程的品質，我們非常希望能得到您的意見，來幫助我們不斷改進。敬請您耐心填寫以下問卷\n敬祝您 健康平安　ERAS 醫療團隊 敬上';

  var BASIC = [
    { id: 'campus', no: 1, text: '請問您這次在哪一個院區做手術？', type: 'radio', def: '高雄',
      options: ['台北', '林口', '高雄', '基隆', '嘉義', '土城', '大里', '桃園', '雲林', '鳳山'] },
    { id: 'age', no: 2, text: '請問您的年齡', type: 'number', unit: '歲', min: 18, max: 110 },
    { id: 'edu', no: 3, text: '請問您的教育程度：', type: 'radio',
      options: ['研究所(含)以上', '大學', '專科', '高中職', '國中', '國小', '不識字'] },
    { id: 'surgery', no: 4, text: '請問您這次接受哪一項手術？', type: 'radio', def: '關節置換手術',
      options: ['胃癌手術', '食道癌手術', '婦癌手術', '頭頸癌手術', '心臟手術', '關節置換手術', '減重手術', '腰椎融合術', '大腸直腸手術'] },
    { id: 'source', no: 5, text: '請問您是從哪裡知道可以參加「術後加速康復療程(ERAS)」？（可複選）', type: 'check',
      options: ['醫師建議', '護理人員建議', '親友推薦', '衛福部網頁', '其他'], other: '其他' }
  ];

  var GROUPS = [
    { title: '(一)住院前/手術前', items: [
      { id: 'q1', no: 1, text: '在您確定要手術時，醫師在門診向您說明疾病治療(如：手術相關資訊)，您感到？' },
      { id: 'q2', no: 2, text: '麻醉醫師提供手術前ERAS麻醉照護相關資訊及說明，您感到？' },
      { id: 'q3', no: 3, text: '營養師提供的ERAS營養照護相關資訊及說明(如：術前營養評估及飲食衛教、術後營養指導)，您感到？' },
      { id: 'q4', no: 4, text: '物理治療師提供的ERAS復健相關資訊及說明(如：術前關節功能評估、居家體力訓練指導)，您感到？' },
      { id: 'q5', no: 5, text: '您到病房報到後，專科護理師或住院醫師提供的疾病相關資訊(如：詢問病史、手術部位標示、治療計畫的說明)，您感到？' },
      { id: 'q6', no: 6, text: '您到病房報到後，護理師提供的手術前的衛教(如：禁食、皮膚消毒使用)，您感到？' }
    ] },
    { title: '(二)手術時', items: [
      { id: 'q7', no: 7, text: '進入手術室後，護理師提供的照護(如：隱私維護、身體保暖)，您感到？' },
      { id: 'q8', no: 8, text: '手術時，麻醉醫師執行ERAS麻醉照護(如：精準麻醉、術後甦醒舒適度、神經阻斷術、預防噁心嘔吐)，您感到？' },
      { id: 'q9', no: 9, text: '手術後進入恢復室，恢復室護理師提供的照護，您感到？' }
    ] },
    { title: '(三)手術後', items: [
      { id: 'q10', no: 10, text: '手術後回到病室，護理師提供的術後衛教指導(如：傷口衛教、下床教導、肩枕使用、關節活動注意事項)，您感到？' },
      { id: 'q11', no: 11, text: '手術後，營養師提供的術後營養衛教，您感到？' },
      { id: 'q12', no: 12, text: '手術後，物理治療師提供的術後及居家復健指導，您感到？' },
      { id: 'q13', no: 13, text: '出院前，護理師提供的居家指導(如：傷口換藥、敷料使用、立即回診衛教)，您感到？' },
      { id: 'q14', no: 14, text: '在接受ERAS後，您對自身的康復進展情形感到？' }
    ] }
  ];
  var PRIOR = { id: 'prior', no: 15, text: '在這次手術之前，您是否曾經有在本院或其他醫院手術的經驗(若「有」，請您接著回答第16題)', options: ['有', '沒有'] };
  var COMPARE = { id: 'q16', no: 16, text: '(承上)相比上次手術的經驗，這次手術的過程與舒適度您感覺到？' };
  var COMMENT = { id: 'comment', no: 17, text: '您對我們的醫療團隊還有其他意見或建議嗎？(請在下方填寫您的建議)' };

  var LIKERT = [];
  GROUPS.forEach(function (g) { g.items.forEach(function (it) { LIKERT.push(it); }); });
  LIKERT.push(COMPARE);

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
  function pad(n) { return String(n).padStart(2, '0'); }
  function localNow() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  function markCare(mrn, simulated) {
    try {
      var all = JSON.parse(localStorage.getItem(CARE_KEY)) || [];
      all.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), mrn: mrn, role: 'patient', item: 'dc4',
        status: 'done', opts: ['滿意度填寫'], fields: {}, note: '病人於衛教網頁填寫',
        value: '已執行：滿意度填寫；說明：病人於衛教網頁填寫', execAt: localNow(), recordedAt: new Date().toISOString(), simulated: !!simulated });
      localStorage.setItem(CARE_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  window.ERAS_SURVEY = {
    TITLE: TITLE, SCALE: SCALE, SCORE: SCORE, BASIC: BASIC, GROUPS: GROUPS, PRIOR: PRIOR, COMPARE: COMPARE, COMMENT: COMMENT, LIKERT: LIKERT,
    SOURCE: '院內現行「術後加速康復療程(ERAS)病人滿意度調查表」',
    list: load,
    get: function (patientKey) { return load().filter(function (s) { return s.patientKey === patientKey; })[0] || null; },
    /* 每位病人（病歷號＋門診日期）保留一份，重新填寫會覆蓋並留下修改時間 */
    submit: function (p, a) {
      var list = load(), old = null;
      list = list.filter(function (s) { if (s.patientKey === p.key) { old = s; return false; } return true; });
      var rec = { patientKey: p.key, name: p.name, mrn: p.mrn, clinicDate: p.clinicDate, simulated: !!p.simulated,
        basic: a.basic, answers: a.answers, prior: a.prior, comment: a.comment,
        createdAt: old ? old.createdAt : new Date().toISOString(), updatedAt: old ? new Date().toISOString() : '' };
      list.push(rec);
      if (!save(list)) return null;
      if (!old) markCare(p.mrn, p.simulated);
      return rec;
    },
    removeSimulated: function () { save(load().filter(function (s) { return !s.simulated; })); },
    score: function (s, id) { return SCORE[s.answers[id]] || 0; },
    /* 第 1～14 題平均（第 16 題只有部分病人作答，不列入） */
    mean: function (s) {
      var v = LIKERT.filter(function (it) { return it.id !== 'q16'; }).map(function (it) { return SCORE[s.answers[it.id]]; }).filter(function (x) { return x; });
      return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : 0;
    },
    _save: save
  };

  /* ───────── 病人端畫面（只有病人頁有 #surveyCard 時執行） ───────── */
  if (!document.getElementById('surveyCard')) return;
  var Store = window.ERAS_STORE;
  var $ = function (id) { return document.getElementById(id); };
  function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function choice(type, name, value, label, checked) {
    var l = mk('label'); var r = mk('input'); r.type = type; r.name = name; r.value = value; if (checked) r.checked = true;
    l.appendChild(r); l.appendChild(document.createTextNode(' ' + label)); return l;
  }
  function likert(it) {
    var fs = mk('fieldset', 'sv-q'); fs.id = 'svq_' + it.id;
    fs.appendChild(mk('legend', '', it.no + '. ' + it.text));
    var row = mk('div', 'sv-scale');
    SCALE.forEach(function (s) {
      var l = mk('label'); var r = mk('input'); r.type = 'radio'; r.name = 'sv_' + it.id; r.value = s;
      l.appendChild(r); l.appendChild(mk('span', '', s)); row.appendChild(l);
    });
    fs.appendChild(row); return fs;
  }

  function build() {
    var f = $('svForm'); f.innerHTML = '';
    f.appendChild(mk('h2', 'sv-sec', '一、基本資料'));
    BASIC.forEach(function (b) {
      var fs = mk('fieldset', 'sv-q'); fs.id = 'svq_' + b.id;
      fs.appendChild(mk('legend', '', b.no + '. ' + b.text));
      var box = mk('div', 'sv-who');
      if (b.type === 'number') {
        var inp = mk('input'); inp.type = 'number'; inp.inputMode = 'numeric'; inp.min = b.min; inp.max = b.max; inp.id = 'sv_' + b.id; inp.className = 'sv-num';
        box.appendChild(inp); box.appendChild(mk('span', '', b.unit));
      } else {
        b.options.forEach(function (o) { box.appendChild(choice(b.type === 'check' ? 'checkbox' : 'radio', 'sv_' + b.id, o, o, o === b.def)); });
        if (b.other) {
          var oth = mk('input'); oth.type = 'text'; oth.id = 'sv_' + b.id + '_other'; oth.maxLength = 60; oth.placeholder = '請說明訊息來源'; oth.className = 'sv-other';
          box.appendChild(oth);
        }
      }
      fs.appendChild(box); f.appendChild(fs);
    });
    f.appendChild(mk('h2', 'sv-sec', '二、醫療服務'));
    GROUPS.forEach(function (g) {
      f.appendChild(mk('h3', 'sv-grp', g.title));
      g.items.forEach(function (it) { f.appendChild(likert(it)); });
    });
    var pf = mk('fieldset', 'sv-q'); pf.id = 'svq_prior';
    pf.appendChild(mk('legend', '', PRIOR.no + '. ' + PRIOR.text));
    var pb = mk('div', 'sv-who');
    PRIOR.options.forEach(function (o) { pb.appendChild(choice('radio', 'sv_prior', o, o)); });
    pf.appendChild(pb); f.appendChild(pf);
    var cmp = likert(COMPARE); cmp.classList.add('hidden'); f.appendChild(cmp);
    pf.addEventListener('change', syncPrior);
    var cm = mk('div', 'field');
    cm.appendChild(mk('label', '', COMMENT.no + '. ' + COMMENT.text)); cm.firstChild.htmlFor = 'svComment';
    var ta = mk('textarea'); ta.id = 'svComment'; ta.rows = 3; ta.maxLength = 500; cm.appendChild(ta);
    f.appendChild(cm);
  }
  function syncPrior() {
    var p = document.querySelector('input[name=sv_prior]:checked');
    $('svq_q16').classList.toggle('hidden', !(p && p.value === '有'));
  }
  function setRadio(name, v) { var r = document.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (r) r.checked = true; }

  function fill(rec) {
    if (!rec) return;
    BASIC.forEach(function (b) {
      var v = rec.basic[b.id];
      if (b.type === 'number') $('sv_' + b.id).value = v || '';
      else if (b.type === 'check') (v || []).forEach(function (x) { setRadio('sv_' + b.id, x); });
      else setRadio('sv_' + b.id, v);
    });
    if (rec.basic.sourceOther) $('sv_source_other').value = rec.basic.sourceOther;
    LIKERT.forEach(function (it) { if (rec.answers[it.id]) setRadio('sv_' + it.id, rec.answers[it.id]); });
    setRadio('sv_prior', rec.prior); syncPrior();
    $('svComment').value = rec.comment || '';
  }

  function renderCard() {
    var p = Store.current(), rec = p && window.ERAS_SURVEY.get(p.key);
    $('svStatus').textContent = rec ? '已填寫，謝謝您的回饋。' : '出院前請花幾分鐘填寫，幫助我們改善照護品質。';
    $('btnSurvey').textContent = rec ? '查看或修改我的回答' : '開始填寫';
    $('surveyCard').classList.toggle('sv-done', !!rec);
  }

  function open() {
    var p = Store.current(); if (!p) return;
    if (window.ERAS_APP && window.ERAS_APP.stopMedia) window.ERAS_APP.stopMedia();
    build(); fill(window.ERAS_SURVEY.get(p.key));
    $('svErr').textContent = '';
    $('svFormWrap').classList.remove('hidden'); $('svThanks').classList.add('hidden');
    $('svOverlay').classList.remove('hidden');
    $('svOverlay').querySelector('.ask-box').scrollTop = 0;
  }
  function close() { $('svOverlay').classList.add('hidden'); renderCard(); }

  $('svTitle').textContent = TITLE;
  $('svIntro').textContent = INTRO;
  $('svForm').addEventListener('change', function (e) { var fs = e.target.closest('.sv-q'); if (fs) fs.classList.remove('sv-miss'); });
  $('btnSurvey').addEventListener('click', open);
  $('svClose').addEventListener('click', close);
  $('svThanksClose').addEventListener('click', close);
  $('svOverlay').addEventListener('click', function (e) { if (e.target === this) close(); });

  $('svSubmit').addEventListener('click', function () {
    var p = Store.current(); if (!p) return;
    var basic = {}, answers = {}, bad = [];
    function mark(id, ok) { document.getElementById('svq_' + id).classList.toggle('sv-miss', !ok); if (!ok) bad.push(id); }
    BASIC.forEach(function (b) {
      if (b.type === 'number') {
        var v = $('sv_' + b.id).value.trim(), n = Number(v);
        var ok = v !== '' && n >= b.min && n <= b.max && Math.floor(n) === n;
        mark(b.id, ok); if (ok) basic[b.id] = n;
      } else if (b.type === 'check') {
        var vs = []; document.querySelectorAll('input[name=sv_' + b.id + ']:checked').forEach(function (c) { vs.push(c.value); });
        var other = $('sv_' + b.id + '_other').value.trim();
        var ok2 = vs.length > 0 && (vs.indexOf(b.other) < 0 || other);
        mark(b.id, ok2); basic[b.id] = vs; basic.sourceOther = vs.indexOf(b.other) >= 0 ? other : '';
      } else {
        var r = document.querySelector('input[name=sv_' + b.id + ']:checked');
        mark(b.id, !!r); if (r) basic[b.id] = r.value;
      }
    });
    var prior = document.querySelector('input[name=sv_prior]:checked');
    mark('prior', !!prior);
    LIKERT.forEach(function (it) {
      if (it.id === 'q16' && !(prior && prior.value === '有')) { document.getElementById('svq_q16').classList.remove('sv-miss'); return; }
      var r = document.querySelector('input[name=sv_' + it.id + ']:checked');
      mark(it.id, !!r); if (r) answers[it.id] = r.value;
    });
    if (bad.length) {
      $('svErr').textContent = '還有 ' + bad.length + ' 題沒有填寫（或填寫不完整），請看標示紅框的題目。';
      var first = document.querySelector('.sv-miss'); if (first) first.scrollIntoView({ block: 'center' });
      return;
    }
    var ok = window.ERAS_SURVEY.submit(p, { basic: basic, answers: answers, prior: prior.value, comment: $('svComment').value.trim() });
    if (!ok) { $('svErr').textContent = '儲存失敗，請稍後再試。'; return; }
    $('svFormWrap').classList.add('hidden'); $('svThanks').classList.remove('hidden');
  });

  window.ERAS_SURVEY.renderCard = renderCard;
  renderCard();
})();
