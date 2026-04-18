// =============================================
// GPS Provider Adapter System
// รองรับหลาย GPS software (cmsv6, gpsone, ...)
// =============================================

// Load proxy URLs + enable flags from Supabase settings (via shared/settings.js)
// Call await gpsLoadProxyConfig(_supabase) before first gpsFetch() on GPS pages.
async function gpsLoadProxyConfig(supabaseClient) {
  if (typeof settingsBootstrap === 'function') {
    await settingsBootstrap(supabaseClient);
  }
}

// HTTPS Proxy — แก้ Mixed Content (HTTPS page → HTTP API)
// Fallback chain: Synology (path-rewrite) → Render (?url=) → GAS (?url=)
//
// Synology setup: path-rewrite mode. ตั้ง Reverse Proxy บน DSM ให้
//   https://staff.supwilai.com/cmsv6/<anything> → http://203.170.193.90/<anything>
// ดู docs/SYNOLOGY_PROXY_SETUP.html สำหรับ step-by-step
//
// Runtime config:
//   CONFIG.GPS_PROXY_SYNOLOGY (Supabase settings key: GPS_PROXY_SYNOLOGY) — primary
//   CONFIG.GPS_PROXY_URL      — Render fallback (hard-coded in config.js)
//   CONFIG.GPS_PROXY_FALLBACK — GAS fallback (hard-coded in config.js)

// Safari (iOS) aggressively caches GET responses that lack Cache-Control headers.
// DSM Reverse Proxy doesn't send cache headers by default → auto-refresh gets stale data.
// Fix: cache: 'no-store' + cache-bust query param (_t=timestamp) on every request.
async function gpsFetch(url) {
  // Prefer settings.js (admin-editable + per-proxy toggle); fallback to raw CONFIG for legacy callers
  var _get = (typeof settingsGet === 'function') ? settingsGet : function(k) {
    var alias = { GPS_PROXY_SYNOLOGY:'GPS_PROXY_SYNOLOGY', GPS_PROXY_RENDER:'GPS_PROXY_URL', GPS_PROXY_GAS:'GPS_PROXY_FALLBACK' };
    return (typeof CONFIG !== 'undefined' && CONFIG[alias[k] || k]) || '';
  };
  var _on = (typeof settingsEnabled === 'function') ? settingsEnabled : function() { return true; };

  var synoUrl   = _on('GPS_PROXY_SYNOLOGY_ENABLED') ? (_get('GPS_PROXY_SYNOLOGY') || '').trim() : '';
  var renderUrl = _on('GPS_PROXY_RENDER_ENABLED')   ? (_get('GPS_PROXY_RENDER')   || '').trim() : '';
  var gasUrl    = _on('GPS_PROXY_GAS_ENABLED')      ? (_get('GPS_PROXY_GAS')      || '').trim() : '';

  var noCacheOpts = {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
  };

  // HTTPS direct — no proxy needed
  if (!url.startsWith('http://')) {
    var r0 = await fetch(url, noCacheOpts);
    return await r0.json();
  }

  // ===== Tier 1: Synology Reverse Proxy (path-rewrite) =====
  if (synoUrl) {
    try {
      // strip scheme+host from original URL: http://203.170.193.90/a/b?c=1 → /a/b?c=1
      var pathAndQuery = url.replace(/^https?:\/\/[^\/]+/, '');
      // Cache-bust for iOS Safari (strips aggressive heuristic caching)
      pathAndQuery += (pathAndQuery.indexOf('?') >= 0 ? '&' : '?') + '_t=' + Date.now();
      var synoFinal = synoUrl.replace(/\/+$/, '') + pathAndQuery;
      var c1 = new AbortController();
      var t1 = setTimeout(function() { c1.abort(); }, 5000);
      var r1 = await fetch(synoFinal, {
        signal: c1.signal,
        credentials: 'omit',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      clearTimeout(t1);
      if (r1.ok) return await r1.json();
      console.warn('GPS Proxy: Synology returned HTTP ' + r1.status + ', falling back to Render');
    } catch(e1) {
      console.warn('GPS Proxy: Synology fail (' + (e1.message || e1) + '), falling back to Render');
    }
  }

  // ===== Tier 2: Render (query-param) =====
  if (renderUrl) {
    try {
      var c2 = new AbortController();
      var t2 = setTimeout(function() { c2.abort(); }, 5000);
      var rFinal = renderUrl.replace(/\/+$/, '') + '/?url=' + encodeURIComponent(url) + '&_t=' + Date.now();
      var r2 = await fetch(rFinal, Object.assign({ signal: c2.signal }, noCacheOpts));
      clearTimeout(t2);
      return await r2.json();
    } catch(e2) {
      console.warn('GPS Proxy: Render fail (' + (e2.message || e2) + '), falling back to GAS');
      if (gasUrl) {
        var gFinal = gasUrl + '?url=' + encodeURIComponent(url) + '&_t=' + Date.now();
        var r3 = await fetch(gFinal, noCacheOpts);
        return await r3.json();
      }
      throw e2;
    }
  }

  // ===== Tier 3: GAS only (if no Render configured) =====
  if (gasUrl) {
    var gFinal2 = gasUrl + '?url=' + encodeURIComponent(url) + '&_t=' + Date.now();
    var r4 = await fetch(gFinal2, noCacheOpts);
    return await r4.json();
  }

  // Last resort: direct (will fail on HTTPS page due to Mixed Content)
  var rDirect = await fetch(url);
  return await rDirect.json();
}

const GPS_ADAPTERS = {

  // ============ CMSV6 ============
  cmsv6: {
    async login(provider) {
      var url = provider.base_url.replace(/\/$/, '') +
        '/StandardApiAction_login.action?account=' +
        encodeURIComponent(provider.account) +
        '&password=' + encodeURIComponent(provider.password);
      var data = await gpsFetch(url);
      if (data.result === 0 && data.jsession) return data.jsession;
      throw new Error('CMSV6 login failed: ' + (data.error || 'Unknown'));
    },

    async getVehicles(provider, session) {
      var url = provider.base_url.replace(/\/$/, '') +
        '/StandardApiAction_queryUserVehicle.action?jsession=' + session;
      var data = await gpsFetch(url);
      var vehicles = [];
      (data.vehicles || []).forEach(function(v) {
        (v.dl || []).forEach(function(d) {
          vehicles.push({
            deviceId: String(d.id || d.did || ''),
            deviceName: v.nm || v.pnm || 'Unknown',
            sim: d.sim || ''
          });
        });
      });
      return vehicles;
    },

    async getStatus(provider, session, deviceId) {
      var url = provider.base_url.replace(/\/$/, '') +
        '/StandardApiAction_getDeviceStatus.action?jsession=' +
        session + '&toMap=1&geoaddress=1';
      var data = await gpsFetch(url);
      var all = data.status || [];
      if (deviceId) {
        all = all.filter(function(s) {
          return String(s.id || s.did) === String(deviceId);
        });
      }
      return all.map(function(s) {
        return {
          deviceId: String(s.id || s.did),
          lat: s.mlat || (s.lat ? s.lat / 1000000 : 0),
          lng: s.mlng || (s.lng ? s.lng / 1000000 : 0),
          speed: (s.sp || 0) / 10,
          online: s.ol === 1,
          address: s.ps || '',
          gpsTime: s.gt || '',
          satellites: s.sn || 0,
          mileage: s.lc ? s.lc / 1000 : 0
        };
      });
    },

    getCameraUrl(provider, deviceId) {
      var base = provider.base_url.replace(/\/$/, '');
      return base + '/808gps/open/player/video.html?lang=en' +
        '&devIdno=' + encodeURIComponent(deviceId) +
        '&account=' + encodeURIComponent(provider.account) +
        '&password=' + encodeURIComponent(provider.password) +
        '&channel=4&stream=1';
    },

    getHlsUrl(provider, deviceId) {
      var base = provider.base_url.replace(/\/$/, '').replace(/:\d+$/, '');
      return base + ':6604/hls/1_' + deviceId + '_0_1.m3u8' +
        '?account=' + encodeURIComponent(provider.account) +
        '&password=' + encodeURIComponent(provider.password);
    }
  },

  // ============ อนาคต: เพิ่ม adapter ใหม่ ============
  // gpsone: {
  //   async login(provider) { ... },
  //   async getVehicles(provider, session) { ... },
  //   async getStatus(provider, session, deviceId) { ... },
  //   getCameraUrl(provider, deviceId) { ... },
  // },

};

// ============ Helper Functions ============

/**
 * ดึง adapter ตาม software type
 * @param {string} software - "cmsv6", "gpsone", ...
 * @returns {object|null} adapter object
 */
function getGpsAdapter(software) {
  return GPS_ADAPTERS[software] || null;
}

/**
 * ดึง supported software list (สำหรับ dropdown ใน Admin)
 * @returns {Array} [{id, name}]
 */
function getGpsSoftwareList() {
  return [
    { id: 'cmsv6', name: 'CMSV6 (Shenzhen Hua Bao)' },
    // { id: 'gpsone', name: 'GPSOne' },
    // { id: 'teltonika', name: 'Teltonika' },
    // { id: 'concox', name: 'Concox / Jimi IoT' },
  ];
}

// ============ GPS Session Cache ============
// เก็บ session ของแต่ละ provider ไม่ต้อง login ทุกครั้ง

var _gpsSessions = {}; // { providerId: { session, loginAt } }

/**
 * Login หรือใช้ session เดิม (ถ้ายังไม่เก่าเกิน 30 นาที)
 */
async function gpsGetSession(provider) {
  var cached = _gpsSessions[provider.id];
  var now = Date.now();
  // ใช้ cache ถ้า login ไม่เกิน 30 นาที
  if (cached && (now - cached.loginAt) < 30 * 60 * 1000) {
    return cached.session;
  }
  var adapter = getGpsAdapter(provider.software);
  if (!adapter) throw new Error('No adapter for software: ' + provider.software);
  var session = await adapter.login(provider);
  _gpsSessions[provider.id] = { session: session, loginAt: now };
  return session;
}

/**
 * ดึง status จาก provider (ใช้ cached session)
 */
async function gpsGetStatus(provider, deviceId) {
  var adapter = getGpsAdapter(provider.software);
  if (!adapter) throw new Error('No adapter for software: ' + provider.software);
  var session = await gpsGetSession(provider);
  try {
    return await adapter.getStatus(provider, session, deviceId);
  } catch (e) {
    // session expired → login ใหม่แล้วลองอีกครั้ง
    delete _gpsSessions[provider.id];
    session = await gpsGetSession(provider);
    return await adapter.getStatus(provider, session, deviceId);
  }
}

/**
 * ดึง vehicles จาก provider
 */
async function gpsGetVehicles(provider) {
  var adapter = getGpsAdapter(provider.software);
  if (!adapter) throw new Error('No adapter for software: ' + provider.software);
  var session = await gpsGetSession(provider);
  return await adapter.getVehicles(provider, session);
}

/**
 * สร้าง camera URL
 */
function gpsGetCameraUrl(provider, deviceId) {
  var adapter = getGpsAdapter(provider.software);
  if (!adapter || !adapter.getCameraUrl) return null;
  return adapter.getCameraUrl(provider, deviceId);
}

/**
 * เปิดกล้อง (window.open — ต้องเรียกจาก user click)
 */
function gpsOpenCamera(provider, deviceId) {
  var url = gpsGetCameraUrl(provider, deviceId);
  if (url) {
    window.open(url, 'gps_camera_' + deviceId, 'width=1100,height=850,menubar=no,toolbar=no');
  }
}
