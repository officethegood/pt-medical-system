// =============================================
// GPS Provider Adapter System
// รองรับหลาย GPS software (cmsv6, gpsone, ...)
// =============================================

// HTTPS Proxy — แก้ Mixed Content (HTTPS page → HTTP API)
// ตั้งค่าใน CONFIG.GPS_PROXY_URL หรือปล่อยว่างถ้าไม่ต้องใช้
async function gpsFetch(url) {
  var proxyUrl = (typeof CONFIG !== 'undefined' && CONFIG.GPS_PROXY_URL) ? CONFIG.GPS_PROXY_URL : '';
  var fallbackUrl = (typeof CONFIG !== 'undefined' && CONFIG.GPS_PROXY_FALLBACK) ? CONFIG.GPS_PROXY_FALLBACK : '';

  if (proxyUrl && url.startsWith('http://')) {
    // ลอง Render ก่อน (timeout 5 วินาที) → ถ้าช้า/fail สลับ GAS
    try {
      var controller = new AbortController();
      var timer = setTimeout(function() { controller.abort(); }, 5000);
      var finalUrl = proxyUrl + '?url=' + encodeURIComponent(url);
      var resp = await fetch(finalUrl, { signal: controller.signal });
      clearTimeout(timer);
      return await resp.json();
    } catch(e) {
      // Render ช้า/fail → fallback GAS
      if (fallbackUrl) {
        console.warn('GPS Proxy: Render timeout, switching to GAS fallback');
        var finalUrl2 = fallbackUrl + '?url=' + encodeURIComponent(url);
        var resp2 = await fetch(finalUrl2);
        return await resp2.json();
      }
      throw e;
    }
  } else {
    // เรียกตรง (localhost / HTTP page)
    var resp = await fetch(url);
    return await resp.json();
  }
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
