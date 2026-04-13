// PT Medical System — Service Worker
var CACHE_NAME = 'pt-medical-v2';
var STATIC_ASSETS = [
  '/pt-medical-system/',
  '/pt-medical-system/index.html',
  '/pt-medical-system/shared/styles.css',
  '/pt-medical-system/shared/auth.js',
  '/pt-medical-system/shared/realtime.js',
  '/pt-medical-system/assets/icon.svg',
  '/pt-medical-system/assets/icon-192.png',
  '/pt-medical-system/assets/icon-512.png',
  '/pt-medical-system/firstaid/index.html',
  '/pt-medical-system/transport/index.html',
  '/pt-medical-system/location/index.html',
  '/pt-medical-system/monitor/index.html'
];

// Install: cache static assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
             .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for HTML + API, cache-fallback for assets
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Network-first for Supabase API and CDN resources
  if (url.indexOf('supabase.co') > -1 || url.indexOf('cloudinary') > -1) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Network-first for HTML pages (always get latest code)
  if (event.request.mode === 'navigate' || url.indexOf('.html') > -1 || url.endsWith('/')) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Cache-first for static assets (CSS, JS, images)
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response.ok && event.request.method === 'GET') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});
