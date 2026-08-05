// PT Medical System — Service Worker
var CACHE_NAME = 'pt-medical-v24';
var STATIC_ASSETS = [
  '/pt-medical-system/',
  '/pt-medical-system/index.html',
  '/pt-medical-system/admin.html',
  '/pt-medical-system/shared/styles.css',
  '/pt-medical-system/shared/auth.js',
  '/pt-medical-system/shared/config.js',
  '/pt-medical-system/shared/settings.js',
  '/pt-medical-system/shared/gps-providers.js',
  '/pt-medical-system/shared/realtime.js',
  '/pt-medical-system/assets/icon.svg',
  '/pt-medical-system/assets/icon-192.png',
  '/pt-medical-system/assets/icon-512.png',
  '/pt-medical-system/firstaid/index.html',
  '/pt-medical-system/transport/index.html',
  '/pt-medical-system/location/index.html',
  '/pt-medical-system/monitor/index.html',
  '/pt-medical-system/gps/index.html'
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

// Activate: clean old caches, then force-reload every open tab ONCE.
// เหตุผล: เครื่องภาคสนามหลายเครื่องติด SW รุ่นเก่า (cache-first) ที่เสิร์ฟโค้ดเก่า
// ค้างไว้ไม่ยอมปล่อย (อาการ: upload preset ว่าง 2026-07-24/25) — ผู้ใช้ทั่วไป
// ไม่รู้ว่าต้อง reload ซ้ำ จึงให้ SW ใหม่รีโหลดหน้าให้เองทันทีที่เข้าควบคุม
// (navigate ยิงครั้งเดียวตอน SW เวอร์ชันใหม่ activate — ไม่เกิด reload วนลูป)
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
             .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return self.clients.claim();
    }).then(function() {
      return self.clients.matchAll({ type: 'window' });
    }).then(function(clients) {
      clients.forEach(function(c) {
        if (c.navigate) c.navigate(c.url).catch(function() {});
      });
    })
  );
});

// Fetch: network-first for HTML + JS + API, cache-fallback for images/CSS
self.addEventListener('fetch', function(event) {
  // ห้าม intercept non-GET เด็ดขาด — iOS/WebKit มีบั๊กทำ body แบบ FormData/ไฟล์
  // หายตอน SW ส่งต่อ request (fetch(event.request)) → Cloudinary ได้ฟอร์มว่าง
  // "Upload preset must be specified" ทั้งที่ client ส่ง preset ครบ (เคสจริง
  // 2026-08-03: อัปรูป First Aid พังเฉพาะเครื่อง Apple ทุกเครื่อง) —
  // POST/PUT cache ไม่ได้อยู่แล้ว ปล่อยให้ browser ยิงตรงเอง
  if (event.request.method !== 'GET') return;

  var url = event.request.url;

  // Network-first for Supabase API, Cloudinary, GPS APIs, GAS proxy.
  // GPS providers MUST be here — otherwise the cache-first fallback below
  // serves stale telematics forever (a real bug we hit in v15: Cartrack
  // status frozen because cache-first kept returning the first response).
  if (url.indexOf('supabase.co') > -1 || url.indexOf('cloudinary') > -1 ||
      url.indexOf('googleapis.com') > -1 || url.indexOf('script.google.com') > -1 ||
      url.indexOf('203.170.193') > -1 ||              // supwilai 808gps server
      url.indexOf('cartrack.com') > -1 ||             // Cartrack Fleet API (any region)
      url.indexOf('karooooo.com') > -1) {             // Cartrack alt host (KE, SA regions)
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Network-first for HTML, JS AND CSS (always get latest code/styles)
  if (event.request.mode === 'navigate' || url.indexOf('.html') > -1 ||
      url.indexOf('.js') > -1 || url.indexOf('.css') > -1 || url.endsWith('/')) {
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

  // Cache-first for static assets only (CSS, images, fonts)
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
