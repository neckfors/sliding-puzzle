(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  var bar = document.getElementById('upd'), btn = document.getElementById('updBtn'), ver = document.getElementById('ver');
  var reloading = false;

  function showUpdate(worker) {
    bar.hidden = false;
    btn.onclick = function () { worker.postMessage({ type: 'SKIP_WAITING' }); };
  }
  function showVersion(worker) {
    if (!worker || !ver) return;
    var ch = new MessageChannel();
    ch.port1.onmessage = function (e) { ver.textContent = 'v' + e.data; };
    worker.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
  }

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloading) return;
    reloading = true; location.reload();
  });

  navigator.serviceWorker.register('sw.js').then(function (reg) {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', function () {
        if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w);
      });
    });
    navigator.serviceWorker.ready.then(function (r) { showVersion(r.active); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () {}); });
    setInterval(function () { reg.update().catch(function () {}); }, 30 * 60 * 1000);
  }).catch(function () {});
})();
