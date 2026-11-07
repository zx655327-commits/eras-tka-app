/* ERAS 膝衛教 App：離線快取（自動產生，版本 189dc098） */
var CACHE = 'eras-tka-189dc098';
var SHELL = ["./", "index.html", "team.html", "manifest.webmanifest", "assets/admin.css", "assets/admin.js", "assets/app.css", "assets/app.js", "assets/ask.js", "assets/care_items.js", "assets/install.js", "assets/nodes.js", "assets/qadmin.js", "assets/questions.js", "assets/sadmin.js", "assets/store.js", "assets/survey.js", "assets/team.js", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png"];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('eras-tka-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;               // 外部資源（如 QR Code 程式庫）不攔截
  if (/\.mp4$/i.test(url.pathname)) return;                 // 影片直接連線播放（影片需網路）
  if (req.mode === 'navigate') {                            // 頁面：先連線取最新版，離線時用快取
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return res;
    }).catch(function () { return caches.match(req).then(function (r) { return r || caches.match('index.html'); }); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (r) {       // 其他檔案：先用快取，背景更新
    var net = fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return r; });
    return r || net;
  }));
});
