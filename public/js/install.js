/**
 * "Add Sevenity to your Home Screen" banner, on every page.
 *
 * - Android / Chrome / Edge: an Install button that opens the browser's install prompt.
 * - iPhone / iPad (Safari has no prompt to open): short steps, Share then
 *   "Add to Home Screen".
 * - Hidden when the site is already open as an installed app, and for 14 days
 *   after someone closes it.
 * Also registers /sw.js, which browsers need before they offer to install.
 */
(function(){
  "use strict";
  var KEY = 'svn-install-dismissed', WAIT_DAYS = 14, DELAY_MS = 3500;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function(){ navigator.serviceWorker.register('/sw.js').catch(function(){}); });
  }

  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  if (standalone) return;
  try {
    var t = parseInt(localStorage.getItem(KEY), 10);
    if (t && Date.now() - t < WAIT_DAYS * 864e5) return;
  } catch (e) {}

  var ua = navigator.userAgent || '';
  var ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var iosSafari = ios && !/CriOS|FxiOS|EdgiOS|GSA\//.test(ua);
  var deferred = null, shown = false;

  function addStyles(){
    var css = ''
      + '.svn-inst{position:fixed;left:50%;bottom:max(1rem,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:200;width:min(30rem,calc(100% - 2rem));box-sizing:border-box;'
      + 'display:flex;align-items:center;gap:.8rem;padding:.8rem .9rem;border-radius:14px;background:rgba(13,19,27,.96);border:1px solid #7db6e9;color:#fff;'
      + 'box-shadow:0 12px 32px rgba(0,0,0,.45);font:400 15px/1.4 "Libre Baskerville",Georgia,serif;text-shadow:none;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}'
      + '.svn-inst img{width:44px;height:44px;border-radius:10px;flex:none}'
      + '.svn-inst .tx{flex:1;min-width:0}'
      + '.svn-inst b{display:block;font-size:15px;margin-bottom:.1rem}'
      + '.svn-inst span{font-size:13px;color:#d9e1ee}'
      + '.svn-inst .go{flex:none;border:0;border-radius:999px;background:#fff;color:#161a22;font:600 14px "Libre Baskerville",Georgia,serif;padding:.55rem 1rem;cursor:pointer}'
      + '.svn-inst .x{flex:none;align-self:flex-start;border:0;background:none;color:#d9e1ee;font-size:22px;line-height:1;padding:0 .1rem;cursor:pointer}'
      + '.svn-share{display:inline-block;width:14px;height:16px;vertical-align:-2px;margin:0 2px}';
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }

  function close(remember){
    var el = document.querySelector('.svn-inst'); if (el) el.parentNode.removeChild(el);
    if (remember) { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} }
  }

  function show(){
    if (shown || !document.body) return; shown = true;
    addStyles();
    var el = document.createElement('div');
    el.className = 'svn-inst'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Add Sevenity to your home screen');
    var share = '<svg class="svn-share" viewBox="0 0 14 16" aria-hidden="true"><path d="M7 1v9M4 4l3-3 3 3" fill="none" stroke="#7db6e9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 7H2v8h10V7h-2" fill="none" stroke="#7db6e9" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    el.innerHTML = '<img src="/img/favicon-192.png" alt="">'
      + '<div class="tx"><b>Get the Sevenity app</b>'
      + (deferred ? '<span>Add Sevenity to your home screen for quick access.</span>'
                  : '<span>Tap ' + share + ' Share, then <b style="display:inline;font-size:13px">Add to Home Screen</b>.</span>')
      + '</div>'
      + (deferred ? '<button class="go" type="button">Install</button>' : '')
      + '<button class="x" type="button" aria-label="Close">&times;</button>';
    document.body.appendChild(el);
    el.querySelector('.x').addEventListener('click', function(){ close(true); });
    var go = el.querySelector('.go');
    if (go) go.addEventListener('click', function(){
      var p = deferred; deferred = null; close(false);
      p.prompt();
      p.userChoice.then(function(r){ if (r && r.outcome !== 'accepted') close(true); }).catch(function(){});
    });
  }

  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault(); deferred = e;
    setTimeout(show, DELAY_MS);
  });
  window.addEventListener('appinstalled', function(){ close(true); });
  if (iosSafari) setTimeout(show, DELAY_MS);
})();
