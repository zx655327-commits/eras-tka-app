/* 安裝成手機 App（PWA）：註冊離線快取，並提供「安裝 App」按鈕。只在安裝版（有 manifest）啟用。 */
(function () {
  if (!document.querySelector('link[rel=manifest]')) return;
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (standalone || document.body.classList.contains('admin-root')) return;
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var deferred = null, buttons = [];

  function makeBtn(cls, text) {
    var b = document.createElement('button'); b.type = 'button'; b.className = cls + ' hidden'; b.textContent = text;
    b.addEventListener('click', install); buttons.push(b); return b;
  }
  var top = document.querySelector('.topbar-inner');
  if (top) top.insertBefore(makeBtn('tb-btn', '📲 安裝 App'), top.querySelector('.tb-btn'));
  var login = document.getElementById('loginForm');
  if (login) login.appendChild(makeBtn('btn-wide btn-demo', '📲 安裝到手機主畫面，下次直接開啟'));
  function show(on) { buttons.forEach(function (b) { b.classList.toggle('hidden', !on); }); }

  var tip = document.createElement('div');
  tip.className = 'overlay hidden'; tip.setAttribute('role', 'dialog');
  var isCriOS = /CriOS/.test(ua);
  var safariSteps = '<p class="sub" style="font-size:1em;line-height:1.8"><b>Safari</b>：點畫面下方的「分享」按鈕 <b>⬆︎</b> → 選「<b>加入主畫面</b>」→ 按「新增」</p>';
  var chromeSteps = '<p class="sub" style="font-size:1em;line-height:1.8"><b>Chrome</b>：點網址列右側的「分享」按鈕 <b>⬆︎</b> → 選「<b>加入主畫面</b>」→ 按「新增」</p>';
  tip.innerHTML = '<div class="login" style="text-align:center"><h1>加入主畫面</h1>' +
    (isCriOS ? chromeSteps + safariSteps : safariSteps + chromeSteps) +
    '<p class="sub">若選單中沒看到「加入主畫面」，請往下滑或按「編輯動作」找出來。</p>' +
    '<p class="sub">之後從手機桌面的「ERAS 膝衛教」圖示直接開啟。</p>' +
    '<button type="button" class="btn-wide">我知道了</button></div>';
  tip.querySelector('button').addEventListener('click', function () { tip.classList.add('hidden'); });
  document.body.appendChild(tip);

  function install() {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; show(false); });
    } else if (isIOS) tip.classList.remove('hidden');
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; show(true); });
  window.addEventListener('appinstalled', function () { deferred = null; show(false); });
  if (isIOS) show(true);
})();
