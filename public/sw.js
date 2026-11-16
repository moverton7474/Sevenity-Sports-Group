/**
 * Sevenity service worker: lets the site install to a phone or computer home
 * screen like an app. Pages always come from the network so the site never shows
 * stale prices; if the network is down, the cached home page is shown instead.
 */
var CACHE = 'sevenity-v1';

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.add('/'); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e){
  // Only page loads; forms (/api/lead) and files go straight to the network as usual.
  if (e.request.method !== 'GET' || e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function(){ return caches.match('/'); }));
});
