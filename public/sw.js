/**
 * Retired. The Add to Home Screen feature was removed; this file stays only so
 * browsers that registered the old service worker remove it and its cache.
 */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.registration.unregister(); }));
});
